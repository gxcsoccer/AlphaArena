/**
 * Signal Subscriptions DAO
 * Data access layer for signal subscriptions
 */

import { getSupabaseClient } from './client';

export type SubscriptionType = 'user' | 'strategy';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface SignalSubscription {
  id: string;
  subscriberId: string;
  sourceType: SubscriptionType;
  sourceId: string;
  autoExecute: boolean;
  copyRatio: number;
  fixedAmount?: number;
  maxAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols: string[];
  blockedSymbols: string[];
  notifyInApp: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  status: SubscriptionStatus;
  signalsReceived: number;
  signalsExecuted: number;
  totalPnl: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  subscriberId: string;
  sourceType: SubscriptionType;
  sourceId: string;
  autoExecute?: boolean;
  copyRatio?: number;
  fixedAmount?: number;
  maxAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
}

export interface UpdateSubscriptionInput {
  autoExecute?: boolean;
  copyRatio?: number;
  fixedAmount?: number;
  maxAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  status?: SubscriptionStatus;
}

export interface SubscriptionFilters {
  subscriberId?: string;
  sourceType?: SubscriptionType;
  sourceId?: string;
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}

export class SignalSubscriptionsDAO {
  async create(input: CreateSubscriptionInput): Promise<SignalSubscription> {
    const supabase = getSupabaseClient();

    // Check if already subscribed
    const existing = await this.getBySubscriberAndSource(
      input.subscriberId,
      input.sourceType,
      input.sourceId
    );

    if (existing) {
      // If cancelled, reactivate
      if (existing.status === 'cancelled') {
        return this.update(existing.id, { status: 'active' });
      }
      throw new Error('Already subscribed to this source');
    }

    // Prevent self-subscription
    if (input.sourceType === 'user' && input.subscriberId === input.sourceId) {
      throw new Error('Cannot subscribe to yourself');
    }

    const { data, error } = await supabase
      .from('signal_subscriptions')
      .insert({
        subscriber_id: input.subscriberId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        auto_execute: input.autoExecute ?? false,
        copy_ratio: input.copyRatio ?? 1.0,
        fixed_amount: input.fixedAmount || null,
        max_amount: input.maxAmount || null,
        max_risk_per_trade: input.maxRiskPerTrade || null,
        allowed_symbols: input.allowedSymbols || [],
        blocked_symbols: input.blockedSymbols || [],
        notify_in_app: input.notifyInApp ?? true,
        notify_push: input.notifyPush ?? false,
        notify_email: input.notifyEmail ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToSubscription(data);
  }

  async getById(id: string): Promise<SignalSubscription | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSubscription(data);
  }

  async getBySubscriberAndSource(
    subscriberId: string,
    sourceType: SubscriptionType,
    sourceId: string
  ): Promise<SignalSubscription | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_subscriptions')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToSubscription(data);
  }

  async getMany(filters: SubscriptionFilters = {}): Promise<SignalSubscription[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('signal_subscriptions').select('*');

    if (filters.subscriberId) {
      query = query.eq('subscriber_id', filters.subscriberId);
    }
    if (filters.sourceType) {
      query = query.eq('source_type', filters.sourceType);
    }
    if (filters.sourceId) {
      query = query.eq('source_id', filters.sourceId);
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

    return data.map(this.mapToSubscription);
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<SignalSubscription> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.autoExecute !== undefined) updateData.auto_execute = input.autoExecute;
    if (input.copyRatio !== undefined) updateData.copy_ratio = input.copyRatio;
    if (input.fixedAmount !== undefined) updateData.fixed_amount = input.fixedAmount || null;
    if (input.maxAmount !== undefined) updateData.max_amount = input.maxAmount || null;
    if (input.maxRiskPerTrade !== undefined) updateData.max_risk_per_trade = input.maxRiskPerTrade || null;
    if (input.allowedSymbols !== undefined) updateData.allowed_symbols = input.allowedSymbols;
    if (input.blockedSymbols !== undefined) updateData.blocked_symbols = input.blockedSymbols;
    if (input.notifyInApp !== undefined) updateData.notify_in_app = input.notifyInApp;
    if (input.notifyPush !== undefined) updateData.notify_push = input.notifyPush;
    if (input.notifyEmail !== undefined) updateData.notify_email = input.notifyEmail;
    if (input.status) updateData.status = input.status;

    const { data, error } = await supabase
      .from('signal_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToSubscription(data);
  }

  async pause(id: string): Promise<SignalSubscription> {
    return this.update(id, { status: 'paused' });
  }

  async resume(id: string): Promise<SignalSubscription> {
    return this.update(id, { status: 'active' });
  }

  async cancel(id: string): Promise<SignalSubscription> {
    return this.update(id, { status: 'cancelled' });
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('signal_subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getActiveSubscriptionsForSource(
    sourceType: SubscriptionType,
    sourceId: string
  ): Promise<SignalSubscription[]> {
    return this.getMany({
      sourceType,
      sourceId,
      status: 'active',
    });
  }

  async getSubscriptionsForSubscriber(
    subscriberId: string,
    status?: SubscriptionStatus
  ): Promise<SignalSubscription[]> {
    return this.getMany({
      subscriberId,
      status,
    });
  }

  async incrementSignalsReceived(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { data: current } = await supabase
      .from('signal_subscriptions')
      .select('signals_received')
      .eq('id', id)
      .single();

    if (current) {
      await supabase
        .from('signal_subscriptions')
        .update({
          signals_received: (current.signals_received || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
  }

  async incrementSignalsExecuted(id: string, pnl: number): Promise<void> {
    const supabase = getSupabaseClient();

    const { data: current } = await supabase
      .from('signal_subscriptions')
      .select('signals_executed, total_pnl')
      .eq('id', id)
      .single();

    if (current) {
      await supabase
        .from('signal_subscriptions')
        .update({
          signals_executed: (current.signals_executed || 0) + 1,
          total_pnl: (current.total_pnl || 0) + pnl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
  }

  async getSubscriberCount(sourceType: SubscriptionType, sourceId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('signal_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('status', 'active');

    if (error) throw error;

    return count || 0;
  }

  private mapToSubscription(row: Record<string, unknown>): SignalSubscription {
    return {
      id: row.id as string,
      subscriberId: row.subscriber_id as string,
      sourceType: row.source_type as SubscriptionType,
      sourceId: row.source_id as string,
      autoExecute: row.auto_execute as boolean,
      copyRatio: row.copy_ratio as number,
      fixedAmount: row.fixed_amount as number | undefined,
      maxAmount: row.max_amount as number | undefined,
      maxRiskPerTrade: row.max_risk_per_trade as number | undefined,
      allowedSymbols: row.allowed_symbols as string[] || [],
      blockedSymbols: row.blocked_symbols as string[] || [],
      notifyInApp: row.notify_in_app as boolean,
      notifyPush: row.notify_push as boolean,
      notifyEmail: row.notify_email as boolean,
      status: row.status as SubscriptionStatus,
      signalsReceived: row.signals_received as number,
      signalsExecuted: row.signals_executed as number,
      totalPnl: row.total_pnl as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
