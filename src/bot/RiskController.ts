/**
 * Risk Controller - 风险控制器
 *
 * Implements risk controls for trading bots:
 * - Position limits
 * - Capital allocation limits
 * - Stop loss / Take profit monitoring
 * - Order rate limiting
 * - Daily loss limits
 * - Anomaly detection
 */

import { EventEmitter } from 'events';
import { BotRiskSettings, BotState } from './BotConfig';

/**
 * Risk check result
 */
export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  riskType?: RiskType;
}

/**
 * Risk type enumeration
 */
export type RiskType =
  | 'position_limit'
  | 'capital_limit'
  | 'stop_loss'
  | 'take_profit'
  | 'rate_limit'
  | 'daily_loss_limit'
  | 'anomaly_detected';

/**
 * Risk event
 */
export interface RiskEvent {
  type: RiskType;
  botId: string;
  timestamp: Date;
  message: string;
  data?: Record<string, unknown>;
  action: 'warning' | 'blocked' | 'emergency_stop';
}

/**
 * Order rate limiter
 */
class OrderRateLimiter {
  private orders: number[] = [];
  private windowMs: number;
  private maxOrders: number;

  constructor(maxOrders: number, windowMs: number = 60000) {
    this.maxOrders = maxOrders;
    this.windowMs = windowMs;
  }

  canPlaceOrder(): boolean {
    const now = Date.now();
    this.orders = this.orders.filter((timestamp) => now - timestamp < this.windowMs);
    return this.orders.length < this.maxOrders;
  }

  recordOrder(): void {
    this.orders.push(Date.now());
  }

  getStatus(): { currentOrders: number; maxOrders: number; remaining: number } {
    const now = Date.now();
    const currentOrders = this.orders.filter((timestamp) => now - timestamp < this.windowMs).length;
    return {
      currentOrders,
      maxOrders: this.maxOrders,
      remaining: Math.max(0, this.maxOrders - currentOrders),
    };
  }

  reset(): void {
    this.orders = [];
  }
}

/**
 * Risk Controller
 */
export class RiskController extends EventEmitter {
  private settings: BotRiskSettings;
  private rateLimiter: OrderRateLimiter;
  private enabled: boolean;
  private botId: string;

  // Tracking for anomaly detection
  private recentPrices: number[] = [];
  private priceAnomalyThreshold: number = 0.1; // 10% price change

  constructor(botId: string, settings: BotRiskSettings) {
    super();
    this.botId = botId;
    this.settings = { ...settings };
    this.enabled = settings.riskControlEnabled;
    this.rateLimiter = new OrderRateLimiter(settings.maxOrdersPerMinute);
  }

  /**
   * Enable or disable risk control
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Update risk settings
   */
  updateSettings(settings: Partial<BotRiskSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.maxOrdersPerMinute !== undefined) {
      this.rateLimiter = new OrderRateLimiter(settings.maxOrdersPerMinute);
    }

    if (settings.riskControlEnabled !== undefined) {
      this.enabled = settings.riskControlEnabled;
    }
  }

  /**
   * Check if a buy order should be approved
   */
  checkBuyOrder(
    price: number,
    quantity: number,
    state: BotState
  ): RiskCheckResult {
    if (!this.enabled) {
      return { approved: true };
    }

    // Check rate limit
    if (!this.rateLimiter.canPlaceOrder()) {
      return this.blockOrder('rate_limit', 'Order rate limit exceeded');
    }

    // Check position limit
    const newPosition = state.positionQuantity + quantity;
    if (newPosition > this.settings.maxPositionSize) {
      return this.blockOrder(
        'position_limit',
        `Position limit exceeded: ${newPosition} > ${this.settings.maxPositionSize}`
      );
    }

    // Check capital limit
    const orderValue = price * quantity;
    const availableCapital = state.portfolioValue;
    let maxCapital: number;

    if (this.settings.usePercentageCapital) {
      maxCapital = availableCapital * this.settings.maxCapitalPerTrade;
    } else {
      maxCapital = this.settings.maxCapitalPerTrade;
    }

    if (orderValue > maxCapital) {
      return this.blockOrder(
        'capital_limit',
        `Capital limit exceeded: ${orderValue.toFixed(2)} > ${maxCapital.toFixed(2)}`
      );
    }

    // Check daily loss limit
    if (this.checkDailyLossLimit(state)) {
      return this.blockOrder(
        'daily_loss_limit',
        `Daily loss limit reached: ${((state.dailyPnL / state.initialCapital) * 100).toFixed(2)}% loss`
      );
    }

    // All checks passed
    this.rateLimiter.recordOrder();
    return { approved: true };
  }

  /**
   * Check if a sell order should be approved
   */
  checkSellOrder(
    price: number,
    quantity: number,
    state: BotState
  ): RiskCheckResult {
    if (!this.enabled) {
      return { approved: true };
    }

    // Check rate limit
    if (!this.rateLimiter.canPlaceOrder()) {
      return this.blockOrder('rate_limit', 'Order rate limit exceeded');
    }

    // Check position - can't sell more than we have
    if (quantity > state.positionQuantity) {
      return this.blockOrder(
        'position_limit',
        `Cannot sell more than current position: ${quantity} > ${state.positionQuantity}`
      );
    }

    // All checks passed
    this.rateLimiter.recordOrder();
    return { approved: true };
  }

  /**
   * Check if stop loss is triggered
   */
  checkStopLoss(
    currentPrice: number,
    averageCost: number,
    state: BotState
  ): boolean {
    if (!this.enabled || state.positionQuantity === 0) {
      return false;
    }

    const priceChange = (currentPrice - averageCost) / averageCost;
    const isTriggered = priceChange <= -this.settings.stopLossPercent;

    if (isTriggered) {
      this.emitRiskEvent('stop_loss', `Stop loss triggered at ${(priceChange * 100).toFixed(2)}%`, {
        currentPrice,
        averageCost,
        threshold: this.settings.stopLossPercent,
      }, 'emergency_stop');
    }

    return isTriggered;
  }

  /**
   * Check if take profit is triggered
   */
  checkTakeProfit(
    currentPrice: number,
    averageCost: number,
    state: BotState
  ): boolean {
    if (!this.enabled || state.positionQuantity === 0) {
      return false;
    }

    const priceChange = (currentPrice - averageCost) / averageCost;
    const isTriggered = priceChange >= this.settings.takeProfitPercent;

    if (isTriggered) {
      this.emitRiskEvent('take_profit', `Take profit triggered at ${(priceChange * 100).toFixed(2)}%`, {
        currentPrice,
        averageCost,
        threshold: this.settings.takeProfitPercent,
      }, 'warning');
    }

    return isTriggered;
  }

  /**
   * Check for price anomalies (potential manipulation or flash crash)
   */
  checkPriceAnomaly(currentPrice: number): boolean {
    if (!this.enabled) {
      return false;
    }

    this.recentPrices.push(currentPrice);

    // Keep only last 100 prices
    if (this.recentPrices.length > 100) {
      this.recentPrices.shift();
    }

    // Need at least 10 prices to detect anomaly
    if (this.recentPrices.length < 10) {
      return false;
    }

    const avgPrice = this.recentPrices.reduce((a, b) => a + b, 0) / this.recentPrices.length;
    const deviation = Math.abs(currentPrice - avgPrice) / avgPrice;

    if (deviation > this.priceAnomalyThreshold) {
      this.emitRiskEvent('anomaly_detected', `Price anomaly detected: ${(deviation * 100).toFixed(2)}% deviation`, {
        currentPrice,
        averagePrice: avgPrice,
        deviation,
      }, 'emergency_stop');
      return true;
    }

    return false;
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { currentOrders: number; maxOrders: number; remaining: number } {
    return this.rateLimiter.getStatus();
  }

  /**
   * Get current settings
   */
  getSettings(): BotRiskSettings {
    return { ...this.settings };
  }

  /**
   * Reset rate limiter (e.g., after pause/resume)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  /**
   * Clear price history (for testing or reset)
   */
  clearPriceHistory(): void {
    this.recentPrices = [];
  }

  /**
   * Check daily loss limit
   */
  private checkDailyLossLimit(state: BotState): boolean {
    if (this.settings.maxDailyLoss <= 0) {
      return false;
    }

    const dailyLossPercent = state.dailyPnL / state.initialCapital;
    return dailyLossPercent <= -this.settings.maxDailyLoss;
  }

  /**
   * Block an order and emit event
   */
  private blockOrder(riskType: RiskType, reason: string): RiskCheckResult {
    this.emitRiskEvent(riskType, reason, undefined, 'blocked');
    return {
      approved: false,
      reason,
      riskType,
    };
  }

  /**
   * Emit a risk event
   */
  private emitRiskEvent(
    type: RiskType,
    message: string,
    data?: Record<string, unknown>,
    action: 'warning' | 'blocked' | 'emergency_stop' = 'blocked'
  ): void {
    const event: RiskEvent = {
      type,
      botId: this.botId,
      timestamp: new Date(),
      message,
      data,
      action,
    };

    this.emit('risk', event);
  }
}
