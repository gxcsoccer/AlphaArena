/**
 * Backtest-Live Comparison Service
 *
 * Comprehensive comparison analysis between live trading and backtest results
 *
 * @module backtest-live/BacktestLiveComparisonService
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { BacktestStats } from '../backtest/types';
import {
  LivePerformanceMetrics,
  PerformanceDeviation,
  PerformanceComparison,
} from './types';
import {
  MetricComparison,
  TimePeriodComparison,
  SlippageImpact,
  FeeImpact,
  ExecutionDelayImpact,
  MarketEnvironmentComparison,
  DivergenceAnalysis,
  ImprovementInsight,
  ComparisonReportConfig,
  LiveBacktestComparisonReport,
  ComparisonVisualizationData,
} from './ComparisonTypes';
import { backtestLiveDAO } from '../database/backtest-live.dao';

const log = createLogger('BacktestLiveComparisonService');

/**
 * Service for comparing live trading results with backtest predictions
 */
export class BacktestLiveComparisonService {
  /**
   * Generate comprehensive comparison report
   */
  async generateComparisonReport(
    config: ComparisonReportConfig
  ): Promise<LiveBacktestComparisonReport> {
    log.info('Generating comparison report', { config });

    const startTime = Date.now();

    try {
      // Get integration data
      const integration = await backtestLiveDAO.getIntegration(config.integrationId);
      if (!integration) {
        throw new Error(`Integration ${config.integrationId} not found`);
      }

      // Get backtest metrics
      const backtestMetrics = await this.getBacktestMetrics(config);
      if (!backtestMetrics) {
        throw new Error('No backtest results available for comparison');
      }

      // Get live metrics
      const liveMetrics = await this.getLiveMetrics(config);

      // Calculate deviation
      const deviation = await this.calculatePerformanceDeviation(
        backtestMetrics,
        liveMetrics,
        config
      );

      // Generate metric comparisons
      const metricComparisons = this.generateMetricComparisons(
        backtestMetrics,
        liveMetrics
      );

      // Generate time period comparisons
      const timePeriodComparisons = await this.generateTimePeriodComparisons(
        backtestMetrics,
        liveMetrics,
        config
      );

      // Analyze impacts (optional)
      const slippageImpact = config.includeSlippageAnalysis
        ? await this.analyzeSlippageImpact(config)
        : undefined;

      const feeImpact = config.includeFeeAnalysis
        ? await this.analyzeFeeImpact(config)
        : undefined;

      const executionDelayImpact = config.includeExecutionDelayAnalysis
        ? await this.analyzeExecutionDelayImpact(config)
        : undefined;

      // Market environment comparison (optional)
      const marketEnvironment = config.includeMarketEnvironment
        ? await this.compareMarketEnvironments(config)
        : undefined;

      // Divergence analysis
      const divergenceAnalysis = this.analyzeDivergence(
        deviation,
        metricComparisons,
        timePeriodComparisons
      );

      // Generate insights
      const insights = this.generateInsights(
        deviation,
        metricComparisons,
        slippageImpact,
        feeImpact,
        executionDelayImpact,
        marketEnvironment,
        config.maxInsights ?? 10
      );

      // Generate visualization data
      const visualizationData = this.generateVisualizationData(
        backtestMetrics,
        liveMetrics,
        deviation,
        config
      );

      // Generate summary
      const summary = this.generateSummary(
        deviation,
        insights,
        metricComparisons
      );

      const report: LiveBacktestComparisonReport = {
        id: uuidv4(),
        generatedAt: Date.now(),
        config,
        backtestMetrics,
        liveMetrics,
        deviation,
        metricComparisons,
        timePeriodComparisons,
        slippageImpact,
        feeImpact,
        executionDelayImpact,
        marketEnvironment,
        divergenceAnalysis,
        insights,
        summary,
        visualizationData,
      };

      log.info('Comparison report generated', {
        reportId: report.id,
        duration: Date.now() - startTime,
      });

      return report;
    } catch (error: any) {
      log.error('Failed to generate comparison report', error);
      throw error;
    }
  }

  /**
   * Get backtest metrics
   */
  private async getBacktestMetrics(
    config: ComparisonReportConfig
  ): Promise<BacktestStats | null> {
    const integration = await backtestLiveDAO.getIntegration(config.integrationId);
    if (!integration?.backtestResultId) {
      return null;
    }

    const result = await backtestLiveDAO.getBacktestResult(integration.backtestResultId);
    return result?.stats ?? null;
  }

  /**
   * Get live trading metrics
   */
  private async getLiveMetrics(
    config: ComparisonReportConfig
  ): Promise<LivePerformanceMetrics> {
    // In production, this would query actual trading data
    // For now, return mock data based on historical comparisons
    const comparisons = await backtestLiveDAO.getHistoricalComparisons(
      config.integrationId,
      100
    );

    if (comparisons.length > 0) {
      const latest = comparisons[comparisons.length - 1].comparison;
      return latest.liveMetrics;
    }

    // Return default metrics if no live data
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      currentEquity: 0,
      cashBalance: 0,
      unrealizedPnL: 0,
      openPositions: 0,
    };
  }

  /**
   * Calculate performance deviation
   */
  private async calculatePerformanceDeviation(
    backtest: BacktestStats,
    live: LivePerformanceMetrics,
    _config: ComparisonReportConfig
  ): Promise<PerformanceDeviation> {
    const threshold = 20; // 20% deviation threshold

    const returnDeviation = this.calculatePercentDeviation(
      backtest.totalReturn,
      live.totalReturn
    );
    const sharpeDeviation = this.calculatePercentDeviation(
      backtest.sharpeRatio,
      live.sharpeRatio
    );
    const drawdownDeviation = this.calculatePercentDeviation(
      backtest.maxDrawdown,
      live.maxDrawdown
    );
    const winRateDeviation = this.calculatePercentDeviation(
      backtest.winRate,
      live.winRate
    );
    const tradeCountDeviation = this.calculatePercentDeviation(
      backtest.totalTrades,
      live.totalTrades
    );

    const overallScore =
      Math.abs(returnDeviation) * 0.3 +
      Math.abs(sharpeDeviation) * 0.2 +
      Math.abs(drawdownDeviation) * 0.2 +
      Math.abs(winRateDeviation) * 0.15 +
      Math.abs(tradeCountDeviation) * 0.15;

    return {
      returnDeviation,
      sharpeDeviation,
      drawdownDeviation,
      winRateDeviation,
      tradeCountDeviation,
      overallScore,
      significantDeviations: [],
    };
  }

  /**
   * Calculate percentage deviation
   */
  private calculatePercentDeviation(expected: number, actual: number): number {
    if (expected === 0) {
      return actual === 0 ? 0 : (actual > 0 ? 100 : -100);
    }
    return ((actual - expected) / Math.abs(expected)) * 100;
  }

  /**
   * Generate metric comparisons
   */
  private generateMetricComparisons(
    backtest: BacktestStats,
    live: LivePerformanceMetrics
  ): MetricComparison[] {
    const metrics: MetricComparison[] = [
      {
        name: 'Total Return',
        key: 'totalReturn',
        backtestValue: backtest.totalReturn,
        liveValue: live.totalReturn,
        unit: '%',
        deviation: this.calculatePercentDeviation(backtest.totalReturn, live.totalReturn),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.totalReturn, live.totalReturn))
        ),
        higherIsBetter: true,
        description: 'Total return percentage over the comparison period',
        possibleCauses: [
          'Market conditions differ from backtest period',
          'Slippage reducing profitability',
          'Execution timing differences',
          'Trading fees impact',
        ],
      },
      {
        name: 'Sharpe Ratio',
        key: 'sharpeRatio',
        backtestValue: backtest.sharpeRatio,
        liveValue: live.sharpeRatio,
        unit: '',
        deviation: this.calculatePercentDeviation(backtest.sharpeRatio, live.sharpeRatio),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.sharpeRatio, live.sharpeRatio))
        ),
        higherIsBetter: true,
        description: 'Risk-adjusted return measure',
        possibleCauses: [
          'Different volatility in live trading',
          'Execution slippage',
          'Risk management differences',
        ],
      },
      {
        name: 'Max Drawdown',
        key: 'maxDrawdown',
        backtestValue: backtest.maxDrawdown,
        liveValue: live.maxDrawdown,
        unit: '%',
        deviation: this.calculatePercentDeviation(backtest.maxDrawdown, live.maxDrawdown),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.maxDrawdown, live.maxDrawdown))
        ),
        higherIsBetter: false,
        description: 'Maximum peak-to-trough decline',
        possibleCauses: [
          'Market volatility differences',
          'Position sizing differences',
          'Stop-loss execution variations',
        ],
      },
      {
        name: 'Win Rate',
        key: 'winRate',
        backtestValue: backtest.winRate,
        liveValue: live.winRate,
        unit: '%',
        deviation: this.calculatePercentDeviation(backtest.winRate, live.winRate),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.winRate, live.winRate))
        ),
        higherIsBetter: true,
        description: 'Percentage of winning trades',
        possibleCauses: [
          'Entry timing differences',
          'Market regime changes',
          'Signal quality differences',
        ],
      },
      {
        name: 'Profit Factor',
        key: 'profitFactor',
        backtestValue: backtest.profitFactor,
        liveValue: live.profitFactor,
        unit: '',
        deviation: this.calculatePercentDeviation(backtest.profitFactor, live.profitFactor),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.profitFactor, live.profitFactor))
        ),
        higherIsBetter: true,
        description: 'Ratio of gross profit to gross loss',
        possibleCauses: [
          'Winner/loser size differences',
          'Exit timing variations',
          'Slippage impact on profits',
        ],
      },
      {
        name: 'Total Trades',
        key: 'totalTrades',
        backtestValue: backtest.totalTrades,
        liveValue: live.totalTrades,
        unit: '',
        deviation: this.calculatePercentDeviation(backtest.totalTrades, live.totalTrades),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.totalTrades, live.totalTrades))
        ),
        higherIsBetter: false,
        description: 'Total number of completed trades',
        possibleCauses: [
          'Signal generation differences',
          'Trading time restrictions',
          'Risk management rules',
        ],
      },
      {
        name: 'Average Win',
        key: 'avgWin',
        backtestValue: backtest.avgWin,
        liveValue: live.avgWin,
        unit: '$',
        deviation: this.calculatePercentDeviation(backtest.avgWin, live.avgWin),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.avgWin, live.avgWin))
        ),
        higherIsBetter: true,
        description: 'Average profit on winning trades',
        possibleCauses: [
          'Exit timing differences',
          'Take-profit execution',
          'Position sizing variations',
        ],
      },
      {
        name: 'Average Loss',
        key: 'avgLoss',
        backtestValue: backtest.avgLoss,
        liveValue: live.avgLoss,
        unit: '$',
        deviation: this.calculatePercentDeviation(backtest.avgLoss, live.avgLoss),
        severity: this.getDeviationSeverity(
          Math.abs(this.calculatePercentDeviation(backtest.avgLoss, live.avgLoss))
        ),
        higherIsBetter: false,
        description: 'Average loss on losing trades',
        possibleCauses: [
          'Stop-loss execution differences',
          'Slippage on exits',
          'Position sizing variations',
        ],
      },
    ];

    return metrics;
  }

  /**
   * Get deviation severity
   */
  private getDeviationSeverity(deviationPercent: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationPercent > 50) return 'critical';
    if (deviationPercent > 30) return 'high';
    if (deviationPercent > 15) return 'medium';
    return 'low';
  }

  /**
   * Generate time period comparisons
   */
  private async generateTimePeriodComparisons(
    _backtest: BacktestStats,
    live: LivePerformanceMetrics,
    config: ComparisonReportConfig
  ): Promise<TimePeriodComparison[]> {
    const comparisons: TimePeriodComparison[] = [];
    const periodDuration = config.periodEnd - config.periodStart;
    const numPeriods = Math.min(12, Math.ceil(periodDuration / (7 * 24 * 60 * 60 * 1000)));

    // Generate weekly/bi-weekly periods
    const periodLength = periodDuration / numPeriods;

    for (let i = 0; i < numPeriods; i++) {
      const start = config.periodStart + i * periodLength;
      const end = Math.min(start + periodLength, config.periodEnd);

      // In production, these would be calculated from actual trade data
      const backtestReturn = (live.totalReturn / numPeriods) * (0.8 + Math.random() * 0.4);
      const liveReturn = (live.totalReturn / numPeriods) * (0.7 + Math.random() * 0.6);

      comparisons.push({
        label: this.formatPeriodLabel(start, end),
        start,
        end,
        backtestReturn,
        liveReturn,
        backtestTrades: Math.floor(live.totalTrades / numPeriods * (0.8 + Math.random() * 0.4)),
        liveTrades: Math.floor(live.totalTrades / numPeriods * (0.7 + Math.random() * 0.6)),
      });
    }

    return comparisons;
  }

  /**
   * Format period label
   */
  private formatPeriodLabel(start: number, end: number): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
  }

  /**
   * Analyze slippage impact
   */
  private async analyzeSlippageImpact(
    _config: ComparisonReportConfig
  ): Promise<SlippageImpact> {
    // In production, this would analyze actual trade execution data
    return {
      avgSlippagePercent: 0.05 + Math.random() * 0.15,
      totalSlippageCost: 100 + Math.random() * 500,
      returnImpact: -0.5 - Math.random() * 2,
      sharpeImpact: -0.05 - Math.random() * 0.15,
      byTradeType: [
        { type: 'market', avgSlippage: 0.08, count: 45 },
        { type: 'limit', avgSlippage: 0.02, count: 30 },
        { type: 'stop', avgSlippage: 0.12, count: 15 },
      ],
    };
  }

  /**
   * Analyze fee impact
   */
  private async analyzeFeeImpact(
    _config: ComparisonReportConfig
  ): Promise<FeeImpact> {
    // In production, this would analyze actual fee data
    return {
      totalFees: 200 + Math.random() * 800,
      feeRate: 0.001,
      returnImpact: -0.2 - Math.random() * 0.8,
      sharpeImpact: -0.02 - Math.random() * 0.08,
      byPeriod: [
        { period: 'Week 1', fees: 50, trades: 12 },
        { period: 'Week 2', fees: 75, trades: 18 },
        { period: 'Week 3', fees: 60, trades: 15 },
        { period: 'Week 4', fees: 45, trades: 10 },
      ],
    };
  }

  /**
   * Analyze execution delay impact
   */
  private async analyzeExecutionDelayImpact(
    _config: ComparisonReportConfig
  ): Promise<ExecutionDelayImpact> {
    // In production, this would analyze actual execution timestamps
    return {
      avgDelayMs: 50 + Math.random() * 150,
      maxDelayMs: 500 + Math.random() * 1000,
      returnImpact: -0.1 - Math.random() * 0.5,
      winRateImpact: -1 - Math.random() * 3,
      affectedTrades: Math.floor(10 + Math.random() * 20),
      affectedPercent: 10 + Math.random() * 20,
    };
  }

  /**
   * Compare market environments
   */
  private async compareMarketEnvironments(
    _config: ComparisonReportConfig
  ): Promise<MarketEnvironmentComparison> {
    // In production, this would analyze actual market data
    return {
      backtestPeriod: {
        avgVolatility: 0.02 + Math.random() * 0.03,
        trendDirection: Math.random() > 0.5 ? 'up' : 'down',
        avgVolume: 1000000 + Math.random() * 5000000,
        significantEvents: ['Fed meeting', 'Earnings season'],
      },
      livePeriod: {
        avgVolatility: 0.015 + Math.random() * 0.035,
        trendDirection: Math.random() > 0.5 ? 'up' : 'sideways',
        avgVolume: 800000 + Math.random() * 4000000,
        significantEvents: ['Market correction', 'Regulatory news'],
      },
      similarityScore: 50 + Math.random() * 40,
      keyDifferences: [
        'Higher volatility in backtest period',
        'Different trend direction',
        'Lower trading volume in live period',
      ],
    };
  }

  /**
   * Analyze divergence
   */
  private analyzeDivergence(
    deviation: PerformanceDeviation,
    metrics: MetricComparison[],
    _periods: TimePeriodComparison[]
  ): DivergenceAnalysis {
    const overallScore = deviation.overallScore;

    // Determine trend based on historical data (simplified)
    const trend: 'improving' | 'stable' | 'worsening' =
      overallScore < 10 ? 'improving' :
      overallScore < 25 ? 'stable' : 'worsening';

    // Divergence by category
    const byCategory = [
      {
        category: 'Returns',
        score: Math.abs(deviation.returnDeviation),
        contribution: 30,
      },
      {
        category: 'Risk',
        score: Math.abs(deviation.sharpeDeviation) + Math.abs(deviation.drawdownDeviation),
        contribution: 25,
      },
      {
        category: 'Execution',
        score: Math.abs(deviation.winRateDeviation),
        contribution: 20,
      },
      {
        category: 'Activity',
        score: Math.abs(deviation.tradeCountDeviation),
        contribution: 15,
      },
      {
        category: 'Efficiency',
        score: metrics.find(m => m.key === 'profitFactor')?.deviation ?? 0,
        contribution: 10,
      },
    ];

    // Root causes
    const rootCauses = this.identifyRootCauses(deviation, metrics);

    return {
      overallDivergenceScore: overallScore,
      trend,
      byCategory,
      rootCauses,
    };
  }

  /**
   * Identify root causes for divergence
   */
  private identifyRootCauses(
    deviation: PerformanceDeviation,
    metrics: MetricComparison[]
  ): DivergenceAnalysis['rootCauses'] {
    const causes: DivergenceAnalysis['rootCauses'] = [];

    // Check return deviation
    if (Math.abs(deviation.returnDeviation) > 15) {
      causes.push({
        cause: 'Return underperformance',
        likelihood: 0.8,
        impact: Math.abs(deviation.returnDeviation),
        suggestedAction: 'Review entry/exit timing and position sizing',
      });
    }

    // Check Sharpe deviation
    if (Math.abs(deviation.sharpeDeviation) > 20) {
      causes.push({
        cause: 'Risk-adjusted performance gap',
        likelihood: 0.7,
        impact: Math.abs(deviation.sharpeDeviation),
        suggestedAction: 'Optimize risk management and position sizing',
      });
    }

    // Check win rate deviation
    if (Math.abs(deviation.winRateDeviation) > 10) {
      causes.push({
        cause: 'Win rate discrepancy',
        likelihood: 0.75,
        impact: Math.abs(deviation.winRateDeviation),
        suggestedAction: 'Review signal generation and entry criteria',
      });
    }

    // Check drawdown deviation
    if (deviation.drawdownDeviation > 20) {
      causes.push({
        cause: 'Higher than expected drawdown',
        likelihood: 0.85,
        impact: deviation.drawdownDeviation,
        suggestedAction: 'Tighten stop-loss levels and reduce position sizes',
      });
    }

    // Sort by impact
    return causes.sort((a, b) => b.impact - a.impact).slice(0, 5);
  }

  /**
   * Generate improvement insights
   */
  private generateInsights(
    deviation: PerformanceDeviation,
    metrics: MetricComparison[],
    slippageImpact?: SlippageImpact,
    feeImpact?: FeeImpact,
    executionDelayImpact?: ExecutionDelayImpact,
    _marketEnvironment?: MarketEnvironmentComparison,
    maxInsights: number = 10
  ): ImprovementInsight[] {
    const insights: ImprovementInsight[] = [];

    // Return deviation insight
    if (Math.abs(deviation.returnDeviation) > 10) {
      const returnMetric = metrics.find(m => m.key === 'totalReturn');
      insights.push({
        id: uuidv4(),
        category: 'execution',
        priority: 1,
        title: 'Return Performance Gap Detected',
        description: `Live returns are ${Math.abs(deviation.returnDeviation).toFixed(1)}% ${deviation.returnDeviation > 0 ? 'above' : 'below'} backtest expectations.`,
        currentSituation: `Backtest: ${returnMetric?.backtestValue.toFixed(2)}%, Live: ${returnMetric?.liveValue.toFixed(2)}%`,
        recommendedAction: deviation.returnDeviation < 0
          ? 'Analyze entry/exit timing and consider tightening execution parameters'
          : 'Review if market conditions are favorable and maintain current approach',
        expectedImprovement: 'Potential 5-15% return improvement',
        confidence: 0.8,
        supportingData: { deviation: deviation.returnDeviation },
      });
    }

    // Slippage insight
    if (slippageImpact && slippageImpact.avgSlippagePercent > 0.05) {
      insights.push({
        id: uuidv4(),
        category: 'execution',
        priority: 2,
        title: 'High Slippage Impacting Returns',
        description: `Average slippage of ${(slippageImpact.avgSlippagePercent * 100).toFixed(2)}% is reducing profitability.`,
        currentSituation: `Total slippage cost: $${slippageImpact.totalSlippageCost.toFixed(2)}`,
        recommendedAction: 'Use limit orders instead of market orders where possible. Consider trading during higher liquidity periods.',
        expectedImprovement: 'Potential 0.5-1% return improvement',
        confidence: 0.85,
        supportingData: { avgSlippage: slippageImpact.avgSlippagePercent },
      });
    }

    // Fee impact insight
    if (feeImpact && Math.abs(feeImpact.returnImpact) > 0.3) {
      insights.push({
        id: uuidv4(),
        category: 'execution',
        priority: 3,
        title: 'Trading Fees Impacting Performance',
        description: `Total fees of $${feeImpact.totalFees.toFixed(2)} are reducing returns by ${Math.abs(feeImpact.returnImpact).toFixed(2)}%.`,
        currentSituation: `Fee rate: ${(feeImpact.feeRate * 100).toFixed(2)}%`,
        recommendedAction: 'Reduce trade frequency or negotiate better fee rates with exchange. Consider using maker orders.',
        expectedImprovement: 'Potential 0.3-0.5% return improvement',
        confidence: 0.75,
        supportingData: { totalFees: feeImpact.totalFees },
      });
    }

    // Execution delay insight
    if (executionDelayImpact && executionDelayImpact.avgDelayMs > 100) {
      insights.push({
        id: uuidv4(),
        category: 'timing',
        priority: 2,
        title: 'Execution Delays Affecting Win Rate',
        description: `Average execution delay of ${executionDelayImpact.avgDelayMs.toFixed(0)}ms is impacting ${executionDelayImpact.affectedPercent.toFixed(1)}% of trades.`,
        currentSituation: `Win rate impact: ${executionDelayImpact.winRateImpact.toFixed(2)}%`,
        recommendedAction: 'Optimize API connection and server location. Consider using co-location or VPS near exchange servers.',
        expectedImprovement: 'Potential 1-3% win rate improvement',
        confidence: 0.7,
        supportingData: { avgDelay: executionDelayImpact.avgDelayMs },
      });
    }

    // Drawdown insight
    const drawdownMetric = metrics.find(m => m.key === 'maxDrawdown');
    if (drawdownMetric && drawdownMetric.liveValue > drawdownMetric.backtestValue * 1.5) {
      insights.push({
        id: uuidv4(),
        category: 'risk',
        priority: 1,
        title: 'Drawdown Exceeding Backtest Expectations',
        description: `Live drawdown (${drawdownMetric.liveValue.toFixed(2)}%) is significantly higher than backtest (${drawdownMetric.backtestValue.toFixed(2)}%).`,
        currentSituation: `Drawdown ratio: ${(drawdownMetric.liveValue / drawdownMetric.backtestValue).toFixed(2)}x`,
        recommendedAction: 'Review and tighten stop-loss levels. Consider reducing position sizes during high volatility.',
        expectedImprovement: 'Potential 20-30% drawdown reduction',
        confidence: 0.85,
        supportingData: { liveDrawdown: drawdownMetric.liveValue },
      });
    }

    // Win rate insight
    const winRateMetric = metrics.find(m => m.key === 'winRate');
    if (winRateMetric && winRateMetric.liveValue < winRateMetric.backtestValue * 0.9) {
      insights.push({
        id: uuidv4(),
        category: 'parameters',
        priority: 2,
        title: 'Win Rate Below Expected',
        description: `Live win rate (${winRateMetric.liveValue.toFixed(1)}%) is below backtest (${winRateMetric.backtestValue.toFixed(1)}%).`,
        currentSituation: `Win rate gap: ${(winRateMetric.backtestValue - winRateMetric.liveValue).toFixed(1)}%`,
        recommendedAction: 'Review signal generation parameters and entry criteria. Consider filtering low-confidence signals.',
        expectedImprovement: 'Potential 3-5% win rate improvement',
        confidence: 0.75,
        supportingData: { winRateGap: winRateMetric.backtestValue - winRateMetric.liveValue },
      });
    }

    // Sort by priority and limit
    return insights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxInsights);
  }

  /**
   * Generate visualization data
   */
  private generateVisualizationData(
    backtest: BacktestStats,
    live: LivePerformanceMetrics,
    deviation: PerformanceDeviation,
    config: ComparisonReportConfig
  ): ComparisonVisualizationData {
    // Generate equity curve comparison
    const numPoints = 50;
    const duration = config.periodEnd - config.periodStart;
    const backtestEquity: { timestamp: number; value: number }[] = [];
    const liveEquity: { timestamp: number; value: number }[] = [];

    let backtestValue = 10000; // Starting capital
    let liveValue = 10000;

    for (let i = 0; i <= numPoints; i++) {
      const timestamp = config.periodStart + (duration * i) / numPoints;

      // Simulate backtest equity curve
      const backtestReturn = (backtest.totalReturn / numPoints) * (0.8 + Math.random() * 0.4);
      backtestValue *= (1 + backtestReturn / 100);
      backtestEquity.push({ timestamp, value: backtestValue });

      // Simulate live equity curve with deviation
      const liveReturn = (backtest.totalReturn / numPoints) * (0.7 + Math.random() * 0.6) * (1 - deviation.overallScore / 200);
      liveValue *= (1 + liveReturn / 100);
      liveEquity.push({ timestamp, value: liveValue });
    }

    // Generate metrics radar data
    const metricsRadar = [
      {
        metric: 'Return',
        backtest: this.normalizeForRadar(backtest.totalReturn, -50, 100),
        live: this.normalizeForRadar(live.totalReturn, -50, 100),
      },
      {
        metric: 'Sharpe',
        backtest: this.normalizeForRadar(backtest.sharpeRatio, 0, 3),
        live: this.normalizeForRadar(live.sharpeRatio, 0, 3),
      },
      {
        metric: 'WinRate',
        backtest: this.normalizeForRadar(backtest.winRate, 0, 100),
        live: this.normalizeForRadar(live.winRate, 0, 100),
      },
      {
        metric: 'Drawdown',
        backtest: this.normalizeForRadar(100 - backtest.maxDrawdown, 0, 100),
        live: this.normalizeForRadar(100 - live.maxDrawdown, 0, 100),
      },
      {
        metric: 'ProfitFactor',
        backtest: this.normalizeForRadar(backtest.profitFactor, 0, 5),
        live: this.normalizeForRadar(live.profitFactor, 0, 5),
      },
    ];

    // Generate divergence timeline
    const divergenceTimeline: { timestamp: number; divergence: number }[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const timestamp = config.periodStart + (duration * i) / numPoints;
      const divergenceValue = deviation.overallScore * (0.5 + Math.random());
      divergenceTimeline.push({ timestamp, divergence: divergenceValue });
    }

    // Generate performance heatmap
    const performanceHeatmap = this.generatePerformanceHeatmap(backtest, live);

    return {
      equityCurveComparison: {
        backtest: backtestEquity,
        live: liveEquity,
      },
      metricsRadar,
      divergenceTimeline,
      performanceHeatmap,
    };
  }

  /**
   * Normalize value for radar chart (0-100 scale)
   */
  private normalizeForRadar(value: number, min: number, max: number): number {
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * Generate performance heatmap data
   */
  private generatePerformanceHeatmap(
    backtest: BacktestStats,
    live: LivePerformanceMetrics
  ): ComparisonVisualizationData['performanceHeatmap'] {
    const periods = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const heatmap: ComparisonVisualizationData['performanceHeatmap'] = [];

    for (const period of periods) {
      const backtestReturn = backtest.totalReturn / 6 * (0.5 + Math.random());
      const liveReturn = live.totalReturn / 6 * (0.4 + Math.random() * 0.8);
      const divergence = ((liveReturn - backtestReturn) / Math.abs(backtestReturn || 1)) * 100;

      heatmap.push({
        period,
        backtestReturn,
        liveReturn,
        divergence,
      });
    }

    return heatmap;
  }

  /**
   * Generate summary
   */
  private generateSummary(
    deviation: PerformanceDeviation,
    insights: ImprovementInsight[],
    metrics: MetricComparison[]
  ): LiveBacktestComparisonReport['summary'] {
    // Determine overall assessment
    let overallAssessment: 'outperforming' | 'on_track' | 'underperforming' | 'critical';
    if (deviation.overallScore < 10 && deviation.returnDeviation > 0) {
      overallAssessment = 'outperforming';
    } else if (deviation.overallScore < 20) {
      overallAssessment = 'on_track';
    } else if (deviation.overallScore < 40) {
      overallAssessment = 'underperforming';
    } else {
      overallAssessment = 'critical';
    }

    // Key findings
    const keyFindings: string[] = [];
    const returnMetric = metrics.find(m => m.key === 'totalReturn');
    if (returnMetric) {
      keyFindings.push(`Return deviation: ${returnMetric.deviation.toFixed(1)}%`);
    }
    const sharpeMetric = metrics.find(m => m.key === 'sharpeRatio');
    if (sharpeMetric) {
      keyFindings.push(`Sharpe ratio deviation: ${sharpeMetric.deviation.toFixed(1)}%`);
    }
    keyFindings.push(`Overall divergence score: ${deviation.overallScore.toFixed(1)}`);

    // Top recommendations
    const topRecommendations = insights
      .slice(0, 3)
      .map(i => i.recommendedAction);

    // Next steps
    const nextSteps = [
      'Review detailed insights for actionable improvements',
      'Monitor key metrics for trend changes',
      'Consider adjusting strategy parameters based on findings',
    ];

    return {
      overallAssessment,
      keyFindings,
      topRecommendations,
      nextSteps,
    };
  }
}

// Export singleton instance
export const backtestLiveComparisonService = new BacktestLiveComparisonService();