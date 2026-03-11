/**
 * SMA Crossover Strategy
 * 
 * A simple moving average crossover strategy that generates buy signals
 * when the short-term SMA crosses above the long-term SMA (golden cross),
 * and sell signals when the short-term SMA crosses below the long-term SMA (death cross).
 */

import { Strategy } from './Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from './types';

/**
 * SMA Strategy configuration
 */
export interface SMAStrategyConfig extends StrategyConfig {
  params?: {
    /** Short-term SMA period (e.g., 5 days) */
    shortPeriod: number;
    /** Long-term SMA period (e.g., 20 days) */
    longPeriod: number;
    /** Quantity to trade per signal */
    tradeQuantity?: number;
  };
}

/**
 * SMA Crossover Strategy - SMA 交叉策略
 * 
 * Implements a simple moving average crossover strategy:
 * - Golden Cross (金叉): Short SMA crosses above Long SMA → Buy signal
 * - Death Cross (死叉): Short SMA crosses below Long SMA → Sell signal
 */
export class SMAStrategy extends Strategy {
  private shortPeriod: number;
  private longPeriod: number;
  private tradeQuantity: number;
  private priceHistory: number[] = [];
  private lastShortSMA: number | null = null;
  private lastLongSMA: number | null = null;

  constructor(config: SMAStrategyConfig) {
    super(config);
    
    // Default parameters
    this.shortPeriod = config.params?.shortPeriod ?? 5;
    this.longPeriod = config.params?.longPeriod ?? 20;
    this.tradeQuantity = config.params?.tradeQuantity ?? 10;
    
    // Validate parameters
    if (this.shortPeriod >= this.longPeriod) {
      throw new Error('Short period must be less than long period');
    }
    if (this.shortPeriod <= 0 || this.longPeriod <= 0) {
      throw new Error('SMA periods must be positive');
    }
  }

  /**
   * Initialize strategy
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected init(_context: StrategyContext): void {
    this.priceHistory = [];
    this.lastShortSMA = null;
    this.lastLongSMA = null;
  }

  /**
   * Handle tick event - generate trading signals based on SMA crossover
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
    
    // Need enough data points for long period SMA
    if (this.priceHistory.length < this.longPeriod) {
      return null;
    }
    
    // Calculate current SMAs
    const currentShortSMA = this.calculateSMA(this.shortPeriod);
    const currentLongSMA = this.calculateSMA(this.longPeriod);
    
    // Generate signal based on crossover
    let signal: OrderSignal | null = null;
    
    if (this.lastShortSMA !== null && this.lastLongSMA !== null) {
      // Golden Cross: Short SMA crosses above Long SMA
      if (this.lastShortSMA <= this.lastLongSMA && currentShortSMA > currentLongSMA) {
        signal = this.createSignal('buy', midPrice, this.tradeQuantity, {
          confidence: 0.7,
          reason: `Golden Cross: SMA(${this.shortPeriod})=${currentShortSMA.toFixed(2)} > SMA(${this.longPeriod})=${currentLongSMA.toFixed(2)}`
        });
      }
      // Death Cross: Short SMA crosses below Long SMA
      else if (this.lastShortSMA >= this.lastLongSMA && currentShortSMA < currentLongSMA) {
        signal = this.createSignal('sell', midPrice, this.tradeQuantity, {
          confidence: 0.7,
          reason: `Death Cross: SMA(${this.shortPeriod})=${currentShortSMA.toFixed(2)} < SMA(${this.longPeriod})=${currentLongSMA.toFixed(2)}`
        });
      }
    }
    
    // Update last SMAs for next tick
    this.lastShortSMA = currentShortSMA;
    this.lastLongSMA = currentLongSMA;
    
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
   * Calculate Simple Moving Average for the given period
   */
  private calculateSMA(period: number): number {
    const start = this.priceHistory.length - period;
    const prices = this.priceHistory.slice(start);
    
    const sum = prices.reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Get current short SMA value
   */
  getShortSMA(): number | null {
    return this.lastShortSMA;
  }

  /**
   * Get current long SMA value
   */
  getLongSMA(): number | null {
    return this.lastLongSMA;
  }

  /**
   * Get price history length
   */
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }

  /**
   * Reset strategy state (useful for backtesting)
   */
  reset(): void {
    this.priceHistory = [];
    this.lastShortSMA = null;
    this.lastLongSMA = null;
  }
}
