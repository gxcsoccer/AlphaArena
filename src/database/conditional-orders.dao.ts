import { getSupabaseClient } from './client';

export interface ConditionalOrder {
  id: string;
  strategyId?: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'stop_loss' | 'take_profit';
  triggerPrice: number;
  quantity: number;
  status: 'active' | 'triggered' | 'cancelled' | 'expired';
  triggeredAt?: Date | null;
  triggeredOrderId?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConditionalOrderFilters {
  strategyId?: string;
  symbol?: string;
  orderType?: 'stop_loss' | 'take_profit';
  status?: 'active' | 'triggered' | 'cancelled' | 'expired';
  limit?: number;
  offset?: number;
}

export class ConditionalOrdersDAO {
  /**
   * Create a new conditional order
   */
  async create(order: {
    strategyId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    orderType: 'stop_loss' | 'take_profit';
    triggerPrice: number;
    quantity: number;
    expiresAt?: Date;
  }): Promise<ConditionalOrder> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('conditional_orders')
      .insert([
        {
          strategy_id: order.strategyId || null,
          symbol: order.symbol,
          side: order.side,
          order_type: order.orderType,
          trigger_price: order.triggerPrice.toString(),
          quantity: order.quantity.toString(),
          expires_at: order.expiresAt?.toISOString() || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToConditionalOrder(data);
  }

  /**
   * Get conditional order by ID
   */
  async getById(id: string): Promise<ConditionalOrder | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('conditional_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToConditionalOrder(data);
  }

  /**
   * Get conditional orders with filters
   */
  async getMany(filters: ConditionalOrderFilters = {}): Promise<ConditionalOrder[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('conditional_orders').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.orderType) {
      query = query.eq('order_type', filters.orderType);
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

    return data.map(this.mapToConditionalOrder);
  }

  /**
   * Get active conditional orders
   */
  async getActive(symbol?: string): Promise<ConditionalOrder[]> {
    return this.getMany({ symbol, status: 'active' });
  }

  /**
   * Update conditional order status
   */
  async updateStatus(
    id: string,
    status: 'active' | 'triggered' | 'cancelled' | 'expired',
    triggeredOrderId?: string
  ): Promise<ConditionalOrder> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'triggered') {
      updateData.triggered_at = new Date().toISOString();
      if (triggeredOrderId) {
        updateData.triggered_order_id = triggeredOrderId;
      }
    }

    const { data, error } = await supabase
      .from('conditional_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToConditionalOrder(data);
  }

  /**
   * Cancel a conditional order
   */
  async cancel(id: string): Promise<ConditionalOrder> {
    return this.updateStatus(id, 'cancelled');
  }

  /**
   * Trigger a conditional order (called when price condition is met)
   */
  async trigger(id: string, triggeredOrderId: string): Promise<ConditionalOrder> {
    return this.updateStatus(id, 'triggered', triggeredOrderId);
  }

  /**
   * Get conditional orders that should be triggered based on current price
   */
  async getOrdersToTrigger(symbol: string, currentPrice: number): Promise<ConditionalOrder[]> {
    const supabase = getSupabaseClient();

    // Get active stop-loss orders (trigger when price <= trigger_price)
    const { data: stopLossOrders, error: stopLossError } = await supabase
      .from('conditional_orders')
      .select('*')
      .eq('symbol', symbol)
      .eq('status', 'active')
      .eq('order_type', 'stop_loss')
      .lte('trigger_price', currentPrice.toString());

    if (stopLossError) throw stopLossError;

    // Get active take-profit orders (trigger when price >= trigger_price)
    const { data: takeProfitOrders, error: takeProfitError } = await supabase
      .from('conditional_orders')
      .select('*')
      .eq('symbol', symbol)
      .eq('status', 'active')
      .eq('order_type', 'take_profit')
      .gte('trigger_price', currentPrice.toString());

    if (takeProfitError) throw takeProfitError;

    return [...stopLossOrders, ...takeProfitOrders].map(this.mapToConditionalOrder);
  }

  /**
   * Delete expired conditional orders
   */
  async deleteExpired(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('conditional_orders')
      .delete()
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Get statistics for conditional orders
   */
  async getStats(strategyId?: string): Promise<{
    totalOrders: number;
    activeOrders: number;
    triggeredOrders: number;
    cancelledOrders: number;
    stopLossCount: number;
    takeProfitCount: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('conditional_orders').select('status, order_type');

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalOrders: data.length,
      activeOrders: data.filter((o: any) => o.status === 'active').length,
      triggeredOrders: data.filter((o: any) => o.status === 'triggered').length,
      cancelledOrders: data.filter((o: any) => o.status === 'cancelled').length,
      stopLossCount: data.filter((o: any) => o.order_type === 'stop_loss').length,
      takeProfitCount: data.filter((o: any) => o.order_type === 'take_profit').length,
    };
  }

  private mapToConditionalOrder(row: any): ConditionalOrder {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      side: row.side,
      orderType: row.order_type as 'stop_loss' | 'take_profit',
      triggerPrice: parseFloat(row.trigger_price),
      quantity: parseFloat(row.quantity),
      status: row.status as 'active' | 'triggered' | 'cancelled' | 'expired',
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
      triggeredOrderId: row.triggered_order_id,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
