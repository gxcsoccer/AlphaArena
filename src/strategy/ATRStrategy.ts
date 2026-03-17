/**
 * ATR (Average True Range) Strategy
 *
 * A volatility-based strategy that measures market volatility and assists with risk management.
 * ATR was developed by J. Welles Wilder and is primarily used to measure volatility,
 * not to indicate price direction.
 *
 * Key Concepts:
 * - True Range (TR): The greatest of:
 *   1. Current High - Current Low
 *   2. abs(Current High - Previous Close)
 *   3. abs(Current Low - Previous Close)
 * - ATR: Simple Moving Average of True Range over a specified period
 *
 * Trading Signals:
 * - Trend Following Mode: Uses ATR bands for breakout detection
 * - Dynamic Position Sizing: Adjusts position size based on ATR
 * - ATR-based Stop Loss: Sets stop loss at ATR multiplier distance
 *
 * ATR Formula:
 * TR = max(High - Low, abs(High - Previous Close), abs(Low - Previous Close))
 * ATR = SMA(TR, period)
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * ATR Strategy configuration
 */
export interface ATRStrategyConfig extends StrategyConfig {
  params?: {
    /** Period for ATR calculation (default: 14) */
    period?: number;
    /** ATR multiplier for stop loss/take profit (default: 2.0) */
    atrMultiplier?: number;
    /** Trend confirmation period (default: 5) */
    trendPeriod?: number;
    /** Base quantity to trade per signal */
    tradeQuantity?: number;
    /** Enable dynamic position sizing based on ATR (default: true) */
    dynamicPositionSizing?: boolean;
    /** Risk per trade as percentage of portfolio (default: 0.02 = 2%) */
    riskPerTrade?: number;
    /** Breakout threshold as ATR multiplier (default: 0.5) */
    breakoutThreshold?: number;
  };
}

/**
 * ATR data point
 */
export interface ATRData {
  /** True Range value */
  trueRange: number;
  /** Average True Range value */
  atr: number;
  /** Upper ATR band (based on previous close) */
  upperBand: number;
  /** Lower ATR band (based on previous close) */
  lowerBand: number;
  /** ATR as percentage of price */
  atrPercent: number;
}

/**
 * Price data with OHLC
 */
export interface PriceData {
  high: number;
  low: number;
  close: number;
}

/**
 * Trend direction
 */
type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * ATR Strategy - ATR 波动率策略
 *
 * Implements ATR-based trading strategy:
 * - Volatility measurement for risk management
 * - Trend following with ATR bands
 * - Dynamic position sizing
 * - ATR-based stop loss levels
 */
export class ATRStrategy extends Strategy {
  private period: number;
  private atrMultiplier: number;
  private trendPeriod: number;
  private tradeQuantity: number;
  private dynamicPositionSizing: boolean;
  private riskPerTrade: number;
  private breakoutThreshold: number;

  // Price history for calculation (stores close prices)
  private priceHistory: number[] = [];
  // OHLC data history
  private ohlcHistory: PriceData[] = [];
  // True Range history
  private trHistory: number[] = [];
  // Previous ATR (for breakout detection)
  private previousATR: number | null = null;
  // Current ATR values (for display/analysis)
  private currentATR: ATRData | null = null;
  // Pre-computed bands for next tick (based on previous close and previous ATR)
  private nextBands: { upper: number; lower: number } | null = null;
  // Track last signal to avoid repeated signals
  private lastSignal: 'buy' | 'sell' | null = null;
  // Track last price for trend calculation
  private lastPrice: number | null = null;
  // Entry price for position
  private entryPrice: number | null = null;
  // Stop loss level
  private stopLoss: number | null = null;
  // Take profit level
  private takeProfit: number | null = null;

  constructor(config: ATRStrategyConfig) {
    super(config);

    // Default parameters
    this.period = config.params?.period ?? 14;
    this.atrMultiplier = config.params?.atrMultiplier ?? 2.0;
    this.trendPeriod = config.params?.trendPeriod ?? 5;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    this.dynamicPositionSizing = config.params?.dynamicPositionSizing ?? true;
    this.riskPerTrade = config.params?.riskPerTrade ?? 0.02;
    this.breakoutThreshold = config.params?.breakoutThreshold ?? 0.5;

    // Validate parameters
    if (this.period < 1) {
      throw new Error('Period must be at least 1');
    }
    if (this.atrMultiplier <= 0) {
      throw new Error('ATR multiplier must be positive');
    }
    if (this.trendPeriod < 1) {
      throw new Error('Trend period must be at least 1');
    }
    if (this.tradeQuantity <= 0) {
      throw new Error('Trade quantity must be positive');
    }
    if (this.riskPerTrade <= 0 || this.riskPerTrade >= 1) {
      throw new Error('Risk per trade must be between 0 and 1');
    }
  }

  /**
   * Initialize strategy
   */
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.ohlcHistory = [];
    this.trHistory = [];
    this.previousATR = null;
    this.currentATR = null;
    this.nextBands = null;
    this.lastSignal = null;
    this.lastPrice = null;
    this.entryPrice = null;
    this.stopLoss = null;
    this.takeProfit = null;
  }

  /**
   * Handle tick event - generate trading signals based on ATR
   */
  onTick(context: StrategyContext): OrderSignal | null {
    const marketData = context.getMarketData();

    // Get price data from order book
    const priceData = this.extractPriceData(marketData.orderBook);
    if (!priceData) {
      return null;
    }

    // Store previous close before adding new data
    const previousClose = this.priceHistory.length > 0 
      ? this.priceHistory[this.priceHistory.length - 1] 
      : null;

    // Check for stop loss / take profit if in position (using current price)
    if (this.entryPrice !== null && this.stopLoss !== null && this.takeProfit !== null) {
      const exitSignal = this.checkStopLossTakeProfit(priceData.close);
      if (exitSignal) {
        return exitSignal;
      }
    }

    // Get pre-computed bands for breakout detection
    const breakoutBands = this.nextBands;

    // Determine trend BEFORE adding new price (using existing history)
    const trend = this.determineTrend();

    // Now add to history and update calculations
    this.priceHistory.push(priceData.close);
    this.ohlcHistory.push(priceData);

    // Calculate True Range
    const tr = this.calculateTrueRange(priceData, previousClose);
    if (tr !== null) {
      this.trHistory.push(tr);
    }

    // Calculate new ATR
    const atr = this.calculateATR();
    
    // Update previous ATR for next tick's breakout detection
    if (atr !== null) {
      this.previousATR = atr;
      // Compute bands for next tick based on current close
      this.nextBands = {
        upper: priceData.close + atr * this.breakoutThreshold,
        lower: priceData.close - atr * this.breakoutThreshold,
      };
    }

    // Update current ATR data for display
    if (atr !== null) {
      const atrPercent = atr / priceData.close;
      this.currentATR = {
        trueRange: tr!,
        atr,
        upperBand: this.nextBands?.upper ?? priceData.close + atr * this.breakoutThreshold,
        lowerBand: this.nextBands?.lower ?? priceData.close - atr * this.breakoutThreshold,
        atrPercent,
      };
    }

    // Need enough data and pre-computed bands for signal generation
    if (!breakoutBands || this.previousATR === null) {
      this.lastPrice = priceData.close;
      return null;
    }

    // Generate trading signals using pre-computed bands
    let signal: OrderSignal | null = null;

    // Calculate position size
    const positionSize = this.calculatePositionSize(context, this.previousATR);

    // Buy signal: Price breaks above upper band in uptrend
    if (priceData.close >= breakoutBands.upper && trend === 'up' && this.lastSignal !== 'buy') {
      signal = this.createSignal('buy', priceData.close, positionSize, {
        confidence: this.calculateConfidence(priceData.close, this.previousATR, 'buy', trend),
        reason: `ATR Breakout Buy: Price=${priceData.close.toFixed(2)} >= Upper Band=${breakoutBands.upper.toFixed(2)}, ATR=${this.previousATR.toFixed(2)}, Trend=${trend}`,
      });
      this.lastSignal = 'buy';
      this.entryPrice = priceData.close;
      this.setStopLossTakeProfit('buy', priceData.close, this.previousATR);
    }
    // Sell signal: Price breaks below lower band in downtrend
    else if (priceData.close <= breakoutBands.lower && trend === 'down' && this.lastSignal !== 'sell') {
      signal = this.createSignal('sell', priceData.close, positionSize, {
        confidence: this.calculateConfidence(priceData.close, this.previousATR, 'sell', trend),
        reason: `ATR Breakdown Sell: Price=${priceData.close.toFixed(2)} <= Lower Band=${breakoutBands.lower.toFixed(2)}, ATR=${this.previousATR.toFixed(2)}, Trend=${trend}`,
      });
      this.lastSignal = 'sell';
      this.entryPrice = priceData.close;
      this.setStopLossTakeProfit('sell', priceData.close, this.previousATR);
    }

    this.lastPrice = priceData.close;
    return signal;
  }

  /**
   * Extract price data from order book
   * Since we only have bid/ask, we simulate high/low/close
   */
  private extractPriceData(orderBook: any): PriceData | null {
    const bestBid = orderBook.getBestBid?.();
    const bestAsk = orderBook.getBestAsk?.();

    if (bestBid === null || bestBid === undefined || 
        bestAsk === null || bestAsk === undefined) {
      return null;
    }

    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    
    // Simulate high/low based on spread
    const high = midPrice + spread / 2;
    const low = midPrice - spread / 2;

    return {
      high,
      low,
      close: midPrice,
    };
  }

  /**
   * Calculate True Range
   * TR = max(High - Low, abs(High - Previous Close), abs(Low - Previous Close))
   */
  private calculateTrueRange(current: PriceData, previousClose: number | null): number | null {
    if (previousClose === null) {
      // First bar: TR = High - Low
      return current.high - current.low;
    }

    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - previousClose);
    const tr3 = Math.abs(current.low - previousClose);

    return Math.max(tr1, tr2, tr3);
  }

  /**
   * Calculate ATR (Simple Moving Average of True Range)
   */
  private calculateATR(): number | null {
    if (this.trHistory.length < this.period) {
      return null;
    }

    // Get the most recent 'period' TR values
    const recentTRs = this.trHistory.slice(-this.period);
    const sum = recentTRs.reduce((acc, tr) => acc + tr, 0);
    
    return sum / this.period;
  }

  /**
   * Determine trend direction based on price movement
   */
  private determineTrend(): TrendDirection {
    if (this.priceHistory.length < this.trendPeriod) {
      return 'neutral';
    }

    const recentPrices = this.priceHistory.slice(-this.trendPeriod);
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];

    // Calculate price change percentage
    const changePercent = (lastPrice - firstPrice) / firstPrice;

    // Determine trend based on change percentage
    if (changePercent > 0.005) { // 0.5% increase
      return 'up';
    } else if (changePercent < -0.005) { // 0.5% decrease
      return 'down';
    }

    return 'neutral';
  }

  /**
   * Calculate position size based on ATR and risk
   */
  private calculatePositionSize(context: StrategyContext, atr: number): number {
    if (!this.dynamicPositionSizing) {
      return this.tradeQuantity;
    }

    const cash = context.getCash();
    const riskAmount = cash * this.riskPerTrade;
    
    // Position size = Risk Amount / (ATR * multiplier)
    const atrStopDistance = atr * this.atrMultiplier;
    
    if (atrStopDistance <= 0) {
      return this.tradeQuantity;
    }

    const calculatedSize = Math.floor(riskAmount / atrStopDistance);
    
    return Math.max(calculatedSize, 1);
  }

  /**
   * Set stop loss and take profit levels
   */
  private setStopLossTakeProfit(side: 'buy' | 'sell', entryPrice: number, atr: number): void {
    if (side === 'buy') {
      this.stopLoss = entryPrice - atr * this.atrMultiplier;
      this.takeProfit = entryPrice + atr * this.atrMultiplier * 1.5;
    } else {
      this.stopLoss = entryPrice + atr * this.atrMultiplier;
      this.takeProfit = entryPrice - atr * this.atrMultiplier * 1.5;
    }
  }

  /**
   * Check if stop loss or take profit should be triggered
   */
  private checkStopLossTakeProfit(currentPrice: number): OrderSignal | null {
    if (this.lastSignal === 'buy') {
      if (this.stopLoss !== null && currentPrice <= this.stopLoss) {
        const signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: 0.9,
          reason: `ATR Stop Loss Triggered: Price=${currentPrice.toFixed(2)} <= Stop Loss=${this.stopLoss.toFixed(2)}`,
        });
        this.resetPosition();
        return signal;
      }
      if (this.takeProfit !== null && currentPrice >= this.takeProfit) {
        const signal = this.createSignal('sell', currentPrice, this.tradeQuantity, {
          confidence: 0.9,
          reason: `ATR Take Profit Triggered: Price=${currentPrice.toFixed(2)} >= Take Profit=${this.takeProfit.toFixed(2)}`,
        });
        this.resetPosition();
        return signal;
      }
    } else if (this.lastSignal === 'sell') {
      if (this.stopLoss !== null && currentPrice >= this.stopLoss) {
        const signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: 0.9,
          reason: `ATR Stop Loss Triggered: Price=${currentPrice.toFixed(2)} >= Stop Loss=${this.stopLoss.toFixed(2)}`,
        });
        this.resetPosition();
        return signal;
      }
      if (this.takeProfit !== null && currentPrice <= this.takeProfit) {
        const signal = this.createSignal('buy', currentPrice, this.tradeQuantity, {
          confidence: 0.9,
          reason: `ATR Take Profit Triggered: Price=${currentPrice.toFixed(2)} <= Take Profit=${this.takeProfit.toFixed(2)}`,
        });
        this.resetPosition();
        return signal;
      }
    }

    return null;
  }

  /**
   * Reset position tracking
   */
  private resetPosition(): void {
    this.entryPrice = null;
    this.stopLoss = null;
    this.takeProfit = null;
    this.lastSignal = null;
  }

  /**
   * Calculate confidence based on ATR and trend
   */
  private calculateConfidence(
    price: number,
    atr: number,
    side: 'buy' | 'sell',
    trend: TrendDirection
  ): number {
    let confidence = 0.5;

    if ((side === 'buy' && trend === 'up') || (side === 'sell' && trend === 'down')) {
      confidence += 0.2;
    }

    const atrPercent = atr / price;
    if (atrPercent > 0.02) {
      confidence += 0.15;
    } else if (atrPercent > 0.01) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.9);
  }

  /**
   * Get current ATR data
   */
  getATR(): ATRData | null {
    return this.currentATR;
  }

  /**
   * Get current ATR value
   */
  getATRValue(): number | null {
    return this.currentATR?.atr ?? null;
  }

  /**
   * Get current True Range value
   */
  getTrueRange(): number | null {
    return this.currentATR?.trueRange ?? null;
  }

  /**
   * Get upper ATR band (pre-computed for next tick)
   */
  getUpperBand(): number | null {
    return this.nextBands?.upper ?? null;
  }

  /**
   * Get lower ATR band (pre-computed for next tick)
   */
  getLowerBand(): number | null {
    return this.nextBands?.lower ?? null;
  }

  /**
   * Get ATR as percentage of price
   */
  getATRPercent(): number | null {
    return this.currentATR?.atrPercent ?? null;
  }

  /**
   * Get current stop loss level
   */
  getStopLoss(): number | null {
    return this.stopLoss;
  }

  /**
   * Get current take profit level
   */
  getTakeProfit(): number | null {
    return this.takeProfit;
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Get TR history length
   */
  getTRHistoryLength(): number {
    return this.trHistory.length;
  }

  /**
   * Check if strategy has enough data to generate signals
   */
  isReady(): boolean {
    return this.trHistory.length >= this.period && this.nextBands !== null;
  }

  /**
   * Get current trend direction
   */
  getTrend(): TrendDirection {
    return this.determineTrend();
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.ohlcHistory = [];
    this.trHistory = [];
    this.previousATR = null;
    this.currentATR = null;
    this.nextBands = null;
    this.lastSignal = null;
    this.lastPrice = null;
    this.entryPrice = null;
    this.stopLoss = null;
    this.takeProfit = null;
  }
}
