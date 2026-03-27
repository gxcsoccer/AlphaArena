/**
 * Portfolio Optimization Service
 * 
 * Provides optimization suggestions and analysis for portfolios:
 * - Rebalancing recommendations
 * - Risk reduction suggestions
 * - Diversification improvements
 * - Performance optimization
 */

import {
  OptimizationSuggestion,
  OptimizationAnalysis,
  StrategyPortfolio,
  Allocation,
  CorrelationAnalysis,
} from './types';
import { correlationAnalysisService } from './correlationAnalysis.service';
import { createLogger } from '../utils/logger';

const log = createLogger('OptimizationService');

/**
 * Optimization thresholds
 */
const THRESHOLDS = {
  highConcentration: 0.4,  // Single strategy > 40% = high concentration
  lowDiversification: 50,  // Score < 50 = low diversification
  underperformingReturn: -0.1,  // -10% = underperforming
  maxWeightDeviation: 0.15,  // 15% deviation suggests rebalance
};

/**
 * Portfolio Optimization Service class
 */
export class PortfolioOptimizationService {
  /**
   * Analyze portfolio and generate optimization suggestions
   */
  analyzePortfolio(
    portfolio: StrategyPortfolio,
    correlationAnalysis?: CorrelationAnalysis,
    historicalReturns?: Map<string, number[]>
  ): OptimizationAnalysis {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for concentration risk
    const concentrationSuggestions = this.checkConcentrationRisk(portfolio);
    suggestions.push(...concentrationSuggestions);

    // Check for rebalancing needs
    const rebalanceSuggestions = this.checkRebalanceNeeds(portfolio);
    suggestions.push(...rebalanceSuggestions);

    // Check for diversification issues
    if (correlationAnalysis) {
      const diversificationSuggestions = this.checkDiversification(
        portfolio,
        correlationAnalysis
      );
      suggestions.push(...diversificationSuggestions);
    }

    // Check for underperforming strategies
    if (historicalReturns) {
      const performanceSuggestions = this.checkPerformance(
        portfolio,
        historicalReturns
      );
      suggestions.push(...performanceSuggestions);
    }

    // Check for risk reduction opportunities
    const riskSuggestions = this.checkRiskReduction(portfolio);
    suggestions.push(...riskSuggestions);

    // Calculate overall score
    const currentScore = this.calculateOptimizationScore(portfolio, suggestions);

    // Calculate risk-return profile
    const riskReturnProfile = this.calculateRiskReturnProfile(
      portfolio,
      historicalReturns
    );

    return {
      currentScore,
      suggestions: suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
      riskReturnProfile,
      lastAnalyzed: new Date(),
    };
  }

  /**
   * Check for concentration risk
   */
  private checkConcentrationRisk(
    portfolio: StrategyPortfolio
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const strategies = portfolio.strategies || [];

    if (strategies.length === 0) {
      return suggestions;
    }

    // Find strategies with high weight
    const concentratedStrategies = strategies.filter(
      s => s.weight >= THRESHOLDS.highConcentration
    );

    for (const strategy of concentratedStrategies) {
      suggestions.push({
        id: `opt_conc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'adjust_weight',
        priority: strategy.weight >= 0.6 ? 'high' : 'medium',
        title: `Reduce concentration in ${strategy.strategyName || strategy.strategyId}`,
        description: `This strategy has ${(strategy.weight * 100).toFixed(0)}% of portfolio allocation. Consider reducing to improve diversification.`,
        impact: {
          diversificationImprovement: (strategy.weight - 0.3) * 100,
        },
        actions: [
          {
            type: 'reduce_weight',
            strategyId: strategy.strategyId,
            currentValue: strategy.weight,
            suggestedValue: Math.min(0.3, strategy.weight * 0.7),
          },
        ],
        createdAt: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Check if portfolio needs rebalancing
   */
  private checkRebalanceNeeds(
    portfolio: StrategyPortfolio
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const strategies = portfolio.strategies || [];

    if (strategies.length === 0) {
      return suggestions;
    }

    // Check weight deviations
    const deviations: Array<{
      strategyId: string;
      name: string;
      targetWeight: number;
      actualWeight: number;
      deviation: number;
    }> = [];

    for (const strategy of strategies) {
      const currentValue = strategy.currentValue || strategy.allocation;
      const totalValue = strategies.reduce(
        (sum, s) => sum + (s.currentValue || s.allocation),
        0
      );
      const actualWeight = totalValue > 0 ? currentValue / totalValue : 0;
      const deviation = Math.abs(actualWeight - strategy.weight);

      if (deviation >= THRESHOLDS.maxWeightDeviation) {
        deviations.push({
          strategyId: strategy.strategyId,
          name: strategy.strategyName || strategy.strategyId,
          targetWeight: strategy.weight,
          actualWeight,
          deviation,
        });
      }
    }

    if (deviations.length > 0) {
      suggestions.push({
        id: `opt_rebal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'rebalance',
        priority: deviations.some(d => d.deviation > 0.25) ? 'high' : 'medium',
        title: 'Portfolio rebalancing recommended',
        description: `${deviations.length} strategies have drifted from target allocations by more than ${(THRESHOLDS.maxWeightDeviation * 100).toFixed(0)}%.`,
        impact: {
          riskReduction: deviations.reduce((sum, d) => sum + d.deviation * 10, 0),
        },
        actions: deviations.map(d => ({
          type: 'adjust_allocation',
          strategyId: d.strategyId,
          currentValue: d.actualWeight,
          suggestedValue: d.targetWeight,
        })),
        createdAt: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Check diversification based on correlation analysis
   */
  private checkDiversification(
    portfolio: StrategyPortfolio,
    correlationAnalysis: CorrelationAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const { diversificationScore, highCorrelationPairs } = correlationAnalysis;

    if (diversificationScore < THRESHOLDS.lowDiversification) {
      // Find the most correlated pair to suggest removal
      if (highCorrelationPairs.length > 0) {
        const worst = highCorrelationPairs[0];
        const strategies = portfolio.strategies || [];

        // Find which one to remove (the one with lower performance)
        const strategy1 = strategies.find(s => s.strategyId === worst.strategyId1);
        const strategy2 = strategies.find(s => s.strategyId === worst.strategyId2);

        const toRemove = (strategy1?.returnPct || 0) < (strategy2?.returnPct || 0)
          ? strategy1
          : strategy2;

        if (toRemove) {
          suggestions.push({
            id: `opt_div_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'remove_strategy',
            priority: 'high',
            title: `Remove redundant strategy: ${toRemove.strategyName || toRemove.strategyId}`,
            description: `High correlation (${(Math.abs(worst.correlation) * 100).toFixed(0)}%) with another strategy. Removing improves diversification.`,
            impact: {
              diversificationImprovement: (1 - Math.abs(worst.correlation)) * 20,
            },
            actions: [
              {
                type: 'remove',
                strategyId: toRemove.strategyId,
              },
            ],
            createdAt: new Date(),
          });
        }
      }
    }

    // Suggest adding different strategy types if all are similar
    if (highCorrelationPairs.length >= (portfolio.strategies?.length || 0)) {
      suggestions.push({
        id: `opt_add_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'add_strategy',
        priority: 'medium',
        title: 'Add a different strategy type',
        description: 'Current strategies are highly correlated. Consider adding a strategy with a different approach (e.g., mean reversion if all are momentum).',
        impact: {
          diversificationImprovement: 20,
        },
        actions: [
          {
            type: 'add',
            suggestedValue: 0.2,  // Suggested 20% allocation
          },
        ],
        createdAt: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Check for underperforming strategies
   */
  private checkPerformance(
    portfolio: StrategyPortfolio,
    historicalReturns: Map<string, number[]>
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const strategies = portfolio.strategies || [];

    for (const strategy of strategies) {
      const returns = historicalReturns.get(strategy.strategyId);
      if (!returns || returns.length < 10) continue;

      // Calculate cumulative return
      const cumulativeReturn = returns.reduce((a, b) => a + b, 0);

      if (cumulativeReturn < THRESHOLDS.underperformingReturn) {
        suggestions.push({
          id: `opt_perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'adjust_weight',
          priority: cumulativeReturn < -0.2 ? 'high' : 'medium',
          title: `Underperforming strategy: ${strategy.strategyName || strategy.strategyId}`,
          description: `This strategy has a cumulative return of ${(cumulativeReturn * 100).toFixed(1)}%. Consider reducing allocation or removing it.`,
          impact: {
            expectedReturnChange: Math.abs(cumulativeReturn) * strategy.weight * 100,
          },
          actions: [
            {
              type: 'reduce_weight',
              strategyId: strategy.strategyId,
              currentValue: strategy.weight,
              suggestedValue: strategy.weight * 0.5,
            },
          ],
          createdAt: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Check for risk reduction opportunities
   */
  private checkRiskReduction(
    portfolio: StrategyPortfolio
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const strategies = portfolio.strategies || [];

    if (strategies.length === 0) {
      return suggestions;
    }

    // Check if all strategies have similar risk profiles
    // This is a simplified check - in practice would use volatility data
    const weights = strategies.map(s => s.weight);
    const maxWeight = Math.max(...weights);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

    // If one strategy dominates
    if (maxWeight > 2 * avgWeight) {
      suggestions.push({
        id: `opt_risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'risk_reduction',
        priority: 'low',
        title: 'Balance risk across strategies',
        description: 'One strategy has significantly higher allocation than others, creating concentration risk.',
        impact: {
          riskReduction: 15,
          diversificationImprovement: 10,
        },
        actions: [
          {
            type: 'equalize_weights',
            suggestedValue: 1 / strategies.length,
          },
        ],
        createdAt: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Calculate overall optimization score
   */
  private calculateOptimizationScore(
    portfolio: StrategyPortfolio,
    suggestions: OptimizationSuggestion[]
  ): number {
    let score = 100;

    // Deduct points for each suggestion
    for (const suggestion of suggestions) {
      const deduction = {
        high: 15,
        medium: 8,
        low: 3,
      }[suggestion.priority];

      score -= deduction;
    }

    // Check basic portfolio health
    const strategies = portfolio.strategies || [];

    // Bonus for good diversification
    if (strategies.length >= 3) {
      const weights = strategies.map(s => s.weight);
      const maxWeight = Math.max(...weights);
      if (maxWeight < 0.4) {
        score += 10;  // Bonus for good diversification
      }
    }

    // Penalty for single strategy
    if (strategies.length === 1) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate risk-return profile
   */
  private calculateRiskReturnProfile(
    portfolio: StrategyPortfolio,
    historicalReturns?: Map<string, number[]>
  ): {
    expectedReturn: number;
    risk: number;
    sharpeRatio: number;
  } {
    const strategies = portfolio.strategies || [];

    // Use actual returns if available
    let expectedReturn = portfolio.totalReturnPct || 0;

    // Estimate risk (simplified - would use volatility in practice)
    const weights = strategies.map(s => s.weight);
    const concentrationRisk = weights.reduce((sum, w) => sum + w * w, 0);

    // Estimate risk as function of concentration
    const risk = concentrationRisk * 20 + 5;  // Simplified

    // Calculate Sharpe ratio (assuming risk-free rate of 2%)
    const riskFreeRate = 0.02;
    const sharpeRatio = risk > 0
      ? (expectedReturn / 100 - riskFreeRate) / (risk / 100)
      : 0;

    return {
      expectedReturn,
      risk,
      sharpeRatio: sharpeRatio * Math.sqrt(252),  // Annualized
    };
  }

  /**
   * Generate optimal allocation based on strategy characteristics
   */
  generateOptimalAllocation(
    strategies: Array<{
      id: string;
      expectedReturn: number;
      volatility: number;
    }>,
    targetRisk: number = 0.15  // 15% target volatility
  ): Allocation[] {
    if (strategies.length === 0) {
      return [];
    }

    // Simple risk parity approach
    // Weight inversely proportional to volatility
    const inverseVols = strategies.map(s => 1 / (s.volatility || 1));
    const totalInverseVol = inverseVols.reduce((a, b) => a + b, 0);

    return strategies.map((s, i) => ({
      strategyId: s.id,
      weight: inverseVols[i] / totalInverseVol,
      allocation: 0,  // Will be calculated based on total capital
    }));
  }
}

// Singleton instance
export const portfolioOptimizationService = new PortfolioOptimizationService();