/**
 * MACD (Moving Average Convergence Divergence) Strategy
 *
 * A trend-following momentum strategy that generates buy signals when the MACD line
 * crosses above the signal line (golden cross/bullish crossover), and sell signals
 * when the MACD line crosses below the signal line (death cross/bearish crossover).
 *
 * MACD Formula:
 * MACD Line = EMA(fastPeriod) - EMA(slowPeriod)
 * Signal Line = EMA(MACD Line, signalPeriod)
 * Histogram = MACD Line - Signal Line
 *
 * Standard parameters: fast=12, slow=26, signal=9
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * MACD Strategy configuration
 */
export interface MACDStrategyConfig extends StrategyConfig {
  params?: {
    /** Fast EMA period (default: 12) */
    fastPeriod?: number;
    /** Slow EMA period (default: 26) */
    slowPeriod?: number;
    /** Signal line period (default: 9) */
    signalPeriod?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
  };
}

/**
 * MACD data point
 */
export interface MACDData {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

/**
 * MACD Strategy - MACD 策略
 *
 * Implements MACD (Moving Average Convergence Divergence) strategy:
 * - Golden Cross: MACD line crosses above signal line → Buy signal
 * - Death Cross: MACD line crosses below signal line → Sell signal
 * - Otherwise: No signal
 */
export class MACDStrategy extends Strategy {
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  private tradeQuantity: number;

  // Price history for EMA calculation
  private priceHistory: number[] = [];
  // EMA values for fast and slow periods
  private fastEMA: number | null = null;
  private slowEMA: number | null = null;
  // MACD line history for signal line calculation
  private macdHistory: number[] = [];
  // Signal line EMA
  private signalLine: number | null = null;
  // Last MACD data for crossover detection
  private lastMACDLine: number | null = null;
  private lastSignalLine: number | null = null;
  // Current MACD data (for external access)
  private currentMACD: MACDData | null = null;

  constructor(config: MACDStrategyConfig) {
    super(config);

    // Default parameters (standard MACD settings)
    this.fastPeriod = config.params?.fastPeriod ?? 12;
    this.slowPeriod = config.params?.slowPeriod ?? 26;
    this.signalPeriod = config.params?.signalPeriod ?? 9;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;

    // Validate parameters
    if (this.fastPeriod >= this.slowPeriod) {
      throw new Error('Fast period must be less than slow period');
    }
    if (this.fastPeriod <= 0 || this.slowPeriod <= 0 || this.signalPeriod <= 0) {
      throw new Error('All periods must be positive');
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
    this.fastEMA = null;
    this.slowEMA = null;
    this.macdHistory = [];
    this.signalLine = null;
    this.lastMACDLine = null;
    this.lastSignalLine = null;
    this.currentMACD = null;
  }

  /**
   * Handle tick event - generate trading signals based on MACD crossover
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

    // Need at least slowPeriod data points to calculate slow EMA
    if (this.priceHistory.length < this.slowPeriod) {
      return null;
    }

    // Calculate EMAs
    this.fastEMA = this.calculateEMA(this.fastPeriod, this.fastEMA);
    this.slowEMA = this.calculateEMA(this.slowPeriod, this.slowEMA);

    if (this.fastEMA === null || this.slowEMA === null) {
      return null;
    }

    // Calculate MACD line
    const macdLine = this.fastEMA - this.slowEMA;
    this.macdHistory.push(macdLine);

    // Need at least signalPeriod MACD values to calculate signal line
    if (this.macdHistory.length < this.signalPeriod) {
      return null;
    }

    // Calculate signal line (EMA of MACD line)
    this.signalLine = this.calculateSignalEMA(this.signalPeriod, this.signalLine);

    if (this.signalLine === null) {
      return null;
    }

    // Calculate histogram
    const histogram = macdLine - this.signalLine;

    // Store current MACD data
    this.currentMACD = {
      macdLine,
      signalLine: this.signalLine,
      histogram,
    };

    // Generate signal based on crossover
    let signal: OrderSignal | null = null;

    if (this.lastMACDLine !== null && this.lastSignalLine !== null) {
      // Golden Cross: MACD line crosses above signal line
      if (this.lastMACDLine <= this.lastSignalLine && macdLine > this.signalLine) {
        signal = this.createSignal('buy', midPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(histogram, 'buy'),
          reason: `MACD Golden Cross: MACD(${macdLine.toFixed(4)}) crossed above Signal(${this.signalLine.toFixed(4)})`,
        });
      }
      // Death Cross: MACD line crosses below signal line
      else if (this.lastMACDLine >= this.lastSignalLine && macdLine < this.signalLine) {
        signal = this.createSignal('sell', midPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(histogram, 'sell'),
          reason: `MACD Death Cross: MACD(${macdLine.toFixed(4)}) crossed below Signal(${this.signalLine.toFixed(4)})`,
        });
      }
    }

    // Update last values for next crossover detection
    this.lastMACDLine = macdLine;
    this.lastSignalLine = this.signalLine;

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
   * Calculate Exponential Moving Average
   *
   * EMA = (Close - Previous EMA) * multiplier + Previous EMA
   * Multiplier = 2 / (Period + 1)
   */
  private calculateEMA(period: number, previousEMA: number | null): number | null {
    if (this.priceHistory.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    if (previousEMA === null) {
      const prices = this.priceHistory.slice(0, period);
      const sma = prices.reduce((sum, price) => sum + price, 0) / period;
      return sma;
    }

    // Subsequent EMA uses previous EMA
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    return (currentPrice - previousEMA) * multiplier + previousEMA;
  }

  /**
   * Calculate Signal Line EMA (EMA of MACD line values)
   */
  private calculateSignalEMA(period: number, previousEMA: number | null): number | null {
    if (this.macdHistory.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);

    // First signal line is SMA of MACD values
    if (previousEMA === null) {
      const macdValues = this.macdHistory.slice(0, period);
      const sma = macdValues.reduce((sum, macd) => sum + macd, 0) / period;
      return sma;
    }

    // Subsequent signal line uses previous EMA
    const currentMACD = this.macdHistory[this.macdHistory.length - 1];
    return (currentMACD - previousEMA) * multiplier + previousEMA;
  }

  /**
   * Calculate confidence based on histogram strength
   * Stronger histogram = higher confidence
   */
  private calculateConfidence(histogram: number, side: 'buy' | 'sell'): number {
    // Histogram magnitude indicates momentum strength
    const absHistogram = Math.abs(histogram);
    // Normalize to a reasonable confidence range (0.5 to 0.9)
    // This is a simple heuristic - in practice, you might want more sophisticated logic
    const normalizedConfidence = Math.min(0.5 + absHistogram * 10, 0.9);

    // For buy signals, positive histogram (MACD > Signal) is expected
    // For sell signals, negative histogram (MACD < Signal) is expected
    // This shouldn't happen in normal operation, but we check for sanity
    if (side === 'buy' && histogram < 0) {
      return 0.5; // Lower confidence if histogram is negative on buy
    }
    if (side === 'sell' && histogram > 0) {
      return 0.5; // Lower confidence if histogram is positive on sell
    }

    return normalizedConfidence;
  }

  /**
   * Get current MACD data
   */
  getMACDData(): MACDData | null {
    return this.currentMACD;
  }

  /**
   * Get current MACD line value
   */
  getMACDLine(): number | null {
    return this.currentMACD?.macdLine ?? null;
  }

  /**
   * Get current signal line value
   */
  getSignalLine(): number | null {
    return this.currentMACD?.signalLine ?? null;
  }

  /**
   * Get current histogram value
   */
  getHistogram(): number | null {
    return this.currentMACD?.histogram ?? null;
  }

  /**
   * Get fast EMA value
   */
  getFastEMA(): number | null {
    return this.fastEMA;
  }

  /**
   * Get slow EMA value
   */
  getSlowEMA(): number | null {
    return this.slowEMA;
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Check if strategy has enough data to generate signals
   */
  isReady(): boolean {
    return (
      this.priceHistory.length >= this.slowPeriod + this.signalPeriod &&
      this.currentMACD !== null
    );
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.fastEMA = null;
    this.slowEMA = null;
    this.macdHistory = [];
    this.signalLine = null;
    this.lastMACDLine = null;
    this.lastSignalLine = null;
    this.currentMACD = null;
  }
}
