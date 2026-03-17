/**
 * Trading Signals DAO
 * Data access layer for trading signals
 */

import { getSupabaseClient } from './client';

export type SignalStatus = 'active' | 'expired' | 'cancelled' | 'executed';
export type SignalType = 'entry' | 'stop_loss' | 'take_profit' | 'exit' | 'update';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface TradingSignal {
  id: string;
  publisherId: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: SignalType;
  entryPrice?: number;
  entryPriceRangeLow?: number;
  entryPriceRangeHigh?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  quantity?: number;
  title?: string;
  description?: string;
  analysis?: string;
  riskLevel: RiskLevel;
  confidenceScore?: number;
  status: SignalStatus;
  expiresAt?: Date;
  executedAt?: Date;
  cancelledAt?: Date;
  executionPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  viewsCount: number;
  subscribersNotified: number;
  executionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSignalInput {
  publisherId: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType?: SignalType;
  entryPrice?: number;
  entryPriceRangeLow?: number;
  entryPriceRangeHigh?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  quantity?: number;
  title?: string;
  description?: string;
  analysis?: string;
  riskLevel?: RiskLevel;
  confidenceScore?: number;
  expiresAt?: Date;
}

export interface UpdateSignalInput {
  status?: SignalStatus;
  executedAt?: Date;
  cancelledAt?: Date;
  executionPrice?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface SignalFilters {
  publisherId?: string;
  strategyId?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  signalType?: SignalType;
  status?: SignalStatus;
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'views_count' | 'executions_count';
  orderDirection?: 'asc' | 'desc';
}

export class TradingSignalsDAO {
  async create(input: CreateSignalInput): Promise<TradingSignal> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_signals')
      .insert({
        publisher_id: input.publisherId,
        strategy_id: input.strategyId || null,
        symbol: input.symbol,
        side: input.side,
        signal_type: input.signalType || 'entry',
        entry_price: input.entryPrice || null,
        entry_price_range_low: input.entryPriceRangeLow || null,
        entry_price_range_high: input.entryPriceRangeHigh || null,
        target_price: input.targetPrice || null,
        stop_loss_price: input.stopLossPrice || null,
        quantity: input.quantity || null,
        title: input.title || null,
        description: input.description || null,
        analysis: input.analysis || null,
        risk_level: input.riskLevel || 'medium',
        confidence_score: input.confidenceScore || null,
        expires_at: input.expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToSignal(data);
  }

  async getById(id: string): Promise<TradingSignal | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSignal(data);
  }

  async getMany(filters: SignalFilters = {}): Promise<TradingSignal[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('trading_signals').select('*');

    if (filters.publisherId) {
      query = query.eq('publisher_id', filters.publisherId);
    }
    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.side) {
      query = query.eq('side', filters.side);
    }
    if (filters.signalType) {
      query = query.eq('signal_type', filters.signalType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.riskLevel) {
      query = query.eq('risk_level', filters.riskLevel);
    }

    const orderBy = filters.orderBy || 'created_at';
    const orderDirection = filters.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToSignal);
  }

  async update(id: string, input: UpdateSignalInput): Promise<TradingSignal> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) updateData.status = input.status;
    if (input.executedAt) updateData.executed_at = input.executedAt.toISOString();
    if (input.cancelledAt) updateData.cancelled_at = input.cancelledAt.toISOString();
    if (input.executionPrice !== undefined) updateData.execution_price = input.executionPrice;
    if (input.pnl !== undefined) updateData.pnl = input.pnl;
    if (input.pnlPercent !== undefined) updateData.pnl_percent = input.pnlPercent;

    const { data, error } = await supabase
      .from('trading_signals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToSignal(data);
  }

  /**
   * Atomically increment views_count
   * Uses PostgreSQL RPC function for concurrent safety
   */
  async incrementViews(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc('increment_signal_views', { signal_uuid: id });

    if (error) {
      console.error('Failed to increment signal views:', error);
    }
  }

  /**
   * Atomically increment executions_count
   * Uses PostgreSQL RPC function for concurrent safety
   */
  async incrementExecutions(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc('increment_signal_executions', { signal_uuid: id });

    if (error) {
      console.error('Failed to increment signal executions:', error);
    }
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('trading_signals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getActiveSignalsForPublisher(publisherId: string): Promise<TradingSignal[]> {
    return this.getMany({ publisherId, status: 'active' });
  }

  async getActiveSignalsForSymbol(symbol: string): Promise<TradingSignal[]> {
    return this.getMany({ symbol, status: 'active' });
  }

  async expireSignals(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trading_signals')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    return data?.length || 0;
  }

  private mapToSignal(row: Record<string, unknown>): TradingSignal {
    return {
      id: row.id as string,
      publisherId: row.publisher_id as string,
      strategyId: row.strategy_id as string | undefined,
      symbol: row.symbol as string,
      side: row.side as 'buy' | 'sell',
      signalType: row.signal_type as SignalType,
      entryPrice: row.entry_price as number | undefined,
      entryPriceRangeLow: row.entry_price_range_low as number | undefined,
      entryPriceRangeHigh: row.entry_price_range_high as number | undefined,
      targetPrice: row.target_price as number | undefined,
      stopLossPrice: row.stop_loss_price as number | undefined,
      quantity: row.quantity as number | undefined,
      title: row.title as string | undefined,
      description: row.description as string | undefined,
      analysis: row.analysis as string | undefined,
      riskLevel: row.risk_level as RiskLevel,
      confidenceScore: row.confidence_score as number | undefined,
      status: row.status as SignalStatus,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      executedAt: row.executed_at ? new Date(row.executed_at as string) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string) : undefined,
      executionPrice: row.execution_price as number | undefined,
      pnl: row.pnl as number | undefined,
      viewsCount: row.views_count as number,
      subscribersNotified: row.subscribers_notified as number,
      executionsCount: row.executions_count as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async getPublisherSignals(publisherId: string): Promise<TradingSignal[]> {
    return this.getMany({ publisherId });
  }
}