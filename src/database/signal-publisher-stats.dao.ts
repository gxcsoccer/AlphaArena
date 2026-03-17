/**
 * Signal Publisher Stats DAO
 * Data access layer for signal publisher statistics
 */

import { getSupabaseClient } from './client';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface PublisherStats {
  id: string;
  publisherId: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  totalSignals: number;
  activeSignals: number;
  expiredSignals: number;
  executedSignals: number;
  cancelledSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: number;
  avgPnlPercent: number;
  totalPnl: number;
  totalViews: number;
  totalExecutions: number;
  subscriberCount: number;
  createdAt: Date;
}

export interface CreateStatsInput {
  publisherId: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
}

export interface UpdateStatsInput {
  totalSignals?: number;
  activeSignals?: number;
  expiredSignals?: number;
  executedSignals?: number;
  cancelledSignals?: number;
  winningSignals?: number;
  losingSignals?: number;
  winRate?: number;
  avgPnlPercent?: number;
  totalPnl?: number;
  totalViews?: number;
  totalExecutions?: number;
  subscriberCount?: number;
}

export interface StatsFilters {
  publisherId?: string;
  periodType?: PeriodType;
  periodStart?: Date;
  periodEnd?: Date;
  limit?: number;
}

export class SignalPublisherStatsDAO {
  async create(input: CreateStatsInput): Promise<PublisherStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_publisher_stats')
      .insert({
        publisher_id: input.publisherId,
        period_type: input.periodType,
        period_start: input.periodStart.toISOString().split('T')[0],
        period_end: input.periodEnd.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToStats(data);
  }

  async getById(id: string): Promise<PublisherStats | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_publisher_stats')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToStats(data);
  }

  async getMany(filters: StatsFilters = {}): Promise<PublisherStats[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('signal_publisher_stats').select('*');

    if (filters.publisherId) {
      query = query.eq('publisher_id', filters.publisherId);
    }
    if (filters.periodType) {
      query = query.eq('period_type', filters.periodType);
    }
    if (filters.periodStart) {
      query = query.gte('period_start', filters.periodStart.toISOString().split('T')[0]);
    }
    if (filters.periodEnd) {
      query = query.lte('period_end', filters.periodEnd.toISOString().split('T')[0]);
    }

    query = query.order('period_start', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToStats);
  }

  async update(id: string, input: UpdateStatsInput): Promise<PublisherStats> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {};

    if (input.totalSignals !== undefined) updateData.total_signals = input.totalSignals;
    if (input.activeSignals !== undefined) updateData.active_signals = input.activeSignals;
    if (input.expiredSignals !== undefined) updateData.expired_signals = input.expiredSignals;
    if (input.executedSignals !== undefined) updateData.executed_signals = input.executedSignals;
    if (input.cancelledSignals !== undefined) updateData.cancelled_signals = input.cancelledSignals;
    if (input.winningSignals !== undefined) updateData.winning_signals = input.winningSignals;
    if (input.losingSignals !== undefined) updateData.losing_signals = input.losingSignals;
    if (input.winRate !== undefined) updateData.win_rate = input.winRate;
    if (input.avgPnlPercent !== undefined) updateData.avg_pnl_percent = input.avgPnlPercent;
    if (input.totalPnl !== undefined) updateData.total_pnl = input.totalPnl;
    if (input.totalViews !== undefined) updateData.total_views = input.totalViews;
    if (input.totalExecutions !== undefined) updateData.total_executions = input.totalExecutions;
    if (input.subscriberCount !== undefined) updateData.subscriber_count = input.subscriberCount;

    const { data, error } = await supabase
      .from('signal_publisher_stats')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToStats(data);
  }

  async upsert(input: CreateStatsInput & UpdateStatsInput): Promise<PublisherStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_publisher_stats')
      .upsert({
        publisher_id: input.publisherId,
        period_type: input.periodType,
        period_start: input.periodStart.toISOString().split('T')[0],
        period_end: input.periodEnd.toISOString().split('T')[0],
        total_signals: input.totalSignals || 0,
        active_signals: input.activeSignals || 0,
        expired_signals: input.expiredSignals || 0,
        executed_signals: input.executedSignals || 0,
        cancelled_signals: input.cancelledSignals || 0,
        winning_signals: input.winningSignals || 0,
        losing_signals: input.losingSignals || 0,
        win_rate: input.winRate || 0,
        avg_pnl_percent: input.avgPnlPercent || 0,
        total_pnl: input.totalPnl || 0,
        total_views: input.totalViews || 0,
        total_executions: input.totalExecutions || 0,
        subscriber_count: input.subscriberCount || 0,
      }, {
        onConflict: 'publisher_id,period_type,period_start',
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToStats(data);
  }

  async getAllTimeStats(publisherId: string): Promise<PublisherStats | null> {
    const stats = await this.getMany({
      publisherId,
      periodType: 'all_time',
      limit: 1,
    });

    return stats[0] || null;
  }

  async getRecentStats(
    publisherId: string,
    periodType: PeriodType,
    limit: number = 30
  ): Promise<PublisherStats[]> {
    return this.getMany({
      publisherId,
      periodType,
      limit,
    });
  }

  async getLeaderboard(
    periodType: PeriodType = 'monthly',
    limit: number = 10
  ): Promise<PublisherStats[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_publisher_stats')
      .select('*')
      .eq('period_type', periodType)
      .order('win_rate', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToStats);
  }

  private mapToStats(row: Record<string, unknown>): PublisherStats {
    return {
      id: row.id as string,
      publisherId: row.publisher_id as string,
      periodType: row.period_type as PeriodType,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      totalSignals: row.total_signals as number,
      activeSignals: row.active_signals as number,
      expiredSignals: row.expired_signals as number,
      executedSignals: row.executed_signals as number,
      cancelledSignals: row.cancelled_signals as number,
      winningSignals: row.winning_signals as number,
      losingSignals: row.losing_signals as number,
      winRate: row.win_rate as number,
      avgPnlPercent: row.avg_pnl_percent as number,
      totalPnl: row.total_pnl as number,
      totalViews: row.total_views as number,
      totalExecutions: row.total_executions as number,
      subscriberCount: row.subscriber_count as number,
      createdAt: new Date(row.created_at as string),
    };
  }
}
