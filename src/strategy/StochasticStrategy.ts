/**
 * Stochastic Oscillator Strategy
 *
 * A momentum strategy that generates trading signals based on the Stochastic Oscillator.
 * The Stochastic Oscillator compares a security's closing price to its price range
 * over a given time period.
 *
 * Stochastic Formula:
 * %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
 * %D = SMA(%K, D period)  [Signal line]
 * Smoothed %K = SMA(%K, smooth period)
 *
 * Trading Signals:
 * - Buy: %K crosses above %D when both are in oversold zone (< oversold threshold)
 * - Sell: %K crosses below %D when both are in overbought zone (> overbought threshold)
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * Stochastic Strategy configuration
 */
export interface StochasticStrategyConfig extends StrategyConfig {
  params?: {
    /** K period - lookback period for %K calculation (default: 14) */
    kPeriod?: number;
    /** D period - smoothing period for %D signal line (default: 3) */
    dPeriod?: number;
    /** Smooth period - smoothing period for %K (default: 3) */
    smoothPeriod?: number;
    /** Overbought threshold (default: 80) - %K above this indicates overbought */
    overbought?: number;
    /** Oversold threshold (default: 20) - %K below this indicates oversold */
    oversold?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
  };
}

/**
 * Stochastic Oscillator data point
 */
export interface StochasticData {
  /** Raw %K value (before smoothing) */
  rawK: number;
  /** Smoothed %K value */
  k: number;
  /** %D signal line (SMA of %K) */
  d: number;
  /** Highest high over the period */
  highestHigh: number;
  /** Lowest low over the period */
  lowestLow: number;
}

/**
 * Stochastic Oscillator Strategy - 随机振荡器策略
 *
 * Implements Stochastic Oscillator strategy:
 * - Buy Signal: %K crosses above %D when both are below oversold threshold (default 20)
 * - Sell Signal: %K crosses below %D when both are above overbought threshold (default 80)
 */
export class StochasticStrategy extends Strategy {
  private kPeriod: number;
  private dPeriod: number;
  private smoothPeriod: number;
  private overbought: number;
  private oversold: number;
  private tradeQuantity: number;

  // Price history for high/low calculation
  private priceHistory: number[] = [];
  // Raw %K values (before smoothing)
  private rawKValues: number[] = [];
  // Smoothed %K values
  private smoothedKValues: number[] = [];
  // Current stochastic values
  private currentStochastic: StochasticData | null = null;
  // Previous %K and %D for crossover detection
  private prevK: number | null = null;
  private prevD: number | null = null;

  constructor(config: StochasticStrategyConfig) {
    super(config);

    // Default parameters
    this.kPeriod = config.params?.kPeriod ?? 14;
    this.dPeriod = config.params?.dPeriod ?? 3;
    this.smoothPeriod = config.params?.smoothPeriod ?? 3;
    this.overbought = config.params?.overbought ?? 80;
    this.oversold = config.params?.oversold ?? 20;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;

    // Validate parameters
    if (this.kPeriod < 1) {
      throw new Error('K period must be at least 1');
    }
    if (this.dPeriod < 1) {
      throw new Error('D period must be at least 1');
    }
    if (this.smoothPeriod < 1) {
      throw new Error('Smooth period must be at least 1');
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
    this.rawKValues = [];
    this.smoothedKValues = [];
    this.currentStochastic = null;
    this.prevK = null;
    this.prevD = null;
  }

  /**
   * Handle tick event - generate trading signals based on Stochastic Oscillator
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

    // Need at least kPeriod data points to calculate %K
    if (this.priceHistory.length < this.kPeriod) {
      return null;
    }

    // Calculate raw %K
    const rawK = this.calculateRawK();
    if (rawK === null) {
      return null;
    }

    this.rawKValues.push(rawK);

    // Need at least smoothPeriod raw %K values for smoothed %K
    if (this.rawKValues.length < this.smoothPeriod) {
      return null;
    }

    // Calculate smoothed %K
    const smoothedK = this.calculateSmoothedK();
    if (smoothedK === null) {
      return null;
    }

    this.smoothedKValues.push(smoothedK);

    // Need at least dPeriod smoothed %K values for %D
    if (this.smoothedKValues.length < this.dPeriod) {
      return null;
    }

    // Calculate %D (signal line)
    const d = this.calculateD();
    if (d === null) {
      return null;
    }

    // Get highest high and lowest low for the data point
    const recentPrices = this.priceHistory.slice(-this.kPeriod);
    const highestHigh = Math.max(...recentPrices);
    const lowestLow = Math.min(...recentPrices);

    // Store current stochastic values
    this.currentStochastic = {
      rawK,
      k: smoothedK,
      d,
      highestHigh,
      lowestLow,
    };

    // Generate signal based on crossover in extreme zones
    let signal: OrderSignal | null = null;

    if (this.prevK !== null && this.prevD !== null) {
      // Buy signal: %K crosses above %D when both are in oversold zone
      if (
        this.prevK <= this.prevD &&
        smoothedK > d &&
        smoothedK < this.oversold &&
        d < this.oversold
      ) {
        signal = this.createSignal('buy', midPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(smoothedK, 'buy'),
          reason: `Stochastic Bullish Crossover (Oversold): %K=${smoothedK.toFixed(2)} crossed above %D=${d.toFixed(2)} (both < ${this.oversold})`,
        });
      }
      // Sell signal: %K crosses below %D when both are in overbought zone
      else if (
        this.prevK >= this.prevD &&
        smoothedK < d &&
        smoothedK > this.overbought &&
        d > this.overbought
      ) {
        signal = this.createSignal('sell', midPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(smoothedK, 'sell'),
          reason: `Stochastic Bearish Crossover (Overbought): %K=${smoothedK.toFixed(2)} crossed below %D=${d.toFixed(2)} (both > ${this.overbought})`,
        });
      }
    }

    // Update previous values for next crossover detection
    this.prevK = smoothedK;
    this.prevD = d;

    return signal;
  }

  /**
   * Get mid price from order book
   */
  private getMidPrice(orderBook: any): number | null {
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid !== null && bestAsk !== null) {
      return (bestBid + bestAsk) / 2;
    }

    return null;
  }

  /**
   * Calculate raw %K
   * %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
   */
  private calculateRawK(): number | null {
    if (this.priceHistory.length < this.kPeriod) {
      return null;
    }

    const recentPrices = this.priceHistory.slice(-this.kPeriod);
    const highestHigh = Math.max(...recentPrices);
    const lowestLow = Math.min(...recentPrices);
    const close = recentPrices[recentPrices.length - 1];

    // Avoid division by zero
    const range = highestHigh - lowestLow;
    if (range === 0) {
      // If all prices are the same, %K is at the midpoint (50)
      return 50;
    }

    return (100 * (close - lowestLow)) / range;
  }

  /**
   * Calculate smoothed %K (SMA of raw %K)
   */
  private calculateSmoothedK(): number | null {
    if (this.rawKValues.length < this.smoothPeriod) {
      return null;
    }

    const recentK = this.rawKValues.slice(-this.smoothPeriod);
    const sum = recentK.reduce((acc, val) => acc + val, 0);
    return sum / this.smoothPeriod;
  }

  /**
   * Calculate %D (SMA of smoothed %K)
   */
  private calculateD(): number | null {
    if (this.smoothedKValues.length < this.dPeriod) {
      return null;
    }

    const recentSmoothedK = this.smoothedKValues.slice(-this.dPeriod);
    const sum = recentSmoothedK.reduce((acc, val) => acc + val, 0);
    return sum / this.dPeriod;
  }

  /**
   * Calculate confidence based on how extreme the stochastic value is
   * More extreme (closer to 0 or 100) = higher confidence
   */
  private calculateConfidence(k: number, side: 'buy' | 'sell'): number {
    if (side === 'buy') {
      // %K closer to 0 = more oversold = higher confidence
      // Scale from 0.5 (at oversold threshold) to 0.9 (at %K=0)
      const extremity = 1 - k / this.oversold;
      return Math.min(0.5 + extremity * 0.4, 0.9);
    } else {
      // %K closer to 100 = more overbought = higher confidence
      // Scale from 0.5 (at overbought threshold) to 0.9 (at %K=100)
      const extremity = (k - this.overbought) / (100 - this.overbought);
      return Math.min(0.5 + extremity * 0.4, 0.9);
    }
  }

  /**
   * Get current Stochastic Oscillator data
   */
  getStochastic(): StochasticData | null {
    return this.currentStochastic;
  }

  /**
   * Get current %K value (smoothed)
   */
  getK(): number | null {
    return this.currentStochastic?.k ?? null;
  }

  /**
   * Get current %D value (signal line)
   */
  getD(): number | null {
    return this.currentStochastic?.d ?? null;
  }

  /**
   * Get raw %K value (before smoothing)
   */
  getRawK(): number | null {
    return this.currentStochastic?.rawK ?? null;
  }

  /**
   * Get highest high over the period
   */
  getHighestHigh(): number | null {
    return this.currentStochastic?.highestHigh ?? null;
  }

  /**
   * Get lowest low over the period
   */
  getLowestLow(): number | null {
    return this.currentStochastic?.lowestLow ?? null;
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
      this.priceHistory.length >= this.kPeriod &&
      this.smoothedKValues.length >= this.dPeriod &&
      this.currentStochastic !== null
    );
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.rawKValues = [];
    this.smoothedKValues = [];
    this.currentStochastic = null;
    this.prevK = null;
    this.prevD = null;
  }
}
