import { getSupabaseClient } from './client';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface FollowerStatsRecord {
  id: string;
  followerId: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: number;
  totalPnl: number;
  totalFees: number;
  roiPct: number;
  leaderPnl: number;
  leaderRoiPct: number;
  correlation?: number;
  createdAt: Date;
}

export interface CreateFollowerStatsInput {
  followerId: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: number;
  totalPnl: number;
  totalFees: number;
  roiPct: number;
  leaderPnl: number;
  leaderRoiPct: number;
  correlation?: number;
}

export interface FollowerStatsFilters {
  followerId?: string;
  periodType?: PeriodType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class FollowerStatsDAO {
  async upsert(input: CreateFollowerStatsInput): Promise<FollowerStatsRecord> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('follower_stats')
      .upsert(
        {
          follower_id: input.followerId,
          period_type: input.periodType,
          period_start: input.periodStart.toISOString().split('T')[0],
          period_end: input.periodEnd.toISOString().split('T')[0],
          total_trades: input.totalTrades,
          winning_trades: input.winningTrades,
          losing_trades: input.losingTrades,
          total_volume: input.totalVolume.toString(),
          total_pnl: input.totalPnl.toString(),
          total_fees: input.totalFees.toString(),
          roi_pct: input.roiPct,
          leader_pnl: input.leaderPnl.toString(),
          leader_roi_pct: input.leaderRoiPct,
          correlation: input.correlation || null,
        },
        {
          onConflict: 'follower_id,period_type,period_start',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return this.mapToFollowerStats(data);
  }

  async getById(id: string): Promise<FollowerStatsRecord | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('follower_stats')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToFollowerStats(data);
  }

  async getMany(filters: FollowerStatsFilters = {}): Promise<FollowerStatsRecord[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('follower_stats').select('*');

    if (filters.followerId) {
      query = query.eq('follower_id', filters.followerId);
    }
    if (filters.periodType) {
      query = query.eq('period_type', filters.periodType);
    }
    if (filters.startDate) {
      query = query.gte('period_start', filters.startDate.toISOString().split('T')[0]);
    }
    if (filters.endDate) {
      query = query.lte('period_end', filters.endDate.toISOString().split('T')[0]);
    }

    query = query.order('period_start', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToFollowerStats);
  }

  async getLatest(followerId: string, periodType: PeriodType): Promise<FollowerStatsRecord | null> {
    const stats = await this.getMany({
      followerId,
      periodType,
      limit: 1,
    });

    return stats[0] || null;
  }

  async getDailyStats(followerId: string, limit = 30): Promise<FollowerStatsRecord[]> {
    return this.getMany({
      followerId,
      periodType: 'daily',
      limit,
    });
  }

  async getWeeklyStats(followerId: string, limit = 12): Promise<FollowerStatsRecord[]> {
    return this.getMany({
      followerId,
      periodType: 'weekly',
      limit,
    });
  }

  async getMonthlyStats(followerId: string, limit = 12): Promise<FollowerStatsRecord[]> {
    return this.getMany({
      followerId,
      periodType: 'monthly',
      limit,
    });
  }

  async getAllTimeStats(followerId: string): Promise<FollowerStatsRecord | null> {
    const stats = await this.getMany({
      followerId,
      periodType: 'all_time',
      limit: 1,
    });

    return stats[0] || null;
  }

  async getLeaderboard(
    periodType: PeriodType = 'monthly',
    limit = 10
  ): Promise<FollowerStatsRecord[]> {
    const supabase = getSupabaseClient();

    const { data: latestPeriod, error: periodError } = await supabase
      .from('follower_stats')
      .select('period_start')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (periodError && periodError.code !== 'PGRST116') throw periodError;

    if (!latestPeriod) return [];

    const { data, error } = await supabase
      .from('follower_stats')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_start', latestPeriod.period_start)
      .order('roi_pct', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapToFollowerStats);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('follower_stats')
      .delete()
      .lt('period_end', date.toISOString().split('T')[0])
      .neq('period_type', 'all_time')
      .select();

    if (error) throw error;

    return data?.length || 0;
  }

  private mapToFollowerStats(row: any): FollowerStatsRecord {
    return {
      id: row.id,
      followerId: row.follower_id,
      periodType: row.period_type as PeriodType,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      totalTrades: row.total_trades,
      winningTrades: row.winning_trades,
      losingTrades: row.losing_trades,
      totalVolume: parseFloat(row.total_volume) || 0,
      totalPnl: parseFloat(row.total_pnl) || 0,
      totalFees: parseFloat(row.total_fees) || 0,
      roiPct: parseFloat(row.roi_pct) || 0,
      leaderPnl: parseFloat(row.leader_pnl) || 0,
      leaderRoiPct: parseFloat(row.leader_roi_pct) || 0,
      correlation: row.correlation !== null ? parseFloat(row.correlation) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}
