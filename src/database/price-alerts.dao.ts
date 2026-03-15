import { getSupabaseClient } from './client';

export interface PriceAlert {
  id: string;
  userId?: string | null;
  symbol: string;
  conditionType: 'above' | 'below';
  targetPrice: number;
  currentPrice?: number | null;
  status: 'active' | 'triggered' | 'disabled' | 'expired';
  notificationMethod: 'in_app' | 'feishu' | 'email' | 'push';
  triggeredAt?: Date | null;
  triggeredPrice?: number | null;
  expiresAt?: Date | null;
  isRecurring: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceAlertFilters {
  userId?: string;
  symbol?: string;
  conditionType?: 'above' | 'below';
  status?: 'active' | 'triggered' | 'disabled' | 'expired';
  notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
  limit?: number;
  offset?: number;
}

export class PriceAlertsDAO {
  /**
   * Create a new price alert
   */
  async create(alert: {
    userId?: string;
    symbol: string;
    conditionType: 'above' | 'below';
    targetPrice: number;
    notificationMethod?: 'in_app' | 'feishu' | 'email' | 'push';
    expiresAt?: Date;
    isRecurring?: boolean;
    notes?: string;
  }): Promise<PriceAlert> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_alerts')
      .insert([
        {
          user_id: alert.userId || null,
          symbol: alert.symbol,
          condition_type: alert.conditionType,
          target_price: alert.targetPrice.toString(),
          notification_method: alert.notificationMethod || 'in_app',
          expires_at: alert.expiresAt?.toISOString() || null,
          is_recurring: alert.isRecurring || false,
          notes: alert.notes || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceAlert(data);
  }

  /**
   * Get price alert by ID
   */
  async getById(id: string): Promise<PriceAlert | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToPriceAlert(data);
  }

  /**
   * Get price alerts with filters
   */
  async getMany(filters: PriceAlertFilters = {}): Promise<PriceAlert[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('price_alerts').select('*');

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.conditionType) {
      query = query.eq('condition_type', filters.conditionType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.notificationMethod) {
      query = query.eq('notification_method', filters.notificationMethod);
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

    return data.map(this.mapToPriceAlert);
  }

  /**
   * Get active price alerts
   */
  async getActive(symbol?: string): Promise<PriceAlert[]> {
    return this.getMany({ symbol, status: 'active' });
  }

  /**
   * Update price alert status
   */
  async updateStatus(
    id: string,
    status: 'active' | 'triggered' | 'disabled' | 'expired',
    triggeredPrice?: number
  ): Promise<PriceAlert> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'triggered') {
      updateData.triggered_at = new Date().toISOString();
      if (triggeredPrice !== undefined) {
        updateData.triggered_price = triggeredPrice.toString();
      }
    }

    const { data, error } = await supabase
      .from('price_alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceAlert(data);
  }

  /**
   * Disable a price alert
   */
  async disable(id: string): Promise<PriceAlert> {
    return this.updateStatus(id, 'disabled');
  }

  /**
   * Enable a price alert
   */
  async enable(id: string): Promise<PriceAlert> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_alerts')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceAlert(data);
  }

  /**
   * Trigger a price alert (called when price condition is met)
   */
  async trigger(id: string, triggeredPrice: number, isRecurring: boolean): Promise<PriceAlert> {
    const supabase = getSupabaseClient();

    const updateData: any = {
      status: isRecurring ? 'active' : 'triggered',
      triggered_at: new Date().toISOString(),
      triggered_price: triggeredPrice.toString(),
      current_price: triggeredPrice.toString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('price_alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceAlert(data);
  }

  /**
   * Delete a price alert
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Get price alerts that should be triggered based on current price
   */
  async getAlertsToTrigger(symbol: string, currentPrice: number): Promise<PriceAlert[]> {
    const supabase = getSupabaseClient();

    // Get active "above" alerts (trigger when price >= target_price)
    const { data: aboveAlerts, error: aboveError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('symbol', symbol)
      .eq('status', 'active')
      .eq('condition_type', 'above')
      .lte('target_price', currentPrice.toString());

    if (aboveError) throw aboveError;

    // Get active "below" alerts (trigger when price <= target_price)
    const { data: belowAlerts, error: belowError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('symbol', symbol)
      .eq('status', 'active')
      .eq('condition_type', 'below')
      .gte('target_price', currentPrice.toString());

    if (belowError) throw belowError;

    return [...aboveAlerts, ...belowAlerts].map(this.mapToPriceAlert);
  }

  /**
   * Update current price for an alert
   */
  async updateCurrentPrice(id: string, currentPrice: number): Promise<PriceAlert> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_alerts')
      .update({
        current_price: currentPrice.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceAlert(data);
  }

  /**
   * Delete expired price alerts
   */
  async deleteExpired(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Get statistics for price alerts
   */
  async getStats(userId?: string): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    triggeredAlerts: number;
    disabledAlerts: number;
    aboveCount: number;
    belowCount: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('price_alerts').select('status, condition_type');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalAlerts: data.length,
      activeAlerts: data.filter((a: any) => a.status === 'active').length,
      triggeredAlerts: data.filter((a: any) => a.status === 'triggered').length,
      disabledAlerts: data.filter((a: any) => a.status === 'disabled').length,
      aboveCount: data.filter((a: any) => a.condition_type === 'above').length,
      belowCount: data.filter((a: any) => a.condition_type === 'below').length,
    };
  }

  private mapToPriceAlert(row: any): PriceAlert {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      conditionType: row.condition_type as 'above' | 'below',
      targetPrice: parseFloat(row.target_price),
      currentPrice: row.current_price ? parseFloat(row.current_price) : null,
      status: row.status as 'active' | 'triggered' | 'disabled' | 'expired',
      notificationMethod: row.notification_method as 'in_app' | 'feishu' | 'email' | 'push',
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
      triggeredPrice: row.triggered_price ? parseFloat(row.triggered_price) : null,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      isRecurring: row.is_recurring || false,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
