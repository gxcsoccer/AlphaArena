import { getSupabaseClient } from './client';

export type FollowerStatus = 'active' | 'paused' | 'cancelled';
export type CopyMode = 'proportional' | 'fixed' | 'mirror';

export interface FollowerSettings {
  copyMode: CopyMode;
  copyRatio: number;
  fixedAmount?: number;
  maxCopyAmount?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxDailyTrades: number;
  maxDailyVolume?: number;
  allowedSymbols: string[];
  blockedSymbols: string[];
}

export interface Follower {
  id: string;
  followerUserId: string;
  leaderUserId: string;
  status: FollowerStatus;
  settings: FollowerSettings;
  stats: {
    totalCopiedTrades: number;
    totalCopiedVolume: number;
    totalPnl: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFollowerInput {
  followerUserId: string;
  leaderUserId: string;
  settings?: Partial<FollowerSettings>;
}

export interface UpdateFollowerInput {
  status?: FollowerStatus;
  settings?: Partial<FollowerSettings>;
}

export interface FollowerFilters {
  followerUserId?: string;
  leaderUserId?: string;
  status?: FollowerStatus;
  limit?: number;
  offset?: number;
}

export class FollowersDAO {
  async create(input: CreateFollowerInput): Promise<Follower> {
    const supabase = getSupabaseClient();

    const defaultSettings: FollowerSettings = {
      copyMode: 'proportional',
      copyRatio: 1.0,
      maxDailyTrades: 10,
      allowedSymbols: [],
      blockedSymbols: [],
      ...input.settings,
    };

    const { data, error } = await supabase
      .from('followers')
      .insert([
        {
          follower_user_id: input.followerUserId,
          leader_user_id: input.leaderUserId,
          status: 'active',
          copy_mode: defaultSettings.copyMode,
          copy_ratio: defaultSettings.copyRatio,
          fixed_amount: defaultSettings.fixedAmount?.toString() || null,
          max_copy_amount: defaultSettings.maxCopyAmount?.toString() || null,
          stop_loss_pct: defaultSettings.stopLossPct || null,
          take_profit_pct: defaultSettings.takeProfitPct || null,
          max_daily_trades: defaultSettings.maxDailyTrades,
          max_daily_volume: defaultSettings.maxDailyVolume?.toString() || null,
          allowed_symbols: defaultSettings.allowedSymbols,
          blocked_symbols: defaultSettings.blockedSymbols,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToFollower(data);
  }

  async getById(id: string): Promise<Follower | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('followers')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToFollower(data);
  }

  async getMany(filters: FollowerFilters = {}): Promise<Follower[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('followers').select('*');

    if (filters.followerUserId) {
      query = query.eq('follower_user_id', filters.followerUserId);
    }
    if (filters.leaderUserId) {
      query = query.eq('leader_user_id', filters.leaderUserId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToFollower);
  }

  async getActiveFollowers(leaderUserId: string): Promise<Follower[]> {
    return this.getMany({ leaderUserId, status: 'active' });
  }

  async getFollowing(followerUserId: string, status?: FollowerStatus): Promise<Follower[]> {
    return this.getMany({ followerUserId, status });
  }

  async update(id: string, input: UpdateFollowerInput): Promise<Follower> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) {
      updateData.status = input.status;
    }

    if (input.settings) {
      if (input.settings.copyMode) {
        updateData.copy_mode = input.settings.copyMode;
      }
      if (input.settings.copyRatio !== undefined) {
        updateData.copy_ratio = input.settings.copyRatio;
      }
      if (input.settings.fixedAmount !== undefined) {
        updateData.fixed_amount = input.settings.fixedAmount?.toString() || null;
      }
      if (input.settings.maxCopyAmount !== undefined) {
        updateData.max_copy_amount = input.settings.maxCopyAmount?.toString() || null;
      }
      if (input.settings.stopLossPct !== undefined) {
        updateData.stop_loss_pct = input.settings.stopLossPct || null;
      }
      if (input.settings.takeProfitPct !== undefined) {
        updateData.take_profit_pct = input.settings.takeProfitPct || null;
      }
      if (input.settings.maxDailyTrades !== undefined) {
        updateData.max_daily_trades = input.settings.maxDailyTrades;
      }
      if (input.settings.maxDailyVolume !== undefined) {
        updateData.max_daily_volume = input.settings.maxDailyVolume?.toString() || null;
      }
      if (input.settings.allowedSymbols !== undefined) {
        updateData.allowed_symbols = input.settings.allowedSymbols;
      }
      if (input.settings.blockedSymbols !== undefined) {
        updateData.blocked_symbols = input.settings.blockedSymbols;
      }
    }

    const { data, error } = await supabase
      .from('followers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToFollower(data);
  }

  async pause(id: string): Promise<Follower> {
    return this.update(id, { status: 'paused' });
  }

  async resume(id: string): Promise<Follower> {
    return this.update(id, { status: 'active' });
  }

  async cancel(id: string): Promise<Follower> {
    return this.update(id, { status: 'cancelled' });
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async incrementStats(id: string, volume: number, pnl?: number): Promise<void> {
    const supabase = getSupabaseClient();

    const { data: current, error: fetchError } = await supabase
      .from('followers')
      .select('total_copied_trades, total_copied_volume, total_pnl')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('followers')
      .update({
        total_copied_trades: (parseInt(current.total_copied_trades) || 0) + 1,
        total_copied_volume: (parseFloat(current.total_copied_volume) || 0) + volume,
        total_pnl: (parseFloat(current.total_pnl) || 0) + (pnl || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  async getStats(leaderUserId?: string): Promise<{
    totalFollowers: number;
    activeFollowers: number;
    pausedFollowers: number;
    cancelledFollowers: number;
    totalCopiedTrades: number;
    totalCopiedVolume: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('followers').select('status, total_copied_trades, total_copied_volume');

    if (leaderUserId) {
      query = query.eq('leader_user_id', leaderUserId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalFollowers: data.length,
      activeFollowers: data.filter((f: any) => f.status === 'active').length,
      pausedFollowers: data.filter((f: any) => f.status === 'paused').length,
      cancelledFollowers: data.filter((f: any) => f.status === 'cancelled').length,
      totalCopiedTrades: data.reduce(
        (sum: number, f: any) => sum + (parseInt(f.total_copied_trades) || 0),
        0
      ),
      totalCopiedVolume: data.reduce(
        (sum: number, f: any) => sum + (parseFloat(f.total_copied_volume) || 0),
        0
      ),
    };
  }

  async isFollowing(followerUserId: string, leaderUserId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_user_id', followerUserId)
      .eq('leader_user_id', leaderUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  private mapToFollower(row: any): Follower {
    return {
      id: row.id,
      followerUserId: row.follower_user_id,
      leaderUserId: row.leader_user_id,
      status: row.status as FollowerStatus,
      settings: {
        copyMode: row.copy_mode as CopyMode,
        copyRatio: parseFloat(row.copy_ratio) || 1.0,
        fixedAmount: row.fixed_amount ? parseFloat(row.fixed_amount) : undefined,
        maxCopyAmount: row.max_copy_amount ? parseFloat(row.max_copy_amount) : undefined,
        stopLossPct: row.stop_loss_pct || undefined,
        takeProfitPct: row.take_profit_pct || undefined,
        maxDailyTrades: row.max_daily_trades || 10,
        maxDailyVolume: row.max_daily_volume ? parseFloat(row.max_daily_volume) : undefined,
        allowedSymbols: row.allowed_symbols || [],
        blockedSymbols: row.blocked_symbols || [],
      },
      stats: {
        totalCopiedTrades: parseInt(row.total_copied_trades) || 0,
        totalCopiedVolume: parseFloat(row.total_copied_volume) || 0,
        totalPnl: parseFloat(row.total_pnl) || 0,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
