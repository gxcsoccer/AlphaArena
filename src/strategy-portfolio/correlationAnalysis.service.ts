/**
 * Correlation Analysis Service
 * 
 * Analyzes correlations between strategies in a portfolio to:
 * - Measure diversification benefits
 * - Identify highly correlated strategies
 * - Provide recommendations for improvement
 */

import {
  StrategyCorrelation,
  CorrelationMatrix,
  CorrelationAnalysis,
  PortfolioPerformanceSnapshot,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('CorrelationAnalysisService');

/**
 * High correlation threshold
 */
const HIGH_CORRELATION_THRESHOLD = 0.7;

/**
 * Correlation Analysis Service class
 */
export class CorrelationAnalysisService {
  /**
   * Calculate correlation between two strategies based on returns
   */
  calculateCorrelation(
    returns1: number[],
    returns2: number[]
  ): number {
    if (returns1.length !== returns2.length || returns1.length < 2) {
      return 0;
    }

    const n = returns1.length;
    const mean1 = returns1.reduce((a, b) => a + b, 0) / n;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1 * denom2);
    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * Calculate rolling correlation
   */
  calculateRollingCorrelation(
    returns1: number[],
    returns2: number[],
    window: number = 30
  ): number[] {
    if (returns1.length < window || returns2.length < window) {
      return [];
    }

    const correlations: number[] = [];
    for (let i = window; i <= returns1.length; i++) {
      const slice1 = returns1.slice(i - window, i);
      const slice2 = returns2.slice(i - window, i);
      correlations.push(this.calculateCorrelation(slice1, slice2));
    }

    return correlations;
  }

  /**
   * Build correlation matrix for multiple strategies
   */
  buildCorrelationMatrix(
    strategyReturns: Map<string, number[]>
  ): CorrelationMatrix {
    const strategyIds = Array.from(strategyReturns.keys());
    const n = strategyIds.length;
    const matrix: number[][] = [];

    // Initialize matrix with 1s on diagonal
    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const returns1 = strategyReturns.get(strategyIds[i]) || [];
          const returns2 = strategyReturns.get(strategyIds[j]) || [];
          matrix[i][j] = this.calculateCorrelation(returns1, returns2);
        }
      }
    }

    return {
      strategyIds,
      matrix,
      period: '30d',
      calculatedAt: new Date(),
    };
  }

  /**
   * Perform full correlation analysis
   */
  analyzeCorrelations(
    strategyReturns: Map<string, number[]>
  ): CorrelationAnalysis {
    const matrix = this.buildCorrelationMatrix(strategyReturns);
    const highCorrelationPairs = this.findHighCorrelationPairs(matrix);
    const diversificationScore = this.calculateDiversificationScore(matrix);
    const recommendations = this.generateRecommendations(
      matrix,
      highCorrelationPairs,
      diversificationScore
    );

    return {
      matrix,
      highCorrelationPairs,
      diversificationScore,
      recommendations,
    };
  }

  /**
   * Find pairs with high correlation
   */
  findHighCorrelationPairs(
    matrix: CorrelationMatrix,
    threshold: number = HIGH_CORRELATION_THRESHOLD
  ): Array<{
    strategyId1: string;
    strategyId2: string;
    correlation: number;
  }> {
    const pairs: Array<{
      strategyId1: string;
      strategyId2: string;
      correlation: number;
    }> = [];

    const { strategyIds, matrix: m } = matrix;
    const n = strategyIds.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const correlation = Math.abs(m[i][j]);
        if (correlation >= threshold) {
          pairs.push({
            strategyId1: strategyIds[i],
            strategyId2: strategyIds[j],
            correlation: m[i][j],
          });
        }
      }
    }

    return pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Calculate diversification score
   * Higher score = better diversification (less correlated strategies)
   */
  calculateDiversificationScore(matrix: CorrelationMatrix): number {
    const { matrix: m, strategyIds } = matrix;
    const n = strategyIds.length;

    if (n <= 1) {
      return 100; // Single strategy = perfectly "diversified"
    }

    // Calculate average correlation (excluding diagonal)
    let totalCorrelation = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        totalCorrelation += Math.abs(m[i][j]);
        count++;
      }
    }

    const avgCorrelation = count > 0 ? totalCorrelation / count : 0;

    // Convert to score: 0 correlation = 100, 1 correlation = 0
    return Math.round((1 - avgCorrelation) * 100);
  }

  /**
   * Generate recommendations based on correlation analysis
   */
  private generateRecommendations(
    matrix: CorrelationMatrix,
    highCorrelationPairs: Array<{
      strategyId1: string;
      strategyId2: string;
      correlation: number;
    }>,
    diversificationScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Diversification recommendations
    if (diversificationScore < 50) {
      recommendations.push(
        'Your portfolio has low diversification. Consider adding strategies with different approaches or asset classes.'
      );
    } else if (diversificationScore < 70) {
      recommendations.push(
        'Portfolio diversification is moderate. Consider reducing allocation to highly correlated strategies.'
      );
    }

    // Specific pair recommendations
    for (const pair of highCorrelationPairs.slice(0, 3)) {
      const correlation = Math.abs(pair.correlation);
      if (correlation >= 0.9) {
        recommendations.push(
          `Strategies ${pair.strategyId1} and ${pair.strategyId2} are highly correlated (${(correlation * 100).toFixed(0)}%). Consider removing one to avoid redundancy.`
        );
      } else {
        recommendations.push(
          `Consider reducing combined allocation to ${pair.strategyId1} and ${pair.strategyId2} due to high correlation (${(correlation * 100).toFixed(0)}%).`
        );
      }
    }

    // Positive correlation recommendations
    const negativeCorrelations = this.findNegativeCorrelations(matrix);
    if (negativeCorrelations.length > 0 && highCorrelationPairs.length > 2) {
      recommendations.push(
        `You have ${negativeCorrelations.length} negatively correlated pairs, which helps balance risk. Maintain these combinations.`
      );
    }

    return recommendations;
  }

  /**
   * Find negatively correlated pairs
   */
  private findNegativeCorrelations(
    matrix: CorrelationMatrix
  ): Array<{
    strategyId1: string;
    strategyId2: string;
    correlation: number;
  }> {
    const pairs: Array<{
      strategyId1: string;
      strategyId2: string;
      correlation: number;
    }> = [];

    const { strategyIds, matrix: m } = matrix;
    const n = strategyIds.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (m[i][j] < -0.2) {
          pairs.push({
            strategyId1: strategyIds[i],
            strategyId2: strategyIds[j],
            correlation: m[i][j],
          });
        }
      }
    }

    return pairs;
  }

  /**
   * Calculate correlation from performance snapshots
   */
  calculateFromSnapshots(
    snapshots: PortfolioPerformanceSnapshot[]
  ): Map<string, number[]> {
    const strategyReturns = new Map<string, number[]>();

    if (snapshots.length < 2) {
      return strategyReturns;
    }

    // Sort snapshots by date
    const sorted = [...snapshots].sort(
      (a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime()
    );

    // Get all strategy IDs
    const strategyIds = new Set<string>();
    for (const snapshot of sorted) {
      for (const perf of snapshot.strategyPerformances) {
        strategyIds.add(perf.strategyId);
      }
    }

    // Calculate returns for each strategy
    for (const strategyId of strategyIds) {
      const returns: number[] = [];
      let previousValue: number | null = null;

      for (const snapshot of sorted) {
        const perf = snapshot.strategyPerformances.find(
          p => p.strategyId === strategyId
        );
        if (perf) {
          if (previousValue !== null && previousValue > 0) {
            const ret = (perf.currentValue - previousValue) / previousValue;
            returns.push(ret);
          }
          previousValue = perf.currentValue;
        }
      }

      if (returns.length > 0) {
        strategyReturns.set(strategyId, returns);
      }
    }

    return strategyReturns;
  }

  /**
   * Calculate correlation summary for display
   */
  getCorrelationSummary(analysis: CorrelationAnalysis): {
    averageCorrelation: number;
    maxCorrelation: number;
    minCorrelation: number;
    highCorrelationCount: number;
    negativeCorrelationCount: number;
  } {
    const { matrix, strategyIds } = analysis.matrix;
    const n = strategyIds.length;

    if (n <= 1) {
      return {
        averageCorrelation: 0,
        maxCorrelation: 0,
        minCorrelation: 0,
        highCorrelationCount: 0,
        negativeCorrelationCount: 0,
      };
    }

    let total = 0;
    let count = 0;
    let max = -Infinity;
    let min = Infinity;
    let highCount = 0;
    let negativeCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = matrix[i][j];
        total += corr;
        count++;
        max = Math.max(max, corr);
        min = Math.min(min, corr);
        if (Math.abs(corr) >= HIGH_CORRELATION_THRESHOLD) highCount++;
        if (corr < 0) negativeCount++;
      }
    }

    return {
      averageCorrelation: count > 0 ? total / count : 0,
      maxCorrelation: max === -Infinity ? 0 : max,
      minCorrelation: min === Infinity ? 0 : min,
      highCorrelationCount: highCount,
      negativeCorrelationCount: negativeCount,
    };
  }
}

// Singleton instance
export const correlationAnalysisService = new CorrelationAnalysisService();