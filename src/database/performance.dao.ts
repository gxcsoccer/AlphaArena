/**
 * Performance Analytics DAO
 *
 * Database operations for strategy performance snapshots and daily account values
 *
 * @module database/performance.dao
 */

import { getSupabaseClient } from './client';
import {
  StrategyPerformanceSnapshot,
  DailyAccountValue,
} from '../analytics/types';

/**
 * Performance Analytics DAO
 */
export class PerformanceDAO {
  /**
   * Create a strategy performance snapshot
   */
  async createPerformanceSnapshot(
    snapshot: Omit<StrategyPerformanceSnapshot, 'id' | 'createdAt'>
  ): Promise<StrategyPerformanceSnapshot> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_performance')
      .insert([
        {
          strategy_id: snapshot.strategyId,
          user_id: snapshot.userId || null,
          period_start: snapshot.periodStart.toISOString(),
          period_end: snapshot.periodEnd.toISOString(),
          total_return: snapshot.totalReturn.toString(),
          annualized_return: snapshot.annualizedReturn.toString(),
          sharpe_ratio: snapshot.sharpeRatio.toString(),
          max_drawdown: snapshot.maxDrawdown.toString(),
          win_rate: snapshot.winRate.toString(),
          profit_factor: snapshot.profitFactor.toString(),
          total_trades: snapshot.totalTrades,
          additional_metrics: snapshot.additionalMetrics || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPerformanceSnapshot(data);
  }

  /**
   * Get performance snapshot by ID
   */
  async getPerformanceSnapshotById(id: string): Promise<StrategyPerformanceSnapshot | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_performance')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToPerformanceSnapshot(data);
  }

  /**
   * Get performance snapshots for a strategy
   */
  async getPerformanceSnapshotsByStrategy(
    strategyId: string,
    limit: number = 30
  ): Promise<StrategyPerformanceSnapshot[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_performance')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('period_end', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToPerformanceSnapshot);
  }

  /**
   * Get latest performance snapshot for a strategy
   */
  async getLatestPerformanceSnapshot(strategyId: string): Promise<StrategyPerformanceSnapshot | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_performance')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToPerformanceSnapshot(data);
  }

  /**
   * Delete performance snapshot
   */
  async deletePerformanceSnapshot(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('strategy_performance')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Create daily account value record
   */
  async createDailyAccountValue(
    value: Omit<DailyAccountValue, 'id' | 'createdAt'>
  ): Promise<DailyAccountValue> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('daily_account_values')
      .insert([
        {
          account_id: value.accountId,
          date: value.date.toISOString().split('T')[0],
          cash: value.cash.toString(),
          positions_value: value.positionsValue.toString(),
          total_value: value.totalValue.toString(),
          daily_return: value.dailyReturn.toString(),
          cumulative_return: value.cumulativeReturn.toString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToDailyAccountValue(data);
  }

  /**
   * Batch create daily account values
   */
  async batchCreateDailyAccountValues(
    values: Array<Omit<DailyAccountValue, 'id' | 'createdAt'>>
  ): Promise<DailyAccountValue[]> {
    const supabase = getSupabaseClient();

    const rows = values.map((v) => ({
      account_id: v.accountId,
      date: v.date.toISOString().split('T')[0],
      cash: v.cash.toString(),
      positions_value: v.positionsValue.toString(),
      total_value: v.totalValue.toString(),
      daily_return: v.dailyReturn.toString(),
      cumulative_return: v.cumulativeReturn.toString(),
    }));

    const { data, error } = await supabase
      .from('daily_account_values')
      .insert(rows)
      .select();

    if (error) throw error;

    return data.map(this.mapToDailyAccountValue);
  }

  /**
   * Get daily account values for an account
   */
  async getDailyAccountValues(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DailyAccountValue[]> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('daily_account_values')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate.toISOString().split('T')[0]);
    }

    if (endDate) {
      query = query.lte('date', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToDailyAccountValue);
  }

  /**
   * Get latest daily account value for an account
   */
  async getLatestDailyAccountValue(accountId: string): Promise<DailyAccountValue | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('daily_account_values')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToDailyAccountValue(data);
  }

  /**
   * Delete daily account values before a date
   */
  async deleteDailyAccountValuesBefore(accountId: string, beforeDate: Date): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('daily_account_values')
      .delete()
      .eq('account_id', accountId)
      .lt('date', beforeDate.toISOString().split('T')[0])
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Get performance summary for multiple strategies
   */
  async getPerformanceSummary(
    strategyIds: string[]
  ): Promise<Map<string, StrategyPerformanceSnapshot>> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_performance')
      .select('*')
      .in('strategy_id', strategyIds)
      .order('period_end', { ascending: false });

    if (error) throw error;

    // Get the latest snapshot for each strategy
    const summary = new Map<string, StrategyPerformanceSnapshot>();
    for (const row of data) {
      const snapshot = this.mapToPerformanceSnapshot(row);
      if (!summary.has(snapshot.strategyId)) {
        summary.set(snapshot.strategyId, snapshot);
      }
    }

    return summary;
  }

  // ============== Mapping Methods ==============

  private mapToPerformanceSnapshot(row: any): StrategyPerformanceSnapshot {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      userId: row.user_id,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      totalReturn: parseFloat(row.total_return),
      annualizedReturn: parseFloat(row.annualized_return),
      sharpeRatio: parseFloat(row.sharpe_ratio),
      maxDrawdown: parseFloat(row.max_drawdown),
      winRate: parseFloat(row.win_rate),
      profitFactor: parseFloat(row.profit_factor),
      totalTrades: row.total_trades,
      additionalMetrics: row.additional_metrics,
      createdAt: new Date(row.created_at),
    };
  }

  private mapToDailyAccountValue(row: any): DailyAccountValue {
    return {
      id: row.id,
      accountId: row.account_id,
      date: new Date(row.date),
      cash: parseFloat(row.cash),
      positionsValue: parseFloat(row.positions_value),
      totalValue: parseFloat(row.total_value),
      dailyReturn: parseFloat(row.daily_return),
      cumulativeReturn: parseFloat(row.cumulative_return),
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const performanceDAO = new PerformanceDAO();

export default PerformanceDAO;