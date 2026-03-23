/**
 * Batch Query Optimizer - 批量查询优化器
 * 
 * Solves N+1 query problems by:
 * - Batching multiple queries into single database calls
 * - Using JOINs instead of separate queries
 * - Preloading related data
 */

import { getSupabaseClient } from '../../database/client';
import { createLogger } from '../logger';

const log = createLogger('BatchQueryOptimizer');

/**
 * Batch query optimizer class
 */
export class BatchQueryOptimizer {
  /**
   * Get trades for multiple strategies in a single query
   * This solves the N+1 problem when calculating leaderboard metrics
   */
  static async getTradesByStrategyIds(
    strategyIds: string[],
    options: { limit?: number } = {}
  ): Promise<Map<string, any[]>> {
    if (strategyIds.length === 0) {
      return new Map();
    }

    const supabase = getSupabaseClient();
    const tradesMap = new Map<string, any[]>();

    // Initialize all strategies with empty arrays
    for (const id of strategyIds) {
      tradesMap.set(id, []);
    }

    // Single query with filter for all strategies
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .in('strategy_id', strategyIds)
      .order('executed_at', { ascending: false })
      .limit(options.limit || 10000);

    if (error) {
      log.error(`Batch query failed: ${error.message}`);
      throw error;
    }

    // Group trades by strategy_id
    for (const trade of data || []) {
      const strategyId = trade.strategy_id;
      if (strategyId && tradesMap.has(strategyId)) {
        tradesMap.get(strategyId)!.push(trade);
      }
    }

    log.debug(`Batch fetched trades for ${strategyIds.length} strategies, total trades: ${data?.length || 0}`);
    return tradesMap;
  }

  /**
   * Get strategy stats for multiple strategies in a single query
   */
  static async getStrategyStatsBatch(
    strategyIds: string[]
  ): Promise<Map<string, {
    totalTrades: number;
    totalVolume: number;
    buyCount: number;
    sellCount: number;
  }>> {
    if (strategyIds.length === 0) {
      return new Map();
    }

    const supabase = getSupabaseClient();
    const statsMap = new Map<string, any>();

    // Initialize all strategies with zero stats
    for (const id of strategyIds) {
      statsMap.set(id, {
        totalTrades: 0,
        totalVolume: 0,
        buyCount: 0,
        sellCount: 0,
      });
    }

    // Single aggregated query using Supabase RPC or raw SQL
    // For now, we'll use a single select with grouping
    const { data, error } = await supabase
      .from('trades')
      .select('strategy_id, side, total')
      .in('strategy_id', strategyIds);

    if (error) {
      log.error(`Batch stats query failed: ${error.message}`);
      throw error;
    }

    // Aggregate stats per strategy
    for (const row of data || []) {
      const stats = statsMap.get(row.strategy_id);
      if (stats) {
        stats.totalTrades++;
        stats.totalVolume += parseFloat(row.total || '0');
        if (row.side === 'buy') stats.buyCount++;
        else if (row.side === 'sell') stats.sellCount++;
      }
    }

    return statsMap;
  }

  /**
   * Get user data for multiple users in a single query
   */
  static async getUsersBatch(
    userIds: string[]
  ): Promise<Map<string, any>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const supabase = getSupabaseClient();
    const usersMap = new Map<string, any>();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds);

    if (error) {
      log.error(`Batch users query failed: ${error.message}`);
      throw error;
    }

    for (const user of data || []) {
      usersMap.set(user.id, user);
    }

    return usersMap;
  }

  /**
   * Get portfolio snapshots for multiple strategies
   */
  static async getPortfoliosBatch(
    strategyIds: string[]
  ): Promise<Map<string, any>> {
    if (strategyIds.length === 0) {
      return new Map();
    }

    const supabase = getSupabaseClient();
    const portfoliosMap = new Map<string, any>();

    // Get latest portfolio for each strategy
    // Using a subquery approach
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .in('strategy_id', strategyIds)
      .order('created_at', { ascending: false });

    if (error) {
      log.error(`Batch portfolios query failed: ${error.message}`);
      throw error;
    }

    // Keep only the latest portfolio per strategy
    const seenStrategies = new Set<string>();
    for (const portfolio of data || []) {
      const strategyId = portfolio.strategy_id;
      if (strategyId && !seenStrategies.has(strategyId)) {
        portfoliosMap.set(strategyId, portfolio);
        seenStrategies.add(strategyId);
      }
    }

    return portfoliosMap;
  }

  /**
   * Prefetch related data for a list of entities
   * Generic method to preload related data in batches
   */
  static async prefetchRelated(
    items: Record<string, any>[],
    relationKey: string,
    fetcher: (ids: string[]) => Promise<Map<string, any>>,
    batchSize: number = 50
  ): Promise<Map<string, any>> {
    // Extract unique IDs (assuming relationKey points to string values)
    const allIds = items
      .map(item => item[relationKey])
      .filter(id => typeof id === 'string' && id !== null) as string[];
    
    const ids = [...new Set(allIds)];

    const result = new Map<string, any>();

    // Fetch in batches to avoid query size limits
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchResults = await fetcher(batch);
      
      for (const [key, value] of batchResults) {
        result.set(key, value);
      }
    }

    return result;
  }
}

/**
 * Decorator for caching query results
 */
export function CachedQuery(namespace: string, keyGenerator: (...args: any[]) => string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const { cacheService } = await import('./CacheService');
      const cacheKey = keyGenerator(...args);
      
      return cacheService.getOrSet(
        namespace,
        cacheKey,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

export default BatchQueryOptimizer;