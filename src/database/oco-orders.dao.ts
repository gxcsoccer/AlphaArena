import { getSupabaseClient } from './client';

/**
 * OCO Order interface
 * 
 * One-Cancels-Other order that combines take-profit and stop-loss
 * When one leg triggers, the other is automatically cancelled
 */
export interface OCOOrder {
  id: string;
  strategyId?: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  
  // Take Profit leg
  takeProfitTriggerPrice: number;
  takeProfitQuantity: number;
  takeProfitOrderType: 'limit' | 'market';
  takeProfitLimitPrice?: number | null;
  
  // Stop Loss leg
  stopLossTriggerPrice: number;
  stopLossQuantity: number;
  stopLossOrderType: 'limit' | 'market';
  stopLossLimitPrice?: number | null;
  
  // Status
  status: 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired';
  triggeredBy?: 'take_profit' | 'stop_loss' | null;
  
  // Tracking
  triggeredAt?: Date | null;
  triggeredOrderId?: string | null;
  cancelledOrderId?: string | null;
  
  // References to underlying conditional orders
  takeProfitConditionalOrderId?: string | null;
  stopLossConditionalOrderId?: string | null;
  
  // Timestamps
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create OCO order input
 */
export interface CreateOCOOrderInput {
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  
  takeProfitTriggerPrice: number;
  takeProfitQuantity: number;
  takeProfitOrderType?: 'limit' | 'market';
  takeProfitLimitPrice?: number;
  
  stopLossTriggerPrice: number;
  stopLossQuantity: number;
  stopLossOrderType?: 'limit' | 'market';
  stopLossLimitPrice?: number;
  
  expiresAt?: Date;
}

/**
 * Filters for querying OCO orders
 */
export interface OCOOrderFilters {
  strategyId?: string;
  symbol?: string;
  status?: 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired';
  limit?: number;
  offset?: number;
}

/**
 * OCO Orders Data Access Object
 * 
 * Manages OCO (One-Cancels-Other) orders in the database
 */
export class OCOOrdersDAO {
  /**
   * Create a new OCO order
   * 
   * Creates the OCO order record and optionally links to underlying conditional orders
   */
  async create(input: CreateOCOOrderInput): Promise<OCOOrder> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oco_orders')
      .insert([
        {
          strategy_id: input.strategyId || null,
          symbol: input.symbol,
          side: input.side,
          
          take_profit_trigger_price: input.takeProfitTriggerPrice.toString(),
          take_profit_quantity: input.takeProfitQuantity.toString(),
          take_profit_order_type: input.takeProfitOrderType || 'limit',
          take_profit_limit_price: input.takeProfitLimitPrice?.toString() || null,
          
          stop_loss_trigger_price: input.stopLossTriggerPrice.toString(),
          stop_loss_quantity: input.stopLossQuantity.toString(),
          stop_loss_order_type: input.stopLossOrderType || 'market',
          stop_loss_limit_price: input.stopLossLimitPrice?.toString() || null,
          
          expires_at: input.expiresAt?.toISOString() || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToOCOOrder(data);
  }

  /**
   * Get OCO order by ID
   */
  async getById(id: string): Promise<OCOOrder | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oco_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToOCOOrder(data);
  }

  /**
   * Get OCO orders with filters
   */
  async getMany(filters: OCOOrderFilters = {}): Promise<OCOOrder[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('oco_orders').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
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

    return data.map(this.mapToOCOOrder);
  }

  /**
   * Get pending OCO orders (active orders that can be triggered)
   */
  async getPending(symbol?: string): Promise<OCOOrder[]> {
    return this.getMany({ symbol, status: 'pending' });
  }

  /**
   * Update OCO order status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired',
    updates?: {
      triggeredBy?: 'take_profit' | 'stop_loss';
      triggeredOrderId?: string;
      cancelledOrderId?: string;
    }
  ): Promise<OCOOrder> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (updates?.triggeredBy) {
      updateData.triggered_by = updates.triggeredBy;
    }

    if (status === 'completed' || status === 'partial') {
      updateData.triggered_at = new Date().toISOString();
      if (updates?.triggeredOrderId) {
        updateData.triggered_order_id = updates.triggeredOrderId;
      }
      if (updates?.cancelledOrderId) {
        updateData.cancelled_order_id = updates.cancelledOrderId;
      }
    }

    const { data, error } = await supabase
      .from('oco_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToOCOOrder(data);
  }

  /**
   * Link conditional order IDs to the OCO order
   */
  async linkConditionalOrders(
    id: string,
    takeProfitConditionalOrderId: string,
    stopLossConditionalOrderId: string
  ): Promise<OCOOrder> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oco_orders')
      .update({
        take_profit_conditional_order_id: takeProfitConditionalOrderId,
        stop_loss_conditional_order_id: stopLossConditionalOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToOCOOrder(data);
  }

  /**
   * Cancel an OCO order
   */
  async cancel(id: string): Promise<OCOOrder> {
    return this.updateStatus(id, 'cancelled');
  }

  /**
   * Mark OCO order as triggered (one leg executed)
   */
  async trigger(
    id: string,
    triggeredBy: 'take_profit' | 'stop_loss',
    triggeredOrderId: string,
    cancelledOrderId: string
  ): Promise<OCOOrder> {
    return this.updateStatus(id, 'completed', {
      triggeredBy,
      triggeredOrderId,
      cancelledOrderId,
    });
  }

  /**
   * Get OCO orders that should be triggered based on current price
   * 
   * Returns OCO orders where either:
   * - Take profit trigger price is reached (price >= trigger for buy, price <= trigger for sell)
   * - Stop loss trigger price is reached (price <= trigger for buy, price >= trigger for sell)
   */
  async getOrdersToTrigger(symbol: string, currentPrice: number): Promise<Array<{
    ocoOrder: OCOOrder;
    triggerType: 'take_profit' | 'stop_loss';
  }>> {
    const supabase = getSupabaseClient();
    const results: Array<{ ocoOrder: OCOOrder; triggerType: 'take_profit' | 'stop_loss' }> = [];

    // Get pending OCO orders for this symbol
    const { data: pendingOrders, error } = await supabase
      .from('oco_orders')
      .select('*')
      .eq('symbol', symbol)
      .eq('status', 'pending');

    if (error) throw error;

    for (const row of pendingOrders || []) {
      const ocoOrder = this.mapToOCOOrder(row);
      
      // For buy orders (long position):
      // - Take profit triggers when price >= trigger price
      // - Stop loss triggers when price <= trigger price
      // For sell orders (short position):
      // - Take profit triggers when price <= trigger price
      // - Stop loss triggers when price >= trigger price
      
      if (ocoOrder.side === 'buy') {
        // Long position
        if (currentPrice >= ocoOrder.takeProfitTriggerPrice) {
          results.push({ ocoOrder, triggerType: 'take_profit' });
        } else if (currentPrice <= ocoOrder.stopLossTriggerPrice) {
          results.push({ ocoOrder, triggerType: 'stop_loss' });
        }
      } else {
        // Short position
        if (currentPrice <= ocoOrder.takeProfitTriggerPrice) {
          results.push({ ocoOrder, triggerType: 'take_profit' });
        } else if (currentPrice >= ocoOrder.stopLossTriggerPrice) {
          results.push({ ocoOrder, triggerType: 'stop_loss' });
        }
      }
    }

    return results;
  }

  /**
   * Delete expired OCO orders
   */
  async deleteExpired(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oco_orders')
      .delete()
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Get statistics for OCO orders
   */
  async getStats(strategyId?: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    expiredOrders: number;
    takeProfitTriggers: number;
    stopLossTriggers: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('oco_orders').select('status, triggered_by');

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalOrders: data.length,
      pendingOrders: data.filter((o: any) => o.status === 'pending').length,
      completedOrders: data.filter((o: any) => o.status === 'completed').length,
      cancelledOrders: data.filter((o: any) => o.status === 'cancelled').length,
      expiredOrders: data.filter((o: any) => o.status === 'expired').length,
      takeProfitTriggers: data.filter((o: any) => o.triggered_by === 'take_profit').length,
      stopLossTriggers: data.filter((o: any) => o.triggered_by === 'stop_loss').length,
    };
  }

  /**
   * Map database row to OCOOrder interface
   */
  private mapToOCOOrder(row: any): OCOOrder {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      side: row.side as 'buy' | 'sell',
      
      takeProfitTriggerPrice: parseFloat(row.take_profit_trigger_price),
      takeProfitQuantity: parseFloat(row.take_profit_quantity),
      takeProfitOrderType: row.take_profit_order_type as 'limit' | 'market',
      takeProfitLimitPrice: row.take_profit_limit_price ? parseFloat(row.take_profit_limit_price) : null,
      
      stopLossTriggerPrice: parseFloat(row.stop_loss_trigger_price),
      stopLossQuantity: parseFloat(row.stop_loss_quantity),
      stopLossOrderType: row.stop_loss_order_type as 'limit' | 'market',
      stopLossLimitPrice: row.stop_loss_limit_price ? parseFloat(row.stop_loss_limit_price) : null,
      
      status: row.status as 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired',
      triggeredBy: row.triggered_by as 'take_profit' | 'stop_loss' | null,
      
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
      triggeredOrderId: row.triggered_order_id,
      cancelledOrderId: row.cancelled_order_id,
      
      takeProfitConditionalOrderId: row.take_profit_conditional_order_id,
      stopLossConditionalOrderId: row.stop_loss_conditional_order_id,
      
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
