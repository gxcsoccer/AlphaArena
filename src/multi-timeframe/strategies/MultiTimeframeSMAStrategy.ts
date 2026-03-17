/**
 * Multi-Timeframe SMA Strategy
 * 
 * A simple moving average crossover strategy that analyzes multiple timeframes
 * and combines signals to make trading decisions.
 */

import { MultiTimeframeStrategy } from '../MultiTimeframeStrategy';
import {
  Timeframe,
  KLineDataPoint,
  TimeframeSignal,
  TimeframeWeight,
} from '../types';
import { createLogger } from '../../utils/logger';

const log = createLogger('MultiTimeframeSMAStrategy');

/**
 * Configuration for Multi-Timeframe SMA Strategy
 */
export interface MultiTimeframeSMAConfig {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: string;
  /** Timeframes to analyze */
  timeframes: Timeframe[];
  /** Short period for SMA */
  shortPeriod?: number;
  /** Long period for SMA */
  longPeriod?: number;
  /** Trade quantity */
  tradeQuantity?: number;
  /** Signal threshold (0-1) */
  signalThreshold?: number;
  /** Timeframe weights */
  timeframeWeights?: TimeframeWeight[];
}

/**
 * Multi-Timeframe SMA Strategy Implementation
 * 
 * Analyzes SMA crossovers across multiple timeframes and combines signals:
 * - Golden cross (short SMA > long SMA) -> Buy signal
 * - Death cross (short SMA < long SMA) -> Sell signal
 */
export class MultiTimeframeSMAStrategy extends MultiTimeframeStrategy {
  private shortPeriod: number;
  private longPeriod: number;
  private tradeQuantity: number;

  // Cache for SMA values
  private shortSMA: Map<Timeframe, number> = new Map();
  private longSMA: Map<Timeframe, number> = new Map();
  private previousShortSMA: Map<Timeframe, number> = new Map();
  private previousLongSMA: Map<Timeframe, number> = new Map();

  constructor(config: MultiTimeframeSMAConfig) {
    super({
      id: config.id,
      name: config.name,
      timeframes: config.timeframes,
      timeframeWeights: config.timeframeWeights,
      signalThreshold: config.signalThreshold,
      params: {
        shortPeriod: config.shortPeriod ?? 10,
        longPeriod: config.longPeriod ?? 30,
        tradeQuantity: config.tradeQuantity ?? 10,
      },
    });

    this.shortPeriod = config.shortPeriod ?? 10;
    this.longPeriod = config.longPeriod ?? 30;
    this.tradeQuantity = config.tradeQuantity ?? 10;

    log.info(`MultiTimeframeSMAStrategy created`, {
      timeframes: config.timeframes,
      shortPeriod: this.shortPeriod,
      longPeriod: this.longPeriod,
    });
  }

  /**
   * Calculate SMA for given data
   */
  private calculateSMA(data: KLineDataPoint[], period: number): number {
    if (data.length < period) {
      return 0;
    }

    const slice = data.slice(-period);
    const sum = slice.reduce((acc, d) => acc + d.close, 0);
    return sum / period;
  }

  /**
   * Analyze a specific timeframe for SMA crossover
   */
  analyzeTimeframe(timeframe: Timeframe): TimeframeSignal | null {
    const data = this.getKLineData(timeframe);
    
    if (!data || data.length < this.longPeriod + 1) {
      log.debug(`Not enough data for ${timeframe}`);
      return null;
    }

    // Store previous SMA values
    const prevShort = this.shortSMA.get(timeframe) ?? 0;
    const prevLong = this.longSMA.get(timeframe) ?? 0;

    // Calculate current SMA values
    const currentShort = this.calculateSMA(data, this.shortPeriod);
    const currentLong = this.calculateSMA(data, this.longPeriod);

    // Store for next iteration
    this.previousShortSMA.set(timeframe, prevShort);
    this.previousLongSMA.set(timeframe, prevLong);
    this.shortSMA.set(timeframe, currentShort);
    this.longSMA.set(timeframe, currentLong);

    // Get current price
    const price = data[data.length - 1].close;

    // Detect crossover
    const wasGoldenCross = prevShort <= prevLong;
    const isGoldenCross = currentShort > currentLong;
    const wasDeathCross = prevShort >= prevLong;
    const isDeathCross = currentShort < currentLong;

    // Generate signal
    if (isGoldenCross && wasGoldenCross === false) {
      // Golden cross - buy signal
      const strength = Math.min(1, (currentShort - currentLong) / currentLong * 10 + 0.5);
      return {
        timeframe,
        type: 'buy',
        strength,
        price,
        timestamp: Date.now(),
        metadata: {
          symbol: 'unknown',
          shortSMA: currentShort,
          longSMA: currentLong,
          crossover: 'golden',
        },
      };
    } else if (isDeathCross && wasDeathCross === false) {
      // Death cross - sell signal
      const strength = Math.min(1, (currentLong - currentShort) / currentLong * 10 + 0.5);
      return {
        timeframe,
        type: 'sell',
        strength,
        price,
        timestamp: Date.now(),
        metadata: {
          symbol: 'unknown',
          shortSMA: currentShort,
          longSMA: currentLong,
          crossover: 'death',
        },
      };
    }

    // No crossover - hold
    return {
      timeframe,
      type: 'hold',
      strength: 0.1,
      price,
      timestamp: Date.now(),
      metadata: {
        symbol: 'unknown',
        shortSMA: currentShort,
        longSMA: currentLong,
        trend: currentShort > currentLong ? 'up' : 'down',
      },
    };
  }

  /**
   * Get current SMA values for a timeframe
   */
  getSMAValues(timeframe: Timeframe): {
    short: number;
    long: number;
    previousShort: number;
    previousLong: number;
  } {
    return {
      short: this.shortSMA.get(timeframe) ?? 0,
      long: this.longSMA.get(timeframe) ?? 0,
      previousShort: this.previousShortSMA.get(timeframe) ?? 0,
      previousLong: this.previousLongSMA.get(timeframe) ?? 0,
    };
  }
}
