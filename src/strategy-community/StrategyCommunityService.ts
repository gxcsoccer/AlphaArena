/**
 * Strategy Community Service
 * Business logic for strategy sharing, discovery, and community features
 */

import { EventEmitter } from 'events';
import {
  StrategyReportsDAO,
  StrategyLeaderboardDAO,
  CommunityStatsDAO,
  getStrategyReportsDAO,
  getStrategyLeaderboardDAO,
  getCommunityStatsDAO,
  StrategyReport,
  LeaderboardEntry,
  LeaderboardConfig,
  CommunityStats,
  CreateReportInput,
  UpdateReportInput,
  ReportStatus,
  ReportType,
  LeaderboardType,
} from '../database/strategy-community.dao';
import {
  MarketplaceStrategiesDAO,
  StrategySubscriptionsDAO,
  StrategyReviewsDAO,
  getMarketplaceStrategiesDAO,
  getStrategySubscriptionsDAO,
  getStrategyReviewsDAO,
  MarketplaceStrategy,
  StrategySubscription,
  StrategyReview,
  CreateStrategyInput,
  UpdateStrategyInput,
  StrategyFilters,
  CreateSubscriptionInput,
  CreateReviewInput,
  StrategyVisibility,
} from '../database/strategy-marketplace.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyCommunityService');

export interface ShareStrategyInput {
  publisherId: string;
  name: string;
  description?: string;
  strategyType: string;
  category?: string;
  symbols?: string[];
  config?: Record<string, unknown>;
  riskParams?: Record<string, unknown>;
  tags?: string[];
  visibility?: StrategyVisibility;
  isVipExclusive?: boolean;
  subscriptionFee?: number;
  performanceMetrics?: {
    totalReturn?: number;
    annualizedReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    profitFactor?: number;
    avgTradeDuration?: number;
    totalTrades?: number;
  };
}

export interface LeaderboardResult {
  type: LeaderboardType;
  period: string;
  category?: string;
  entries: LeaderboardEntry[];
  updatedAt: Date;
}

export interface SubscribeResult {
  subscription: StrategySubscription;
  strategy: MarketplaceStrategy;
  isNew: boolean;
}

export interface CommunityOverview {
  stats: CommunityStats;
  featuredStrategies: MarketplaceStrategy[];
  topRated: MarketplaceStrategy[];
  recentStrategies: MarketplaceStrategy[];
  topPublishers: { id: string; name: string; strategies: number; subscribers: number }[];
}

export interface StrategyDetail {
  strategy: MarketplaceStrategy;
  publisher: {
    id: string;
    totalStrategies: number;
    avgRating: number;
    totalSubscribers: number;
  };
  reviews: StrategyReview[];
  ranking: {
    returnRank: number;
    popularityRank: number;
    stabilityRank: number;
    overallRank: number;
  } | null;
  isSubscribed: boolean;
  userReview: StrategyReview | null;
  reportCount: number;
}

export class StrategyCommunityService extends EventEmitter {
  private reportsDAO: StrategyReportsDAO;
  private leaderboardDAO: StrategyLeaderboardDAO;
  private communityStatsDAO: CommunityStatsDAO;
  private strategiesDAO: MarketplaceStrategiesDAO;
  private subscriptionsDAO: StrategySubscriptionsDAO;
  private reviewsDAO: StrategyReviewsDAO;

  constructor() {
    super();
    this.reportsDAO = getStrategyReportsDAO();
    this.leaderboardDAO = getStrategyLeaderboardDAO();
    this.communityStatsDAO = getCommunityStatsDAO();
    this.strategiesDAO = getMarketplaceStrategiesDAO();
    this.subscriptionsDAO = getStrategySubscriptionsDAO();
    this.reviewsDAO = getStrategyReviewsDAO();
  }

  // ==================== Strategy Sharing ====================

  /**
   * Share a strategy to the community
   */
  async shareStrategy(input: ShareStrategyInput): Promise<MarketplaceStrategy> {
    log.info(`Sharing strategy: ${input.name} by ${input.publisherId}`);

    // Create strategy with community visibility
    const strategyInput: CreateStrategyInput = {
      publisherId: input.publisherId,
      name: input.name,
      description: input.description,
      strategyType: input.strategyType,
      category: input.category || 'general',
      symbols: input.symbols || [],
      config: input.config || {},
      riskParams: input.riskParams || {},
      tags: input.tags || [],
      visibility: input.visibility || 'public',
      subscriptionFee: input.subscriptionFee || 0,
      performanceMetrics: input.performanceMetrics || {},
    };

    const strategy = await this.strategiesDAO.create(strategyInput);

    // Auto-publish if public
    if (input.visibility === 'public') {
      await this.strategiesDAO.publish(strategy.id);
    }

    this.emit('strategyShared', strategy);
    return strategy;
  }

  /**
   * Update strategy sharing settings
   */
  async updateSharingSettings(
    strategyId: string,
    publisherId: string,
    input: {
      visibility?: StrategyVisibility;
      isVipExclusive?: boolean;
      subscriptionFee?: number;
      tags?: string[];
      description?: string;
    }
  ): Promise<MarketplaceStrategy> {
    const strategy = await this.strategiesDAO.getById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== publisherId) {
      throw new Error('Not authorized to update this strategy');
    }

    const updateInput: UpdateStrategyInput = {
      visibility: input.visibility,
      subscriptionFee: input.subscriptionFee,
      tags: input.tags,
      description: input.description,
    };

    const updated = await this.strategiesDAO.update(strategyId, updateInput);
    this.emit('sharingSettingsUpdated', updated);
    return updated;
  }

  /**
   * Publish a strategy to the community
   */
  async publishToCommunity(strategyId: string, publisherId: string): Promise<MarketplaceStrategy> {
    const strategy = await this.strategiesDAO.getById(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== publisherId) {
      throw new Error('Not authorized to publish this strategy');
    }

    const published = await this.strategiesDAO.publish(strategyId);
    this.emit('strategyPublished', published);
    return published;
  }

  // ==================== Strategy Discovery ====================

  /**
   * Get community overview with highlights
   */
  async getCommunityOverview(): Promise<CommunityOverview> {
    const [stats, featured, topRated, recent] = await Promise.all([
      this.communityStatsDAO.getStats(),
      this.strategiesDAO.getMany({
        status: 'approved',
        visibility: 'public',
        isFeatured: true,
        limit: 5,
        orderBy: 'rating_avg',
        orderDirection: 'desc',
      }),
      this.strategiesDAO.getMany({
        status: 'approved',
        visibility: 'public',
        minRating: 4,
        limit: 5,
        orderBy: 'rating_avg',
        orderDirection: 'desc',
      }),
      this.strategiesDAO.getMany({
        status: 'approved',
        visibility: 'public',
        limit: 5,
        orderBy: 'created_at',
        orderDirection: 'desc',
      }),
    ]);

    // Get top publishers
    const { getStrategyPublisherStatsDAO } = await import('../database/strategy-marketplace.dao');
    const publisherStatsDAO = getStrategyPublisherStatsDAO();
    const topPublishersData = await publisherStatsDAO.getTopPublishers(5);
    
    const topPublishers = topPublishersData.map(p => ({
      id: p.publisherId,
      name: p.publisherId, // Would fetch actual name from user service
      strategies: p.totalStrategies,
      subscribers: p.totalSubscribers,
    }));

    return {
      stats,
      featuredStrategies: featured,
      topRated,
      recentStrategies: recent,
      topPublishers,
    };
  }

  /**
   * Get strategy leaderboard
   */
  async getLeaderboard(config: LeaderboardConfig): Promise<LeaderboardResult> {
    const entries = await this.leaderboardDAO.getLeaderboard(config);

    return {
      type: config.type,
      period: config.period,
      category: config.category,
      entries,
      updatedAt: new Date(),
    };
  }

  /**
   * Browse strategies by category
   */
  async browseByCategory(
    category: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: 'rating_avg' | 'subscriber_count' | 'created_at';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      category,
      limit: options.limit || 20,
      offset: options.offset,
      orderBy: options.orderBy || 'rating_avg',
      orderDirection: options.orderDirection || 'desc',
    });
  }

  /**
   * Search strategies
   */
  async searchStrategies(
    query: string,
    options: {
      category?: string;
      tags?: string[];
      minRating?: number;
      limit?: number;
    } = {}
  ): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      search: query,
      category: options.category,
      tags: options.tags,
      minRating: options.minRating,
      limit: options.limit || 20,
    });
  }

  /**
   * Get available categories with counts
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const categories = await this.strategiesDAO.getCategories();
    const stats = await this.communityStatsDAO.getStats();
    
    return stats.topCategories;
  }

  /**
   * Get popular tags
   */
  async getPopularTags(): Promise<string[]> {
    return this.strategiesDAO.getTags();
  }

  // ==================== Strategy Subscription ====================

  /**
   * Subscribe to a strategy
   */
  async subscribeToStrategy(
    input: CreateSubscriptionInput
  ): Promise<SubscribeResult> {
    const strategy = await this.strategiesDAO.getById(input.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.status !== 'approved') {
      throw new Error('Strategy is not available for subscription');
    }
    if (strategy.publisherId === input.subscriberId) {
      throw new Error('Cannot subscribe to your own strategy');
    }

    // Check if already subscribed
    const existing = await this.subscriptionsDAO.getBySubscriberAndStrategy(
      input.subscriberId,
      input.strategyId
    );

    if (existing) {
      if (existing.status === 'active') {
        return { subscription: existing, strategy, isNew: false };
      }
      // Reactivate
      const reactivated = await this.subscriptionsDAO.update(existing.id, {
        status: 'active',
        cancelledAt: undefined,
      });
      return { subscription: reactivated, strategy, isNew: false };
    }

    const subscription = await this.subscriptionsDAO.create(input);

    log.info(`User ${input.subscriberId} subscribed to strategy ${input.strategyId}`);

    this.emit('subscribed', { subscription, strategy });

    return { subscription, strategy, isNew: true };
  }

  /**
   * Unsubscribe from a strategy
   */
  async unsubscribeFromStrategy(subscriptionId: string, subscriberId: string): Promise<void> {
    const subscription = await this.subscriptionsDAO.getById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    if (subscription.subscriberId !== subscriberId) {
      throw new Error('Not authorized to cancel this subscription');
    }

    await this.subscriptionsDAO.cancel(subscriptionId);
    this.emit('unsubscribed', subscription);
  }

  /**
   * Get user's subscriptions
   */
  async getMySubscriptions(userId: string): Promise<{
    subscriptions: (StrategySubscription & { strategy: MarketplaceStrategy | null })[];
  }> {
    const subscriptions = await this.subscriptionsDAO.getActiveSubscriptionsForUser(userId);

    // Fetch strategy details for each subscription
    const subscriptionsWithStrategy = await Promise.all(
      subscriptions.map(async (sub) => {
        const strategy = await this.strategiesDAO.getById(sub.strategyId);
        return { ...sub, strategy };
      })
    );

    return { subscriptions: subscriptionsWithStrategy };
  }

  /**
   * Update subscription settings
   */
  async updateSubscription(
    subscriptionId: string,
    subscriberId: string,
    input: {
      autoExecute?: boolean;
      copyRatio?: number;
      notifySignal?: boolean;
      notifyExecution?: boolean;
    }
  ): Promise<StrategySubscription> {
    const subscription = await this.subscriptionsDAO.getById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    if (subscription.subscriberId !== subscriberId) {
      throw new Error('Not authorized to update this subscription');
    }

    return this.subscriptionsDAO.update(subscriptionId, input);
  }

  // ==================== Strategy Evaluation ====================

  /**
   * Rate and review a strategy
   */
  async reviewStrategy(
    input: CreateReviewInput
  ): Promise<StrategyReview> {
    // Check if user has subscribed to verify
    const subscription = await this.subscriptionsDAO.getBySubscriberAndStrategy(
      input.userId,
      input.strategyId
    );

    const reviewInput = {
      ...input,
      isVerifiedSubscriber: !!subscription && subscription.status === 'active',
    };

    const review = await this.reviewsDAO.create(reviewInput);
    this.emit('reviewCreated', review);
    return review;
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    input: { rating?: number; title?: string; content?: string }
  ): Promise<StrategyReview> {
    const review = await this.reviewsDAO.getById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }
    if (review.userId !== userId) {
      throw new Error('Not authorized to update this review');
    }

    const updated = await this.reviewsDAO.update(reviewId, input);
    this.emit('reviewUpdated', updated);
    return updated;
  }

  /**
   * Get reviews for a strategy
   */
  async getStrategyReviews(
    strategyId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<StrategyReview[]> {
    return this.reviewsDAO.getMany({
      strategyId,
      status: 'active',
      limit: options.limit || 20,
      offset: options.offset,
    });
  }

  // ==================== Strategy Reporting ====================

  /**
   * Report a strategy
   */
  async reportStrategy(input: CreateReportInput): Promise<StrategyReport> {
    // Check if strategy exists
    const strategy = await this.strategiesDAO.getById(input.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    const report = await this.reportsDAO.create(input);
    this.emit('strategyReported', report);

    log.info(`Strategy ${input.strategyId} reported by ${input.reporterId}: ${input.reportType}`);

    return report;
  }

  /**
   * Resolve a report (admin only)
   */
  async resolveReport(
    reportId: string,
    adminId: string,
    resolution: string,
    action: 'dismiss' | 'warning' | 'delist'
  ): Promise<StrategyReport> {
    const report = await this.reportsDAO.getById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const updated = await this.reportsDAO.update(reportId, {
      status: 'resolved',
      resolvedBy: adminId,
      resolution,
    });

    // Take action on strategy if needed
    if (action === 'delist') {
      await this.strategiesDAO.update(report.strategyId, { status: 'delisted' });
      this.emit('strategyDelisted', { strategyId: report.strategyId, reason: resolution });
    }

    this.emit('reportResolved', updated);
    return updated;
  }

  /**
   * Get reports (admin only)
   */
  async getReports(filters: {
    status?: ReportStatus;
    reportType?: ReportType;
    limit?: number;
    offset?: number;
  } = {}): Promise<StrategyReport[]> {
    return this.reportsDAO.getMany(filters);
  }

  // ==================== Strategy Details ====================

  /**
   * Get full strategy details with community data
   */
  async getStrategyDetails(
    strategyId: string,
    userId?: string
  ): Promise<StrategyDetail | null> {
    const strategy = await this.strategiesDAO.getById(strategyId);
    if (!strategy) return null;

    // Increment view count
    await this.strategiesDAO.incrementViews(strategyId);

    // Get publisher stats
    const { getStrategyPublisherStatsDAO } = await import('../database/strategy-marketplace.dao');
    const publisherStatsDAO = getStrategyPublisherStatsDAO();
    const publisherStats = await publisherStatsDAO.getByPublisher(strategy.publisherId);

    // Get reviews
    const reviews = await this.reviewsDAO.getMany({
      strategyId,
      status: 'active',
      limit: 10,
    });

    // Get rankings
    const rankings = await this.leaderboardDAO.getStrategyRankings(strategyId);

    // Check subscription status
    let isSubscribed = false;
    if (userId) {
      const subscription = await this.subscriptionsDAO.getBySubscriberAndStrategy(userId, strategyId);
      isSubscribed = !!subscription && subscription.status === 'active';
    }

    // Get user's review if exists
    let userReview: StrategyReview | null = null;
    if (userId) {
      userReview = await this.reviewsDAO.getByUserAndStrategy(userId, strategyId);
    }

    // Get report count
    const reportCount = await this.reportsDAO.getReportCountByStrategy(strategyId);

    return {
      strategy,
      publisher: {
        id: strategy.publisherId,
        totalStrategies: publisherStats?.totalStrategies || 0,
        avgRating: publisherStats?.avgRating || 0,
        totalSubscribers: publisherStats?.totalSubscribers || 0,
      },
      reviews,
      ranking: rankings ? {
        returnRank: rankings.returnRank,
        popularityRank: rankings.popularityRank,
        stabilityRank: rankings.stabilityRank,
        overallRank: rankings.overallRank,
      } : null,
      isSubscribed,
      userReview,
      reportCount,
    };
  }

  // ==================== Community Statistics ====================

  /**
   * Get community statistics
   */
  async getCommunityStats(): Promise<CommunityStats> {
    return this.communityStatsDAO.getStats();
  }

  /**
   * Get trending strategies (high recent activity)
   */
  async getTrendingStrategies(limit: number = 10): Promise<MarketplaceStrategy[]> {
    // Get strategies with recent subscriber growth
    const recentStrategies = await this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      limit,
      orderBy: 'subscriber_count',
      orderDirection: 'desc',
    });

    return recentStrategies;
  }
}

// Singleton instance
let strategyCommunityService: StrategyCommunityService | null = null;

export function getStrategyCommunityService(): StrategyCommunityService {
  if (!strategyCommunityService) {
    strategyCommunityService = new StrategyCommunityService();
  }
  return strategyCommunityService;
}