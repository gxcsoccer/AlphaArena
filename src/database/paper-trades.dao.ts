/**
 * Paper Trades Data Access Object
 * Handles database operations for individual trade executions
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('PaperTradesDAO');

// ============================================
// Type Definitions
// ============================================

export interface PaperTrade {
  id: string;
  order_id: string | null;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  gross_amount: number;
  fees: number;
  net_amount: number;
  commission: number;
  stamp_duty: number;
  transfer_fee: number;
  cost_basis: number | null;
  realized_pnl: number | null;
  executed_at: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface CreatePaperTradeData {
  order_id?: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  gross_amount: number;
  fees: number;
  net_amount: number;
  commission?: number;
  stamp_duty?: number;
  transfer_fee?: number;
  cost_basis?: number;
  realized_pnl?: number;
  metadata?: Record<string, any>;
}

export interface TradeStats {
  total_trades: number;
  buy_trades: number;
  sell_trades: number;
  total_buy_volume: number;
  total_sell_volume: number;
  total_realized_pnl: number;
  total_fees: number;
  winning_trades: number;
  losing_trades: number;
}

// ============================================
// DAO Class
// ============================================

export class PaperTradesDAO {
  /**
   * Create a new paper trade record
   */
  static async createTrade(data: CreatePaperTradeData): Promise<PaperTrade> {
    const supabase = getSupabaseClient();

    const { data: trade, error } = await supabase
      .from('paper_trades')
      .insert({
        order_id: data.order_id,
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        quantity: data.quantity,
        price: data.price,
        gross_amount: data.gross_amount,
        fees: data.fees,
        net_amount: data.net_amount,
        commission: data.commission || 0,
        stamp_duty: data.stamp_duty || 0,
        transfer_fee: data.transfer_fee || 0,
        cost_basis: data.cost_basis,
        realized_pnl: data.realized_pnl,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating paper trade:', error);
      throw new Error(`Failed to create paper trade: ${error.message}`);
    }

    return trade;
  }

  /**
   * Get trade by ID
   */
  static async getTradeById(tradeId: string): Promise<PaperTrade | null> {
    const supabase = getSupabaseClient();

    const { data: trade, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Error getting trade:', error);
      throw new Error(`Failed to get trade: ${error.message}`);
    }

    return trade;
  }

  /**
   * Get trades for an account
   */
  static async getTrades(
    accountId: string,
    options?: {
      symbol?: string;
      side?: 'buy' | 'sell';
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ trades: PaperTrade[]; total: number }> {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('paper_trades')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId);

    if (options?.symbol) {
      query = query.eq('symbol', options.symbol);
    }
    if (options?.side) {
      query = query.eq('side', options.side);
    }
    if (options?.startDate) {
      query = query.gte('executed_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('executed_at', options.endDate.toISOString());
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    query = query
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: trades, error, count } = await query;

    if (error) {
      log.error('Error getting trades:', error);
      throw new Error(`Failed to get trades: ${error.message}`);
    }

    return {
      trades: trades || [],
      total: count || 0,
    };
  }

  /**
   * Get trades for an order
   */
  static async getTradesByOrder(orderId: string): Promise<PaperTrade[]> {
    const supabase = getSupabaseClient();

    const { data: trades, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('order_id', orderId)
      .order('executed_at', { ascending: true });

    if (error) {
      log.error('Error getting trades by order:', error);
      throw new Error(`Failed to get trades: ${error.message}`);
    }

    return trades || [];
  }

  /**
   * Get trade statistics for an account
   */
  static async getTradeStats(accountId: string): Promise<TradeStats> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .rpc('get_trade_stats', { p_account_id: accountId });

    if (error) {
      log.error('Error getting trade stats:', error);
      throw new Error(`Failed to get trade stats: ${error.message}`);
    }

    return data?.[0] || {
      total_trades: 0,
      buy_trades: 0,
      sell_trades: 0,
      total_buy_volume: 0,
      total_sell_volume: 0,
      total_realized_pnl: 0,
      total_fees: 0,
      winning_trades: 0,
      losing_trades: 0,
    };
  }

  /**
   * Get recent trades for an account
   */
  static async getRecentTrades(
    accountId: string,
    limit: number = 10
  ): Promise<PaperTrade[]> {
    const supabase = getSupabaseClient();

    const { data: trades, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('account_id', accountId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Error getting recent trades:', error);
      throw new Error(`Failed to get recent trades: ${error.message}`);
    }

    return trades || [];
  }

  /**
   * Get daily trade summary
   */
  static async getDailyTradeSummary(
    accountId: string,
    date: Date
  ): Promise<{
    date: string;
    total_trades: number;
    buy_count: number;
    sell_count: number;
    total_volume: number;
    total_fees: number;
    realized_pnl: number;
  }> {
    const supabase = getSupabaseClient();

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: trades, error } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('account_id', accountId)
      .gte('executed_at', startOfDay.toISOString())
      .lte('executed_at', endOfDay.toISOString());

    if (error) {
      log.error('Error getting daily trade summary:', error);
      throw new Error(`Failed to get daily trade summary: ${error.message}`);
    }

    const summary = {
      date: startOfDay.toISOString().split('T')[0],
      total_trades: trades?.length || 0,
      buy_count: trades?.filter(t => t.side === 'buy').length || 0,
      sell_count: trades?.filter(t => t.side === 'sell').length || 0,
      total_volume: trades?.reduce((sum, t) => sum + Number(t.gross_amount), 0) || 0,
      total_fees: trades?.reduce((sum, t) => sum + Number(t.fees), 0) || 0,
      realized_pnl: trades?.reduce((sum, t) => sum + (Number(t.realized_pnl) || 0), 0) || 0,
    };

    return summary;
  }

  /**
   * Delete trades for an account (used for account reset)
   */
  static async deleteTradesForAccount(accountId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('paper_trades')
      .delete()
      .eq('account_id', accountId);

    if (error) {
      log.error('Error deleting trades:', error);
      throw new Error(`Failed to delete trades: ${error.message}`);
    }
  }
}

export default PaperTradesDAO;