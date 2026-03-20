/**
 * Optimization Feedback Service
 *
 * Analyzes live trading data and generates optimization suggestions
 *
 * @module backtest-live/OptimizationFeedback
 */

import {
  IntegratedStrategyConfig,
  OptimizationSuggestion,
  PerformanceComparison,
} from './types';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('OptimizationFeedback');

/**
 * Optimization analysis result
 */
interface OptimizationAnalysis {
  suggestions: OptimizationSuggestion[];
  confidence: number;
  analysisPeriod: {
    start: number;
    end: number;
  };
}

/**
 * OptimizationFeedback - Optimization suggestion generator
 */
export class OptimizationFeedback {
  /**
   * Analyze performance and generate optimization suggestions
   */
  async analyzePerformance(integration: IntegratedStrategyConfig): Promise<OptimizationAnalysis> {
    const now = Date.now();
    const suggestions: OptimizationSuggestion[] = [];

    // Get recent comparisons
    const comparisons = await backtestLiveDAO.getHistoricalComparisons(integration.id, 50);
    
    if (comparisons.length < 5) {
      log.info(`Not enough comparison data for optimization analysis (${comparisons.length} samples)`);
      return {
        suggestions: [],
        confidence: 0,
        analysisPeriod: {
          start: integration.createdAt,
          end: now,
        },
      };
    }

    // Analyze trends
    const trendAnalysis = this.analyzeTrends(comparisons.map(c => c.comparison));
    
    // Generate parameter adjustment suggestions
    const paramSuggestions = await this.generateParameterSuggestions(
      integration,
      trendAnalysis
    );
    suggestions.push(...paramSuggestions);

    // Generate risk management suggestions
    const riskSuggestions = await this.generateRiskManagementSuggestions(
      integration,
      trendAnalysis
    );
    suggestions.push(...riskSuggestions);

    // Generate timing adjustment suggestions
    const timingSuggestions = await this.generateTimingSuggestions(
      integration,
      trendAnalysis
    );
    suggestions.push(...timingSuggestions);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(comparisons.length, suggestions);

    return {
      suggestions,
      confidence,
      analysisPeriod: {
        start: comparisons[comparisons.length - 1].timestamp,
        end: now,
      },
    };
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(comparisons: PerformanceComparison[]): {
    returnTrend: 'improving' | 'declining' | 'stable';
    deviationTrend: 'improving' | 'declining' | 'stable';
    averageDeviation: number;
    volatility: number;
    winRateTrend: 'improving' | 'declining' | 'stable';
  } {
    const deviations = comparisons.map(c => c.deviation.overallScore);
    const returns = comparisons.map(c => c.liveMetrics.totalReturn);
    const winRates = comparisons.map(c => c.liveMetrics.winRate);

    // Calculate trends using linear regression slope
    const returnTrend = this.getTrend(returns);
    // For deviation, lower is better, so we invert the trend
    const deviationTrend = this.getTrend(deviations);
    const winRateTrend = this.getTrend(winRates);

    // Calculate average deviation
    const averageDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

    // Calculate volatility (standard deviation of deviations)
    const volatility = Math.sqrt(
      deviations.reduce((sum, d) => sum + Math.pow(d - averageDeviation, 2), 0) / deviations.length
    );

    return {
      returnTrend,
      deviationTrend,
      averageDeviation,
      volatility,
      winRateTrend,
    };
  }

  /**
   * Get trend direction from values
   */
  private getTrend(values: number[]): 'improving' | 'declining' | 'stable' {
    if (values.length < 2) return 'stable';

    // Simple linear regression
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Determine trend based on slope
    const threshold = 0.01 * (values[values.length - 1] - values[0]) / n;
    
    if (slope > threshold) return 'improving';
    if (slope < -threshold) return 'declining';
    return 'stable';
  }

  /**
   * Generate parameter adjustment suggestions
   */
  private async generateParameterSuggestions(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const _params = integration.strategy.params;

    // Analyze each parameter based on strategy type
    switch (integration.strategy.type.toLowerCase()) {
      case 'sma':
      case 'smacrossover':
        suggestions.push(...await this.analyzeSmaParameters(integration, trendAnalysis));
        break;
      case 'rsi':
        suggestions.push(...await this.analyzeRsiParameters(integration, trendAnalysis));
        break;
      case 'macd':
        suggestions.push(...await this.analyzeMacdParameters(integration, trendAnalysis));
        break;
      case 'bollinger':
      case 'bollingerbands':
        suggestions.push(...await this.analyzeBollingerParameters(integration, trendAnalysis));
        break;
    }

    return suggestions;
  }

  /**
   * Analyze SMA strategy parameters
   */
  private async analyzeSmaParameters(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const params = integration.strategy.params;

    // If win rate is declining, suggest longer periods for fewer signals
    if (trendAnalysis.winRateTrend === 'declining') {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'parameter_adjustment',
        priority: 'medium',
        title: 'Increase SMA periods',
        description: 'Win rate is declining. Consider increasing SMA periods to reduce signal frequency and improve quality.',
        currentValue: { shortPeriod: params.shortPeriod, longPeriod: params.longPeriod },
        suggestedValue: { 
          shortPeriod: Math.round(params.shortPeriod * 1.2), 
          longPeriod: Math.round(params.longPeriod * 1.2) 
        },
        expectedImprovement: 'Higher win rate, fewer but more reliable signals',
        confidence: 0.6,
        supportingData: { winRateTrend: trendAnalysis.winRateTrend },
        createdAt: Date.now(),
        applied: false,
      });
    }

    // If deviation is high, suggest backtesting new parameters
    if (trendAnalysis.averageDeviation > 15) {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'parameter_adjustment',
        priority: 'high',
        title: 'Re-optimize SMA parameters',
        description: 'Live performance deviates significantly from backtest. Consider re-optimizing parameters using recent data.',
        currentValue: { shortPeriod: params.shortPeriod, longPeriod: params.longPeriod },
        suggestedValue: 'Run optimization with recent 3-month data',
        expectedImprovement: 'Better alignment between backtest and live performance',
        confidence: 0.7,
        supportingData: { averageDeviation: trendAnalysis.averageDeviation },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Analyze RSI strategy parameters
   */
  private async analyzeRsiParameters(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const params = integration.strategy.params;

    // Adjust overbought/oversold thresholds based on trend
    if (trendAnalysis.returnTrend === 'declining') {
      const newOverbought = Math.min(params.overbought + 5, 85);
      const newOversold = Math.max(params.oversold - 5, 15);
      
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'parameter_adjustment',
        priority: 'medium',
        title: 'Widen RSI thresholds',
        description: 'Returns are declining. Widening RSI thresholds may reduce false signals.',
        currentValue: { overbought: params.overbought, oversold: params.oversold },
        suggestedValue: { overbought: newOverbought, oversold: newOversold },
        expectedImprovement: 'Fewer false signals, better entry timing',
        confidence: 0.55,
        supportingData: { returnTrend: trendAnalysis.returnTrend },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Analyze MACD strategy parameters
   */
  private async analyzeMacdParameters(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const params = integration.strategy.params;

    if (trendAnalysis.volatility > 10) {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'parameter_adjustment',
        priority: 'medium',
        title: 'Increase MACD signal period',
        description: 'High performance volatility. Increasing signal period can smooth out false signals.',
        currentValue: { signalPeriod: params.signalPeriod },
        suggestedValue: { signalPeriod: params.signalPeriod + 2 },
        expectedImprovement: 'Smoother signals, reduced whipsaw',
        confidence: 0.6,
        supportingData: { volatility: trendAnalysis.volatility },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Analyze Bollinger Bands parameters
   */
  private async analyzeBollingerParameters(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const params = integration.strategy.params;

    if (trendAnalysis.winRateTrend === 'declining') {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'parameter_adjustment',
        priority: 'medium',
        title: 'Adjust Bollinger Bands multiplier',
        description: 'Win rate declining. Consider adjusting standard deviation multiplier for better signal quality.',
        currentValue: { stdDevMultiplier: params.stdDevMultiplier },
        suggestedValue: { stdDevMultiplier: params.stdDevMultiplier + 0.5 },
        expectedImprovement: 'Better signal filtering, improved win rate',
        confidence: 0.55,
        supportingData: { winRateTrend: trendAnalysis.winRateTrend },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Generate risk management suggestions
   */
  private async generateRiskManagementSuggestions(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const risk = integration.strategy.riskManagement;

    if (!risk) return suggestions;

    // Suggest position size adjustment based on performance
    if (trendAnalysis.returnTrend === 'declining' && trendAnalysis.averageDeviation > 10) {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'risk_management',
        priority: 'high',
        title: 'Reduce position size',
        description: 'Performance is declining with high deviation. Reducing position size can limit losses while strategy is re-evaluated.',
        currentValue: { maxPositionSize: risk.maxPositionSize },
        suggestedValue: { maxPositionSize: risk.maxPositionSize * 0.7 },
        expectedImprovement: 'Reduced risk exposure, lower potential losses',
        confidence: 0.7,
        supportingData: {
          returnTrend: trendAnalysis.returnTrend,
          averageDeviation: trendAnalysis.averageDeviation,
        },
        createdAt: Date.now(),
        applied: false,
      });
    }

    // Suggest tighter stop loss if deviation is declining (getting worse)
    if (trendAnalysis.deviationTrend === 'declining') {
      const newStopLoss = risk.stopLossPercentage ? risk.stopLossPercentage * 0.8 : 4;
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'risk_management',
        priority: 'medium',
        title: 'Tighten stop loss',
        description: 'Deviation is increasing. Tighter stop loss can protect against larger drawdowns.',
        currentValue: { stopLossPercentage: risk.stopLossPercentage },
        suggestedValue: { stopLossPercentage: newStopLoss },
        expectedImprovement: 'Better downside protection',
        confidence: 0.65,
        supportingData: { deviationTrend: trendAnalysis.deviationTrend },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Generate timing adjustment suggestions
   */
  private async generateTimingSuggestions(
    integration: IntegratedStrategyConfig,
    trendAnalysis: ReturnType<typeof this.analyzeTrends>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // If volatility is high, suggest longer evaluation periods
    if (trendAnalysis.volatility > 15) {
      suggestions.push({
        id: uuidv4(),
        integrationId: integration.id,
        type: 'timing_adjustment',
        priority: 'low',
        title: 'Increase evaluation interval',
        description: 'High performance volatility. Longer evaluation intervals can provide more stable metrics.',
        currentValue: { comparisonInterval: integration.monitoring.comparisonInterval },
        suggestedValue: { comparisonInterval: integration.monitoring.comparisonInterval * 2 },
        expectedImprovement: 'More stable performance metrics',
        confidence: 0.5,
        supportingData: { volatility: trendAnalysis.volatility },
        createdAt: Date.now(),
        applied: false,
      });
    }

    return suggestions;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(sampleSize: number, suggestions: OptimizationSuggestion[]): number {
    if (suggestions.length === 0) return 0;

    // More samples = higher confidence
    const sampleFactor = Math.min(sampleSize / 50, 1);

    // Average suggestion confidence weighted by priority
    const priorityWeights = { low: 0.5, medium: 0.75, high: 1 };
    const avgSuggestionConfidence = suggestions.reduce((sum, s) => {
      return sum + s.confidence * priorityWeights[s.priority];
    }, 0) / suggestions.length;

    return sampleFactor * avgSuggestionConfidence;
  }

  /**
   * Apply an optimization suggestion
   */
  async applySuggestion(
    integration: IntegratedStrategyConfig,
    suggestion: OptimizationSuggestion
  ): Promise<{
    success: boolean;
    message: string;
    updatedIntegration?: IntegratedStrategyConfig;
  }> {
    try {
      // Apply based on suggestion type
      switch (suggestion.type) {
        case 'parameter_adjustment':
          return await this.applyParameterAdjustment(integration, suggestion);
        case 'risk_management':
          return await this.applyRiskManagementAdjustment(integration, suggestion);
        case 'timing_adjustment':
          return await this.applyTimingAdjustment(integration, suggestion);
        default:
          return {
            success: false,
            message: `Unknown suggestion type: ${suggestion.type}`,
          };
      }
    } catch (error: any) {
      log.error('Failed to apply suggestion:', error);
      return {
        success: false,
        message: error.message || 'Failed to apply suggestion',
      };
    }
  }

  /**
   * Apply parameter adjustment
   */
  private async applyParameterAdjustment(
    integration: IntegratedStrategyConfig,
    suggestion: OptimizationSuggestion
  ): Promise<{
    success: boolean;
    message: string;
    updatedIntegration?: IntegratedStrategyConfig;
  }> {
    const newParams = {
      ...integration.strategy.params,
      ...suggestion.suggestedValue,
    };

    // Update integration
    const updated = await backtestLiveDAO.updateIntegration(integration.id, {
      strategy: {
        ...integration.strategy,
        params: newParams,
        updatedAt: Date.now(),
      },
    });

    // Mark suggestion as applied
    await backtestLiveDAO.applySuggestion(suggestion.id);

    return {
      success: true,
      message: 'Parameters updated successfully',
      updatedIntegration: updated,
    };
  }

  /**
   * Apply risk management adjustment
   */
  private async applyRiskManagementAdjustment(
    integration: IntegratedStrategyConfig,
    suggestion: OptimizationSuggestion
  ): Promise<{
    success: boolean;
    message: string;
    updatedIntegration?: IntegratedStrategyConfig;
  }> {
    const newRisk = {
      ...integration.strategy.riskManagement,
      ...suggestion.suggestedValue,
    };

    // Update integration
    const updated = await backtestLiveDAO.updateIntegration(integration.id, {
      strategy: {
        ...integration.strategy,
        riskManagement: newRisk,
        updatedAt: Date.now(),
      },
    });

    // Mark suggestion as applied
    await backtestLiveDAO.applySuggestion(suggestion.id);

    return {
      success: true,
      message: 'Risk management settings updated successfully',
      updatedIntegration: updated,
    };
  }

  /**
   * Apply timing adjustment
   */
  private async applyTimingAdjustment(
    integration: IntegratedStrategyConfig,
    suggestion: OptimizationSuggestion
  ): Promise<{
    success: boolean;
    message: string;
    updatedIntegration?: IntegratedStrategyConfig;
  }> {
    const newMonitoring = {
      ...integration.monitoring,
      ...suggestion.suggestedValue,
    };

    // Update integration
    const updated = await backtestLiveDAO.updateIntegration(integration.id, {
      monitoring: newMonitoring,
    });

    // Mark suggestion as applied
    await backtestLiveDAO.applySuggestion(suggestion.id);

    return {
      success: true,
      message: 'Timing settings updated successfully',
      updatedIntegration: updated,
    };
  }

  /**
   * Save optimization suggestions
   */
  async saveSuggestions(suggestions: OptimizationSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      await backtestLiveDAO.saveOptimizationSuggestion(suggestion);
    }
  }
}

// Singleton instance
export const optimizationFeedback = new OptimizationFeedback();