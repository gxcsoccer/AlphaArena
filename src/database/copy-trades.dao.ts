import { getSupabaseClient } from './client';
import { Follower } from './followers.dao';

export type CopyTradeStatus = 'pending' | 'executing' | 'filled' | 'partial' | 'failed' | 'cancelled';

export interface CopyTrade {
  id: string;
  followerId: string;
  originalTradeId?: string;
  originalOrderId?: string;
  leaderUserId: string;
  followerUserId: string;
  symbol: string;
  side: 'buy' | 'sell';
  originalQuantity: number;
  copiedQuantity: number;
  originalPrice: number;
  copiedPrice?: number;
  status: CopyTradeStatus;
  error?: string;
  retryCount: number;
  copiedOrderId?: string;
  copiedTradeId?: string;
  fee: number;
  feeCurrency?: string;
  signalReceivedAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface CreateCopyTradeInput {
  followerId: string;
  originalTradeId?: string;
  originalOrderId?: string;
  leaderUserId: string;
  followerUserId: string;
  symbol: string;
  side: 'buy' | 'sell';
  originalQuantity: number;
  copiedQuantity: number;
  originalPrice: number;
  signalReceivedAt: Date;
}

export interface CopyTradeFilters {
  followerId?: string;
  followerUserId?: string;
  leaderUserId?: string;
  symbol?: string;
  status?: CopyTradeStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class CopyTradesDAO {
  async create(input: CreateCopyTradeInput): Promise<CopyTrade> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('copy_trades')
      .insert([
        {
          follower_id: input.followerId,
          original_trade_id: input.originalTradeId || null,
          original_order_id: input.originalOrderId || null,
          leader_user_id: input.leaderUserId,
          follower_user_id: input.followerUserId,
          symbol: input.symbol,
          side: input.side,
          original_quantity: input.originalQuantity.toString(),
          copied_quantity: input.copiedQuantity.toString(),
          original_price: input.originalPrice.toString(),
          status: 'pending',
          retry_count: 0,
          signal_received_at: input.signalReceivedAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToCopyTrade(data);
  }

  async getById(id: string): Promise<CopyTrade | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('copy_trades')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToCopyTrade(data);
  }

  async getMany(filters: CopyTradeFilters = {}): Promise<CopyTrade[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('copy_trades').select('*');

    if (filters.followerId) {
      query = query.eq('follower_id', filters.followerId);
    }
    if (filters.followerUserId) {
      query = query.eq('follower_user_id', filters.followerUserId);
    }
    if (filters.leaderUserId) {
      query = query.eq('leader_user_id', filters.leaderUserId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
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

    return data.map(this.mapToCopyTrade);
  }

  async getPending(limit = 100): Promise<CopyTrade[]> {
    return this.getMany({ status: 'pending', limit });
  }

  async getByFollower(followerId: string, limit = 100): Promise<CopyTrade[]> {
    return this.getMany({ followerId, limit });
  }

  async updateStatus(
    id: string,
    status: CopyTradeStatus,
    updates?: {
      copiedPrice?: number;
      copiedOrderId?: string;
      copiedTradeId?: string;
      fee?: number;
      feeCurrency?: string;
      error?: string;
    }
  ): Promise<CopyTrade> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      status,
    };

    if (status === 'executing') {
      updateData.executed_at = new Date().toISOString();
    }

    if (status === 'filled' || status === 'partial') {
      updateData.completed_at = new Date().toISOString();
    }

    if (updates) {
      if (updates.copiedPrice !== undefined) {
        updateData.copied_price = updates.copiedPrice.toString();
      }
      if (updates.copiedOrderId) {
        updateData.copied_order_id = updates.copiedOrderId;
      }
      if (updates.copiedTradeId) {
        updateData.copied_trade_id = updates.copiedTradeId;
      }
      if (updates.fee !== undefined) {
        updateData.fee = updates.fee.toString();
      }
      if (updates.feeCurrency) {
        updateData.fee_currency = updates.feeCurrency;
      }
      if (updates.error) {
        updateData.error = updates.error;
      }
    }

    const { data, error } = await supabase
      .from('copy_trades')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToCopyTrade(data);
  }

  async incrementRetry(id: string, error?: string): Promise<CopyTrade> {
    const supabase = getSupabaseClient();

    const { data: current, error: fetchError } = await supabase
      .from('copy_trades')
      .select('retry_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const updateData: any = {
      retry_count: (parseInt(current.retry_count) || 0) + 1,
    };

    if (error) {
      updateData.error = error;
    }

    const { data, error: updateError } = await supabase
      .from('copy_trades')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return this.mapToCopyTrade(data);
  }

  async markExecuting(id: string): Promise<CopyTrade> {
    return this.updateStatus(id, 'executing');
  }

  async markFilled(
    id: string,
    details: {
      copiedPrice: number;
      copiedOrderId?: string;
      copiedTradeId?: string;
      fee?: number;
      feeCurrency?: string;
    }
  ): Promise<CopyTrade> {
    return this.updateStatus(id, 'filled', details);
  }

  async markFailed(id: string, error: string): Promise<CopyTrade> {
    return this.updateStatus(id, 'failed', { error });
  }

  async cancel(id: string): Promise<CopyTrade> {
    return this.updateStatus(id, 'cancelled');
  }

  async getStats(followerUserId?: string, leaderUserId?: string): Promise<{
    totalTrades: number;
    pendingTrades: number;
    filledTrades: number;
    failedTrades: number;
    totalVolume: number;
    totalFees: number;
    buyCount: number;
    sellCount: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('copy_trades').select('status, side, copied_quantity, copied_price, fee');

    if (followerUserId) {
      query = query.eq('follower_user_id', followerUserId);
    }
    if (leaderUserId) {
      query = query.eq('leader_user_id', leaderUserId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalTrades: data.length,
      pendingTrades: data.filter((t: any) => t.status === 'pending' || t.status === 'executing').length,
      filledTrades: data.filter((t: any) => t.status === 'filled').length,
      failedTrades: data.filter((t: any) => t.status === 'failed').length,
      totalVolume: data.reduce(
        (sum: number, t: any) => {
          if (t.copied_price && t.copied_quantity) {
            return sum + parseFloat(t.copied_price) * parseFloat(t.copied_quantity);
          }
          return sum;
        },
        0
      ),
      totalFees: data.reduce(
        (sum: number, t: any) => sum + (parseFloat(t.fee) || 0),
        0
      ),
      buyCount: data.filter((t: any) => t.side === 'buy').length,
      sellCount: data.filter((t: any) => t.side === 'sell').length,
    };
  }

  async getTodayCount(followerId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('copy_trades')
      .select('id')
      .eq('follower_id', followerId)
      .gte('created_at', today.toISOString());

    if (error) throw error;

    return data.length;
  }

  async getTodayVolume(followerId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('copy_trades')
      .select('copied_quantity, copied_price')
      .eq('follower_id', followerId)
      .gte('created_at', today.toISOString());

    if (error) throw error;

    return data.reduce(
      (sum: number, t: any) => {
        if (t.copied_price && t.copied_quantity) {
          return sum + parseFloat(t.copied_price) * parseFloat(t.copied_quantity);
        }
        return sum;
      },
      0
    );
  }

  private mapToCopyTrade(row: any): CopyTrade {
    return {
      id: row.id,
      followerId: row.follower_id,
      originalTradeId: row.original_trade_id,
      originalOrderId: row.original_order_id,
      leaderUserId: row.leader_user_id,
      followerUserId: row.follower_user_id,
      symbol: row.symbol,
      side: row.side as 'buy' | 'sell',
      originalQuantity: parseFloat(row.original_quantity),
      copiedQuantity: parseFloat(row.copied_quantity),
      originalPrice: parseFloat(row.original_price),
      copiedPrice: row.copied_price ? parseFloat(row.copied_price) : undefined,
      status: row.status as CopyTradeStatus,
      error: row.error,
      retryCount: row.retry_count || 0,
      copiedOrderId: row.copied_order_id,
      copiedTradeId: row.copied_trade_id,
      fee: parseFloat(row.fee) || 0,
      feeCurrency: row.fee_currency,
      signalReceivedAt: new Date(row.signal_received_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}
