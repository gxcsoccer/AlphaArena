/**
 * VWAP (Volume Weighted Average Price) Strategy
 *
 * A benchmark strategy that calculates the average price weighted by volume.
 * VWAP is widely used by institutional traders to measure execution quality.
 *
 * VWAP Formula:
 * VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * where Typical Price = (High + Low + Close) / 3
 *
 * Trading Signals:
 * - Price crosses above VWAP: Bullish signal (buy)
 * - Price crosses below VWAP: Bearish signal (sell)
 * - Deviation from VWAP can indicate overbought/oversold conditions
 *
 * Features:
 * - Cumulative VWAP calculation (session-based or rolling window)
 * - VWAP deviation bands (similar to Bollinger Bands around VWAP)
 * - Support for multiple timeframes
 * - Customizable signal thresholds
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * VWAP data point for OHLCV data
 */
export interface VWAPDataPoint {
  timestamp: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  typicalPrice: number;
}

/**
 * VWAP Strategy configuration
 */
export interface VWAPStrategyConfig extends StrategyConfig {
  params?: {
    /** VWAP calculation mode: 'session' resets daily, 'rolling' uses a fixed window */
    mode?: 'session' | 'rolling';
    /** Rolling window size in number of candles (only for 'rolling' mode, default: 20) */
    windowSize?: number;
    /** Deviation threshold for signal generation (default: 0.005 = 0.5%) */
    deviationThreshold?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
    /** Session start hour in UTC (0-23, default: 0 = midnight) */
    sessionStartHour?: number;
    /** Enable upper/lower deviation bands */
    enableBands?: boolean;
    /** Band multiplier for deviation (default: 1.5) */
    bandMultiplier?: number;
    /** Minimum volume threshold to consider valid VWAP */
    minVolumeThreshold?: number;
  };
}

/**
 * VWAP calculation result
 */
export interface VWAPResult {
  vwap: number;
  cumulativeVolume: number;
  cumulativeTPV: number; // Typical Price × Volume
  upperBand?: number;
  lowerBand?: number;
  deviation?: number; // Current price deviation from VWAP as percentage
}

/**
 * VWAP Strategy - VWAP 策略
 *
 * Implements VWAP (Volume Weighted Average Price) strategy:
 * - Price > VWAP + threshold: Buy signal (price deviated below and returning)
 * - Price < VWAP - threshold: Sell signal (price deviated above and returning)
 * - Cross signals: Price crossing VWAP generates signals
 */
export class VWAPStrategy extends Strategy {
  // Configuration parameters
  private mode: 'session' | 'rolling';
  private windowSize: number;
  private deviationThreshold: number;
  private tradeQuantity: number;
  private sessionStartHour: number;
  private enableBands: boolean;
  private bandMultiplier: number;
  private minVolumeThreshold: number;

  // Data storage
  private dataPoints: VWAPDataPoint[] = [];
  private currentSessionDate: number | null = null;

  // VWAP calculation state
  private cumulativeTPV: number = 0; // Cumulative Typical Price × Volume
  private cumulativeVolume: number = 0;

  // Rolling window calculations
  private rollingTPV: number[] = [];
  private rollingVolume: number[] = [];

  // Last calculated values
  private lastVWAP: number | null = null;
  private lastUpperBand: number | null = null;
  private lastLowerBand: number | null = null;
  private lastDeviation: number | null = null;

  // Signal state tracking
  private lastPriceAboveVWAP: boolean | null = null;
  private lastSignal: 'buy' | 'sell' | null = null;

  // Track if we have enough data
  private hasEnoughData: boolean = false;

  constructor(config: VWAPStrategyConfig) {
    super(config);

    // Default parameters
    this.mode = config.params?.mode ?? 'session';
    this.windowSize = config.params?.windowSize ?? 20;
    this.deviationThreshold = config.params?.deviationThreshold ?? 0.005;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    this.sessionStartHour = config.params?.sessionStartHour ?? 0;
    this.enableBands = config.params?.enableBands ?? true;
    this.bandMultiplier = config.params?.bandMultiplier ?? 1.5;
    this.minVolumeThreshold = config.params?.minVolumeThreshold ?? 0;

    // Validate parameters
    if (this.mode === 'rolling' && this.windowSize < 2) {
      throw new Error('Rolling window size must be at least 2');
    }
    if (this.deviationThreshold <= 0) {
      throw new Error('Deviation threshold must be positive');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
    if (this.sessionStartHour < 0 || this.sessionStartHour > 23) {
      throw new Error('Session start hour must be between 0 and 23');
    }
    if (this.bandMultiplier <= 0) {
      throw new Error('Band multiplier must be positive');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.dataPoints = [];
    this.currentSessionDate = null;
    this.cumulativeTPV = 0;
    this.cumulativeVolume = 0;
    this.rollingTPV = [];
    this.rollingVolume = [];
    this.lastVWAP = null;
    this.lastUpperBand = null;
    this.lastLowerBand = null;
    this.lastDeviation = null;
    this.lastPriceAboveVWAP = null;
    this.lastSignal = null;
    this.hasEnoughData = false;
  }

  /**
   * Handle tick event - generate trading signals based on VWAP
   */
  onTick(context: StrategyContext): OrderSignal | null {
    const marketData = context.getMarketData();
    const timestamp = context.clock;

    // Get OHLCV data - we need high, low, close, and volume for VWAP
    const ohlcvData = this.extractOHLCV(marketData, timestamp);
    if (!ohlcvData) {
      return null;
    }

    // Check for session reset (only in session mode)
    if (this.mode === 'session') {
      this.checkSessionReset(timestamp);
    }

    // Add data point
    this.addDataPoint(ohlcvData);

    // Calculate VWAP
    const vwapResult = this.calculateVWAP();
    if (!vwapResult) {
      return null;
    }

    // Update last values
    this.lastVWAP = vwapResult.vwap;
    this.lastUpperBand = vwapResult.upperBand ?? null;
    this.lastLowerBand = vwapResult.lowerBand ?? null;
    this.lastDeviation = vwapResult.deviation ?? null;
    this.hasEnoughData = true;

    // Get current price for signal generation
    const currentPrice = ohlcvData.close;
    const priceAboveVWAP = currentPrice > vwapResult.vwap;

    // Generate signal
    let signal: OrderSignal | null = null;

    // Crossing signals
    if (this.lastPriceAboveVWAP !== null) {
      // Price crossed above VWAP from below - Buy signal
      if (priceAboveVWAP && !this.lastPriceAboveVWAP && this.lastSignal !== 'buy') {
        signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: this.calculateCrossingConfidence(vwapResult.deviation ?? 0, 'buy'),
          reason: `VWAP Golden Cross: Price ${currentPrice.toFixed(2)} crossed above VWAP ${vwapResult.vwap.toFixed(2)}`,
        });
        this.lastSignal = 'buy';
      }
      // Price crossed below VWAP from above - Sell signal
      else if (!priceAboveVWAP && this.lastPriceAboveVWAP && this.lastSignal !== 'sell') {
        signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: this.calculateCrossingConfidence(vwapResult.deviation ?? 0, 'sell'),
          reason: `VWAP Death Cross: Price ${currentPrice.toFixed(2)} crossed below VWAP ${vwapResult.vwap.toFixed(2)}`,
        });
        this.lastSignal = 'sell';
      }
    }

    // Deviation signals (when price is far from VWAP and potentially reverting)
    if (!signal && vwapResult.deviation !== undefined) {
      const absDeviation = Math.abs(vwapResult.deviation);
      
      // Price significantly below VWAP - potential buy (mean reversion)
      if (absDeviation > this.deviationThreshold && 
          vwapResult.deviation < 0 && 
          this.lastSignal !== 'buy' &&
          this.isPriceReverting(ohlcvData.close, vwapResult)) {
        signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: this.calculateDeviationConfidence(absDeviation, 'buy'),
          reason: `VWAP Deviation Buy: Price ${currentPrice.toFixed(2)} is ${(absDeviation * 100).toFixed(2)}% below VWAP ${vwapResult.vwap.toFixed(2)}`,
        });
        this.lastSignal = 'buy';
      }
      // Price significantly above VWAP - potential sell (mean reversion)
      else if (absDeviation > this.deviationThreshold && 
               vwapResult.deviation > 0 && 
               this.lastSignal !== 'sell' &&
               this.isPriceReverting(ohlcvData.close, vwapResult)) {
        signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: this.calculateDeviationConfidence(absDeviation, 'sell'),
          reason: `VWAP Deviation Sell: Price ${currentPrice.toFixed(2)} is ${(absDeviation * 100).toFixed(2)}% above VWAP ${vwapResult.vwap.toFixed(2)}`,
        });
        this.lastSignal = 'sell';
      }
    }

    // Update price position state
    this.lastPriceAboveVWAP = priceAboveVWAP;

    // Reset signal state when near VWAP (in neutral zone)
    if (vwapResult.deviation !== undefined && Math.abs(vwapResult.deviation) < this.deviationThreshold / 2) {
      this.lastSignal = null;
    }

    return signal;
  }

  /**
   * Extract OHLCV data from market data
   */
  private extractOHLCV(marketData: any, timestamp: number): VWAPDataPoint | null {
    // Try to get data from trades first (more accurate for volume)
    if (marketData.trades && marketData.trades.length > 0) {
      const trades = marketData.trades;
      let high = -Infinity;
      let low = Infinity;
      let close = 0;
      let volume = 0;

      for (const trade of trades) {
        if (trade.price > high) high = trade.price;
        if (trade.price < low) low = trade.price;
        close = trade.price;
        volume += trade.quantity ?? trade.amount ?? 0;
      }

      if (high === -Infinity || low === Infinity) {
        return null;
      }

      const typicalPrice = (high + low + close) / 3;
      return { timestamp, high, low, close, volume, typicalPrice };
    }

    // Fallback to order book
    const orderBook = marketData.orderBook;
    if (!orderBook) {
      return null;
    }

    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid === null || bestBid === undefined || bestAsk === null || bestAsk === undefined) {
      return null;
    }

    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const high = bestAsk;
    const low = bestBid;
    const close = midPrice;
    const volume = 1; // Default volume for order book snapshot
    const typicalPrice = (high + low + close) / 3;

    return { timestamp, high, low, close, volume, typicalPrice };
  }

  /**
   * Check if session has changed and reset VWAP if needed
   */
  private checkSessionReset(timestamp: number): void {
    const date = new Date(timestamp);
    const sessionDate = new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      this.sessionStartHour,
      0,
      0,
      0
    ).getTime();

    if (this.currentSessionDate === null) {
      this.currentSessionDate = sessionDate;
    } else if (this.currentSessionDate !== sessionDate) {
      // New session - reset cumulative values
      this.currentSessionDate = sessionDate;
      this.cumulativeTPV = 0;
      this.cumulativeVolume = 0;
      this.dataPoints = [];
      this.lastPriceAboveVWAP = null;
      this.lastSignal = null;
    }
  }

  /**
   * Add a new data point
   */
  private addDataPoint(data: VWAPDataPoint): void {
    this.dataPoints.push(data);

    // Update cumulative values
    this.cumulativeTPV += data.typicalPrice * data.volume;
    this.cumulativeVolume += data.volume;

    // Update rolling window
    if (this.mode === 'rolling') {
      this.rollingTPV.push(data.typicalPrice * data.volume);
      this.rollingVolume.push(data.volume);

      // Trim to window size
      if (this.rollingTPV.length > this.windowSize) {
        const removedTPV = this.rollingTPV.shift()!;
        const removedVolume = this.rollingVolume.shift()!;
        this.cumulativeTPV -= removedTPV;
        this.cumulativeVolume -= removedVolume;
      }
    }
  }

  /**
   * Calculate VWAP
   */
  private calculateVWAP(): VWAPResult | null {
    if (this.cumulativeVolume <= this.minVolumeThreshold) {
      return null;
    }

    const vwap = this.cumulativeTPV / this.cumulativeVolume;

    if (isNaN(vwap) || !isFinite(vwap)) {
      return null;
    }

    // Get current price for deviation calculation
    const currentPrice = this.dataPoints.length > 0 
      ? this.dataPoints[this.dataPoints.length - 1].close 
      : null;

    let deviation: number | undefined;
    if (currentPrice !== null && vwap > 0) {
      deviation = (currentPrice - vwap) / vwap;
    }

    // Calculate bands if enabled
    let upperBand: number | undefined;
    let lowerBand: number | undefined;

    if (this.enableBands && this.dataPoints.length >= 2) {
      // Calculate standard deviation of typical prices
      const stdDev = this.calculateStandardDeviation();
      if (stdDev !== null) {
        upperBand = vwap + stdDev * this.bandMultiplier;
        lowerBand = vwap - stdDev * this.bandMultiplier;
      }
    }

    return {
      vwap,
      cumulativeVolume: this.cumulativeVolume,
      cumulativeTPV: this.cumulativeTPV,
      upperBand,
      lowerBand,
      deviation,
    };
  }

  /**
   * Calculate standard deviation of typical prices
   */
  private calculateStandardDeviation(): number | null {
    const dataPoints = this.mode === 'rolling' 
      ? this.dataPoints.slice(-this.windowSize) 
      : this.dataPoints;

    if (dataPoints.length < 2) {
      return null;
    }

    // Weighted standard deviation
    const totalVolume = dataPoints.reduce((sum, d) => sum + d.volume, 0);
    if (totalVolume <= 0) {
      return null;
    }

    const weightedMean = dataPoints.reduce((sum, d) => sum + d.typicalPrice * d.volume, 0) / totalVolume;
    
    const weightedVariance = dataPoints.reduce((sum, d) => {
      const diff = d.typicalPrice - weightedMean;
      return sum + d.volume * diff * diff;
    }, 0) / totalVolume;

    return Math.sqrt(weightedVariance);
  }

  /**
   * Check if price is showing signs of reverting to VWAP
   */
  private isPriceReverting(currentPrice: number, vwapResult: VWAPResult): boolean {
    // Simple mean reversion check: see if recent price movement is toward VWAP
    if (this.dataPoints.length < 2) {
      return false;
    }

    const prevPrice = this.dataPoints[this.dataPoints.length - 2].close;
    const vwap = vwapResult.vwap;

    // Price was above VWAP and is now moving down toward VWAP
    if (prevPrice > vwap && currentPrice < prevPrice) {
      return true;
    }

    // Price was below VWAP and is now moving up toward VWAP
    if (prevPrice < vwap && currentPrice > prevPrice) {
      return true;
    }

    return false;
  }

  /**
   * Calculate confidence for crossing signals
   */
  private calculateCrossingConfidence(deviation: number, side: 'buy' | 'sell'): number {
    // Higher confidence for stronger crossings (larger deviation being corrected)
    const baseConfidence = 0.6;
    const deviationBonus = Math.min(Math.abs(deviation) * 10, 0.3); // Up to 0.3 bonus
    return Math.min(baseConfidence + deviationBonus, 0.9);
  }

  /**
   * Calculate confidence for deviation signals
   */
  private calculateDeviationConfidence(absDeviation: number, side: 'buy' | 'sell'): number {
    // Higher confidence for larger deviations
    const baseConfidence = 0.5;
    const deviationBonus = Math.min(absDeviation * 50, 0.4); // Up to 0.4 bonus
    return Math.min(baseConfidence + deviationBonus, 0.9);
  }

  /**
   * Get current VWAP value
   */
  getVWAP(): number | null {
    return this.lastVWAP;
  }

  /**
   * Get VWAP upper band
   */
  getUpperBand(): number | null {
    return this.lastUpperBand;
  }

  /**
   * Get VWAP lower band
   */
  getLowerBand(): number | null {
    return this.lastLowerBand;
  }

  /**
   * Get current deviation from VWAP
   */
  getDeviation(): number | null {
    return this.lastDeviation;
  }

  /**
   * Get data points count
   */
  getDataPointsCount(): number {
    return this.dataPoints.length;
  }

  /**
   * Check if strategy has enough data
   */
  isReady(): boolean {
    return this.hasEnoughData && this.lastVWAP !== null;
  }

  /**
   * Get cumulative volume
   */
  getCumulativeVolume(): number {
    return this.cumulativeVolume;
  }

  /**
   * Get VWAP data for visualization
   */
  getVWAPData(): { vwap: number | null; upperBand: number | null; lowerBand: number | null; deviation: number | null } {
    return {
      vwap: this.lastVWAP,
      upperBand: this.lastUpperBand,
      lowerBand: this.lastLowerBand,
      deviation: this.lastDeviation,
    };
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.dataPoints = [];
    this.currentSessionDate = null;
    this.cumulativeTPV = 0;
    this.cumulativeVolume = 0;
    this.rollingTPV = [];
    this.rollingVolume = [];
    this.lastVWAP = null;
    this.lastUpperBand = null;
    this.lastLowerBand = null;
    this.lastDeviation = null;
    this.lastPriceAboveVWAP = null;
    this.lastSignal = null;
    this.hasEnoughData = false;
  }
}
