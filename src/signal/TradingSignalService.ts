/**
 * Trading Signal Service
 * Manages trading signal creation, publishing, and distribution
 */

import { EventEmitter } from 'events';
import {
  TradingSignalsDAO,
  SignalSubscriptionsDAO,
  SignalExecutionsDAO,
  SignalPublisherStatsDAO,
  TradingSignal,
  CreateSignalInput,
  SignalStatus,
  SignalType,
  RiskLevel,
} from '../database';
import { createLogger } from '../utils/logger';
import { createSignalNotification } from '../notification/NotificationService';

const log = createLogger('TradingSignalService');

export interface PublishSignalInput {
  publisherId: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType?: SignalType;
  entryPrice?: number;
  entryPriceRangeLow?: number;
  entryPriceRangeHigh?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  quantity?: number;
  title?: string;
  description?: string;
  analysis?: string;
  riskLevel?: RiskLevel;
  confidenceScore?: number;
  expiresAt?: Date;
}

export interface SignalFeedOptions {
  userId: string;
  symbols?: string[];
  limit?: number;
  offset?: number;
}

export interface SignalPublisherInfo {
  publisherId: string;
  totalSignals: number;
  activeSignals: number;
  winRate: number;
  avgPnlPercent: number;
  subscriberCount: number;
}

export class TradingSignalService extends EventEmitter {
  private signalsDAO: TradingSignalsDAO;
  private subscriptionsDAO: SignalSubscriptionsDAO;
  private executionsDAO: SignalExecutionsDAO;
  private statsDAO: SignalPublisherStatsDAO;

  constructor() {
    super();
    this.signalsDAO = new TradingSignalsDAO();
    this.subscriptionsDAO = new SignalSubscriptionsDAO();
    this.executionsDAO = new SignalExecutionsDAO();
    this.statsDAO = new SignalPublisherStatsDAO();
  }

  /**
   * Publish a new trading signal
   */
  async publishSignal(input: PublishSignalInput): Promise<TradingSignal> {
    log.info(`Publishing signal for ${input.symbol} by user ${input.publisherId}`);

    // Create the signal
    const signal = await this.signalsDAO.create({
      publisherId: input.publisherId,
      strategyId: input.strategyId,
      symbol: input.symbol,
      side: input.side,
      signalType: input.signalType || 'entry',
      entryPrice: input.entryPrice,
      entryPriceRangeLow: input.entryPriceRangeLow,
      entryPriceRangeHigh: input.entryPriceRangeHigh,
      targetPrice: input.targetPrice,
      stopLossPrice: input.stopLossPrice,
      quantity: input.quantity,
      title: input.title,
      description: input.description,
      analysis: input.analysis,
      riskLevel: input.riskLevel,
      confidenceScore: input.confidenceScore,
      expiresAt: input.expiresAt,
    });

    log.info(`Signal created: ${signal.id}`);

    // Notify subscribers
    await this.notifySubscribers(signal);

    // Update publisher stats
    await this.updatePublisherStats(signal.publisherId);

    // Emit event for real-time updates
    this.emit('signalPublished', signal);

    return signal;
  }

  /**
   * Get signal by ID
   */
  async getSignal(signalId: string): Promise<TradingSignal | null> {
    const signal = await this.signalsDAO.getById(signalId);
    
    if (signal) {
      // Increment view count
      await this.signalsDAO.incrementViews(signalId);
    }

    return signal;
  }

  /**
   * Get signal feed for a user (signals from subscribed sources)
   */
  async getSignalFeed(options: SignalFeedOptions): Promise<TradingSignal[]> {
    const { userId, symbols, limit = 20, offset = 0 } = options;

    // Get user's active subscriptions
    const subscriptions = await this.subscriptionsDAO.getSubscriptionsForSubscriber(userId, 'active');

    if (subscriptions.length === 0) {
      return [];
    }

    // Get signals from subscribed sources
    const allSignals: TradingSignal[] = [];

    for (const sub of subscriptions) {
      const signals = await this.signalsDAO.getMany({
        publisherId: sub.sourceType === 'user' ? sub.sourceId : undefined,
        strategyId: sub.sourceType === 'strategy' ? sub.sourceId : undefined,
        status: 'active',
        limit: 50,
      });

      allSignals.push(...signals);
    }

    // Filter by symbols if specified
    let filteredSignals = allSignals;
    if (symbols && symbols.length > 0) {
      filteredSignals = allSignals.filter((s) => symbols.includes(s.symbol));
    }

    // Sort by created_at descending
    filteredSignals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    return filteredSignals.slice(offset, offset + limit);
  }

  /**
   * Get all active signals (signal marketplace)
   */
  async getActiveSignals(options: {
    symbol?: string;
    riskLevel?: RiskLevel;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'views_count' | 'executions_count';
  } = {}): Promise<TradingSignal[]> {
    return this.signalsDAO.getMany({
      status: 'active',
      symbol: options.symbol,
      riskLevel: options.riskLevel,
      limit: options.limit || 50,
      offset: options.offset,
      orderBy: options.orderBy || 'created_at',
    });
  }

  /**
   * Cancel a signal
   */
  async cancelSignal(signalId: string, publisherId: string): Promise<TradingSignal> {
    const signal = await this.signalsDAO.getById(signalId);

    if (!signal) {
      throw new Error('Signal not found');
    }

    if (signal.publisherId !== publisherId) {
      throw new Error('Not authorized to cancel this signal');
    }

    if (signal.status !== 'active') {
      throw new Error('Signal is not active');
    }

    const updatedSignal = await this.signalsDAO.update(signalId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    this.emit('signalCancelled', updatedSignal);

    return updatedSignal;
  }

  /**
   * Mark signal as executed
   */
  async markSignalExecuted(
    signalId: string,
    executionPrice: number,
    pnl?: number,
    pnlPercent?: number
  ): Promise<TradingSignal> {
    const signal = await this.signalsDAO.update(signalId, {
      status: 'executed',
      executedAt: new Date(),
      executionPrice,
      pnl,
      pnlPercent,
    });

    await this.updatePublisherStats(signal.publisherId);

    return signal;
  }

  /**
   * Get publisher statistics
   */
  async getPublisherStats(publisherId: string): Promise<SignalPublisherInfo> {
    const allTimeStats = await this.statsDAO.getAllTimeStats(publisherId);
    const activeSignals = await this.signalsDAO.getActiveSignalsForPublisher(publisherId);
    const subscriberCount = await this.subscriptionsDAO.getSubscriberCount('user', publisherId);

    return {
      publisherId,
      totalSignals: allTimeStats?.totalSignals || 0,
      activeSignals: activeSignals.length,
      winRate: allTimeStats?.winRate || 0,
      avgPnlPercent: allTimeStats?.avgPnlPercent || 0,
      subscriberCount,
    };
  }

  /**
   * Get publisher's signal history
   */
  async getPublisherSignals(
    publisherId: string,
    options: { status?: SignalStatus; limit?: number; offset?: number } = {}
  ): Promise<TradingSignal[]> {
    return this.signalsDAO.getMany({
      publisherId,
      status: options.status,
      limit: options.limit || 50,
      offset: options.offset,
    });
  }

  /**
   * Expire signals that have passed their expiration time
   */
  async expireSignals(): Promise<number> {
    const count = await this.signalsDAO.expireSignals();
    
    if (count > 0) {
      log.info(`Expired ${count} signals`);
    }

    return count;
  }

  /**
   * Notify subscribers about a new signal
   */
  private async notifySubscribers(signal: TradingSignal): Promise<void> {
    // Get active subscriptions for this publisher
    const subscriptions = await this.subscriptionsDAO.getActiveSubscriptionsForSource(
      'user',
      signal.publisherId
    );

    log.info(`Notifying ${subscriptions.length} subscribers for signal ${signal.id}`);

    // Filter by allowed/blocked symbols
    const eligibleSubscriptions = subscriptions.filter((sub) => {
      // Check allowed symbols
      if (sub.allowedSymbols.length > 0 && !sub.allowedSymbols.includes(signal.symbol)) {
        return false;
      }

      // Check blocked symbols
      if (sub.blockedSymbols.includes(signal.symbol)) {
        return false;
      }

      return true;
    });

    // Send notifications
    for (const sub of eligibleSubscriptions) {
      try {
        // Increment signals received count
        await this.subscriptionsDAO.incrementSignalsReceived(sub.id);

        // Send in-app notification if enabled
        if (sub.notifyInApp) {
          await createSignalNotification(
            sub.subscriberId,
            signal.title || `New ${signal.side} signal for ${signal.symbol}`,
            signal.description || `Entry: ${signal.entryPrice || 'Market'}, Target: ${signal.targetPrice || 'N/A'}`,
            {
              symbol: signal.symbol,
              side: signal.side,
              price: signal.entryPrice,
              strategy: signal.strategyId,
              confidence: signal.confidenceScore,
            },
            {
              priority: signal.riskLevel === 'high' || signal.riskLevel === 'very_high' ? 'HIGH' : 'MEDIUM',
              actionUrl: `/signals/${signal.id}`,
              strategyId: signal.strategyId,
            }
          );
        }

        // BACKLOG(#426, #427): Push and email notifications pending
        // #426: Email service integration (EMAIL_SERVICE_PROVIDER, EMAIL_API_KEY)
        // #427: Push notification service (PUSH_SERVICE_PROVIDER, device tokens)
        // In-app notifications are currently implemented via createSignalNotification
      } catch (error) {
        log.error(`Failed to notify subscriber ${sub.subscriberId}:`, error);
      }
    }

    // Update subscribers notified count
    const supabase = (await import('../database/client')).getSupabaseClient();
    await supabase
      .from('trading_signals')
      .update({ subscribers_notified: eligibleSubscriptions.length })
      .eq('id', signal.id);
  }

  /**
   * Update publisher statistics
   */
  private async updatePublisherStats(publisherId: string): Promise<void> {
    try {
      const signals = await this.signalsDAO.getPublisherSignals(publisherId);
      const subscriberCount = await this.subscriptionsDAO.getSubscriberCount('user', publisherId);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate stats
      const totalSignals = signals.length;
      const activeSignals = signals.filter((s: TradingSignal) => s.status === 'active').length;
      const expiredSignals = signals.filter((s: TradingSignal) => s.status === 'expired').length;
      const executedSignals = signals.filter((s: TradingSignal) => s.status === 'executed').length;
      const cancelledSignals = signals.filter((s: TradingSignal) => s.status === 'cancelled').length;

      const signalsWithPnl = signals.filter((s: TradingSignal) => s.pnl !== undefined && s.pnl !== null);
      const winningSignals = signalsWithPnl.filter((s: TradingSignal) => (s.pnl || 0) > 0).length;
      const losingSignals = signalsWithPnl.filter((s: TradingSignal) => (s.pnl || 0) <= 0).length;
      const winRate = signalsWithPnl.length > 0 
        ? (winningSignals / signalsWithPnl.length) * 100 
        : 0;
      const avgPnlPercent = signalsWithPnl.length > 0
        ? signalsWithPnl.reduce((sum: number, s: TradingSignal) => sum + (s.pnlPercent || 0), 0) / signalsWithPnl.length
        : 0;
      const totalPnl = signalsWithPnl.reduce((sum: number, s: TradingSignal) => sum + (s.pnl || 0), 0);
      const totalViews = signals.reduce((sum: number, s: TradingSignal) => sum + s.viewsCount, 0);
      const totalExecutions = signals.reduce((sum: number, s: TradingSignal) => sum + s.executionsCount, 0);

      // Update all-time stats
      await this.statsDAO.upsert({
        publisherId,
        periodType: 'all_time',
        periodStart: new Date(0),
        periodEnd: now,
        totalSignals,
        activeSignals,
        expiredSignals,
        executedSignals,
        cancelledSignals,
        winningSignals,
        losingSignals,
        winRate,
        avgPnlPercent,
        totalPnl,
        totalViews,
        totalExecutions,
        subscriberCount,
      });

      // Update daily stats
      await this.statsDAO.upsert({
        publisherId,
        periodType: 'daily',
        periodStart: today,
        periodEnd: today,
        totalSignals: signals.filter((s: TradingSignal) => s.createdAt >= today).length,
        activeSignals,
        expiredSignals,
        executedSignals,
        cancelledSignals,
        winningSignals,
        losingSignals,
        winRate,
        avgPnlPercent,
        totalPnl,
        totalViews,
        totalExecutions,
        subscriberCount,
      });

      // Update weekly stats
      await this.statsDAO.upsert({
        publisherId,
        periodType: 'weekly',
        periodStart: weekStart,
        periodEnd: now,
        totalSignals: signals.filter((s: TradingSignal) => s.createdAt >= weekStart).length,
        activeSignals,
        expiredSignals,
        executedSignals,
        cancelledSignals,
        winningSignals,
        losingSignals,
        winRate,
        avgPnlPercent,
        totalPnl,
        totalViews,
        totalExecutions,
        subscriberCount,
      });

      // Update monthly stats
      await this.statsDAO.upsert({
        publisherId,
        periodType: 'monthly',
        periodStart: monthStart,
        periodEnd: now,
        totalSignals: signals.filter((s: TradingSignal) => s.createdAt >= monthStart).length,
        activeSignals,
        expiredSignals,
        executedSignals,
        cancelledSignals,
        winningSignals,
        losingSignals,
        winRate,
        avgPnlPercent,
        totalPnl,
        totalViews,
        totalExecutions,
        subscriberCount,
      });
    } catch (error) {
      log.error(`Failed to update publisher stats for ${publisherId}:`, error);
    }
  }
}

// Singleton instance
let tradingSignalService: TradingSignalService | null = null;

export function getTradingSignalService(): TradingSignalService {
  if (!tradingSignalService) {
    tradingSignalService = new TradingSignalService();
  }
  return tradingSignalService;
}
