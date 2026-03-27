/**
 * Strategy Community DAO
 * Data access layer for strategy community operations (leaderboards, reports, etc.)
 */

import { getSupabaseClient } from './client';

// ==================== Types ====================

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportType = 'spam' | 'inappropriate' | 'fraud' | 'copyright' | 'other';
export type LeaderboardType = 'returns' | 'popularity' | 'stability' | 'win_rate' | 'recent';

export interface StrategyReport {
  id: string;
  reporterId: string;
  strategyId: string;
  reportType: ReportType;
  reason: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportInput {
  reporterId: string;
  strategyId: string;
  reportType: ReportType;
  reason: string;
}

export interface UpdateReportInput {
  status?: ReportStatus;
  resolvedBy?: string;
  resolution?: string;
}

export interface ReportFilters {
  reporterId?: string;
  strategyId?: string;
  status?: ReportStatus;
  reportType?: ReportType;
  limit?: number;
  offset?: number;
}

export interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  publisherId: string;
  publisherName?: string;
  score: number;
  metrics: {
    totalReturn?: number;
    winRate?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    subscriberCount?: number;
    ratingAvg?: number;
    signalCount?: number;
  };
  period: string;
  updatedAt: Date;
}

export interface LeaderboardConfig {
  type: LeaderboardType;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  category?: string;
  limit?: number;
}

export interface StrategyRanking {
  strategyId: string;
  category: string;
  period: string;
  returnRank: number;
  popularityRank: number;
  stabilityRank: number;
  overallRank: number;
  returnScore: number;
  popularityScore: number;
  stabilityScore: number;
  overallScore: number;
  updatedAt: Date;
}

export interface CommunityStats {
  totalStrategies: number;
  activeStrategies: number;
  totalSubscriptions: number;
  totalSignals: number;
  totalReviews: number;
  totalPublishers: number;
  topCategories: { category: string; count: number }[];
  recentGrowth: {
    newStrategies: number;
    newSubscriptions: number;
    newSignals: number;
  };
  updatedAt: Date;
}

// ==================== Strategy Reports DAO ====================

export class StrategyReportsDAO {
  async create(input: CreateReportInput): Promise<StrategyReport> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_reports')
      .insert({
        reporter_id: input.reporterId,
        strategy_id: input.strategyId,
        report_type: input.reportType,
        reason: input.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToReport(data);
  }

  async getById(id: string): Promise<StrategyReport | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('strategy_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapToReport(data);
  }

  async getMany(filters: ReportFilters = {}): Promise<StrategyReport[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('strategy_reports').select('*');

    if (filters.reporterId) {
      query = query.eq('reporter_id', filters.reporterId);
    }
    if (filters.strategyId) {
      query = query.eq('strategy_id', filters.strategyId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.reportType) {
      query = query.eq('report_type', filters.reportType);
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
    return (data || []).map(this.mapToReport);
  }

  async update(id: string, input: UpdateReportInput): Promise<StrategyReport> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.resolvedBy !== undefined) updateData.resolved_by = input.resolvedBy;
    if (input.resolution !== undefined) updateData.resolution = input.resolution;

    const { data, error } = await supabase
      .from('strategy_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToReport(data);
  }

  async getPendingCount(): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('strategy_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  }

  async getReportCountByStrategy(strategyId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('strategy_reports')
      .select('*', { count: 'exact', head: true })
      .eq('strategy_id', strategyId)
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  }

  private mapToReport(row: Record<string, unknown>): StrategyReport {
    return {
      id: row.id as string,
      reporterId: row.reporter_id as string,
      strategyId: row.strategy_id as string,
      reportType: row.report_type as ReportType,
      reason: row.reason as string,
      status: row.status as ReportStatus,
      resolvedBy: row.resolved_by as string | null,
      resolution: row.resolution as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// ==================== Strategy Leaderboard DAO ====================

export class StrategyLeaderboardDAO {
  /**
   * Get strategy leaderboard by type
   */
  async getLeaderboard(config: LeaderboardConfig): Promise<LeaderboardEntry[]> {
    const supabase = getSupabaseClient();
    const limit = config.limit || 20;

    // Build base query for approved public strategies
    let baseQuery = supabase
      .from('marketplace_strategies')
      .select(`
        id,
        name,
        publisher_id,
        subscriber_count,
        rating_avg,
        rating_count,
        view_count,
        signal_count,
        performance_metrics,
        created_at
      `)
      .eq('status', 'approved')
      .eq('visibility', 'public');

    if (config.category) {
      baseQuery = baseQuery.eq('category', config.category);
    }

    // Apply ordering based on leaderboard type
    switch (config.type) {
      case 'returns':
        baseQuery = baseQuery.order('performance_metrics->totalReturn', { ascending: false, nullsFirst: false });
        break;
      case 'popularity':
        baseQuery = baseQuery.order('subscriber_count', { ascending: false });
        break;
      case 'stability':
        baseQuery = baseQuery.order('performance_metrics->sharpeRatio', { ascending: false, nullsFirst: false });
        break;
      case 'win_rate':
        baseQuery = baseQuery.order('performance_metrics->winRate', { ascending: false, nullsFirst: false });
        break;
      case 'recent':
        baseQuery = baseQuery.order('created_at', { ascending: false });
        break;
    }

    baseQuery = baseQuery.limit(limit);

    const { data, error } = await baseQuery;

    if (error) throw error;

    // Map to leaderboard entries
    return (data || []).map((row, index) => {
      const metrics = row.performance_metrics as Record<string, unknown> || {};
      
      return {
        rank: index + 1,
        strategyId: row.id as string,
        strategyName: row.name as string,
        publisherId: row.publisher_id as string,
        score: this.calculateScore(config.type, {
          totalReturn: metrics.totalReturn as number,
          subscriberCount: row.subscriber_count as number,
          sharpeRatio: metrics.sharpeRatio as number,
          winRate: metrics.winRate as number,
          ratingAvg: row.rating_avg as number,
        }),
        metrics: {
          totalReturn: metrics.totalReturn as number,
          winRate: metrics.winRate as number,
          sharpeRatio: metrics.sharpeRatio as number,
          maxDrawdown: metrics.maxDrawdown as number,
          subscriberCount: row.subscriber_count as number,
          ratingAvg: row.rating_avg as number,
          signalCount: row.signal_count as number,
        },
        period: config.period,
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Get comprehensive rankings for a strategy
   */
  async getStrategyRankings(strategyId: string): Promise<StrategyRanking | null> {
    const supabase = getSupabaseClient();

    // Get strategy data
    const { data: strategy, error: strategyError } = await supabase
      .from('marketplace_strategies')
      .select('*')
      .eq('id', strategyId)
      .single();

    if (strategyError || !strategy) return null;

    // Get rankings in each category
    const category = strategy.category as string;
    const metrics = strategy.performance_metrics as Record<string, unknown> || {};

    // Calculate rankings (simplified - in production would use more complex queries)
    const [returnsRank, popularityRank, stabilityRank] = await Promise.all([
      this.getRankInCategory('returns', strategyId, category),
      this.getRankInCategory('popularity', strategyId, category),
      this.getRankInCategory('stability', strategyId, category),
    ]);

    const returnScore = (metrics.totalReturn as number) || 0;
    const popularityScore = (strategy.subscriber_count as number) || 0;
    const stabilityScore = (metrics.sharpeRatio as number) || 0;
    const overallScore = (returnScore * 0.4 + popularityScore * 0.3 + stabilityScore * 0.3);

    return {
      strategyId,
      category,
      period: 'all_time',
      returnRank: returnsRank,
      popularityRank: popularityRank,
      stabilityRank: stabilityRank,
      overallRank: Math.round((returnsRank + popularityRank + stabilityRank) / 3),
      returnScore,
      popularityScore,
      stabilityScore,
      overallScore,
      updatedAt: new Date(),
    };
  }

  /**
   * Get rank of a strategy in a specific category
   */
  private async getRankInCategory(
    type: LeaderboardType,
    strategyId: string,
    category?: string
  ): Promise<number> {
    const supabase = getSupabaseClient();

    // Get all strategies with better scores
    let query = supabase
      .from('marketplace_strategies')
      .select('id')
      .eq('status', 'approved')
      .eq('visibility', 'public');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error || !data) return 999;

    // Find rank based on type
    const currentStrategy = data.find(s => s.id === strategyId);
    if (!currentStrategy) return 999;

    // For simplicity, return rank based on position (would need more complex logic in production)
    return data.findIndex(s => s.id === strategyId) + 1;
  }

  /**
   * Calculate score for leaderboard entry
   */
  private calculateScore(
    type: LeaderboardType,
    metrics: {
      totalReturn?: number;
      subscriberCount?: number;
      sharpeRatio?: number;
      winRate?: number;
      ratingAvg?: number;
    }
  ): number {
    switch (type) {
      case 'returns':
        return metrics.totalReturn || 0;
      case 'popularity':
        return metrics.subscriberCount || 0;
      case 'stability':
        return metrics.sharpeRatio || 0;
      case 'win_rate':
        return metrics.winRate || 0;
      case 'recent':
        return (metrics.ratingAvg || 0) * (metrics.subscriberCount || 0);
      default:
        return 0;
    }
  }

  /**
   * Update leaderboard cache (called periodically)
   */
  async updateLeaderboardCache(): Promise<void> {
    // This would update a cached leaderboard table
    // For now, we query directly
  }
}

// ==================== Community Stats DAO ====================

export class CommunityStatsDAO {
  /**
   * Get overall community statistics
   */
  async getStats(): Promise<CommunityStats> {
    const supabase = getSupabaseClient();

    // Get counts in parallel
    const [
      strategiesRes,
      subscriptionsRes,
      signalsRes,
      reviewsRes,
      publishersRes,
      categoriesRes,
      recentStrategiesRes,
      recentSubscriptionsRes,
      recentSignalsRes,
    ] = await Promise.all([
      supabase.from('marketplace_strategies').select('id, status', { count: 'exact' }),
      supabase.from('strategy_marketplace_subscriptions').select('id', { count: 'exact' }),
      supabase.from('marketplace_strategy_signals').select('id', { count: 'exact' }),
      supabase.from('strategy_reviews').select('id', { count: 'exact' }),
      supabase.from('strategy_publisher_stats').select('publisher_id', { count: 'exact' }),
      supabase.from('marketplace_strategies').select('category').eq('status', 'approved'),
      supabase.from('marketplace_strategies')
        .select('id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('strategy_marketplace_subscriptions')
        .select('id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('marketplace_strategy_signals')
        .select('id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const strategies = strategiesRes.data || [];
    const categories = categoriesRes.data || [];

    // Calculate category distribution
    const categoryCounts = new Map<string, number>();
    categories.forEach(row => {
      const cat = row.category as string;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalStrategies: strategiesRes.count || 0,
      activeStrategies: strategies.filter(s => s.status === 'approved').length,
      totalSubscriptions: subscriptionsRes.count || 0,
      totalSignals: signalsRes.count || 0,
      totalReviews: reviewsRes.count || 0,
      totalPublishers: publishersRes.count || 0,
      topCategories,
      recentGrowth: {
        newStrategies: recentStrategiesRes.data?.length || 0,
        newSubscriptions: recentSubscriptionsRes.data?.length || 0,
        newSignals: recentSignalsRes.data?.length || 0,
      },
      updatedAt: new Date(),
    };
  }
}

// ==================== Singleton Instances ====================

let strategyReportsDAO: StrategyReportsDAO | null = null;
let strategyLeaderboardDAO: StrategyLeaderboardDAO | null = null;
let communityStatsDAO: CommunityStatsDAO | null = null;

export function getStrategyReportsDAO(): StrategyReportsDAO {
  if (!strategyReportsDAO) {
    strategyReportsDAO = new StrategyReportsDAO();
  }
  return strategyReportsDAO;
}

export function getStrategyLeaderboardDAO(): StrategyLeaderboardDAO {
  if (!strategyLeaderboardDAO) {
    strategyLeaderboardDAO = new StrategyLeaderboardDAO();
  }
  return strategyLeaderboardDAO;
}

export function getCommunityStatsDAO(): CommunityStatsDAO {
  if (!communityStatsDAO) {
    communityStatsDAO = new CommunityStatsDAO();
  }
  return communityStatsDAO;
}