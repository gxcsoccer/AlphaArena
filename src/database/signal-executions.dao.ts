/**
 * Signal Executions DAO
 * Data access layer for signal executions
 */

import { getSupabaseClient } from './client';

export type ExecutionType = 'manual' | 'auto';
export type ExecutionStatus = 'pending' | 'filled' | 'failed' | 'cancelled';

export interface SignalExecution {
  id: string;
  signalId: string;
  subscriptionId: string;
  userId: string;
  executionType: ExecutionType;
  quantity: number;
  price: number;
  status: ExecutionStatus;
  orderId?: string;
  tradeId?: string;
  pnl?: number;
  pnlPercent?: number;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExecutionInput {
  signalId: string;
  subscriptionId: string;
  userId: string;
  executionType: ExecutionType;
  quantity: number;
  price: number;
}

export interface UpdateExecutionInput {
  status?: ExecutionStatus;
  orderId?: string;
  tradeId?: string;
  pnl?: number;
  pnlPercent?: number;
  closedAt?: Date;
}

export interface ExecutionFilters {
  signalId?: string;
  subscriptionId?: string;
  userId?: string;
  status?: ExecutionStatus;
  executionType?: ExecutionType;
  limit?: number;
  offset?: number;
}

export class SignalExecutionsDAO {
  async create(input: CreateExecutionInput): Promise<SignalExecution> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_executions')
      .insert({
        signal_id: input.signalId,
        subscription_id: input.subscriptionId,
        user_id: input.userId,
        execution_type: input.executionType,
        quantity: input.quantity,
        price: input.price,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToExecution(data);
  }

  async getById(id: string): Promise<SignalExecution | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToExecution(data);
  }

  async getMany(filters: ExecutionFilters = {}): Promise<SignalExecution[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('signal_executions').select('*');

    if (filters.signalId) {
      query = query.eq('signal_id', filters.signalId);
    }
    if (filters.subscriptionId) {
      query = query.eq('subscription_id', filters.subscriptionId);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.executionType) {
      query = query.eq('execution_type', filters.executionType);
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

    return data.map(this.mapToExecution);
  }

  async update(id: string, input: UpdateExecutionInput): Promise<SignalExecution> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) updateData.status = input.status;
    if (input.orderId !== undefined) updateData.order_id = input.orderId;
    if (input.tradeId !== undefined) updateData.trade_id = input.tradeId;
    if (input.pnl !== undefined) updateData.pnl = input.pnl;
    if (input.pnlPercent !== undefined) updateData.pnl_percent = input.pnlPercent;
    if (input.closedAt) updateData.closed_at = input.closedAt.toISOString();

    const { data, error } = await supabase
      .from('signal_executions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToExecution(data);
  }

  async markFilled(
    id: string,
    details: {
      orderId?: string;
      tradeId?: string;
    }
  ): Promise<SignalExecution> {
    return this.update(id, {
      status: 'filled',
      orderId: details.orderId,
      tradeId: details.tradeId,
    });
  }

  async markFailed(id: string): Promise<SignalExecution> {
    return this.update(id, { status: 'failed' });
  }

  async markCancelled(id: string): Promise<SignalExecution> {
    return this.update(id, { status: 'cancelled' });
  }

  async closeExecution(
    id: string,
    pnl: number,
    pnlPercent: number
  ): Promise<SignalExecution> {
    return this.update(id, {
      pnl,
      pnlPercent,
      closedAt: new Date(),
    });
  }

  async getExecutionsForSignal(signalId: string): Promise<SignalExecution[]> {
    return this.getMany({ signalId });
  }

  async getExecutionsForUser(
    userId: string,
    limit: number = 50
  ): Promise<SignalExecution[]> {
    return this.getMany({ userId, limit });
  }

  async getExecutionStats(userId: string): Promise<{
    total: number;
    filled: number;
    failed: number;
    totalPnl: number;
  }> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('signal_executions')
      .select('status, pnl')
      .eq('user_id', userId);

    if (error) throw error;

    return {
      total: data?.length || 0,
      filled: data?.filter((e) => e.status === 'filled').length || 0,
      failed: data?.filter((e) => e.status === 'failed').length || 0,
      totalPnl: data?.reduce((sum, e) => sum + (e.pnl || 0), 0) || 0,
    };
  }

  private mapToExecution(row: Record<string, unknown>): SignalExecution {
    return {
      id: row.id as string,
      signalId: row.signal_id as string,
      subscriptionId: row.subscription_id as string,
      userId: row.user_id as string,
      executionType: row.execution_type as ExecutionType,
      quantity: row.quantity as number,
      price: row.price as number,
      status: row.status as ExecutionStatus,
      orderId: row.order_id as string | undefined,
      tradeId: row.trade_id as string | undefined,
      pnl: row.pnl as number | undefined,
      pnlPercent: row.pnl_percent as number | undefined,
      closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
