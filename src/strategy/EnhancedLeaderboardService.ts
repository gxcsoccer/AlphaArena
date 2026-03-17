/**
 * Enhanced Leaderboard Service - 增强版排行榜计算服务
 * 
 * Features:
 * - Multi-dimensional rankings (ROI, Sharpe, Win Rate, Max Drawdown, Comprehensive Score)
 * - Time periods (Daily, Weekly, Monthly, All-time)
 * - Social features integration (likes, comments, followers)
 * - Competition support
 */

import { EventEmitter } from 'events';
import { StrategiesDAO, Strategy } from '../database/strategies.dao';
import { TradesDAO, Trade } from '../database/trades.dao';
import { SocialDAO, UserBadge, StrategyStats } from '../database/social.dao';
import { CompetitionsDAO, CompetitionParticipant } from '../database/competitions.dao';
import { LeaderboardDAO } from '../database/leaderboard.dao';

/**
 * Time period for rankings
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

/**
 * Sort criterion for leaderboard
 */
export type SortCriterion = 
  | 'roi'
  | 'sharpeRatio'
  | 'maxDrawdown'
  | 'totalPnL'
  | 'winRate'
  | 'totalVolume'
  | 'comprehensiveScore';

/**
 * Enhanced strategy metrics
 */
export interface EnhancedStrategyMetrics {
  strategyId: string;
  strategyName: string;
  status: string;
  // Basic metrics
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  // Comprehensive score
  comprehensiveScore: number;
  // Period-specific metrics
  periodStart: Date;
  periodEnd: Date;
  periodType: TimePeriod;
  // Social metrics
  likesCount: number;
  commentsCount: number;
  followersCount: number;
  // Rank change
  rankChange: number;
  // Badges
  badges: UserBadge[];
  // Calculated at
  calculatedAt: Date;
}

/**
 * Enhanced leaderboard entry
 */
export interface EnhancedLeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  status: string;
  metrics: EnhancedStrategyMetrics;
  rankChange: number;
  // User info
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  // Social stats
  isLiked?: boolean;
  isFollowing?: boolean;
}

/**
 * Ranking filter options
 */
export interface RankingFilter {
  sortBy: SortCriterion;
  period: TimePeriod;
  limit?: number;
  offset?: number;
  userId?: string;
}

/**
 * Rank history entry
 */
export interface RankHistoryEntry {
  strategyId: string;
  rank: number;
  previousRank: number | null;
  periodType: TimePeriod;
  sortBy: SortCriterion;
  recordedAt: Date;
}

/**
 * Badge definition
 */
interface BadgeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  condition: (metrics: EnhancedStrategyMetrics) => boolean;
}

/**
 * Predefined badges
 */
const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: 'top_trader',
    name: 'Top Trader',
    description: 'Achieved #1 rank in any category',
    icon: '🏆',
    condition: (m) => m.rankChange > 0 && m.rankChange >= 10,
  },
  {
    type: 'high_roi',
    name: 'ROI Master',
    description: 'ROI exceeds 50%',
    icon: '📈',
    condition: (m) => m.roi >= 50,
  },
  {
    type: 'risk_manager',
    name: 'Risk Manager',
    description: 'Max drawdown below 5%',
    icon: '🛡️',
    condition: (m) => m.maxDrawdown < 5,
  },
  {
    type: 'winning_streak',
    name: 'Winning Streak',
    description: '10+ consecutive winning trades',
    icon: '🔥',
    condition: (m) => m.consecutiveWins >= 10,
  },
  {
    type: 'sharpe_king',
    name: 'Sharpe King',
    description: 'Sharpe ratio above 3.0',
    icon: '👑',
    condition: (m) => m.sharpeRatio >= 3.0,
  },
  {
    type: 'high_volume',
    name: 'Volume King',
    description: 'Total volume exceeds $1M',
    icon: '💎',
    condition: (m) => m.totalVolume >= 1000000,
  },
  {
    type: 'consistent',
    name: 'Consistent Trader',
    description: 'Win rate above 70%',
    icon: '⭐',
    condition: (m) => m.winRate >= 70,
  },
  {
    type: 'rising_star',
    name: 'Rising Star',
    description: 'New trader with positive ROI',
    icon: '🌟',
    condition: (m) => m.totalTrades >= 10 && m.totalTrades <= 50 && m.roi > 0,
  },
];

/**
 * Enhanced Leaderboard Service
 */
export class EnhancedLeaderboardService extends EventEmitter {
  private strategiesDAO: StrategiesDAO;
  private tradesDAO: TradesDAO;
  private socialDAO: SocialDAO;
  private competitionsDAO: CompetitionsDAO;
  private leaderboardDAO: LeaderboardDAO;
  
  private cachedRankings: Map<string, EnhancedLeaderboardEntry[]> = new Map();
  private lastCalculation: Map<string, Date> = new Map();

  constructor() {
    super();
    this.strategiesDAO = new StrategiesDAO();
    this.tradesDAO = new TradesDAO();
    this.socialDAO = new SocialDAO();
    this.competitionsDAO = new CompetitionsDAO();
    this.leaderboardDAO = new LeaderboardDAO();
  }

  /**
   * Calculate comprehensive score
   * Weighted combination of multiple factors
   */
  private calculateComprehensiveScore(metrics: {
    roi: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalVolume: number;
  }): number {
    // Normalize each metric to 0-100 scale
    const roiScore = Math.min(Math.max(metrics.roi, -100), 100) + 100; // -100 to 100 -> 0 to 200
    const sharpeScore = Math.min(Math.max(metrics.sharpeRatio * 20, 0), 100); // 0 to 5 -> 0 to 100
    const drawdownScore = Math.max(100 - metrics.maxDrawdown * 5, 0); // Lower is better
    const winRateScore = metrics.winRate;
    const volumeScore = Math.min(metrics.totalVolume / 10000, 100); // 0 to $1M -> 0 to 100

    // Weights: ROI 30%, Sharpe 25%, Drawdown 20%, Win Rate 15%, Volume 10%
    const comprehensiveScore = 
      (roiScore / 2 * 0.30) + // ROI: 30%
      (sharpeScore * 0.25) + // Sharpe: 25%
      (drawdownScore * 0.20) + // Drawdown: 20%
      (winRateScore * 0.15) + // Win Rate: 15%
      (volumeScore * 0.10); // Volume: 10%

    return Math.round(comprehensiveScore * 100) / 100;
  }

  /**
   * Get time period range
   */
  private getPeriodRange(period: TimePeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = now;
    let start: Date;

    switch (period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all_time':
      default:
        start = new Date(0); // Beginning of time
        break;
    }

    return { start, end };
  }

  /**
   * Filter trades by time period
   */
  private filterTradesByPeriod(trades: Trade[], period: TimePeriod): Trade[] {
    const { start, end } = this.getPeriodRange(period);
    return trades.filter(trade => {
      const tradeTime = new Date(trade.executedAt);
      return tradeTime >= start && tradeTime <= end;
    });
  }

  /**
   * Calculate strategy metrics for a period
   */
  async calculateStrategyMetrics(
    strategyId: string,
    period: TimePeriod = 'all_time'
  ): Promise<EnhancedStrategyMetrics | null> {
    try {
      const strategy = await this.strategiesDAO.getById(strategyId);
      if (!strategy) return null;

      // Get all trades and filter by period
      const allTrades = await this.tradesDAO.getByStrategy(strategyId, 10000);
      const trades = this.filterTradesByPeriod(allTrades, period);
      
      const { start, end } = this.getPeriodRange(period);

      if (trades.length === 0) {
        return this.getEmptyMetrics(strategy, period, start, end);
      }

      // Calculate basic metrics
      const buys = trades.filter(t => t.side === 'buy');
      const sells = trades.filter(t => t.side === 'sell');
      
      const totalCost = buys.reduce((sum, t) => sum + t.total, 0);
      const totalProceeds = sells.reduce((sum, t) => sum + t.total, 0);
      const totalPnL = totalProceeds - totalCost;
      const totalVolume = trades.reduce((sum, t) => sum + t.total, 0);
      const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

      // Calculate win rate and trade-level P&L
      let profitableTrades = 0;
      let losingTrades = 0;
      let bestTrade = -Infinity;
      let worstTrade = Infinity;
      const tradePnLs: number[] = [];

      for (const sell of sells) {
        const correspondingBuy = buys.find(b => 
          b.orderId && sell.orderId && 
          b.orderId.slice(0, 8) === sell.orderId.slice(0, 8)
        ) || buys[0];
        
        if (correspondingBuy) {
          const tradePnL = sell.total - correspondingBuy.total;
          tradePnLs.push(tradePnL);
          
          if (tradePnL > 0) profitableTrades++;
          else losingTrades++;
          
          if (tradePnL > bestTrade) bestTrade = tradePnL;
          if (tradePnL < worstTrade) worstTrade = tradePnL;
        }
      }

      const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0;
      const sharpeRatio = this.calculateSharpeRatio(tradePnLs);
      const maxDrawdown = this.calculateMaxDrawdown(tradePnLs);
      const { consecutiveWins, consecutiveLosses } = this.calculateConsecutive(tradePnLs);

      // Calculate comprehensive score
      const comprehensiveScore = this.calculateComprehensiveScore({
        roi,
        sharpeRatio,
        maxDrawdown,
        winRate,
        totalVolume,
      });

      // Get social stats
      const socialStats = await this.socialDAO.getStrategyStats(strategyId);
      
      // Get badges
      const badges = await this.socialDAO.getUserBadges(strategy.id);

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: strategy.status,
        totalTrades: trades.length,
        totalVolume,
        totalPnL,
        roi,
        winRate,
        sharpeRatio,
        maxDrawdown,
        avgTradeSize,
        profitableTrades,
        losingTrades,
        consecutiveWins,
        consecutiveLosses,
        bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
        worstTrade: worstTrade === Infinity ? 0 : worstTrade,
        comprehensiveScore,
        periodStart: start,
        periodEnd: end,
        periodType: period,
        likesCount: socialStats?.likesCount || 0,
        commentsCount: socialStats?.commentsCount || 0,
        followersCount: socialStats?.followersCount || 0,
        rankChange: 0,
        badges,
        calculatedAt: new Date(),
      };
    } catch (error) {
      console.error(`[EnhancedLeaderboard] Error calculating metrics for strategy \${strategyId}:`, error);
      return null;
    }
  }

  /**
   * Get empty metrics for strategy with no trades
   */
  private getEmptyMetrics(
    strategy: Strategy,
    period: TimePeriod,
    start: Date,
    end: Date
  ): EnhancedStrategyMetrics {
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: strategy.status,
      totalTrades: 0,
      totalVolume: 0,
      totalPnL: 0,
      roi: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      avgTradeSize: 0,
      profitableTrades: 0,
      losingTrades: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      bestTrade: 0,
      worstTrade: 0,
      comprehensiveScore: 0,
      periodStart: start,
      periodEnd: end,
      periodType: period,
      likesCount: 0,
      commentsCount: 0,
      followersCount: 0,
      rankChange: 0,
      badges: [],
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate Sharpe Ratio
   */
  private calculateSharpeRatio(tradePnLs: number[]): number {
    if (tradePnLs.length < 2) return 0;

    const avg = tradePnLs.reduce((sum, pnl) => sum + pnl, 0) / tradePnLs.length;
    const variance = tradePnLs.reduce((sum, pnl) => sum + Math.pow(pnl - avg, 2), 0) / tradePnLs.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;
    return (avg / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Maximum Drawdown
   */
  private calculateMaxDrawdown(tradePnLs: number[]): number {
    if (tradePnLs.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const pnl of tradePnLs) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = (peak - cumulative) / (peak || 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown * 100;
  }

  /**
   * Calculate consecutive wins and losses
   */
  private calculateConsecutive(tradePnLs: number[]): { consecutiveWins: number; consecutiveLosses: number } {
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const pnl of tradePnLs) {
      if (pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > consecutiveWins) consecutiveWins = currentWins;
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > consecutiveLosses) consecutiveLosses = currentLosses;
      }
    }

    return { consecutiveWins, consecutiveLosses };
  }

  /**
   * Calculate full leaderboard
   */
  async calculateLeaderboard(filter: RankingFilter): Promise<EnhancedLeaderboardEntry[]> {
    const cacheKey = `\${filter.sortBy}_\${filter.period}`;
    
    // Check if we need to recalculate
    const lastCalc = this.lastCalculation.get(cacheKey);
    const now = new Date();
    const cacheTimeout = 60000; // 1 minute cache

    if (lastCalc && (now.getTime() - lastCalc.getTime()) < cacheTimeout) {
      const cached = this.cachedRankings.get(cacheKey);
      if (cached) {
        return this.applyPagination(cached, filter.limit, filter.offset);
      }
    }

    const strategies = await this.strategiesDAO.getAll();
    const entries: EnhancedLeaderboardEntry[] = [];
    const previousRanks: Map<string, number> = new Map();

    // Get previous rankings for rank change calculation
    const historicalData = await this.leaderboardDAO.getStrategyHistory(filter.sortBy === 'comprehensiveScore' ? 'roi' : filter.sortBy, 1);
    for (const hist of historicalData) {
      previousRanks.set(hist.strategyId, hist.rank);
    }

    // Calculate metrics for each strategy
    for (const strategy of strategies) {
      const metrics = await this.calculateStrategyMetrics(strategy.id, filter.period);
      if (metrics) {
        const previousRank = previousRanks.get(strategy.id);
        metrics.rankChange = previousRank ? previousRank - entries.length : 0;

        entries.push({
          rank: 0, // Will be set after sorting
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          metrics,
          rankChange: metrics.rankChange,
        });
      }
    }

    // Sort by criterion
    entries.sort((a, b) => {
      let comparison = 0;
      switch (filter.sortBy) {
        case 'roi':
          comparison = b.metrics.roi - a.metrics.roi;
          break;
        case 'sharpeRatio':
          comparison = b.metrics.sharpeRatio - a.metrics.sharpeRatio;
          break;
        case 'maxDrawdown':
          comparison = a.metrics.maxDrawdown - b.metrics.maxDrawdown;
          break;
        case 'totalPnL':
          comparison = b.metrics.totalPnL - a.metrics.totalPnL;
          break;
        case 'winRate':
          comparison = b.metrics.winRate - a.metrics.winRate;
          break;
        case 'totalVolume':
          comparison = b.metrics.totalVolume - a.metrics.totalVolume;
          break;
        case 'comprehensiveScore':
          comparison = b.metrics.comprehensiveScore - a.metrics.comprehensiveScore;
          break;
      }
      return comparison;
    });

    // Assign ranks and calculate rank changes
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.metrics.rankChange = previousRanks.get(entry.strategyId) 
        ? previousRanks.get(entry.strategyId)! - entry.rank 
        : 0;
    });

    // Cache results
    this.cachedRankings.set(cacheKey, entries);
    this.lastCalculation.set(cacheKey, now);

    // If userId provided, check if user has liked/followed each strategy
    if (filter.userId) {
      for (const entry of entries) {
        entry.isLiked = await this.socialDAO.hasLikedStrategy(entry.strategyId, filter.userId);
      }
    }

    return this.applyPagination(entries, filter.limit, filter.offset);
  }

  /**
   * Apply pagination to results
   */
  private applyPagination(
    entries: EnhancedLeaderboardEntry[],
    limit?: number,
    offset?: number
  ): EnhancedLeaderboardEntry[] {
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return entries.slice(start, end);
  }

  /**
   * Get rank history for a strategy
   */
  async getRankHistory(
    strategyId: string,
    period: TimePeriod = 'all_time',
    limit = 30
  ): Promise<RankHistoryEntry[]> {
    // This would typically query a rank_history table
    // For now, return simulated data based on leaderboard snapshots
    const history: RankHistoryEntry[] = [];
    
    const snapshots = await this.leaderboardDAO.getStrategyHistory(strategyId, limit);
    
    for (const snapshot of snapshots) {
      history.push({
        strategyId,
        rank: snapshot.rank,
        previousRank: snapshot.rankChange ? snapshot.rank - snapshot.rankChange : null,
        periodType: period,
        sortBy: 'roi',
        recordedAt: snapshot.createdAt,
      });
    }

    return history;
  }

  /**
   * Get user's rank percentile
   */
  async getPercentileRank(
    strategyId: string,
    sortBy: SortCriterion = 'comprehensiveScore',
    period: TimePeriod = 'all_time'
  ): Promise<number> {
    const entries = await this.calculateLeaderboard({ sortBy, period });
    const entry = entries.find(e => e.strategyId === strategyId);
    
    if (!entry) return 0;
    
    // Percentile = (total - rank) / total * 100
    const total = entries.length;
    return ((total - entry.rank + 1) / total) * 100;
  }

  /**
   * Check and award badges for a strategy
   */
  async checkAndAwardBadges(strategyId: string, userId: string): Promise<UserBadge[]> {
    const metrics = await this.calculateStrategyMetrics(strategyId);
    if (!metrics) return [];

    const newBadges: UserBadge[] = [];

    for (const badgeDef of BADGE_DEFINITIONS) {
      const hasBadge = await this.socialDAO.hasBadge(userId, badgeDef.type);
      
      if (!hasBadge && badgeDef.condition(metrics)) {
        const badge = await this.socialDAO.awardBadge(
          userId,
          badgeDef.type,
          badgeDef.name,
          badgeDef.description,
          badgeDef.icon,
          { strategyId, earnedAt: new Date().toISOString() }
        );
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(competitionId: string): Promise<CompetitionParticipant[]> {
    return this.competitionsDAO.getLeaderboard(competitionId);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedRankings.clear();
    this.lastCalculation.clear();
  }
}

export default EnhancedLeaderboardService;
