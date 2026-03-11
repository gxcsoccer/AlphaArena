import { getSupabaseClient } from './client';

export interface PriceHistory {
  id: string;
  symbol: string;
  price: number;
  bid?: number | null;
  ask?: number | null;
  volume24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  timestamp: Date;
  createdAt: Date;
}

export interface PricePoint {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  timestamp: Date;
}

export class PriceHistoryDAO {
  /**
   * Record a price point
   */
  async recordPrice(price: PricePoint): Promise<PriceHistory> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_history')
      .insert([
        {
          symbol: price.symbol,
          price: price.price.toString(),
          bid: price.bid?.toString() || null,
          ask: price.ask?.toString() || null,
          volume_24h: price.volume24h?.toString() || null,
          high_24h: price.high24h?.toString() || null,
          low_24h: price.low24h?.toString() || null,
          timestamp: price.timestamp.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPriceHistory(data);
  }

  /**
   * Record multiple price points (batch)
   */
  async recordPrices(prices: PricePoint[]): Promise<PriceHistory[]> {
    const supabase = getSupabaseClient();

    const records = prices.map((p) => ({
      symbol: p.symbol,
      price: p.price.toString(),
      bid: p.bid?.toString() || null,
      ask: p.ask?.toString() || null,
      volume_24h: p.volume24h?.toString() || null,
      high_24h: p.high24h?.toString() || null,
      low_24h: p.low24h?.toString() || null,
      timestamp: p.timestamp.toISOString(),
    }));

    const { data, error } = await supabase.from('price_history').insert(records).select();

    if (error) throw error;

    return data.map(this.mapToPriceHistory);
  }

  /**
   * Get latest price for a symbol
   */
  async getLatest(symbol: string): Promise<PriceHistory | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('symbol', symbol)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToPriceHistory(data);
  }

  /**
   * Get price history for a symbol
   */
  async getHistory(
    symbol: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<PriceHistory[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('price_history').select('*').eq('symbol', symbol);

    if (options.startDate) {
      query = query.gte('timestamp', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('timestamp', options.endDate.toISOString());
    }

    query = query.order('timestamp', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToPriceHistory);
  }

  /**
   * Get prices for multiple symbols
   */
  async getLatestPrices(symbols: string[]): Promise<Map<string, PriceHistory>> {
    // Fallback implementation - fetch each symbol individually
    const result = new Map<string, PriceHistory>();
    for (const symbol of symbols) {
      const price = await this.getLatest(symbol);
      if (price) {
        result.set(symbol, price);
      }
    }
    return result;
  }

  /**
   * Get price statistics for a period
   */
  async getStats(
    symbol: string,
    days = 7
  ): Promise<{
    avgPrice: number;
    highPrice: number;
    lowPrice: number;
    volatility: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await this.getHistory(symbol, { startDate });

    if (history.length === 0) {
      return {
        avgPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        volatility: 0,
      };
    }

    const prices = history.map((h) => h.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);

    // Calculate volatility (standard deviation)
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    return {
      avgPrice,
      highPrice,
      lowPrice,
      volatility,
    };
  }

  private mapToPriceHistory(row: any): PriceHistory {
    return {
      id: row.id,
      symbol: row.symbol,
      price: parseFloat(row.price),
      bid: row.bid ? parseFloat(row.bid) : null,
      ask: row.ask ? parseFloat(row.ask) : null,
      volume24h: row.volume_24h ? parseFloat(row.volume_24h) : null,
      high24h: row.high_24h ? parseFloat(row.high_24h) : null,
      low24h: row.low_24h ? parseFloat(row.low_24h) : null,
      timestamp: new Date(row.timestamp),
      createdAt: new Date(row.created_at),
    };
  }
}
