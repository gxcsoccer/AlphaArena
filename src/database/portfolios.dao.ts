import { getSupabaseClient } from './client';

export interface Portfolio {
  id: string;
  strategyId?: string | null;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseBalance: number;
  quoteBalance: number;
  totalValue?: number | null;
  snapshotAt: Date;
  createdAt: Date;
}

export interface PortfolioSnapshot {
  strategyId?: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseBalance: number;
  quoteBalance: number;
  totalValue?: number;
  snapshotAt: Date;
}

export class PortfoliosDAO {
  /**
   * Create a portfolio snapshot
   */
  async createSnapshot(snapshot: PortfolioSnapshot): Promise<Portfolio> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('portfolios')
      .insert([
        {
          strategy_id: snapshot.strategyId || null,
          symbol: snapshot.symbol,
          base_currency: snapshot.baseCurrency,
          quote_currency: snapshot.quoteCurrency,
          base_balance: snapshot.baseBalance.toString(),
          quote_balance: snapshot.quoteBalance.toString(),
          total_value: snapshot.totalValue?.toString() || null,
          snapshot_at: snapshot.snapshotAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapToPortfolio(data);
  }

  /**
   * Get latest portfolio snapshot
   */
  async getLatest(strategyId?: string, symbol?: string): Promise<Portfolio | null> {
    const supabase = getSupabaseClient();

    let query = supabase.from('portfolios').select('*');

    if (strategyId) {
      query = query.eq('strategy_id', strategyId);
    }
    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    const { data, error } = await query
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToPortfolio(data);
  }

  /**
   * Get portfolio snapshots with filters
   */
  async getMany(
    filters: {
      strategyId?: string;
      symbol?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<Portfolio[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('portfolios').select('*');

    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.symbol) {
      query = query.eq('symbol', filters.symbol);
    }
    if (filters.startDate) {
      query = query.gte('snapshot_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('snapshot_at', filters.endDate.toISOString());
    }

    query = query.order('snapshot_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(this.mapToPortfolio);
  }

  /**
   * Get portfolio history for a strategy
   */
  async getHistory(strategyId: string, limit = 100): Promise<Portfolio[]> {
    return this.getMany({ strategyId, limit });
  }

  /**
   * Get portfolio value over time
   */
  async getValueHistory(
    strategyId: string,
    days = 7
  ): Promise<
    {
      timestamp: Date;
      totalValue: number;
    }[]
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await this.getMany({
      strategyId,
      startDate,
      limit: days * 24, // Assume hourly snapshots
    });

    return snapshots.map((s) => ({
      timestamp: s.snapshotAt,
      totalValue: s.totalValue || 0,
    }));
  }

  /**
   * Get portfolio PnL history with time range support
   * @param strategyId - Strategy ID
   * @param timeRange - Time range: '1d' | '1w' | '1m' | 'all'
   */
  async getPnLHistory(
    strategyId: string,
    timeRange: '1d' | '1w' | '1m' | 'all' = '1w'
  ): Promise<
    {
      timestamp: Date;
      totalValue: number;
      realizedPnL: number;
      unrealizedPnL: number;
    }[]
  > {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        // Use a very old date to get all history
        startDate = new Date(2000, 0, 1);
        break;
    }

    const snapshots = await this.getMany({
      strategyId,
      startDate,
      limit: timeRange === 'all' ? 1000 : timeRange === '1m' ? 720 : timeRange === '1w' ? 168 : 24,
    });

    // Reverse to get chronological order
    snapshots.reverse();

    return snapshots.map((s) => ({
      timestamp: s.snapshotAt,
      totalValue: s.totalValue || 0,
      realizedPnL: 0, // Will be calculated from trades
      unrealizedPnL: 0, // Will be calculated from positions
    }));
  }

  private mapToPortfolio(row: any): Portfolio {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      symbol: row.symbol,
      baseCurrency: row.base_currency,
      quoteCurrency: row.quote_currency,
      baseBalance: parseFloat(row.base_balance),
      quoteBalance: parseFloat(row.quote_balance),
      totalValue: row.total_value ? parseFloat(row.total_value) : null,
      snapshotAt: new Date(row.snapshot_at),
      createdAt: new Date(row.created_at),
    };
  }
}
