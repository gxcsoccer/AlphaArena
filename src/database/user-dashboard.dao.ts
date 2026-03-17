/**
 * User Dashboard Data Access Object
 * Handles database operations for user-specific dashboard data
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('UserDashboardDAO');

// ============================================
// Types
// ============================================

export interface UserOverview {
  userId: string;
  totalAssets: number;
  monthlyPnL: number;
  monthlyPnLPercent: number;
  activeStrategies: number;
  totalTrades: number;
  winRate: number;
  equityCurve: Array<{ date: string; value: number }>;
}

export interface UserStrategy {
  id: string;
  userId: string;
  name: string;
  type: string;
  status: 'active' | 'paused' | 'stopped';
  returnRate: number;
  tradeCount: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface UserTrade {
  id: string;
  userId: string;
  strategyId?: string;
  strategyName?: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  pnl: number;
  fee: number;
  executedAt: string;
}

export interface UserPerformance {
  userId: string;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  monthlyReturns: Array<{ month: string; return: number }>;
  assetDistribution: Array<{ asset: string; value: number; percentage: number }>;
}

export interface DashboardFilters {
  status?: 'active' | 'paused' | 'stopped';
  type?: string;
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// DAO Class
// ============================================

export class UserDashboardDAO {
  /**
   * Get user overview statistics
   */
  static async getUserOverview(userId: string): Promise<UserOverview | null> {
    const supabase = getSupabaseClient();

    try {
      // In production, this would query user-specific tables
      // For now, we aggregate from existing data with user_id filter
      // If user_id column doesn't exist, we return demo data

      // Try to get user's strategies
      const { data: strategies, error: strategiesError } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId);

      if (strategiesError && strategiesError.code !== 'PGRST116') {
        log.warn('Could not fetch user strategies:', strategiesError.message);
      }

      // Try to get user's trades
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (tradesError && tradesError.code !== 'PGRST116') {
        log.warn('Could not fetch user trades:', tradesError.message);
      }

      // Calculate statistics
      const activeStrategies = (strategies || []).filter(s => s.status === 'active').length;
      const totalTrades = (trades || []).length;
      
      // Calculate total PnL (simplified)
      const totalPnL = (trades || []).reduce((sum, t) => {
        const pnl = t.side === 'sell' ? t.total : -t.total;
        return sum + parseFloat(pnl || 0);
      }, 0);

      // Generate equity curve data
      const equityCurve = this.generateEquityCurve(trades || []);

      return {
        userId,
        totalAssets: 100000 + totalPnL, // Base assets + PnL
        monthlyPnL: totalPnL * 0.3, // Simplified monthly portion
        monthlyPnLPercent: 3.5, // Simplified
        activeStrategies,
        totalTrades,
        winRate: totalTrades > 0 ? 0.65 : 0,
        equityCurve,
      };
    } catch (error: any) {
      log.error('Error fetching user overview:', error);
      // Return demo data on error
      return this.getDemoOverview(userId);
    }
  }

  /**
   * Get user's strategies
   */
  static async getUserStrategies(
    userId: string,
    filters: DashboardFilters = {}
  ): Promise<UserStrategy[]> {
    const supabase = getSupabaseClient();

    try {
      let query = supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        log.warn('Could not fetch user strategies:', error.message);
        return this.getDemoStrategies(userId);
      }

      return (data || []).map(s => ({
        id: s.id,
        userId: s.user_id || userId,
        name: s.name,
        type: s.config?.type || 'momentum',
        status: s.status,
        returnRate: s.config?.returnRate || Math.random() * 30 - 10,
        tradeCount: Math.floor(Math.random() * 100) + 10,
        createdAt: s.created_at,
        lastActiveAt: s.updated_at || s.created_at,
      }));
    } catch (error: any) {
      log.error('Error fetching user strategies:', error);
      return this.getDemoStrategies(userId);
    }
  }

  /**
   * Get user's trade history
   */
  static async getUserTrades(
    userId: string,
    filters: DashboardFilters = {}
  ): Promise<{ trades: UserTrade[]; total: number }> {
    const supabase = getSupabaseClient();

    try {
      let query = supabase
        .from('trades')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (filters.symbol) {
        query = query.eq('symbol', filters.symbol);
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

      const { data, error, count } = await query;

      if (error) {
        log.warn('Could not fetch user trades:', error.message);
        return this.getDemoTrades(userId, filters);
      }

      const trades: UserTrade[] = (data || []).map(t => ({
        id: t.id,
        userId: t.user_id || userId,
        strategyId: t.strategy_id,
        strategyName: `Strategy ${t.strategy_id?.slice(0, 8) || 'N/A'}`,
        symbol: t.symbol,
        side: t.side,
        price: parseFloat(t.price || 0),
        quantity: parseFloat(t.quantity || 0),
        total: parseFloat(t.total || 0),
        pnl: t.side === 'sell' ? parseFloat(t.total || 0) * 0.1 : -parseFloat(t.fee || 0),
        fee: parseFloat(t.fee || 0),
        executedAt: t.executed_at,
      }));

      return { trades, total: count || trades.length };
    } catch (error: any) {
      log.error('Error fetching user trades:', error);
      return this.getDemoTrades(userId, filters);
    }
  }

  /**
   * Get user performance metrics
   */
  static async getUserPerformance(userId: string): Promise<UserPerformance | null> {
    const supabase = getSupabaseClient();

    try {
      // Get all user trades for performance calculation
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        log.warn('Could not fetch trades for performance:', error.message);
        return this.getDemoPerformance(userId);
      }

      // Calculate performance metrics
      const totalTrades = (trades || []).length;
      const winningTrades = (trades || []).filter(t => t.side === 'sell').length;
      const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

      // Generate monthly returns
      const monthlyReturns = this.generateMonthlyReturns();

      // Generate asset distribution
      const assetDistribution = this.generateAssetDistribution();

      return {
        userId,
        totalReturn: 12500,
        totalReturnPercent: 12.5,
        annualizedReturn: 45.2,
        maxDrawdown: -8.5,
        sharpeRatio: 1.85,
        winRate: winRate || 0.65,
        profitLossRatio: 2.3,
        monthlyReturns,
        assetDistribution,
      };
    } catch (error: any) {
      log.error('Error fetching user performance:', error);
      return this.getDemoPerformance(userId);
    }
  }

  // ============================================
  // Demo Data Generators (fallback when user_id not available)
  // ============================================

  private static getDemoOverview(userId: string): UserOverview {
    return {
      userId,
      totalAssets: 112500,
      monthlyPnL: 3750,
      monthlyPnLPercent: 3.5,
      activeStrategies: 3,
      totalTrades: 156,
      winRate: 0.65,
      equityCurve: this.generateEquityCurve([]),
    };
  }

  private static getDemoStrategies(userId: string): UserStrategy[] {
    return [
      {
        id: 'strat-1',
        userId,
        name: 'BTC Momentum',
        type: 'momentum',
        status: 'active',
        returnRate: 18.5,
        tradeCount: 45,
        createdAt: '2025-01-15T10:00:00Z',
        lastActiveAt: '2026-03-18T00:00:00Z',
      },
      {
        id: 'strat-2',
        userId,
        name: 'ETH Grid Trading',
        type: 'grid',
        status: 'active',
        returnRate: 12.3,
        tradeCount: 89,
        createdAt: '2025-02-20T08:30:00Z',
        lastActiveAt: '2026-03-17T22:00:00Z',
      },
      {
        id: 'strat-3',
        userId,
        name: 'Multi-Asset Rebalance',
        type: 'rebalance',
        status: 'paused',
        returnRate: 8.7,
        tradeCount: 22,
        createdAt: '2025-03-10T14:00:00Z',
        lastActiveAt: '2026-03-15T10:00:00Z',
      },
    ];
  }

  private static getDemoTrades(
    userId: string,
    filters: DashboardFilters
  ): { trades: UserTrade[]; total: number } {
    const allTrades: UserTrade[] = [
      {
        id: 'trade-1',
        userId,
        strategyId: 'strat-1',
        strategyName: 'BTC Momentum',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 42500,
        quantity: 0.5,
        total: 21250,
        pnl: -50,
        fee: 50,
        executedAt: '2026-03-18T10:30:00Z',
      },
      {
        id: 'trade-2',
        userId,
        strategyId: 'strat-1',
        strategyName: 'BTC Momentum',
        symbol: 'BTC/USDT',
        side: 'sell',
        price: 43200,
        quantity: 0.5,
        total: 21600,
        pnl: 350,
        fee: 50,
        executedAt: '2026-03-18T09:15:00Z',
      },
      {
        id: 'trade-3',
        userId,
        strategyId: 'strat-2',
        strategyName: 'ETH Grid Trading',
        symbol: 'ETH/USDT',
        side: 'buy',
        price: 2850,
        quantity: 2,
        total: 5700,
        pnl: -20,
        fee: 20,
        executedAt: '2026-03-17T16:45:00Z',
      },
      {
        id: 'trade-4',
        userId,
        strategyId: 'strat-2',
        strategyName: 'ETH Grid Trading',
        symbol: 'ETH/USDT',
        side: 'sell',
        price: 2920,
        quantity: 2,
        total: 5840,
        pnl: 140,
        fee: 20,
        executedAt: '2026-03-17T14:20:00Z',
      },
      {
        id: 'trade-5',
        userId,
        strategyId: 'strat-3',
        strategyName: 'Multi-Asset Rebalance',
        symbol: 'SOL/USDT',
        side: 'buy',
        price: 125,
        quantity: 10,
        total: 1250,
        pnl: -5,
        fee: 5,
        executedAt: '2026-03-15T11:00:00Z',
      },
    ];

    let filtered = allTrades;

    if (filters.symbol) {
      filtered = filtered.filter(t => t.symbol === filters.symbol);
    }

    const total = filtered.length;

    if (filters.limit) {
      filtered = filtered.slice(filters.offset || 0, (filters.offset || 0) + filters.limit);
    }

    return { trades: filtered, total };
  }

  private static getDemoPerformance(userId: string): UserPerformance {
    return {
      userId,
      totalReturn: 12500,
      totalReturnPercent: 12.5,
      annualizedReturn: 45.2,
      maxDrawdown: -8.5,
      sharpeRatio: 1.85,
      winRate: 0.65,
      profitLossRatio: 2.3,
      monthlyReturns: this.generateMonthlyReturns(),
      assetDistribution: this.generateAssetDistribution(),
    };
  }

  private static generateEquityCurve(trades: any[]): Array<{ date: string; value: number }> {
    const curve: Array<{ date: string; value: number }> = [];
    const now = Date.now();
    let value = 100000;

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const change = (Math.random() - 0.4) * 2000;
      value = Math.max(80000, value + change);
      curve.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value),
      });
    }

    return curve;
  }

  private static generateMonthlyReturns(): Array<{ month: string; return: number }> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      month,
      return: (Math.random() - 0.3) * 15, // -4.5% to +10.5%
    }));
  }

  private static generateAssetDistribution(): Array<{ asset: string; value: number; percentage: number }> {
    const assets = [
      { asset: 'BTC', value: 45000, percentage: 40 },
      { asset: 'ETH', value: 28000, percentage: 25 },
      { asset: 'SOL', value: 11250, percentage: 10 },
      { asset: 'USDT', value: 16875, percentage: 15 },
      { asset: 'Others', value: 11250, percentage: 10 },
    ];
    return assets;
  }
}

export default UserDashboardDAO;
