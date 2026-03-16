/**
 * Bollinger Bands Strategy
 *
 * A volatility-based strategy that generates trading signals based on Bollinger Bands.
 * Bollinger Bands consist of:
 * - Middle Band: Simple Moving Average (SMA)
 * - Upper Band: SMA + (Standard Deviation * multiplier)
 * - Lower Band: SMA - (Standard Deviation * multiplier)
 *
 * Trading Signals:
 * - Buy: Price touches or crosses below lower band (potential oversold condition)
 * - Sell: Price touches or crosses above upper band (potential overbought condition)
 * - Squeeze: Narrow bands indicate potential breakout (stored but not used for signals)
 *
 * Bollinger Bands Formula:
 * Middle Band = SMA(price, period)
 * Upper Band = Middle Band + (StdDev * stdDevMultiplier)
 * Lower Band = Middle Band - (StdDev * stdDevMultiplier)
 * Band Width = Upper Band - Lower Band
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * Bollinger Bands Strategy configuration
 */
export interface BollingerBandsStrategyConfig extends StrategyConfig {
  params?: {
    /** Period for SMA calculation (default: 20) */
    period?: number;
    /** Standard deviation multiplier (default: 2) */
    stdDevMultiplier?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
    /** Squeeze threshold - bands width below this indicates squeeze (default: 0.02 = 2%) */
    squeezeThreshold?: number;
  };
}

/**
 * Bollinger Bands data point
 */
export interface BollingerBandsData {
  upperBand: number;
  middleBand: number;
  lowerBand: number;
  bandWidth: number;
  percentB: number; // (price - lowerBand) / (upperBand - lowerBand)
  isSqueeze: boolean;
}

/**
 * Bollinger Bands Strategy - 布林带策略
 *
 * Implements Bollinger Bands strategy:
 * - Price crosses below lower band: Buy signal (oversold)
 * - Price crosses above upper band: Sell signal (overbought)
 * - Squeeze detection: Narrow bands indicate potential breakout
 */
export class BollingerBandsStrategy extends Strategy {
  private period: number;
  private stdDevMultiplier: number;
  private tradeQuantity: number;
  private squeezeThreshold: number;

  // Price history for calculation
  private priceHistory: number[] = [];
  // Current Bollinger Bands values
  private currentBands: BollingerBandsData | null = null;
  // Track if we're in a position to avoid repeated signals
  private lastSignal: 'buy' | 'sell' | null = null;
  // Track squeeze state
  private inSqueeze: boolean = false;

  constructor(config: BollingerBandsStrategyConfig) {
    super(config);

    // Default parameters
    this.period = config.params?.period ?? 20;
    this.stdDevMultiplier = config.params?.stdDevMultiplier ?? 2;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    this.squeezeThreshold = config.params?.squeezeThreshold ?? 0.02;

    // Validate parameters
    if (this.period <= 1) {
      throw new Error('Period must be greater than 1');
    }
    if (this.stdDevMultiplier <= 0) {
      throw new Error('Standard deviation multiplier must be positive');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
    if (this.squeezeThreshold <= 0 || this.squeezeThreshold >= 1) {
      throw new Error('Squeeze threshold must be between 0 and 1');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.currentBands = null;
    this.lastSignal = null;
    this.inSqueeze = false;
  }

  /**
   * Handle tick event - generate trading signals based on Bollinger Bands
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

    // Need at least 'period' data points to calculate bands
    if (this.priceHistory.length < this.period) {
      return null;
    }

    // Calculate Bollinger Bands
    const bands = this.calculateBollingerBands();

    if (bands === null) {
      return null;
    }

    this.currentBands = bands;

    // Check for squeeze
    const bandWidthPercent = bands.bandWidth / bands.middleBand;
    this.inSqueeze = bandWidthPercent < this.squeezeThreshold;

    // Generate signal based on price position relative to bands
    let signal: OrderSignal | null = null;

    // Buy signal: Price touches or crosses below lower band
    if (midPrice <= bands.lowerBand && this.lastSignal !== 'buy') {
      signal = this.createSignal('buy', midPrice, this.tradeQuantity, {
        confidence: this.calculateConfidence(midPrice, bands, 'buy'),
        reason: this.inSqueeze
          ? `Bollinger Oversold (Squeeze): Price=${midPrice.toFixed(2)} <= Lower Band=${bands.lowerBand.toFixed(2)}`
          : `Bollinger Oversold: Price=${midPrice.toFixed(2)} <= Lower Band=${bands.lowerBand.toFixed(2)}`,
      });
      this.lastSignal = 'buy';
    }
    // Sell signal: Price touches or crosses above upper band
    else if (midPrice >= bands.upperBand && this.lastSignal !== 'sell') {
      signal = this.createSignal('sell', midPrice, this.tradeQuantity, {
        confidence: this.calculateConfidence(midPrice, bands, 'sell'),
        reason: this.inSqueeze
          ? `Bollinger Overbought (Squeeze): Price=${midPrice.toFixed(2)} >= Upper Band=${bands.upperBand.toFixed(2)}`
          : `Bollinger Overbought: Price=${midPrice.toFixed(2)} >= Upper Band=${bands.upperBand.toFixed(2)}`,
      });
      this.lastSignal = 'sell';
    }
    // Reset signal state when price is within bands
    else if (midPrice > bands.lowerBand && midPrice < bands.upperBand) {
      this.lastSignal = null;
    }

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
   * Calculate Bollinger Bands
   *
   * Middle Band = SMA
   * Upper Band = SMA + (StdDev * multiplier)
   * Lower Band = SMA - (StdDev * multiplier)
   */
  private calculateBollingerBands(): BollingerBandsData | null {
    if (this.priceHistory.length < this.period) {
      return null;
    }

    // Get the most recent 'period' prices
    const recentPrices = this.priceHistory.slice(-this.period);

    // Calculate SMA (Middle Band)
    const sum = recentPrices.reduce((acc, price) => acc + price, 0);
    const sma = sum / this.period;

    // Calculate Standard Deviation
    const squaredDiffs = recentPrices.map(price => Math.pow(price - sma, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / this.period;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Calculate Upper and Lower Bands
    const upperBand = sma + (stdDev * this.stdDevMultiplier);
    const lowerBand = sma - (stdDev * this.stdDevMultiplier);

    // Calculate Band Width
    const bandWidth = upperBand - lowerBand;

    // Get current price
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];

    // Calculate %B (position within bands)
    const percentB = bandWidth > 0 
      ? (currentPrice - lowerBand) / bandWidth 
      : 0.5; // Default to middle if bands are collapsed

    // Detect squeeze
    const bandWidthPercent = bandWidth / sma;
    const isSqueeze = bandWidthPercent < this.squeezeThreshold;

    return {
      upperBand,
      middleBand: sma,
      lowerBand,
      bandWidth,
      percentB,
      isSqueeze,
    };
  }

  /**
   * Calculate confidence based on how extreme the price position is
   * More extreme position = higher confidence
   */
  private calculateConfidence(
    price: number,
    bands: BollingerBandsData,
    side: 'buy' | 'sell'
  ): number {
    if (side === 'buy') {
      // Price further below lower band = higher confidence
      // percentB < 0 means price is below lower band
      // Lower percentB = more oversold = higher confidence
      const extremity = Math.max(0, -bands.percentB);
      return Math.min(0.5 + extremity * 0.4, 0.9);
    } else {
      // Price further above upper band = higher confidence
      // percentB > 1 means price is above upper band
      // Higher percentB = more overbought = higher confidence
      const extremity = Math.max(0, bands.percentB - 1);
      return Math.min(0.5 + extremity * 0.4, 0.9);
    }
  }

  /**
   * Get current Bollinger Bands data
   */
  getBands(): BollingerBandsData | null {
    return this.currentBands;
  }

  /**
   * Get current upper band
   */
  getUpperBand(): number | null {
    return this.currentBands?.upperBand ?? null;
  }

  /**
   * Get current middle band (SMA)
   */
  getMiddleBand(): number | null {
    return this.currentBands?.middleBand ?? null;
  }

  /**
   * Get current lower band
   */
  getLowerBand(): number | null {
    return this.currentBands?.lowerBand ?? null;
  }

  /**
   * Get current band width
   */
  getBandWidth(): number | null {
    return this.currentBands?.bandWidth ?? null;
  }

  /**
   * Get current %B value
   */
  getPercentB(): number | null {
    return this.currentBands?.percentB ?? null;
  }

  /**
   * Check if currently in squeeze
   */
  isInSqueeze(): boolean {
    return this.inSqueeze;
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
    return this.priceHistory.length >= this.period && this.currentBands !== null;
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.currentBands = null;
    this.lastSignal = null;
    this.inSqueeze = false;
  }
}
