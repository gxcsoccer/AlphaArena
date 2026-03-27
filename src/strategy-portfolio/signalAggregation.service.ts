/**
 * Signal Aggregation Service
 * 
 * Aggregates trading signals from multiple strategies using various methods:
 * - Voting: Majority vote on direction
 * - Weighted Average: Weight signals by strategy allocation
 * - Consensus: Only act when strategies agree above threshold
 * - Best Performer: Follow the best performing strategy
 */

import {
  StrategySignal,
  AggregatedSignal,
  SignalAggregationMethod,
  SignalAggregationConfig,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('SignalAggregationService');

/**
 * Default aggregation configuration
 */
export const DEFAULT_AGGREGATION_CONFIG: SignalAggregationConfig = {
  method: 'weighted_average',
  minConfidence: 0.3,
  consensusThreshold: 0.6,
  requireMajority: true,
};

/**
 * Signal Aggregation Service class
 */
export class SignalAggregationService {
  private config: SignalAggregationConfig;

  constructor(config: Partial<SignalAggregationConfig> = {}) {
    this.config = { ...DEFAULT_AGGREGATION_CONFIG, ...config };
  }

  /**
   * Aggregate signals from multiple strategies
   */
  aggregateSignals(
    signals: StrategySignal[],
    strategyWeights: Map<string, number>,
    method?: SignalAggregationMethod
  ): AggregatedSignal | null {
    if (signals.length === 0) {
      return null;
    }

    // Filter by minimum confidence
    const filteredSignals = signals.filter(
      s => s.confidence >= this.config.minConfidence
    );

    if (filteredSignals.length === 0) {
      log.debug('All signals filtered out due to low confidence');
      return null;
    }

    // Group by symbol
    const signalsBySymbol = this.groupSignalsBySymbol(filteredSignals);
    
    // Aggregate each symbol's signals
    const aggregationMethod = method || this.config.method;
    const aggregated = this.aggregateBySymbol(signalsBySymbol, strategyWeights, aggregationMethod);

    // Return the highest confidence signal if multiple symbols
    if (aggregated.length === 0) {
      return null;
    }

    // Sort by confidence and return the best one
    // In practice, you might want to return all signals for all symbols
    return aggregated.sort((a, b) => b.confidence - a.confidence)[0];
  }

  /**
   * Aggregate signals for all symbols
   */
  aggregateAllSignals(
    signals: StrategySignal[],
    strategyWeights: Map<string, number>,
    method?: SignalAggregationMethod
  ): AggregatedSignal[] {
    const filteredSignals = signals.filter(
      s => s.confidence >= this.config.minConfidence
    );

    if (filteredSignals.length === 0) {
      return [];
    }

    const signalsBySymbol = this.groupSignalsBySymbol(filteredSignals);
    const aggregationMethod = method || this.config.method;

    return this.aggregateBySymbol(signalsBySymbol, strategyWeights, aggregationMethod);
  }

  /**
   * Group signals by symbol
   */
  private groupSignalsBySymbol(signals: StrategySignal[]): Map<string, StrategySignal[]> {
    const grouped = new Map<string, StrategySignal[]>();

    for (const signal of signals) {
      const existing = grouped.get(signal.symbol) || [];
      existing.push(signal);
      grouped.set(signal.symbol, existing);
    }

    return grouped;
  }

  /**
   * Aggregate signals by symbol
   */
  private aggregateBySymbol(
    signalsBySymbol: Map<string, StrategySignal[]>,
    strategyWeights: Map<string, number>,
    method: SignalAggregationMethod
  ): AggregatedSignal[] {
    const results: AggregatedSignal[] = [];

    for (const [symbol, signals] of signalsBySymbol) {
      const aggregated = this.aggregateSymbolSignals(
        symbol,
        signals,
        strategyWeights,
        method
      );

      if (aggregated) {
        results.push(aggregated);
      }
    }

    return results;
  }

  /**
   * Aggregate signals for a single symbol
   */
  private aggregateSymbolSignals(
    symbol: string,
    signals: StrategySignal[],
    strategyWeights: Map<string, number>,
    method: SignalAggregationMethod
  ): AggregatedSignal | null {
    switch (method) {
      case 'voting':
        return this.votingAggregation(symbol, signals, strategyWeights);
      case 'weighted_average':
        return this.weightedAverageAggregation(symbol, signals, strategyWeights);
      case 'consensus':
        return this.consensusAggregation(symbol, signals, strategyWeights);
      case 'best_performer':
        return this.bestPerformerAggregation(symbol, signals, strategyWeights);
      default:
        return this.weightedAverageAggregation(symbol, signals, strategyWeights);
    }
  }

  /**
   * Voting aggregation - majority vote on direction
   */
  private votingAggregation(
    symbol: string,
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): AggregatedSignal | null {
    let buyVotes = 0;
    let sellVotes = 0;
    let holdVotes = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = strategyWeights.get(signal.strategyId) || 1 / signals.length;
      totalWeight += weight;

      switch (signal.side) {
        case 'buy':
          buyVotes += weight;
          break;
        case 'sell':
          sellVotes += weight;
          break;
        case 'hold':
          holdVotes += weight;
          break;
      }
    }

    // Determine winner
    let side: 'buy' | 'sell' | 'hold';
    let winningVotes: number;

    if (buyVotes > sellVotes && buyVotes > holdVotes) {
      side = 'buy';
      winningVotes = buyVotes;
    } else if (sellVotes > buyVotes && sellVotes > holdVotes) {
      side = 'sell';
      winningVotes = sellVotes;
    } else {
      side = 'hold';
      winningVotes = holdVotes;
    }

    // Check if majority is required
    if (this.config.requireMajority && winningVotes / totalWeight < 0.5) {
      side = 'hold';
    }

    // Calculate confidence as proportion of winning votes
    const confidence = totalWeight > 0 ? winningVotes / totalWeight : 0;

    // Calculate weighted average quantity and price
    const { quantity, price } = this.calculateWeightedAverages(
      signals.filter(s => s.side === side),
      strategyWeights
    );

    return {
      symbol,
      side,
      confidence,
      quantity,
      price,
      aggregationMethod: 'voting',
      contributingStrategies: signals.map(s => ({
        strategyId: s.strategyId,
        signal: s,
        weight: strategyWeights.get(s.strategyId) || 1 / signals.length,
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Weighted average aggregation
   */
  private weightedAverageAggregation(
    symbol: string,
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): AggregatedSignal | null {
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = (strategyWeights.get(signal.strategyId) || 1 / signals.length) * signal.confidence;
      totalWeight += weight;

      if (signal.side === 'buy') {
        buyScore += weight;
      } else if (signal.side === 'sell') {
        sellScore += weight;
      }
    }

    // Determine direction
    let side: 'buy' | 'sell' | 'hold';
    const netScore = buyScore - sellScore;
    const threshold = totalWeight * 0.2; // 20% threshold for action

    if (netScore > threshold) {
      side = 'buy';
    } else if (netScore < -threshold) {
      side = 'sell';
    } else {
      side = 'hold';
    }

    // Confidence is the absolute value of net score normalized
    const confidence = totalWeight > 0 ? Math.abs(netScore) / totalWeight : 0;

    // Calculate weighted averages for buy or sell signals
    const relevantSignals = signals.filter(
      s => s.side === (side === 'hold' ? 'buy' : side)
    );
    const { quantity, price } = this.calculateWeightedAverages(
      relevantSignals,
      strategyWeights
    );

    return {
      symbol,
      side,
      confidence,
      quantity,
      price,
      aggregationMethod: 'weighted_average',
      contributingStrategies: signals.map(s => ({
        strategyId: s.strategyId,
        signal: s,
        weight: strategyWeights.get(s.strategyId) || 1 / signals.length,
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Consensus aggregation - only act when strategies agree above threshold
   */
  private consensusAggregation(
    symbol: string,
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): AggregatedSignal | null {
    const buySignals = signals.filter(s => s.side === 'buy');
    const sellSignals = signals.filter(s => s.side === 'sell');
    const totalWeight = signals.reduce(
      (sum, s) => sum + (strategyWeights.get(s.strategyId) || 1 / signals.length),
      0
    );

    const buyWeight = buySignals.reduce(
      (sum, s) => sum + (strategyWeights.get(s.strategyId) || 1 / signals.length),
      0
    );
    const sellWeight = sellSignals.reduce(
      (sum, s) => sum + (strategyWeights.get(s.strategyId) || 1 / signals.length),
      0
    );

    const threshold = this.config.consensusThreshold;

    let side: 'buy' | 'sell' | 'hold';
    let confidence = 0;

    if (buyWeight / totalWeight >= threshold) {
      side = 'buy';
      confidence = buyWeight / totalWeight;
    } else if (sellWeight / totalWeight >= threshold) {
      side = 'sell';
      confidence = sellWeight / totalWeight;
    } else {
      side = 'hold';
      confidence = 1 - Math.max(buyWeight, sellWeight) / totalWeight;
    }

    const relevantSignals = side === 'hold' ? [] : signals.filter(s => s.side === side);
    const { quantity, price } = this.calculateWeightedAverages(
      relevantSignals,
      strategyWeights
    );

    return {
      symbol,
      side,
      confidence,
      quantity,
      price,
      aggregationMethod: 'consensus',
      contributingStrategies: signals.map(s => ({
        strategyId: s.strategyId,
        signal: s,
        weight: strategyWeights.get(s.strategyId) || 1 / signals.length,
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Best performer aggregation - follow the best performing strategy
   */
  private bestPerformerAggregation(
    symbol: string,
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): AggregatedSignal | null {
    if (signals.length === 0) {
      return null;
    }

    // Find the signal with highest confidence (assuming best performer = highest confidence)
    const bestSignal = signals.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return {
      symbol,
      side: bestSignal.side,
      confidence: bestSignal.confidence,
      quantity: bestSignal.quantity || 0,
      price: bestSignal.price,
      aggregationMethod: 'best_performer',
      contributingStrategies: signals.map(s => ({
        strategyId: s.strategyId,
        signal: s,
        weight: s.strategyId === bestSignal.strategyId ? 1 : 0,
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Calculate weighted average quantity and price
   */
  private calculateWeightedAverages(
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): { quantity: number; price?: number } {
    if (signals.length === 0) {
      return { quantity: 0 };
    }

    let totalWeight = 0;
    let weightedQuantity = 0;
    let weightedPrice = 0;
    let hasPrice = false;

    for (const signal of signals) {
      const weight = (strategyWeights.get(signal.strategyId) || 1 / signals.length) * signal.confidence;
      totalWeight += weight;

      if (signal.quantity) {
        weightedQuantity += signal.quantity * weight;
      }

      if (signal.price) {
        weightedPrice += signal.price * weight;
        hasPrice = true;
      }
    }

    return {
      quantity: totalWeight > 0 ? weightedQuantity / totalWeight : 0,
      price: hasPrice && totalWeight > 0 ? weightedPrice / totalWeight : undefined,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SignalAggregationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SignalAggregationConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const signalAggregationService = new SignalAggregationService();