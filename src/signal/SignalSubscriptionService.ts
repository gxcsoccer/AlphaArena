/**
 * Signal Subscription Service
 * Manages signal subscriptions and signal distribution to subscribers
 */

import { EventEmitter } from 'events';
import {
  SignalSubscriptionsDAO,
  SignalExecutionsDAO,
  TradingSignalsDAO,
  SignalSubscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionType,
  SubscriptionStatus,
  SignalExecution,
} from '../database';
import { createLogger } from '../utils/logger';

const log = createLogger('SignalSubscriptionService');

export interface SubscribeInput {
  subscriberId: string;
  sourceType: SubscriptionType;
  sourceId: string;
  autoExecute?: boolean;
  copyRatio?: number;
  fixedAmount?: number;
  maxAmount?: number;
  maxRiskPerTrade?: number;
  allowedSymbols?: string[];
  blockedSymbols?: string[];
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
}

export interface ExecuteSignalInput {
  signalId: string;
  userId: string;
  executionType: 'manual' | 'auto';
  quantity: number;
  price: number;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  signalsReceived: number;
  signalsExecuted: number;
  totalPnl: number;
}

export class SignalSubscriptionService extends EventEmitter {
  private subscriptionsDAO: SignalSubscriptionsDAO;
  private executionsDAO: SignalExecutionsDAO;
  private signalsDAO: TradingSignalsDAO;

  constructor() {
    super();
    this.subscriptionsDAO = new SignalSubscriptionsDAO();
    this.executionsDAO = new SignalExecutionsDAO();
    this.signalsDAO = new TradingSignalsDAO();
  }

  /**
   * Subscribe to a signal source (user or strategy)
   */
  async subscribe(input: SubscribeInput): Promise<SignalSubscription> {
    log.info(`User ${input.subscriberId} subscribing to ${input.sourceType}:${input.sourceId}`);

    const subscription = await this.subscriptionsDAO.create({
      subscriberId: input.subscriberId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      autoExecute: input.autoExecute,
      copyRatio: input.copyRatio,
      fixedAmount: input.fixedAmount,
      maxAmount: input.maxAmount,
      maxRiskPerTrade: input.maxRiskPerTrade,
      allowedSymbols: input.allowedSymbols,
      blockedSymbols: input.blockedSymbols,
      notifyInApp: input.notifyInApp,
      notifyPush: input.notifyPush,
      notifyEmail: input.notifyEmail,
    });

    this.emit('subscribed', subscription);

    return subscription;
  }

  /**
   * Unsubscribe from a signal source
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionsDAO.getById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await this.subscriptionsDAO.cancel(subscriptionId);

    this.emit('unsubscribed', subscription);

    log.info(`User ${subscription.subscriberId} unsubscribed from ${subscription.sourceType}:${subscription.sourceId}`);
  }

  /**
   * Update subscription settings
   */
  async updateSubscription(
    subscriptionId: string,
    input: UpdateSubscriptionInput
  ): Promise<SignalSubscription> {
    const subscription = await this.subscriptionsDAO.update(subscriptionId, input);

    this.emit('subscriptionUpdated', subscription);

    return subscription;
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<SignalSubscription> {
    const subscription = await this.subscriptionsDAO.pause(subscriptionId);

    this.emit('subscriptionPaused', subscription);

    return subscription;
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<SignalSubscription> {
    const subscription = await this.subscriptionsDAO.resume(subscriptionId);

    this.emit('subscriptionResumed', subscription);

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<SignalSubscription | null> {
    return this.subscriptionsDAO.getById(subscriptionId);
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(
    userId: string,
    status?: SubscriptionStatus
  ): Promise<SignalSubscription[]> {
    return this.subscriptionsDAO.getSubscriptionsForSubscriber(userId, status);
  }

  /**
   * Get subscribers for a signal source
   */
  async getSourceSubscribers(
    sourceType: SubscriptionType,
    sourceId: string
  ): Promise<SignalSubscription[]> {
    return this.subscriptionsDAO.getActiveSubscriptionsForSource(sourceType, sourceId);
  }

  /**
   * Execute a signal (create an execution record)
   */
  async executeSignal(input: ExecuteSignalInput): Promise<SignalExecution> {
    const { signalId, userId, executionType, quantity, price } = input;

    // Get the signal
    const signal = await this.signalsDAO.getById(signalId);
    if (!signal) {
      throw new Error('Signal not found');
    }

    // Get user's subscription to this signal source
    const subscription = await this.subscriptionsDAO.getBySubscriberAndSource(
      userId,
      'user',
      signal.publisherId
    );

    if (!subscription) {
      throw new Error('Not subscribed to this signal source');
    }

    // Validate execution against risk limits
    const validation = this.validateExecution(subscription, quantity, price);
    if (!validation.valid) {
      throw new Error(`Risk validation failed: ${validation.reason}`);
    }

    // Create execution record
    const execution = await this.executionsDAO.create({
      signalId,
      subscriptionId: subscription.id,
      userId,
      executionType,
      quantity,
      price,
    });

    // Update stats atomically
    await this.signalsDAO.incrementExecutions(signalId);

    this.emit('signalExecuted', { signal, execution, subscription });

    log.info(`Signal ${signalId} executed by user ${userId}`);

    return execution;
  }

  /**
   * Mark execution as filled
   */
  async markExecutionFilled(
    executionId: string,
    details: { orderId?: string; tradeId?: string }
  ): Promise<SignalExecution> {
    const execution = await this.executionsDAO.markFilled(executionId, details);

    // Update subscription stats atomically
    await this.subscriptionsDAO.incrementSignalsExecuted(execution.subscriptionId, 0);

    this.emit('executionFilled', execution);

    return execution;
  }

  /**
   * Mark execution as failed
   */
  async markExecutionFailed(executionId: string): Promise<SignalExecution> {
    const execution = await this.executionsDAO.markFailed(executionId);

    this.emit('executionFailed', execution);

    return execution;
  }

  /**
   * Close an execution with PnL
   */
  async closeExecution(
    executionId: string,
    pnl: number,
    pnlPercent: number
  ): Promise<SignalExecution> {
    const execution = await this.executionsDAO.closeExecution(executionId, pnl, pnlPercent);

    // Update subscription stats atomically
    await this.subscriptionsDAO.incrementSignalsExecuted(execution.subscriptionId, pnl);

    this.emit('executionClosed', execution);

    return execution;
  }

  /**
   * Get executions for a signal
   */
  async getSignalExecutions(signalId: string): Promise<SignalExecution[]> {
    return this.executionsDAO.getExecutionsForSignal(signalId);
  }

  /**
   * Get user's execution history
   */
  async getUserExecutions(userId: string, limit: number = 50): Promise<SignalExecution[]> {
    return this.executionsDAO.getExecutionsForUser(userId, limit);
  }

  /**
   * Get subscription statistics for a user
   */
  async getSubscriptionStats(userId: string): Promise<SubscriptionStats> {
    const subscriptions = await this.subscriptionsDAO.getSubscriptionsForSubscriber(userId);

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
      signalsReceived: subscriptions.reduce((sum, s) => sum + s.signalsReceived, 0),
      signalsExecuted: subscriptions.reduce((sum, s) => sum + s.signalsExecuted, 0),
      totalPnl: subscriptions.reduce((sum, s) => sum + s.totalPnl, 0),
    };
  }

  /**
   * Get execution statistics for a user
   */
  async getExecutionStats(userId: string): Promise<{
    total: number;
    filled: number;
    failed: number;
    totalPnl: number;
  }> {
    return this.executionsDAO.getExecutionStats(userId);
  }

  /**
   * Check if user should receive signal based on subscription settings
   */
  async shouldReceiveSignal(
    subscription: SignalSubscription,
    signalSymbol: string
  ): Promise<boolean> {
    // Check subscription status
    if (subscription.status !== 'active') {
      return false;
    }

    // Check allowed symbols
    if (
      subscription.allowedSymbols.length > 0 &&
      !subscription.allowedSymbols.includes(signalSymbol)
    ) {
      return false;
    }

    // Check blocked symbols
    if (subscription.blockedSymbols.includes(signalSymbol)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate position size for auto-execution
   */
  calculatePositionSize(
    subscription: SignalSubscription,
    signalQuantity: number,
    signalPrice: number
  ): number {
    if (subscription.fixedAmount) {
      // Fixed amount mode
      return subscription.fixedAmount / signalPrice;
    }

    // Ratio mode
    return signalQuantity * subscription.copyRatio;
  }

  /**
   * Validate execution against subscription risk limits
   */
  validateExecution(
    subscription: SignalSubscription,
    quantity: number,
    price: number
  ): { valid: boolean; reason?: string } {
    // Check max amount
    if (subscription.maxAmount) {
      const positionValue = quantity * price;
      if (positionValue > subscription.maxAmount) {
        return {
          valid: false,
          reason: `Position value ${positionValue} exceeds max amount ${subscription.maxAmount}`,
        };
      }
    }

    return { valid: true };
  }
}

// Singleton instance
let signalSubscriptionService: SignalSubscriptionService | null = null;

export function getSignalSubscriptionService(): SignalSubscriptionService {
  if (!signalSubscriptionService) {
    signalSubscriptionService = new SignalSubscriptionService();
  }
  return signalSubscriptionService;
}