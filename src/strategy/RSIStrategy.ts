/**
 * RSI (Relative Strength Index) Strategy
 *
 * A momentum oscillator strategy that generates buy signals when RSI is below
 * the oversold threshold (indicating potential upward reversal) and sell signals
 * when RSI is above the overbought threshold (indicating potential downward reversal).
 *
 * RSI Formula:
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * RSI Strategy configuration
 */
export interface RSIStrategyConfig extends StrategyConfig {
  params?: {
    /** RSI period (default: 14) */
    period?: number;
    /** Overbought threshold (default: 70) - RSI above this indicates overbought */
    overbought?: number;
    /** Oversold threshold (default: 30) - RSI below this indicates oversold */
    oversold?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
  };
}

/**
 * RSI Strategy - RSI 策略
 *
 * Implements RSI (Relative Strength Index) strategy:
 * - RSI < oversold (default 30): Buy signal (oversold condition)
 * - RSI > overbought (default 70): Sell signal (overbought condition)
 * - Otherwise: No signal
 */
export class RSIStrategy extends Strategy {
  private period: number;
  private overbought: number;
  private oversold: number;
  private tradeQuantity: number;

  // Price history for RSI calculation
  private priceHistory: number[] = [];
  // Previous average gain and loss for smooth RSI calculation
  private prevAvgGain: number | null = null;
  private prevAvgLoss: number | null = null;
  // Last calculated RSI value
  private lastRSI: number | null = null;
  // Track if we've seen enough data to calculate RSI
  private hasEnoughData: boolean = false;

  // Track if we're in a position to avoid repeated signals
  private lastSignal: 'buy' | 'sell' | null = null;

  constructor(config: RSIStrategyConfig) {
    super(config);

    // Default parameters
    this.period = config.params?.period ?? 14;
    this.overbought = config.params?.overbought ?? 70;
    this.oversold = config.params?.oversold ?? 30;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;

    // Validate parameters
    if (this.period <= 1) {
      throw new Error('RSI period must be greater than 1');
    }
    if (this.oversold >= this.overbought) {
      throw new Error('Oversold threshold must be less than overbought threshold');
    }
    if (this.oversold <= 0 || this.overbought >= 100) {
      throw new Error('Thresholds must be between 0 and 100');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.prevAvgGain = null;
    this.prevAvgLoss = null;
    this.lastRSI = null;
    this.hasEnoughData = false;
    this.lastSignal = null;
  }

  /**
   * Handle tick event - generate trading signals based on RSI
   */
  onTick(context: StrategyContext): OrderSignal | null {
    const marketData = context.getMarketData();

    // Get the mid price from order book
    const midPrice = this.getMidPrice(marketData.orderBook);
    if (midPrice === null) {
      return null;
    }

    // Add price to history
    this.priceHistory.push(midPrice);

    // Need at least (period + 1) data points to calculate RSI
    // (period price changes require period + 1 prices)
    if (this.priceHistory.length < this.period + 1) {
      return null;
    }

    // Calculate RSI
    const rsi = this.calculateRSI();

    if (rsi === null) {
      return null;
    }

    this.lastRSI = rsi;
    this.hasEnoughData = true;

    // Generate signal based on RSI levels
    let signal: OrderSignal | null = null;

    // Buy signal: RSI < oversold (and not already signaled buy)
    if (rsi < this.oversold && this.lastSignal !== 'buy') {
      signal = this.createSignal('buy', midPrice, this.tradeQuantity, {
        confidence: this.calculateConfidence(rsi, 'buy'),
        reason: `RSI Oversold: RSI=${rsi.toFixed(2)} < ${this.oversold}`,
      });
      this.lastSignal = 'buy';
    }
    // Sell signal: RSI > overbought (and not already signaled sell)
    else if (rsi > this.overbought && this.lastSignal !== 'sell') {
      signal = this.createSignal('sell', midPrice, this.tradeQuantity, {
        confidence: this.calculateConfidence(rsi, 'sell'),
        reason: `RSI Overbought: RSI=${rsi.toFixed(2)} > ${this.overbought}`,
      });
      this.lastSignal = 'sell';
    }
    // Reset signal state when RSI is in neutral zone
    else if (rsi >= this.oversold && rsi <= this.overbought) {
      this.lastSignal = null;
    }

    return signal;
  }

  /**
   * Get mid price from order book
   */
  private getMidPrice(orderBook: any): number | null {
    // Try to get best bid and ask
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid !== null && bestAsk !== null) {
      return (bestBid + bestAsk) / 2;
    }

    // Fallback to last trade price if available
    return null;
  }

  /**
   * Calculate RSI using Wilder's smoothing method
   *
   * RSI = 100 - (100 / (1 + RS))
   * RS = Average Gain / Average Loss
   */
  private calculateRSI(): number | null {
    if (this.priceHistory.length < this.period + 1) {
      return null;
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < this.priceHistory.length; i++) {
      changes.push(this.priceHistory[i] - this.priceHistory[i - 1]);
    }

    // Separate gains and losses
    const gains = changes.map(c => (c > 0 ? c : 0));
    const losses = changes.map(c => (c < 0 ? Math.abs(c) : 0));

    let avgGain: number;
    let avgLoss: number;

    // First calculation: simple average
    if (this.prevAvgGain === null || this.prevAvgLoss === null) {
      // Use the first 'period' changes for initial average
      const initialGains = gains.slice(0, this.period);
      const initialLosses = losses.slice(0, this.period);

      avgGain = initialGains.reduce((a, b) => a + b, 0) / this.period;
      avgLoss = initialLosses.reduce((a, b) => a + b, 0) / this.period;
    } else {
      // Use Wilder's smoothing method
      // New Average = ((Previous Average * (period - 1)) + Current) / period
      const lastGain = gains[gains.length - 1];
      const lastLoss = losses[losses.length - 1];

      avgGain = (this.prevAvgGain * (this.period - 1) + lastGain) / this.period;
      avgLoss = (this.prevAvgLoss * (this.period - 1) + lastLoss) / this.period;
    }

    // Store for next calculation
    this.prevAvgGain = avgGain;
    this.prevAvgLoss = avgLoss;

    // Calculate RS and RSI
    if (avgLoss === 0) {
      // If no losses, RSI is 100
      return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Calculate confidence based on RSI extremity
   * More extreme RSI = higher confidence
   */
  private calculateConfidence(rsi: number, side: 'buy' | 'sell'): number {
    if (side === 'buy') {
      // RSI closer to 0 = more oversold = higher confidence
      // Scale from 0.5 (at oversold threshold) to 0.9 (at RSI=0)
      const extremity = 1 - (rsi / this.oversold);
      return Math.min(0.5 + extremity * 0.4, 0.9);
    } else {
      // RSI closer to 100 = more overbought = higher confidence
      // Scale from 0.5 (at overbought threshold) to 0.9 (at RSI=100)
      const extremity = (rsi - this.overbought) / (100 - this.overbought);
      return Math.min(0.5 + extremity * 0.4, 0.9);
    }
  }

  /**
   * Get current RSI value
   */
  getRSI(): number | null {
    return this.lastRSI;
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Check if strategy has enough data to calculate RSI
   */
  isReady(): boolean {
    return this.hasEnoughData;
  }

  /**
   * Get current average gain (for testing/debugging)
   */
  getAvgGain(): number | null {
    return this.prevAvgGain;
  }

  /**
   * Get current average loss (for testing/debugging)
   */
  getAvgLoss(): number | null {
    return this.prevAvgLoss;
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.prevAvgGain = null;
    this.prevAvgLoss = null;
    this.lastRSI = null;
    this.hasEnoughData = false;
    this.lastSignal = null;
  }
}
