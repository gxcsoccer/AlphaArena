import { getSupabaseClient } from './client';

export interface Trade {
  id: string;
  strategyId?: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  fee: number;
  feeCurrency?: string | null;
  orderId?: string | null;
  tradeId?: string | null;
  executedAt: Date;
  createdAt: Date;
}

export interface TradeFilters {
  strategyId?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class TradesDAO {
  /**
   * Record a new trade
   */
  async create(trade: {
    strategyId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    total: number;
    fee?: number;
    feeCurrency?: string;
    orderId?: string;
    tradeId?: string;
    executedAt: Date;
  }): Promise<Trade> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('trades')
      .insert([
        {
          strategy_id: trade.strategyId || null,
          symbol: trade.symbol,
          side: trade.side,
          price: trade.price.toString(),
          quantity: trade.quantity.toString(),
          total: trade.total.toString(),
          fee: (trade.fee || 0).toString(),
          fee_currency: trade.feeCurrency || null,
          order_id: trade.orderId || null,
          trade_id: trade.tradeId || null,
          executed_at: trade.executedAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToTrade(data);
  }

  /**
   * Get trade by ID
   */
  async getById(id: string): Promise<Trade | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('trades').select('*').eq('id', id).single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToTrade(data);
  }

  /**
   * Get trades with filters
   */
  async getMany(filters: TradeFilters = {}): Promise<Trade[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('trades').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.side) {
      query = query.eq('side', filters.side);
    }
    if (filters.startDate) {
      query = query.gte('executed_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('executed_at', filters.endDate.toISOString());
    }

    query = query.order('executed_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToTrade);
  }

  /**
   * Get trades by strategy
   */
  async getByStrategy(strategyId: string, limit = 100): Promise<Trade[]> {
    return this.getMany({ strategyId, limit });
  }

  /**
   * Get trades by symbol
   */
  async getBySymbol(symbol: string, limit = 100): Promise<Trade[]> {
    return this.getMany({ symbol, limit });
  }

  /**
   * Get total trading volume
   */
  async getTotalVolume(strategyId?: string): Promise<number> {
    const supabase = getSupabaseClient();

    let query = supabase.from('trades').select('total');

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.reduce((sum: number, trade: { total: string }) => sum + parseFloat(trade.total), 0);
  }

  /**
   * Get trade statistics
   */
  async getStats(strategyId?: string): Promise<{
    totalTrades: number;
    totalVolume: number;
    buyCount: number;
    sellCount: number;
  }> {
    const supabase = getSupabaseClient();

    let query = supabase.from('trades').select('side, total');

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      totalTrades: data.length,
      totalVolume: data.reduce(
        (sum: number, trade: { side: string; total: string }) => sum + parseFloat(trade.total),
        0
      ),
      buyCount: data.filter((t: { side: string }) => t.side === 'buy').length,
      sellCount: data.filter((t: { side: string }) => t.side === 'sell').length,
    };
  }

  /**
   * Export trades to CSV format
   * @param filters - Filters to apply to the export
   * @returns CSV string with trade data
   */
  async exportToCSV(filters: TradeFilters = {}): Promise<string> {
    // Get all trades with filters (no limit for export)
    const trades = await this.getMany({ ...filters, limit: undefined });

    // CSV header
    const headers = [
      'Timestamp',
      'Symbol',
      'Side',
      'Price',
      'Quantity',
      'Total',
      'Fee',
      'Fee Currency',
      'Strategy ID',
      'Order ID',
      'Trade ID',
    ];

    // CSV rows
    const rows = trades.map(trade => [
      trade.executedAt.toISOString(),
      trade.symbol,
      trade.side,
      trade.price.toFixed(8),
      trade.quantity.toFixed(8),
      trade.total.toFixed(8),
      trade.fee.toFixed(8),
      trade.feeCurrency || '',
      trade.strategyId || '',
      trade.orderId || '',
      trade.tradeId || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  private mapToTrade(row: any): Trade {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      side: row.side,
      price: parseFloat(row.price),
      quantity: parseFloat(row.quantity),
      total: parseFloat(row.total),
      fee: parseFloat(row.fee),
      feeCurrency: row.fee_currency,
      orderId: row.order_id,
      tradeId: row.trade_id,
      executedAt: new Date(row.executed_at),
      createdAt: new Date(row.created_at),
    };
  }
}
