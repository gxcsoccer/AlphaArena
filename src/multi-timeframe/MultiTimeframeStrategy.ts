/**
 * Multi-Timeframe Strategy Base Class
 * 
 * Abstract base class for strategies that analyze multiple timeframes
 */

import { Strategy } from '../strategy/Strategy';
import { StrategyContext, OrderSignal } from '../strategy/types';
import {
  Timeframe,
  KLineDataPoint,
  TimeframeSignal,
  MultiTimeframeSignal,
  MultiTimeframeStrategyConfig,
  MultiTimeframeContext,
  TimeframeWeight,
  getDefaultTimeframeWeights,
  aggregateSignals,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('MultiTimeframeStrategy');

/**
 * Extended strategy context with multi-timeframe data
 */
export interface MultiTimeframeStrategyContext extends StrategyContext {
  /** Multi-timeframe context */
  mtf: MultiTimeframeContext;
}

/**
 * Abstract base class for multi-timeframe strategies
 */
export abstract class MultiTimeframeStrategy extends Strategy {
  protected mtfConfig: MultiTimeframeStrategyConfig;
  protected timeframeWeights: TimeframeWeight[];
  protected klineData: Map<Timeframe, KLineDataPoint[]> = new Map();
  protected signals: Map<Timeframe, TimeframeSignal> = new Map();
  protected lastCombinedSignal: MultiTimeframeSignal | null = null;

  constructor(config: MultiTimeframeStrategyConfig) {
    super({
      id: config.id,
      name: config.name,
      params: config.params,
    });

    this.mtfConfig = config;
    
    // Initialize timeframe weights
    if (config.timeframeWeights && config.timeframeWeights.length > 0) {
      this.timeframeWeights = config.timeframeWeights;
    } else {
      this.timeframeWeights = getDefaultTimeframeWeights(config.timeframes);
    }

    log.info(`MultiTimeframeStrategy initialized: ${config.name}`, {
      timeframes: config.timeframes,
      weights: this.timeframeWeights,
    });
  }

  /**
   * Get the timeframes this strategy analyzes
   */
  getTimeframes(): Timeframe[] {
    return this.mtfConfig.timeframes;
  }

  /**
   * Get timeframe weights
   */
  getTimeframeWeights(): TimeframeWeight[] {
    return this.timeframeWeights;
  }

  /**
   * Update K-line data for a timeframe
   */
  updateKLineData(timeframe: Timeframe, data: KLineDataPoint[]): void {
    this.klineData.set(timeframe, data);
  }

  /**
   * Get K-line data for a timeframe
   */
  getKLineData(timeframe: Timeframe): KLineDataPoint[] | null {
    return this.klineData.get(timeframe) ?? null;
  }

  /**
   * Get current price from the most recent candle
   */
  protected getCurrentPrice(timeframe: Timeframe): number {
    const data = this.klineData.get(timeframe);
    if (!data || data.length === 0) return 0;
    return data[data.length - 1].close;
  }

  /**
   * Analyze a specific timeframe and generate a signal
   * Must be implemented by subclasses
   */
  abstract analyzeTimeframe(timeframe: Timeframe): TimeframeSignal | null;

  /**
   * Analyze all timeframes and generate signals
   */
  analyzeAllTimeframes(): TimeframeSignal[] {
    const signals: TimeframeSignal[] = [];

    for (const timeframe of this.mtfConfig.timeframes) {
      const signal = this.analyzeTimeframe(timeframe);
      if (signal) {
        this.signals.set(timeframe, signal);
        signals.push(signal);
      }
    }

    return signals;
  }

  /**
   * Get combined signal from all timeframes
   */
  getCombinedSignal(): MultiTimeframeSignal | null {
    const signals = Array.from(this.signals.values());
    
    if (signals.length === 0) {
      return null;
    }

    this.lastCombinedSignal = aggregateSignals(signals, this.timeframeWeights);
    return this.lastCombinedSignal;
  }

  /**
   * Create multi-timeframe context
   */
  protected createMultiTimeframeContext(symbol: string): MultiTimeframeContext {
    return {
      symbol,
      getKLineData: (timeframe: Timeframe) => this.getKLineData(timeframe),
      getCurrentPrice: () => {
        // Get price from primary timeframe (first in list) or any available
        const primaryTf = this.mtfConfig.timeframes[0];
        return this.getCurrentPrice(primaryTf);
      },
      getSignal: (timeframe: Timeframe) => self.signals.get(timeframe) ?? null,
      getAllSignals: () => Array.from(self.signals.values()),
      getCombinedSignal: () => self.getCombinedSignal(),
      timestamp: Date.now(),
    };
  }

  /**
   * Check if combined signal meets the threshold
   */
  protected isSignalStrongEnough(signal: MultiTimeframeSignal | null): boolean {
    if (!signal) return false;
    
    const threshold = this.mtfConfig.signalThreshold ?? 0.3;
    return signal.combinedStrength >= threshold;
  }

  /**
   * Convert combined signal to order signal
   */
  protected createOrderSignalFromCombined(
    combined: MultiTimeframeSignal
  ): OrderSignal | null {
    if (combined.combinedType === 'hold') {
      return null;
    }

    const price = this.getCurrentPrice(this.mtfConfig.timeframes[0]);
    const quantity = this.mtfConfig.params?.tradeQuantity ?? 10;

    return this.createSignal(
      combined.combinedType,
      price,
      quantity,
      {
        confidence: combined.confidence,
        reason: `Multi-timeframe ${combined.combinedType} signal (strength: ${combined.combinedStrength.toFixed(2)}, confidence: ${combined.confidence.toFixed(2)})`,
      }
    );
  }

  /**
   * Main tick handler - analyzes all timeframes and generates signals
   */
  onTick(_context: StrategyContext): OrderSignal | null {
    // Analyze all timeframes
    this.analyzeAllTimeframes();

    // Get combined signal
    const combined = this.getCombinedSignal();

    if (!combined) {
      return null;
    }

    // Check if signal is strong enough
    if (!this.isSignalStrongEnough(combined)) {
      log.debug(`Signal not strong enough: ${combined.combinedStrength.toFixed(2)}`);
      return null;
    }

    // Convert to order signal
    return this.createOrderSignalFromCombined(combined);
  }

  /**
   * Get the last combined signal for analysis
   */
  getLastCombinedSignal(): MultiTimeframeSignal | null {
    return this.lastCombinedSignal;
  }

  /**
   * Get all timeframe signals
   */
  getAllTimeframeSignals(): Map<Timeframe, TimeframeSignal> {
    return new Map(this.signals);
  }

  /**
   * Clear all signals (useful for testing)
   */
  clearSignals(): void {
    this.signals.clear();
    this.lastCombinedSignal = null;
  }
}
