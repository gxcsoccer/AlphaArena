/**
 * Strategy Portfolio DAO
 * 
 * Database access layer for strategy portfolio management.
 */

import { getSupabaseClient } from '../database/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  StrategyPortfolio,
  PortfolioStrategy,
  PortfolioStrategyWithDetails,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  PortfolioRebalance,
  PortfolioPerformanceSnapshot,
  Allocation,
  AllocationMethod,
  PortfolioStatus,
  RebalanceConfig,
  RebalanceReason,
  RebalanceExecutionStatus,
  SnapshotType,
  StrategyPerformance,
  PortfolioFilters,
  PerformanceHistoryQuery,
} from './types';

/**
 * Database row representation for strategy_portfolios
 */
interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  total_capital: string;
  allocation_method: string;
  rebalance_config: any;
  status: string;
  total_value: string | null;
  total_return: string | null;
  total_return_pct: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row representation for portfolio_strategies
 */
interface PortfolioStrategyRow {
  id: string;
  portfolio_id: string;
  strategy_id: string;
  weight: string;
  allocation: string;
  current_allocation: string | null;
  status: string;
  enabled: boolean;
  current_value: string | null;
  return_amount: string | null;
  return_pct: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row representation for portfolio_rebalances
 */
interface PortfolioRebalanceRow {
  id: string;
  portfolio_id: string;
  reason: string;
  allocations_before: any;
  allocations_after: any;
  trades: any;
  status: string;
  error_message: string | null;
  executed_at: string;
  completed_at: string | null;
}

/**
 * Database row representation for portfolio_performance_snapshots
 */
interface PerformanceSnapshotRow {
  id: string;
  portfolio_id: string;
  snapshot_at: string;
  snapshot_type: string;
  total_value: string;
  total_return: string;
  total_return_pct: string;
  strategy_performances: any;
  diversification_ratio: string | null;
  max_drawdown: string | null;
  sharpe_ratio: string | null;
  created_at: string;
}

/**
 * Strategy Portfolio DAO class
 */
export class StrategyPortfolioDAO {
  private supabase: SupabaseClient | any;

  constructor(client?: SupabaseClient | any) {
    this.supabase = client || getSupabaseClient();
  }
  // ==================== Portfolio CRUD ====================

  /**
   * Create a new strategy portfolio
   */
  async createPortfolio(
    userId: string,
    input: CreatePortfolioInput
  ): Promise<StrategyPortfolio> {
    const supabase = this.supabase;

    // Calculate allocations based on method
    const allocations = this.calculateAllocations(
      input.strategies.map(s => s.strategyId),
      input.totalCapital,
      input.allocationMethod,
      input.strategies.reduce((map, s) => {
        if (s.weight !== undefined) {
          map.set(s.strategyId, s.weight);
        }
        return map;
      }, new Map<string, number>())
    );

    const { data, error } = await supabase
      .from('strategy_portfolios')
      .insert([
        {
          user_id: userId,
          name: input.name,
          description: input.description || null,
          total_capital: input.totalCapital.toString(),
          allocation_method: input.allocationMethod,
          rebalance_config: {
            enabled: input.rebalanceConfig?.enabled ?? true,
            frequency: input.rebalanceConfig?.frequency ?? 'threshold',
            threshold: input.rebalanceConfig?.threshold ?? 5,
          },
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const portfolio = this.mapToPortfolio(data);

    // Create portfolio strategies
    const strategyRows = allocations.map(a => ({
      portfolio_id: portfolio.id,
      strategy_id: a.strategyId,
      weight: a.weight.toString(),
      allocation: a.allocation.toString(),
      current_allocation: a.allocation.toString(),
      status: 'running',
      enabled: true,
    }));

    const { error: strategyError } = await supabase
      .from('portfolio_strategies')
      .insert(strategyRows);

    if (strategyError) throw strategyError;

    // Fetch with strategies
    return this.getPortfolioById(portfolio.id) as Promise<StrategyPortfolio>;
  }

  /**
   * Get portfolio by ID
   */
  async getPortfolioById(id: string): Promise<StrategyPortfolio | null> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('strategy_portfolios')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const portfolio = this.mapToPortfolio(data);

    // Fetch strategies
    portfolio.strategies = await this.getPortfolioStrategies(id);

    return portfolio;
  }

  /**
   * Get portfolios for a user
   */
  async getPortfolios(userId: string, filters?: PortfolioFilters): Promise<StrategyPortfolio[]> {
    const supabase = this.supabase;

    let query = supabase
      .from('strategy_portfolios')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.allocationMethod) {
      query = query.eq('allocation_method', filters.allocationMethod);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    const portfolios = data.map(this.mapToPortfolio);

    // Fetch strategies for each portfolio
    for (const portfolio of portfolios) {
      portfolio.strategies = await this.getPortfolioStrategies(portfolio.id);
    }

    return portfolios;
  }

  /**
   * Update portfolio
   */
  async updatePortfolio(id: string, input: UpdatePortfolioInput): Promise<StrategyPortfolio> {
    const supabase = this.supabase;

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.totalCapital !== undefined) updateData.total_capital = input.totalCapital.toString();
    if (input.allocationMethod !== undefined) updateData.allocation_method = input.allocationMethod;
    if (input.rebalanceConfig !== undefined) {
      updateData.rebalance_config = input.rebalanceConfig;
    }
    if (input.status !== undefined) updateData.status = input.status;

    const { _data, error } = await supabase
      .from('strategy_portfolios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.getPortfolioById(id) as Promise<StrategyPortfolio>;
  }

  /**
   * Delete portfolio
   */
  async deletePortfolio(id: string): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase
      .from('strategy_portfolios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==================== Portfolio Strategies ====================

  /**
   * Get strategies for a portfolio
   */
  async getPortfolioStrategies(portfolioId: string): Promise<PortfolioStrategyWithDetails[]> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('portfolio_strategies')
      .select(`
        *,
        strategies (
          id,
          name,
          symbol,
          status
        )
      `)
      .eq('portfolio_id', portfolioId);

    if (error) throw error;

    return data.map((row: PortfolioStrategyRow & { strategies: any }) => {
      const strategy = row.strategies;
      return {
        ...this.mapToPortfolioStrategy(row),
        strategyName: strategy?.name,
        strategySymbol: strategy?.symbol,
        strategyStatus: strategy?.status,
      };
    });
  }

  /**
   * Add strategy to portfolio
   */
  async addStrategyToPortfolio(
    portfolioId: string,
    strategyId: string,
    weight: number,
    allocation: number
  ): Promise<PortfolioStrategy> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('portfolio_strategies')
      .insert([
        {
          portfolio_id: portfolioId,
          strategy_id: strategyId,
          weight: weight.toString(),
          allocation: allocation.toString(),
          current_allocation: allocation.toString(),
          status: 'running',
          enabled: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPortfolioStrategy(data);
  }

  /**
   * Update strategy in portfolio
   */
  async updatePortfolioStrategy(
    portfolioId: string,
    strategyId: string,
    updates: {
      weight?: number;
      allocation?: number;
      currentAllocation?: number;
      status?: 'running' | 'paused' | 'stopped';
      enabled?: boolean;
    }
  ): Promise<PortfolioStrategy> {
    const supabase = this.supabase;

    const updateData: any = {};
    if (updates.weight !== undefined) updateData.weight = updates.weight.toString();
    if (updates.allocation !== undefined) updateData.allocation = updates.allocation.toString();
    if (updates.currentAllocation !== undefined) {
      updateData.current_allocation = updates.currentAllocation.toString();
    }
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

    const { data, error } = await supabase
      .from('portfolio_strategies')
      .update(updateData)
      .eq('portfolio_id', portfolioId)
      .eq('strategy_id', strategyId)
      .select()
      .single();

    if (error) throw error;

    return this.mapToPortfolioStrategy(data);
  }

  /**
   * Remove strategy from portfolio
   */
  async removeStrategyFromPortfolio(portfolioId: string, strategyId: string): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase
      .from('portfolio_strategies')
      .delete()
      .eq('portfolio_id', portfolioId)
      .eq('strategy_id', strategyId);

    if (error) throw error;
  }

  /**
   * Update all strategy allocations in a portfolio
   */
  async updateStrategyAllocations(
    portfolioId: string,
    allocations: Allocation[]
  ): Promise<void> {
    const supabase = this.supabase;

    for (const alloc of allocations) {
      const { error } = await supabase
        .from('portfolio_strategies')
        .update({
          weight: alloc.weight.toString(),
          allocation: alloc.allocation.toString(),
        })
        .eq('portfolio_id', portfolioId)
        .eq('strategy_id', alloc.strategyId);

      if (error) throw error;
    }
  }

  // ==================== Rebalancing ====================

  /**
   * Create rebalance record
   */
  async createRebalance(
    portfolioId: string,
    reason: RebalanceReason,
    allocationsBefore: Allocation[],
    allocationsAfter: Allocation[]
  ): Promise<PortfolioRebalance> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('portfolio_rebalances')
      .insert([
        {
          portfolio_id: portfolioId,
          reason,
          allocations_before: allocationsBefore,
          allocations_after: allocationsAfter,
          trades: [],
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToRebalance(data);
  }

  /**
   * Get rebalances for a portfolio
   */
  async getRebalances(portfolioId: string, limit = 50): Promise<PortfolioRebalance[]> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('portfolio_rebalances')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToRebalance);
  }

  /**
   * Update rebalance status
   */
  async updateRebalanceStatus(
    id: string,
    status: RebalanceExecutionStatus,
    errorMessage?: string
  ): Promise<void> {
    const supabase = this.supabase;

    const updateData: any = {
      status,
      error_message: errorMessage || null,
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('portfolio_rebalances')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Update last rebalanced timestamp
   */
  async updateLastRebalanced(portfolioId: string): Promise<void> {
    const supabase = this.supabase;

    // Get current config
    const { data: portfolio, error: fetchError } = await supabase
      .from('strategy_portfolios')
      .select('rebalance_config')
      .eq('id', portfolioId)
      .single();

    if (fetchError) throw fetchError;

    const config = { ...portfolio.rebalance_config } as RebalanceConfig;
    config.lastRebalanced = new Date();

    const { error } = await supabase
      .from('strategy_portfolios')
      .update({ rebalance_config: config })
      .eq('id', portfolioId);

    if (error) throw error;
  }

  // ==================== Performance ====================

  /**
   * Create performance snapshot
   */
  async createPerformanceSnapshot(
    portfolioId: string,
    snapshotType: SnapshotType,
    performance: {
      totalValue: number;
      totalReturn: number;
      totalReturnPct: number;
      strategyPerformances: StrategyPerformance[];
      diversificationRatio?: number;
      maxDrawdown?: number;
      sharpeRatio?: number;
    }
  ): Promise<PortfolioPerformanceSnapshot> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('portfolio_performance_snapshots')
      .insert([
        {
          portfolio_id: portfolioId,
          snapshot_type: snapshotType,
          total_value: performance.totalValue.toString(),
          total_return: performance.totalReturn.toString(),
          total_return_pct: performance.totalReturnPct.toString(),
          strategy_performances: performance.strategyPerformances,
          diversification_ratio: performance.diversificationRatio?.toString() || null,
          max_drawdown: performance.maxDrawdown?.toString() || null,
          sharpe_ratio: performance.sharpeRatio?.toString() || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPerformanceSnapshot(data);
  }

  /**
   * Get performance history
   */
  async getPerformanceHistory(
    query: PerformanceHistoryQuery
  ): Promise<PortfolioPerformanceSnapshot[]> {
    const supabase = this.supabase;

    let dbQuery = supabase
      .from('portfolio_performance_snapshots')
      .select('*')
      .eq('portfolio_id', query.portfolioId);

    if (query.snapshotType) {
      dbQuery = dbQuery.eq('snapshot_type', query.snapshotType);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('snapshot_at', query.startDate.toISOString());
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('snapshot_at', query.endDate.toISOString());
    }

    dbQuery = dbQuery.order('snapshot_at', { ascending: false });

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;

    return data.map(this.mapToPerformanceSnapshot);
  }

  /**
   * Update portfolio performance cache
   */
  async updatePortfolioPerformance(
    portfolioId: string,
    performance: {
      totalValue: number;
      totalReturn: number;
      totalReturnPct: number;
    }
  ): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase
      .from('strategy_portfolios')
      .update({
        total_value: performance.totalValue.toString(),
        total_return: performance.totalReturn.toString(),
        total_return_pct: performance.totalReturnPct.toString(),
      })
      .eq('id', portfolioId);

    if (error) throw error;
  }

  // ==================== Allocation Helpers ====================

  /**
   * Calculate allocations based on method
   */
  private calculateAllocations(
    strategyIds: string[],
    totalCapital: number,
    method: AllocationMethod,
    customWeights?: Map<string, number>
  ): Allocation[] {
    switch (method) {
      case 'equal':
        return this.equalWeightAllocation(strategyIds, totalCapital);

      case 'custom':
        if (!customWeights || customWeights.size === 0) {
          return this.equalWeightAllocation(strategyIds, totalCapital);
        }
        return this.customAllocation(strategyIds, totalCapital, customWeights);

      case 'risk_parity':
        // Simplified risk parity - in real implementation, would need volatility data
        return this.equalWeightAllocation(strategyIds, totalCapital);

      default:
        return this.equalWeightAllocation(strategyIds, totalCapital);
    }
  }

  /**
   * Equal weight allocation
   */
  private equalWeightAllocation(
    strategyIds: string[],
    totalCapital: number
  ): Allocation[] {
    const weight = 1 / strategyIds.length;
    return strategyIds.map(id => ({
      strategyId: id,
      weight,
      allocation: totalCapital * weight,
    }));
  }

  /**
   * Custom weight allocation
   */
  private customAllocation(
    strategyIds: string[],
    totalCapital: number,
    customWeights: Map<string, number>
  ): Allocation[] {
    // Calculate total weight for normalization
    let totalWeight = 0;
    for (const id of strategyIds) {
      totalWeight += customWeights.get(id) || 0;
    }

    if (totalWeight === 0) {
      return this.equalWeightAllocation(strategyIds, totalCapital);
    }

    return strategyIds.map(id => {
      const rawWeight = customWeights.get(id) || 0;
      const normalizedWeight = rawWeight / totalWeight;
      return {
        strategyId: id,
        weight: normalizedWeight,
        allocation: totalCapital * normalizedWeight,
      };
    });
  }

  // ==================== Mappers ====================

  private mapToPortfolio(row: PortfolioRow): StrategyPortfolio {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      totalCapital: parseFloat(row.total_capital),
      allocationMethod: row.allocation_method as AllocationMethod,
      rebalanceConfig: row.rebalance_config as RebalanceConfig,
      status: row.status as PortfolioStatus,
      totalValue: row.total_value ? parseFloat(row.total_value) : undefined,
      totalReturn: row.total_return ? parseFloat(row.total_return) : undefined,
      totalReturnPct: row.total_return_pct ? parseFloat(row.total_return_pct) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToPortfolioStrategy(row: PortfolioStrategyRow): PortfolioStrategy {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      strategyId: row.strategy_id,
      weight: parseFloat(row.weight),
      allocation: parseFloat(row.allocation),
      currentAllocation: row.current_allocation ? parseFloat(row.current_allocation) : 0,
      status: row.status as 'running' | 'paused' | 'stopped',
      enabled: row.enabled,
      currentValue: row.current_value ? parseFloat(row.current_value) : undefined,
      returnAmount: row.return_amount ? parseFloat(row.return_amount) : undefined,
      returnPct: row.return_pct ? parseFloat(row.return_pct) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToRebalance(row: PortfolioRebalanceRow): PortfolioRebalance {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      reason: row.reason as RebalanceReason,
      allocationsBefore: row.allocations_before as Allocation[],
      allocationsAfter: row.allocations_after as Allocation[],
      trades: row.trades || [],
      status: row.status as RebalanceExecutionStatus,
      errorMessage: row.error_message || undefined,
      executedAt: new Date(row.executed_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }

  private mapToPerformanceSnapshot(row: PerformanceSnapshotRow): PortfolioPerformanceSnapshot {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      snapshotAt: new Date(row.snapshot_at),
      snapshotType: row.snapshot_type as SnapshotType,
      totalValue: parseFloat(row.total_value),
      totalReturn: parseFloat(row.total_return),
      totalReturnPct: parseFloat(row.total_return_pct),
      strategyPerformances: row.strategy_performances as StrategyPerformance[],
      diversificationRatio: row.diversification_ratio
        ? parseFloat(row.diversification_ratio)
        : undefined,
      maxDrawdown: row.max_drawdown ? parseFloat(row.max_drawdown) : undefined,
      sharpeRatio: row.sharpe_ratio ? parseFloat(row.sharpe_ratio) : undefined,
    } as PortfolioPerformanceSnapshot;
  }
}

// Singleton instance
export const strategyPortfolioDAO = new StrategyPortfolioDAO();