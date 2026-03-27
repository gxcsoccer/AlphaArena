/**
 * Risk Control Service
 * 
 * Manages portfolio-level risk controls including:
 * - Position limits enforcement
 * - Strategy conflict detection
 * - Automated conflict resolution
 */

import {
  PositionLimits,
  StrategyConflict,
  ConflictType,
  ConflictResolution,
  RiskControlConfig,
  StrategySignal,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskControlService');

/**
 * Default position limits
 */
export const DEFAULT_POSITION_LIMITS: PositionLimits = {
  maxTotalPosition: 100000,  // $100k
  maxSingleAssetPosition: 20000,  // $20k
  maxSingleStrategyPosition: 50000,  // $50k
  maxLeverage: 2,  // 2x
};

/**
 * Default risk control configuration
 */
export const DEFAULT_RISK_CONTROL_CONFIG: RiskControlConfig = {
  positionLimits: DEFAULT_POSITION_LIMITS,
  conflictResolution: 'weighted_vote',
  enableConflictDetection: true,
  autoResolveConflicts: true,
};

/**
 * Risk Control Service class
 */
export class RiskControlService {
  private config: RiskControlConfig;

  constructor(config: Partial<RiskControlConfig> = {}) {
    this.config = { ...DEFAULT_RISK_CONTROL_CONFIG, ...config };
  }

  /**
   * Check if a position is within limits
   */
  checkPositionLimits(params: {
    currentTotalPosition: number;
    currentPositionByAsset: Map<string, number>;
    currentPositionByStrategy: Map<string, number>;
    proposedPosition?: {
      strategyId: string;
      symbol: string;
      value: number;
    };
  }): {
    withinLimits: boolean;
    violations: string[];
    warnings: string[];
  } {
    const { positionLimits } = this.config;
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check total position limit
    if (params.currentTotalPosition > positionLimits.maxTotalPosition) {
      violations.push(
        `Total position ${params.currentTotalPosition.toFixed(2)} exceeds limit ${positionLimits.maxTotalPosition}`
      );
    } else if (params.currentTotalPosition > positionLimits.maxTotalPosition * 0.9) {
      warnings.push(
        `Total position at ${((params.currentTotalPosition / positionLimits.maxTotalPosition) * 100).toFixed(1)}% of limit`
      );
    }

    // Check per-asset limits
    for (const [symbol, position] of params.currentPositionByAsset) {
      if (position > positionLimits.maxSingleAssetPosition) {
        violations.push(
          `Position in ${symbol} (${position.toFixed(2)}) exceeds limit ${positionLimits.maxSingleAssetPosition}`
        );
      } else if (position > positionLimits.maxSingleAssetPosition * 0.8) {
        warnings.push(
          `Position in ${symbol} at ${((position / positionLimits.maxSingleAssetPosition) * 100).toFixed(1)}% of limit`
        );
      }
    }

    // Check per-strategy limits
    for (const [strategyId, position] of params.currentPositionByStrategy) {
      if (position > positionLimits.maxSingleStrategyPosition) {
        violations.push(
          `Position from strategy ${strategyId} (${position.toFixed(2)}) exceeds limit ${positionLimits.maxSingleStrategyPosition}`
        );
      }
    }

    // Check proposed position if provided
    if (params.proposedPosition) {
      const { strategyId, symbol, value } = params.proposedPosition;

      // Check if adding this position would exceed total
      if (params.currentTotalPosition + value > positionLimits.maxTotalPosition) {
        violations.push(
          `Proposed position would exceed total position limit`
        );
      }

      // Check per-asset
      const currentAssetPosition = params.currentPositionByAsset.get(symbol) || 0;
      if (currentAssetPosition + value > positionLimits.maxSingleAssetPosition) {
        violations.push(
          `Proposed position would exceed ${symbol} position limit`
        );
      }

      // Check per-strategy
      const currentStrategyPosition = params.currentPositionByStrategy.get(strategyId) || 0;
      if (currentStrategyPosition + value > positionLimits.maxSingleStrategyPosition) {
        violations.push(
          `Proposed position would exceed strategy position limit`
        );
      }
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Detect conflicts between strategy signals
   */
  detectConflicts(signals: StrategySignal[]): StrategyConflict[] {
    if (!this.config.enableConflictDetection) {
      return [];
    }

    const conflicts: StrategyConflict[] = [];

    // Group signals by symbol
    const signalsBySymbol = new Map<string, StrategySignal[]>();
    for (const signal of signals) {
      const existing = signalsBySymbol.get(signal.symbol) || [];
      existing.push(signal);
      signalsBySymbol.set(signal.symbol, existing);
    }

    // Check each symbol for conflicts
    for (const [symbol, symbolSignals] of signalsBySymbol) {
      const buys = symbolSignals.filter(s => s.side === 'buy');
      const sells = symbolSignals.filter(s => s.side === 'sell');

      // Opposite direction conflict
      if (buys.length > 0 && sells.length > 0) {
        const conflict = this.createConflict(
          'opposite_direction',
          symbol,
          [...buys.map(s => s.strategyId), ...sells.map(s => s.strategyId)],
          `Strategies have conflicting signals for ${symbol}: ${buys.length} want to buy, ${sells.length} want to sell`,
          this.determineSeverity(buys.length + sells.length)
        );
        conflicts.push(conflict);
      }

      // Same direction conflict (multiple strategies want to buy/sell same asset)
      if (buys.length > 1 || sells.length > 1) {
        const direction = buys.length > 1 ? 'buy' : 'sell';
        const relevantSignals = direction === 'buy' ? buys : sells;
        const totalQuantity = relevantSignals.reduce((sum, s) => sum + (s.quantity || 0), 0);

        // Only flag as conflict if total quantity is significant
        if (totalQuantity > this.config.positionLimits.maxSingleAssetPosition * 0.5) {
          const conflict = this.createConflict(
            'same_direction',
            symbol,
            relevantSignals.map(s => s.strategyId),
            `Multiple strategies want to ${direction} ${symbol}: total quantity ${totalQuantity.toFixed(2)}`,
            'medium'
          );
          conflicts.push(conflict);
        }
      }
    }

    // Detect resource contention (multiple strategies trading heavily)
    const totalSignalsPerStrategy = new Map<string, number>();
    for (const signal of signals) {
      const count = totalSignalsPerStrategy.get(signal.strategyId) || 0;
      totalSignalsPerStrategy.set(signal.strategyId, count + 1);
    }

    const heavyTraders = Array.from(totalSignalsPerStrategy.entries())
      .filter(([_, count]) => count > 5);

    if (heavyTraders.length > 2) {
      const conflict = this.createConflict(
        'resource_contention',
        'all',
        heavyTraders.map(([id]) => id),
        'Multiple strategies are generating many signals simultaneously',
        'low'
      );
      conflicts.push(conflict);
    }

    return conflicts;
  }

  /**
   * Create a conflict object
   */
  private createConflict(
    type: ConflictType,
    symbol: string,
    strategyIds: string[],
    description: string,
    severity: 'low' | 'medium' | 'high'
  ): StrategyConflict {
    const suggestedResolution = this.suggestResolution(type, severity);

    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      strategyIds,
      symbol,
      description,
      severity,
      suggestedResolution,
      detectedAt: new Date(),
    };
  }

  /**
   * Suggest resolution for a conflict
   */
  private suggestResolution(
    type: ConflictType,
    severity: 'low' | 'medium' | 'high'
  ): string {
    switch (type) {
      case 'opposite_direction':
        if (severity === 'high') {
          return 'Consider using weighted voting to determine direction, or pause one strategy';
        }
        return 'Use signal aggregation to resolve conflicting signals';
      case 'same_direction':
        return 'Adjust position sizes proportionally to stay within limits';
      case 'resource_contention':
        return 'Consider staggering strategy execution or reducing signal frequency';
      default:
        return 'Review and adjust strategy parameters';
    }
  }

  /**
   * Determine conflict severity
   */
  private determineSeverity(involvedStrategies: number): 'low' | 'medium' | 'high' {
    if (involvedStrategies >= 4) return 'high';
    if (involvedStrategies >= 2) return 'medium';
    return 'low';
  }

  /**
   * Resolve conflicts automatically
   */
  resolveConflicts(
    conflicts: StrategyConflict[],
    signals: StrategySignal[],
    strategyWeights: Map<string, number>
  ): {
    resolvedSignals: StrategySignal[];
    resolutions: Array<{ conflictId: string; action: string }>;
  } {
    const resolutions: Array<{ conflictId: string; action: string }> = [];
    const resolvedSignals = [...signals];

    if (!this.config.autoResolveConflicts) {
      return { resolvedSignals, resolutions };
    }

    for (const conflict of conflicts) {
      switch (this.config.conflictResolution) {
        case 'first_come':
          // Keep only the first signal for this symbol
          {
            const firstSignal = signals.find(s => conflict.strategyIds.includes(s.strategyId));
            if (firstSignal) {
              // Remove other signals for this symbol
              const toRemove = resolvedSignals.filter(
                s => conflict.strategyIds.includes(s.strategyId) && s.id !== firstSignal.id
              );
              for (const s of toRemove) {
                const index = resolvedSignals.indexOf(s);
                if (index > -1) resolvedSignals.splice(index, 1);
              }
              resolutions.push({
                conflictId: conflict.id,
                action: `Kept first signal from ${firstSignal.strategyId}`,
              });
            }
          }
          break;

        case 'highest_confidence':
          // Keep only the highest confidence signal
          {
            const relevantSignals = signals.filter(s => conflict.strategyIds.includes(s.strategyId));
            if (relevantSignals.length > 0) {
              const best = relevantSignals.reduce((a, b) =>
                a.confidence > b.confidence ? a : b
              );
              const toRemove = resolvedSignals.filter(
                s => conflict.strategyIds.includes(s.strategyId) && s.id !== best.id
              );
              for (const s of toRemove) {
                const index = resolvedSignals.indexOf(s);
                if (index > -1) resolvedSignals.splice(index, 1);
              }
              resolutions.push({
                conflictId: conflict.id,
                action: `Kept highest confidence signal from ${best.strategyId}`,
              });
            }
          }
          break;

        case 'weighted_vote':
          // Weight signals by strategy weight and keep the winning direction
          {
            const relevantSignals = signals.filter(s => conflict.strategyIds.includes(s.strategyId));
            let buyWeight = 0;
            let sellWeight = 0;

            for (const signal of relevantSignals) {
              const weight = strategyWeights.get(signal.strategyId) || 1;
              if (signal.side === 'buy') buyWeight += weight * signal.confidence;
              else if (signal.side === 'sell') sellWeight += weight * signal.confidence;
            }

            const winningSide = buyWeight > sellWeight ? 'buy' : 'sell';
            const toRemove = resolvedSignals.filter(
              s => conflict.strategyIds.includes(s.strategyId) && s.side !== winningSide
            );
            for (const s of toRemove) {
              const index = resolvedSignals.indexOf(s);
              if (index > -1) resolvedSignals.splice(index, 1);
            }
            resolutions.push({
              conflictId: conflict.id,
              action: `Resolved via weighted vote to ${winningSide}`,
            });
          }
          break;

        case 'manual':
          // Don't auto-resolve
          resolutions.push({
            conflictId: conflict.id,
            action: 'Requires manual resolution',
          });
          break;
      }
    }

    return { resolvedSignals, resolutions };
  }

  /**
   * Calculate risk score for a portfolio
   */
  calculateRiskScore(params: {
    totalPosition: number;
    positionByAsset: Map<string, number>;
    positionByStrategy: Map<string, number>;
    conflictCount: number;
  }): {
    score: number;  // 0-100, lower is better
    breakdown: {
      concentrationRisk: number;
      limitUtilization: number;
      conflictRisk: number;
    };
  } {
    const { positionLimits } = this.config;

    // Concentration risk (how concentrated is the portfolio)
    const assetWeights = Array.from(params.positionByAsset.values());
    const totalAssetValue = assetWeights.reduce((a, b) => a + b, 0);
    const hhi = assetWeights.reduce((sum, w) => sum + (w / totalAssetValue) ** 2, 0);
    const concentrationRisk = hhi * 100;

    // Limit utilization
    const totalUtilization = params.totalPosition / positionLimits.maxTotalPosition;
    const maxAssetUtilization = Math.max(
      ...Array.from(params.positionByAsset.values()).map(
        v => v / positionLimits.maxSingleAssetPosition
      ),
      0
    );
    const limitUtilization = Math.max(totalUtilization, maxAssetUtilization) * 100;

    // Conflict risk
    const conflictRisk = Math.min(params.conflictCount * 10, 100);

    // Overall score (weighted average)
    const score = concentrationRisk * 0.4 + limitUtilization * 0.4 + conflictRisk * 0.2;

    return {
      score: Math.min(score, 100),
      breakdown: {
        concentrationRisk,
        limitUtilization,
        conflictRisk,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskControlConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskControlConfig {
    return { ...this.config };
  }

  /**
   * Update position limits
   */
  updatePositionLimits(limits: Partial<PositionLimits>): void {
    this.config.positionLimits = { ...this.config.positionLimits, ...limits };
  }
}

// Singleton instance
export const riskControlService = new RiskControlService();