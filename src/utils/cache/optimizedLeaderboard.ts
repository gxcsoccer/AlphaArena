/**
 * Optimized Leaderboard Service - 优化的排行榜服务
 * 
 * Improvements:
 * - Batch queries to solve N+1 problem
 * - Caching for frequently accessed data
 * - Parallel data fetching
 * - Reduced database calls
 */

import { EventEmitter } from 'events';
import { getSupabaseClient } from '../../database/client';
import { cacheService, CacheNamespaces, CacheTTL } from './CacheService';
import { createLogger } from '../logger';

const log = createLogger('OptimizedLeaderboardService');

/**
 * Strategy performance metrics
 */
export interface StrategyMetrics {
  strategyId: string;
  strategyName: string;
  status: string;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  calculatedAt: Date;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  status: string;
  metrics: StrategyMetrics;
  rankChange: number;
}

/**
 * Sort criterion
 */
export type SortCriterion = 
  | 'roi'
  | 'sharpeRatio'
  | 'maxDrawdown'
  | 'totalPnL'
  | 'winRate'
  | 'totalVolume';

/**
 * Optimized Leaderboard Service
 */
export class OptimizedLeaderboardService extends EventEmitter {
  private currentRankings: Map<string, LeaderboardEntry> = new Map();
  private previousRankings: Map<string, number> = new Map();
  private isCalculating: boolean = false;
  private lastCalculation?: Date;

  /**
   * Calculate leaderboard with optimized queries
   */
  async calculateLeaderboard(
    sortBy: SortCriterion = 'roi'
  ): Promise<LeaderboardEntry[]> {
    // Check cache first
    const cacheKey = `leaderboard:${sortBy}`;
    const cached = await cacheService.get<LeaderboardEntry[]>(
      CacheNamespaces.LEADERBOARD,
      cacheKey
    );

    if (cached) {
      log.debug('Returning cached leaderboard');
      this.currentRankings = new Map(cached.map(e => [e.strategyId, e]));
      return cached;
    }

    if (this.isCalculating) {
      log.debug('Calculation in progress, returning current rankings');
      return this.getCurrentLeaderboard();
    }

    this.isCalculating = true;

    try {
      const supabase = getSupabaseClient();

      // Store previous rankings
      this.previousRankings = new Map();
      this.currentRankings.forEach((entry, strategyId) => {
        this.previousRankings.set(strategyId, entry.rank);
      });

      // OPTIMIZATION: Single query to get all strategies
      const { data: strategies, error: strategiesError } = await supabase
        .from('strategies')
        .select('id, name, status, symbol, config, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (strategiesError) throw strategiesError;
      if (!strategies || strategies.length === 0) {
        return [];
      }

      const strategyIds = strategies.map(s => s.id);

      // OPTIMIZATION: Batch fetch all trades in a single query
      log.debug(`Fetching trades for ${strategyIds.length} strategies in batch`);
      const startTime = Date.now();
      
      const { data: allTrades, error: tradesError } = await supabase
        .from('trades')
        .select('strategy_id, symbol, side, price, quantity, total, fee, order_id, trade_id, executed_at, created_at')
        .in('strategy_id', strategyIds)
        .order('executed_at', { ascending: false })
        .limit(50000); // Limit total trades to fetch

      if (tradesError) throw tradesError;

      log.debug(`Fetched ${allTrades?.length || 0} trades in ${Date.now() - startTime}ms`);

      // Group trades by strategy_id in memory
      const tradesByStrategy = new Map<string, any[]>();
      for (const id of strategyIds) {
        tradesByStrategy.set(id, []);
      }

      for (const trade of allTrades || []) {
        const trades = tradesByStrategy.get(trade.strategy_id);
        if (trades) {
          trades.push(trade);
        }
      }

      // Calculate metrics for each strategy (in parallel)
      const entries: LeaderboardEntry[] = [];
      
      // Process in batches for memory efficiency
      const BATCH_SIZE = 20;
      for (let i = 0; i < strategies.length; i += BATCH_SIZE) {
        const batch = strategies.slice(i, i + BATCH_SIZE);
        
        const batchMetrics = await Promise.all(
          batch.map(strategy => 
            this.calculateStrategyMetricsOptimized(
              strategy,
              tradesByStrategy.get(strategy.id) || []
            )
          )
        );

        for (const metrics of batchMetrics) {
          if (metrics) {
            entries.push({
              rank: 0,
              strategyId: metrics.strategyId,
              strategyName: metrics.strategyName,
              status: metrics.status,
              metrics,
              rankChange: 0,
            });
          }
        }
      }

      // Sort by criterion
      entries.sort((a, b) => this.compareByCriterion(a, b, sortBy));

      // Assign ranks and calculate rank changes
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
        const previousRank = this.previousRankings.get(entry.strategyId);
        entry.rankChange = previousRank ? previousRank - entry.rank : 0;
        this.currentRankings.set(entry.strategyId, entry);
      });

      this.lastCalculation = new Date();

      // Cache the result
      await cacheService.set(
        CacheNamespaces.LEADERBOARD,
        cacheKey,
        entries,
        CacheTTL.LEADERBOARD
      );

      this.emit('leaderboard:updated', entries);
      log.info(`Leaderboard calculated: ${entries.length} strategies, ${allTrades?.length || 0} trades`);

      return entries;
    } catch (error: any) {
      log.error(`Error calculating leaderboard: ${error.message}`);
      throw error;
    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * Calculate metrics for a single strategy with pre-fetched trades
   */
  private calculateStrategyMetricsOptimized(
    strategy: any,
    trades: any[]
  ): StrategyMetrics | null {
    if (!strategy) return null;

    if (trades.length === 0) {
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: strategy.status,
        totalTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
        roi: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        avgTradeSize: 0,
        profitableTrades: 0,
        losingTrades: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        bestTrade: 0,
        worstTrade: 0,
        calculatedAt: new Date(),
      };
    }

    // Calculate metrics from trades
    const buys = trades.filter(t => t.side === 'buy');
    const sells = trades.filter(t => t.side === 'sell');
    
    const totalCost = buys.reduce((sum, t) => sum + parseFloat(t.total || '0'), 0);
    const totalProceeds = sells.reduce((sum, t) => sum + parseFloat(t.total || '0'), 0);
    const totalPnL = totalProceeds - totalCost;
    const totalVolume = trades.reduce((sum, t) => sum + parseFloat(t.total || '0'), 0);
    const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

    // Calculate trade-level P&L
    const tradePnLs: number[] = [];
    let profitableTrades = 0;
    let losingTrades = 0;
    let bestTrade = -Infinity;
    let worstTrade = Infinity;

    for (const sell of sells) {
      const correspondingBuy = buys.find(b => 
        b.order_id && sell.order_id && 
        b.order_id.slice(0, 8) === sell.order_id.slice(0, 8)
      ) || buys[0];
      
      if (correspondingBuy) {
        const tradePnL = parseFloat(sell.total || '0') - parseFloat(correspondingBuy.total || '0');
        tradePnLs.push(tradePnL);
        
        if (tradePnL > 0) profitableTrades++;
        else losingTrades++;
        
        bestTrade = Math.max(bestTrade, tradePnL);
        worstTrade = Math.min(worstTrade, tradePnL);
      }
    }

    const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0;
    const sharpeRatio = this.calculateSharpeRatio(tradePnLs);
    const maxDrawdown = this.calculateMaxDrawdown(tradePnLs);
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutive(tradePnLs);

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: strategy.status,
      totalTrades: trades.length,
      totalVolume,
      totalPnL,
      roi,
      winRate,
      sharpeRatio,
      maxDrawdown,
      avgTradeSize,
      profitableTrades,
      losingTrades,
      consecutiveWins,
      consecutiveLosses,
      bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
      worstTrade: worstTrade === Infinity ? 0 : worstTrade,
      calculatedAt: new Date(),
    };
  }

  /**
   * Compare entries by sort criterion
   */
  private compareByCriterion(a: LeaderboardEntry, b: LeaderboardEntry, sortBy: SortCriterion): number {
    switch (sortBy) {
      case 'roi':
        return b.metrics.roi - a.metrics.roi;
      case 'sharpeRatio':
        return b.metrics.sharpeRatio - a.metrics.sharpeRatio;
      case 'maxDrawdown':
        return a.metrics.maxDrawdown - b.metrics.maxDrawdown;
      case 'totalPnL':
        return b.metrics.totalPnL - a.metrics.totalPnL;
      case 'winRate':
        return b.metrics.winRate - a.metrics.winRate;
      case 'totalVolume':
        return b.metrics.totalVolume - a.metrics.totalVolume;
      default:
        return b.metrics.roi - a.metrics.roi;
    }
  }

  /**
   * Calculate Sharpe Ratio
   */
  private calculateSharpeRatio(tradePnLs: number[]): number {
    if (tradePnLs.length < 2) return 0;

    const avg = tradePnLs.reduce((sum, pnl) => sum + pnl, 0) / tradePnLs.length;
    const variance = tradePnLs.reduce((sum, pnl) => sum + Math.pow(pnl - avg, 2), 0) / tradePnLs.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (avg / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Maximum Drawdown
   */
  private calculateMaxDrawdown(tradePnLs: number[]): number {
    if (tradePnLs.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const pnl of tradePnLs) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = (peak - cumulative) / (peak || 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown * 100;
  }

  /**
   * Calculate consecutive wins and losses
   */
  private calculateConsecutive(tradePnLs: number[]): { consecutiveWins: number; consecutiveLosses: number } {
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const pnl of tradePnLs) {
      if (pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > consecutiveWins) consecutiveWins = currentWins;
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > consecutiveLosses) consecutiveLosses = currentLosses;
      }
    }

    return { consecutiveWins, consecutiveLosses };
  }

  /**
   * Get current leaderboard from cache
   */
  getCurrentLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.currentRankings.values()).sort((a, b) => a.rank - b.rank);
  }

  /**
   * Get strategy rank
   */
  getStrategyRank(strategyId: string): LeaderboardEntry | null {
    return this.currentRankings.get(strategyId) || null;
  }

  /**
   * Get last calculation time
   */
  getLastCalculation(): Date | undefined {
    return this.lastCalculation;
  }

  /**
   * Create leaderboard snapshot
   */
  async createSnapshot(): Promise<{
    timestamp: Date;
    entries: LeaderboardEntry[];
    totalStrategies: number;
    totalTrades: number;
    totalVolume: number;
  }> {
    const entries = this.getCurrentLeaderboard();
    
    return {
      timestamp: new Date(),
      entries,
      totalStrategies: entries.length,
      totalTrades: entries.reduce((sum, e) => sum + e.metrics.totalTrades, 0),
      totalVolume: entries.reduce((sum, e) => sum + e.metrics.totalVolume, 0),
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await cacheService.deleteNamespace(CacheNamespaces.LEADERBOARD);
    this.currentRankings.clear();
    this.previousRankings.clear();
    this.lastCalculation = undefined;
    log.info('Leaderboard cache cleared');
  }
}

// Export singleton instance
export const optimizedLeaderboardService = new OptimizedLeaderboardService();
export default optimizedLeaderboardService;