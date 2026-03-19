/**
 * Strategy Marketplace Service
 * Business logic for strategy marketplace operations
 */

import { EventEmitter } from 'events';
import {
  MarketplaceStrategiesDAO,
  StrategySubscriptionsDAO,
  StrategyReviewsDAO,
  MarketplaceSignalsDAO,
  StrategyPublisherStatsDAO,
  getMarketplaceStrategiesDAO,
  getStrategySubscriptionsDAO,
  getStrategyReviewsDAO,
  getMarketplaceSignalsDAO,
  getStrategyPublisherStatsDAO,
  MarketplaceStrategy,
  StrategySubscription,
  StrategyReview,
  MarketplaceSignal,
  PublisherStats,
  CreateStrategyInput,
  UpdateStrategyInput,
  StrategyFilters,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionFilters,
  CreateReviewInput,
  UpdateReviewInput,
  CreateSignalInput,
  UpdateSignalInput,
  PerformanceMetrics,
} from '../database/strategy-marketplace.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('StrategyMarketplaceService');

export interface SignalBroadcast {
  signal: MarketplaceSignal;
  strategy: MarketplaceStrategy;
  subscribers: StrategySubscription[];
}

export interface SubscriptionResult {
  subscription: StrategySubscription;
  strategy: MarketplaceStrategy;
}

export class StrategyMarketplaceService extends EventEmitter {
  private strategiesDAO: MarketplaceStrategiesDAO;
  private subscriptionsDAO: StrategySubscriptionsDAO;
  private reviewsDAO: StrategyReviewsDAO;
  private signalsDAO: MarketplaceSignalsDAO;
  private publisherStatsDAO: StrategyPublisherStatsDAO;

  constructor() {
    super();
    this.strategiesDAO = getMarketplaceStrategiesDAO();
    this.subscriptionsDAO = getStrategySubscriptionsDAO();
    this.reviewsDAO = getStrategyReviewsDAO();
    this.signalsDAO = getMarketplaceSignalsDAO();
    this.publisherStatsDAO = getStrategyPublisherStatsDAO();
  }

  // ==================== Strategy Management ====================

  /**
   * Create a new strategy for the marketplace
   */
  async createStrategy(input: CreateStrategyInput): Promise<MarketplaceStrategy> {
    log.info(`Creating strategy: ${input.name} by ${input.publisherId}`);

    const strategy = await this.strategiesDAO.create(input);

    // Initialize publisher stats
    await this.publisherStatsDAO.getOrCreate(input.publisherId);

    this.emit('strategyCreated', strategy);
    return strategy;
  }

  /**
   * Update a strategy
   */
  async updateStrategy(id: string, publisherId: string, input: UpdateStrategyInput): Promise<MarketplaceStrategy> {
    const strategy = await this.strategiesDAO.getById(id);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== publisherId) {
      throw new Error('Not authorized to update this strategy');
    }

    const updated = await this.strategiesDAO.update(id, input);
    this.emit('strategyUpdated', updated);
    return updated;
  }

  /**
   * Publish a strategy to the marketplace
   */
  async publishStrategy(id: string, publisherId: string): Promise<MarketplaceStrategy> {
    const strategy = await this.strategiesDAO.getById(id);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== publisherId) {
      throw new Error('Not authorized to publish this strategy');
    }

    const published = await this.strategiesDAO.publish(id);
    this.emit('strategyPublished', published);
    return published;
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(id: string, publisherId: string): Promise<void> {
    const strategy = await this.strategiesDAO.getById(id);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== publisherId) {
      throw new Error('Not authorized to delete this strategy');
    }

    await this.strategiesDAO.delete(id);
    this.emit('strategyDeleted', { id, publisherId });
  }

  /**
   * Get strategy by ID and increment view count
   */
  async getStrategyWithViews(id: string): Promise<MarketplaceStrategy | null> {
    const strategy = await this.strategiesDAO.getById(id);
    if (strategy) {
      await this.strategiesDAO.incrementViews(id);
    }
    return strategy;
  }

  /**
   * List strategies with filters
   */
  async listStrategies(filters: StrategyFilters = {}): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany(filters);
  }

  /**
   * Get featured strategies
   */
  async getFeaturedStrategies(limit: number = 10): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      isFeatured: true,
      limit,
      orderBy: 'rating_avg',
      orderDirection: 'desc',
    });
  }

  /**
   * Get top rated strategies
   */
  async getTopRatedStrategies(limit: number = 10): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({
      status: 'approved',
      visibility: 'public',
      minRating: 4,
      limit,
      orderBy: 'rating_avg',
      orderDirection: 'desc',
    });
  }

  /**
   * Get strategies by publisher
   */
  async getPublisherStrategies(publisherId: string): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({ publisherId });
  }

  /**
   * Update strategy performance metrics
   */
  async updatePerformanceMetrics(strategyId: string, metrics: PerformanceMetrics): Promise<MarketplaceStrategy> {
    return this.strategiesDAO.update(strategyId, { performanceMetrics: metrics });
  }

  // ==================== Subscription Management ====================

  /**
   * Subscribe to a strategy
   */
  async subscribe(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
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

    const subscription = await this.subscriptionsDAO.create(input);

    log.info(`User ${input.subscriberId} subscribed to strategy ${input.strategyId}`);

    this.emit('subscribed', { subscription, strategy });

    return { subscription, strategy };
  }

  /**
   * Unsubscribe from a strategy
   */
  async unsubscribe(subscriptionId: string, subscriberId: string): Promise<void> {
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
   * Pause subscription
   */
  async pauseSubscription(subscriptionId: string, subscriberId: string): Promise<StrategySubscription> {
    const subscription = await this.subscriptionsDAO.getById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    if (subscription.subscriberId !== subscriberId) {
      throw new Error('Not authorized to pause this subscription');
    }

    const paused = await this.subscriptionsDAO.pause(subscriptionId);
    this.emit('subscriptionPaused', paused);
    return paused;
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: string, subscriberId: string): Promise<StrategySubscription> {
    const subscription = await this.subscriptionsDAO.getById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    if (subscription.subscriberId !== subscriberId) {
      throw new Error('Not authorized to resume this subscription');
    }

    const resumed = await this.subscriptionsDAO.resume(subscriptionId);
    this.emit('subscriptionResumed', resumed);
    return resumed;
  }

  /**
   * Update subscription settings
   */
  async updateSubscriptionSettings(
    subscriptionId: string,
    subscriberId: string,
    input: UpdateSubscriptionInput
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

  /**
   * Get user's subscriptions
   */
  async getUserSubscriptions(subscriberId: string, status?: string): Promise<StrategySubscription[]> {
    return this.subscriptionsDAO.getMany({ subscriberId, status: status as any });
  }

  /**
   * Get strategy subscribers
   */
  async getStrategySubscribers(strategyId: string): Promise<StrategySubscription[]> {
    return this.subscriptionsDAO.getActiveSubscriptionsForStrategy(strategyId);
  }

  // ==================== Review Management ====================

  /**
   * Create a review for a strategy
   */
  async createReview(input: CreateReviewInput): Promise<StrategyReview> {
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
  async updateReview(reviewId: string, userId: string, input: UpdateReviewInput): Promise<StrategyReview> {
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
   * Delete a review
   */
  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewsDAO.getById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }
    if (review.userId !== userId) {
      throw new Error('Not authorized to delete this review');
    }

    await this.reviewsDAO.delete(reviewId);
    this.emit('reviewDeleted', review);
  }

  /**
   * Get reviews for a strategy
   */
  async getStrategyReviews(strategyId: string, limit: number = 10): Promise<StrategyReview[]> {
    return this.reviewsDAO.getMany({ strategyId, status: 'active', limit });
  }

  // ==================== Signal Management ====================

  /**
   * Publish a trading signal from a strategy
   */
  async publishSignal(input: CreateSignalInput): Promise<SignalBroadcast> {
    // Verify strategy ownership
    const strategy = await this.strategiesDAO.getById(input.strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    if (strategy.publisherId !== input.publisherId) {
      throw new Error('Not authorized to publish signals for this strategy');
    }
    if (strategy.status !== 'approved') {
      throw new Error('Strategy must be approved to publish signals');
    }

    const signal = await this.signalsDAO.create(input);

    // Get active subscribers to notify
    const subscribers = await this.subscriptionsDAO.getActiveSubscriptionsForStrategy(input.strategyId);

    // Update notified count
    const supabase = (await import('../database/client')).getSupabaseClient();
    await supabase
      .from('marketplace_strategy_signals')
      .update({ subscribers_notified: subscribers.length })
      .eq('id', signal.id);

    // Increment signals received for each subscriber
    for (const sub of subscribers) {
      await this.subscriptionsDAO.incrementSignalsReceived(sub.id);
    }

    log.info(`Signal ${signal.id} published for strategy ${input.strategyId}, notifying ${subscribers.length} subscribers`);

    this.emit('signalPublished', { signal, strategy, subscribers });

    return { signal, strategy, subscribers };
  }

  /**
   * Update signal status
   */
  async updateSignalStatus(
    signalId: string,
    publisherId: string,
    input: UpdateSignalInput
  ): Promise<MarketplaceSignal> {
    const signal = await this.signalsDAO.getById(signalId);
    if (!signal) {
      throw new Error('Signal not found');
    }
    if (signal.publisherId !== publisherId) {
      throw new Error('Not authorized to update this signal');
    }

    const updated = await this.signalsDAO.update(signalId, input);
    this.emit('signalUpdated', updated);
    return updated;
  }

  /**
   * Get signals for a strategy
   */
  async getStrategySignals(strategyId: string, limit: number = 50): Promise<MarketplaceSignal[]> {
    return this.signalsDAO.getMany({ strategyId, limit });
  }

  /**
   * Get active signals for subscribed strategies
   */
  async getActiveSignalsForSubscriber(subscriberId: string): Promise<MarketplaceSignal[]> {
    const subscriptions = await this.subscriptionsDAO.getActiveSubscriptionsForUser(subscriberId);
    const strategyIds = subscriptions.map(s => s.strategyId);

    if (strategyIds.length === 0) return [];

    const signals: MarketplaceSignal[] = [];
    for (const strategyId of strategyIds) {
      const strategySignals = await this.signalsDAO.getActiveSignalsForStrategy(strategyId);
      signals.push(...strategySignals);
    }

    return signals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark signal as executed for a subscriber
   */
  async markSignalExecuted(
    subscriptionId: string,
    signalId: string,
    pnl: number
  ): Promise<void> {
    await this.subscriptionsDAO.incrementSignalsExecuted(subscriptionId, pnl);
    this.emit('signalExecuted', { subscriptionId, signalId, pnl });
  }

  // ==================== Publisher Stats ====================

  /**
   * Get publisher stats
   */
  async getPublisherStats(publisherId: string): Promise<PublisherStats> {
    return this.publisherStatsDAO.getOrCreate(publisherId);
  }

  /**
   * Refresh publisher stats
   */
  async refreshPublisherStats(publisherId: string): Promise<PublisherStats> {
    return this.publisherStatsDAO.updateStats(publisherId);
  }

  /**
   * Get top publishers
   */
  async getTopPublishers(limit: number = 10): Promise<PublisherStats[]> {
    return this.publisherStatsDAO.getTopPublishers(limit);
  }

  // ==================== Marketplace Utilities ====================

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    return this.strategiesDAO.getCategories();
  }

  /**
   * Get popular tags
   */
  async getTags(): Promise<string[]> {
    return this.strategiesDAO.getTags();
  }

  /**
   * Search strategies
   */
  async searchStrategies(query: string, limit: number = 20): Promise<MarketplaceStrategy[]> {
    return this.strategiesDAO.getMany({
      search: query,
      status: 'approved',
      visibility: 'public',
      limit,
    });
  }
}

// Singleton instance
let strategyMarketplaceService: StrategyMarketplaceService | null = null;

export function getStrategyMarketplaceService(): StrategyMarketplaceService {
  if (!strategyMarketplaceService) {
    strategyMarketplaceService = new StrategyMarketplaceService();
  }
  return strategyMarketplaceService;
}