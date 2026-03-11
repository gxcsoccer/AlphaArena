/**
 * Risk Control Module - 风险控制模块
 *
 * Implements various risk controls:
 * - Position limits
 * - Exposure limits
 * - Stop loss checks
 * - Order rate limiting
 */

import { RiskControlConfig, RiskCheckResult } from './types';
import { OrderSignal } from '../strategy/types';
import { PortfolioSnapshot } from '../portfolio/types';

/**
 * Order rate limiter - tracks orders per time window
 */
class OrderRateLimiter {
  private orders: number[] = [];
  private windowMs: number = 60000; // 1 minute default
  private maxOrders: number;

  constructor(maxOrders: number, windowMs: number = 60000) {
    this.maxOrders = maxOrders;
    this.windowMs = windowMs;
  }

  /**
   * Record an order and check if within limit
   */
  recordOrder(): boolean {
    const now = Date.now();

    // Remove old orders outside the window
    this.orders = this.orders.filter((timestamp) => now - timestamp < this.windowMs);

    // Check if within limit
    if (this.orders.length >= this.maxOrders) {
      return false;
    }

    // Record this order
    this.orders.push(now);
    return true;
  }

  /**
   * Get current order count in window
   */
  getOrderCount(): number {
    const now = Date.now();
    return this.orders.filter((timestamp) => now - timestamp < this.windowMs).length;
  }

  /**
   * Reset the limiter
   */
  reset(): void {
    this.orders = [];
  }
}

/**
 * Risk Control Manager
 */
export class RiskControl {
  private config: RiskControlConfig;
  private rateLimiter: OrderRateLimiter;
  private enabled: boolean;

  constructor(config: RiskControlConfig) {
    this.config = config;
    this.enabled = config.enabled;
    this.rateLimiter = new OrderRateLimiter(
      config.maxOrdersPerMinute,
      60000 // 1 minute
    );
  }

  /**
   * Enable or disable risk control
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if a signal should be approved
   */
  checkSignal(signal: OrderSignal, portfolio: PortfolioSnapshot): RiskCheckResult {
    if (!this.enabled) {
      return { approved: true };
    }

    // Check position limit
    const positionCheck = this.checkPositionLimit(signal, portfolio);
    if (!positionCheck.approved) {
      return positionCheck;
    }

    // Check exposure limit
    const exposureCheck = this.checkExposureLimit(signal, portfolio);
    if (!exposureCheck.approved) {
      return exposureCheck;
    }

    // Check rate limit
    const rateCheck = this.checkRateLimit();
    if (!rateCheck.approved) {
      return rateCheck;
    }

    return { approved: true };
  }

  /**
   * Check if a trade would trigger stop loss
   */
  checkStopLoss(
    symbol: string,
    currentPrice: number,
    portfolio: PortfolioSnapshot
  ): RiskCheckResult {
    if (!this.enabled) {
      return { approved: true };
    }

    const position = portfolio.positions.find((p) => p.symbol === symbol);

    if (!position || position.quantity === 0) {
      return { approved: true }; // No position, no stop loss check needed
    }

    const costBasis = position.averageCost;
    const priceChange = (currentPrice - costBasis) / costBasis;

    // Check if price has dropped below stop loss threshold
    if (priceChange < -this.config.stopLossPercent) {
      return {
        approved: false,
        reason: `Stop loss triggered: price dropped ${Math.abs(priceChange * 100).toFixed(2)}% (threshold: ${this.config.stopLossPercent * 100}%)`,
        riskType: 'stop_loss',
      };
    }

    return { approved: true };
  }

  /**
   * Record an order for rate limiting
   */
  recordOrder(): void {
    if (this.enabled) {
      this.rateLimiter.recordOrder();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskControlConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.maxOrdersPerMinute !== undefined) {
      this.rateLimiter = new OrderRateLimiter(config.maxOrdersPerMinute, 60000);
    }

    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskControlConfig {
    return { ...this.config };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    currentOrders: number;
    maxOrders: number;
    remaining: number;
  } {
    const current = this.rateLimiter.getOrderCount();
    return {
      currentOrders: current,
      maxOrders: this.config.maxOrdersPerMinute,
      remaining: Math.max(0, this.config.maxOrdersPerMinute - current),
    };
  }

  /**
   * Private: Check position limit
   */
  private checkPositionLimit(signal: OrderSignal, portfolio: PortfolioSnapshot): RiskCheckResult {
    if (signal.side === 'buy') {
      const position = portfolio.positions.find((p) => p.symbol === signal.id.split('-')[0]);
      const currentQuantity = position ? position.quantity : 0;
      const newQuantity = currentQuantity + signal.quantity;

      if (newQuantity > this.config.maxPositionSize) {
        return {
          approved: false,
          reason: `Position limit exceeded: ${newQuantity} > ${this.config.maxPositionSize}`,
          riskType: 'position_limit',
        };
      }
    }

    return { approved: true };
  }

  /**
   * Private: Check total exposure limit
   */
  private checkExposureLimit(signal: OrderSignal, portfolio: PortfolioSnapshot): RiskCheckResult {
    if (signal.side === 'buy') {
      const orderValue = signal.price * signal.quantity;
      const newExposure = portfolio.totalValue + orderValue;

      if (newExposure > this.config.maxTotalExposure) {
        return {
          approved: false,
          reason: `Total exposure limit exceeded: ${newExposure.toFixed(2)} > ${this.config.maxTotalExposure}`,
          riskType: 'exposure_limit',
        };
      }
    }

    return { approved: true };
  }

  /**
   * Private: Check rate limit
   */
  private checkRateLimit(): RiskCheckResult {
    const status = this.getRateLimitStatus();

    if (status.remaining <= 0) {
      return {
        approved: false,
        reason: `Order rate limit exceeded: ${status.currentOrders} orders in last minute (max: ${status.maxOrders})`,
        riskType: 'rate_limit',
      };
    }

    return { approved: true };
  }
}
