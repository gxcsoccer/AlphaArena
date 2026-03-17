/**
 * Fibonacci Retracement Strategy
 *
 * A technical analysis strategy that uses Fibonacci retracement levels to identify
 * potential support and resistance levels, generating buy signals near support levels
 * in uptrends and sell signals near resistance levels in downtrends.
 *
 * Fibonacci Retracement Levels:
 * - Standard: 23.6%, 38.2%, 50%, 61.8%, 78.6%
 * - Extensions: 127.2%, 161.8%
 *
 * The strategy identifies swing highs and lows, then calculates Fibonacci levels
 * to determine optimal entry and exit points.
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * Standard Fibonacci retracement levels
 */
export const FIBONACCI_LEVELS = {
  LEVEL_0: 0,
  LEVEL_23_6: 0.236,
  LEVEL_38_2: 0.382,
  LEVEL_50: 0.5,
  LEVEL_61_8: 0.618,
  LEVEL_78_6: 0.786,
  LEVEL_100: 1.0,
  EXT_127_2: 1.272,
  EXT_161_8: 1.618,
} as const;

/**
 * Pre-defined Fibonacci level names
 */
export type FibonacciLevelName = keyof typeof FIBONACCI_LEVELS;

/**
 * Fibonacci level with price
 */
export interface FibonacciLevel {
  name: FibonacciLevelName;
  ratio: number;
  price: number;
}

/**
 * Swing point (high or low)
 */
export interface SwingPoint {
  price: number;
  index: number;
  type: 'high' | 'low';
  timestamp: number;
}

/**
 * Trend direction
 */
export type TrendDirection = 'uptrend' | 'downtrend' | 'sideways';

/**
 * Fibonacci Strategy configuration
 */
export interface FibonacciStrategyConfig extends StrategyConfig {
  params?: {
    /** Number of candles to identify swing points (default: 5) */
    swingPeriod?: number;
    /** Threshold for trend confirmation (default: 0.02 = 2%) */
    trendThreshold?: number;
    /** Price tolerance for level proximity (default: 0.005 = 0.5%) */
    levelTolerance?: number;
    /** Minimum number of price points to start trading (default: 20) */
    minDataPoints?: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
    /** Custom Fibonacci levels to use (default: standard levels) */
    customLevels?: number[];
    /** Use extension levels (default: false) */
    useExtensions?: boolean;
    /** Signal confidence base (default: 0.6) */
    baseConfidence?: number;
    /** Enable support/resistance identification */
    identifySR?: boolean;
  };
}

/**
 * Fibonacci Retracement Strategy - 斐波那契回调策略
 *
 * Implements Fibonacci retracement strategy:
 * - Identifies swing highs and lows
 * - Calculates Fibonacci retracement levels
 * - Generates buy signals near support levels in uptrends
 * - Generates sell signals near resistance levels in downtrends
 * - Calculates signal strength based on level proximity
 */
export class FibonacciStrategy extends Strategy {
  private swingPeriod: number;
  private trendThreshold: number;
  private levelTolerance: number;
  private minDataPoints: number;
  private tradeQuantity: number;
  private customLevels: number[];
  private useExtensions: boolean;
  private baseConfidence: number;
  private identifySR: boolean;

  // Price history
  private priceHistory: number[] = [];
  private timestampHistory: number[] = [];

  // Calculated levels
  private fibonacciLevels: FibonacciLevel[] = [];
  private currentSwingHigh: SwingPoint | null = null;
  private currentSwingLow: SwingPoint | null = null;
  private trend: TrendDirection = 'sideways';

  // Track last signal to avoid repeated signals
  private lastSignal: 'buy' | 'sell' | null = null;
  private lastSignalPrice: number | null = null;

  // Support and resistance levels
  private supportLevels: number[] = [];
  private resistanceLevels: number[] = [];

  constructor(config: FibonacciStrategyConfig) {
    super(config);

    // Default parameters
    this.swingPeriod = config.params?.swingPeriod ?? 5;
    this.trendThreshold = config.params?.trendThreshold ?? 0.02;
    this.levelTolerance = config.params?.levelTolerance ?? 0.005;
    this.minDataPoints = config.params?.minDataPoints ?? 20;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    this.customLevels = config.params?.customLevels ?? [
      FIBONACCI_LEVELS.LEVEL_23_6,
      FIBONACCI_LEVELS.LEVEL_38_2,
      FIBONACCI_LEVELS.LEVEL_50,
      FIBONACCI_LEVELS.LEVEL_61_8,
      FIBONACCI_LEVELS.LEVEL_78_6,
    ];
    this.useExtensions = config.params?.useExtensions ?? false;
    this.baseConfidence = config.params?.baseConfidence ?? 0.6;
    this.identifySR = config.params?.identifySR ?? true;

    // Validate parameters
    if (this.swingPeriod < 2) {
      throw new Error('Swing period must be at least 2');
    }
    if (this.trendThreshold <= 0) {
      throw new Error('Trend threshold must be positive');
    }
    if (this.levelTolerance <= 0 || this.levelTolerance > 0.1) {
      throw new Error('Level tolerance must be between 0 and 0.1');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }

    // Add extension levels if enabled
    if (this.useExtensions) {
      this.customLevels = [
        ...this.customLevels,
        FIBONACCI_LEVELS.EXT_127_2,
        FIBONACCI_LEVELS.EXT_161_8,
      ];
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.timestampHistory = [];
    this.fibonacciLevels = [];
    this.currentSwingHigh = null;
    this.currentSwingLow = null;
    this.trend = 'sideways';
    this.lastSignal = null;
    this.lastSignalPrice = null;
    this.supportLevels = [];
    this.resistanceLevels = [];
  }

  /**
   * Handle tick event - generate trading signals based on Fibonacci levels
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
    this.timestampHistory.push(context.clock);

    // Need minimum data points to start analysis
    if (this.priceHistory.length < this.minDataPoints) {
      return null;
    }

    // Identify swing points
    this.identifySwingPoints();

    // Calculate Fibonacci levels
    this.calculateFibonacciLevels();

    // Identify trend
    this.identifyTrend();

    // Identify support and resistance levels
    if (this.identifySR) {
      this.identifySupportResistance();
    }

    // Check if price is near a Fibonacci level and generate signal
    return this.generateSignal(midPrice);
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
   * Identify swing high and swing low points
   * A swing high is a high surrounded by lower highs
   * A swing low is a low surrounded by higher lows
   */
  private identifySwingPoints(): void {
    const len = this.priceHistory.length;
    const n = this.swingPeriod;

    if (len < 2 * n + 1) {
      return;
    }

    // Check for swing high at position len - n - 1
    const highIdx = len - n - 1;
    const highPrice = this.priceHistory[highIdx];
    let isSwingHigh = true;

    for (let i = 1; i <= n; i++) {
      if (this.priceHistory[highIdx - i] >= highPrice || this.priceHistory[highIdx + i] >= highPrice) {
        isSwingHigh = false;
        break;
      }
    }

    if (isSwingHigh) {
      this.currentSwingHigh = {
        price: highPrice,
        index: highIdx,
        type: 'high',
        timestamp: this.timestampHistory[highIdx],
      };
    }

    // Check for swing low at position len - n - 1
    const lowIdx = len - n - 1;
    const lowPrice = this.priceHistory[lowIdx];
    let isSwingLow = true;

    for (let i = 1; i <= n; i++) {
      if (this.priceHistory[lowIdx - i] <= lowPrice || this.priceHistory[lowIdx + i] <= lowPrice) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingLow) {
      this.currentSwingLow = {
        price: lowPrice,
        index: lowIdx,
        type: 'low',
        timestamp: this.timestampHistory[lowIdx],
      };
    }
  }

  /**
   * Calculate Fibonacci retracement levels based on swing points
   */
  private calculateFibonacciLevels(): void {
    if (!this.currentSwingHigh || !this.currentSwingLow) {
      return;
    }

    const high = this.currentSwingHigh.price;
    const low = this.currentSwingLow.price;
    const range = high - low;

    if (range <= 0) {
      return;
    }

    // Determine direction based on which swing point is more recent
    const isUpTrend = this.currentSwingHigh.index > this.currentSwingLow.index;

    this.fibonacciLevels = [];

    // Add level 0 (swing low for uptrend, swing high for downtrend)
    this.fibonacciLevels.push({
      name: 'LEVEL_0',
      ratio: 0,
      price: isUpTrend ? low : high,
    });

    // Add intermediate levels
    for (const level of this.customLevels) {
      const name = this.getLevelName(level);
      if (name) {
        const price = isUpTrend
          ? low + range * level
          : high - range * level;
        this.fibonacciLevels.push({
          name,
          ratio: level,
          price,
        });
      }
    }

    // Add level 100
    this.fibonacciLevels.push({
      name: 'LEVEL_100',
      ratio: 1.0,
      price: isUpTrend ? high : low,
    });
  }

  /**
   * Get Fibonacci level name from ratio
   */
  private getLevelName(ratio: number): FibonacciLevelName | null {
    for (const [name, value] of Object.entries(FIBONACCI_LEVELS)) {
      if (Math.abs(value - ratio) < 0.001) {
        return name as FibonacciLevelName;
      }
    }
    return null;
  }

  /**
   * Identify current trend direction
   */
  private identifyTrend(): void {
    if (!this.currentSwingHigh || !this.currentSwingLow) {
      this.trend = 'sideways';
      return;
    }

    const high = this.currentSwingHigh.price;
    const low = this.currentSwingLow.price;
    const range = high - low;
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];

    // Calculate trend based on price position relative to swing points
    const priceFromLow = (currentPrice - low) / range;

    if (priceFromLow > 0.5 + this.trendThreshold) {
      this.trend = 'uptrend';
    } else if (priceFromLow < 0.5 - this.trendThreshold) {
      this.trend = 'downtrend';
    } else {
      this.trend = 'sideways';
    }
  }

  /**
   * Identify support and resistance levels based on Fibonacci levels
   */
  private identifySupportResistance(): void {
    this.supportLevels = [];
    this.resistanceLevels = [];

    if (this.fibonacciLevels.length === 0) {
      return;
    }

    const currentPrice = this.priceHistory[this.priceHistory.length - 1];

    for (const level of this.fibonacciLevels) {
      if (level.price < currentPrice) {
        this.supportLevels.push(level.price);
      } else if (level.price > currentPrice) {
        this.resistanceLevels.push(level.price);
      }
    }

    // Sort levels
    this.supportLevels.sort((a, b) => b - a); // Descending (closest support first)
    this.resistanceLevels.sort((a, b) => a - b); // Ascending (closest resistance first)
  }

  /**
   * Generate trading signal based on Fibonacci levels
   */
  private generateSignal(currentPrice: number): OrderSignal | null {
    if (this.fibonacciLevels.length === 0) {
      return null;
    }

    // Find the nearest Fibonacci level
    let nearestLevel: FibonacciLevel | null = null;
    let minDistance = Infinity;

    for (const level of this.fibonacciLevels) {
      const distance = Math.abs(currentPrice - level.price) / currentPrice;
      if (distance < minDistance) {
        minDistance = distance;
        nearestLevel = level;
      }
    }

    if (!nearestLevel || minDistance > this.levelTolerance) {
      return null;
    }

    // Check if we already signaled at this level
    if (this.lastSignalPrice !== null) {
      const priceDiff = Math.abs(currentPrice - this.lastSignalPrice) / currentPrice;
      if (priceDiff < this.levelTolerance) {
        return null; // Too close to last signal price
      }
    }

    let signal: OrderSignal | null = null;

    // Generate signal based on trend and level proximity
    if (this.trend === 'uptrend') {
      // In uptrend, buy near support levels (lower Fibonacci levels)
      if (nearestLevel.ratio <= 0.786 && nearestLevel.price < currentPrice) {
        // Price is near a support level in uptrend - buy signal
        signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(nearestLevel, 'buy'),
          reason: `Fibonacci Buy: Price ${currentPrice.toFixed(2)} near ${nearestLevel.name} (${(nearestLevel.ratio * 100).toFixed(1)}%) support in uptrend`,
        });
        this.lastSignal = 'buy';
        this.lastSignalPrice = currentPrice;
      } else if (nearestLevel.ratio >= 1.0 && nearestLevel.price > currentPrice) {
        // Price near extension level - potential resistance
        if (this.lastSignal === 'buy') {
          signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
            confidence: this.calculateConfidence(nearestLevel, 'sell'),
            reason: `Fibonacci Sell: Price ${currentPrice.toFixed(2)} near ${nearestLevel.name} extension resistance`,
          });
          this.lastSignal = 'sell';
          this.lastSignalPrice = currentPrice;
        }
      }
    } else if (this.trend === 'downtrend') {
      // In downtrend, sell near resistance levels (higher Fibonacci levels)
      if (nearestLevel.ratio >= 0.236 && nearestLevel.price > currentPrice) {
        // Price is near a resistance level in downtrend - sell signal
        signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: this.calculateConfidence(nearestLevel, 'sell'),
          reason: `Fibonacci Sell: Price ${currentPrice.toFixed(2)} near ${nearestLevel.name} (${(nearestLevel.ratio * 100).toFixed(1)}%) resistance in downtrend`,
        });
        this.lastSignal = 'sell';
        this.lastSignalPrice = currentPrice;
      } else if (nearestLevel.ratio <= 0 && nearestLevel.price < currentPrice) {
        // Price near extension level below - potential support
        if (this.lastSignal === 'sell') {
          signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
            confidence: this.calculateConfidence(nearestLevel, 'buy'),
            reason: `Fibonacci Buy: Price ${currentPrice.toFixed(2)} near extension support`,
          });
          this.lastSignal = 'buy';
          this.lastSignalPrice = currentPrice;
        }
      }
    }

    // Reset signal state when price moves away from level
    if (minDistance > this.levelTolerance * 2) {
      this.lastSignal = null;
    }

    return signal;
  }

  /**
   * Calculate signal confidence based on Fibonacci level strength
   * Golden ratio levels (38.2%, 61.8%) are considered stronger
   */
  private calculateConfidence(level: FibonacciLevel, _side: 'buy' | 'sell'): number {
    let confidence = this.baseConfidence;

    // Golden ratio levels are stronger
    if (level.ratio === FIBONACCI_LEVELS.LEVEL_38_2 || level.ratio === FIBONACCI_LEVELS.LEVEL_61_8) {
      confidence += 0.15;
    } else if (level.ratio === FIBONACCI_LEVELS.LEVEL_50) {
      confidence += 0.1;
    } else if (level.ratio === FIBONACCI_LEVELS.LEVEL_23_6 || level.ratio === FIBONACCI_LEVELS.LEVEL_78_6) {
      confidence += 0.05;
    }

    // Extension levels have lower confidence
    if (level.ratio > 1) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0.3), 0.95);
  }

  /**
   * Get current Fibonacci levels
   */
  getFibonacciLevels(): FibonacciLevel[] {
    return [...this.fibonacciLevels];
  }

  /**
   * Get current swing high
   */
  getSwingHigh(): SwingPoint | null {
    return this.currentSwingHigh;
  }

  /**
   * Get current swing low
   */
  getSwingLow(): SwingPoint | null {
    return this.currentSwingLow;
  }

  /**
   * Get current trend
   */
  getTrend(): TrendDirection {
    return this.trend;
  }

  /**
   * Get support levels
   */
  getSupportLevels(): number[] {
    return [...this.supportLevels];
  }

  /**
   * Get resistance levels
   */
  getResistanceLevels(): number[] {
    return [...this.resistanceLevels];
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Check if strategy has enough data
   */
  isReady(): boolean {
    return this.priceHistory.length >= this.minDataPoints;
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.priceHistory = [];
    this.timestampHistory = [];
    this.fibonacciLevels = [];
    this.currentSwingHigh = null;
    this.currentSwingLow = null;
    this.trend = 'sideways';
    this.lastSignal = null;
    this.lastSignalPrice = null;
    this.supportLevels = [];
    this.resistanceLevels = [];
  }
}
