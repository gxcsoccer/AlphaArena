/**
 * Live vs Backtest Comparison Types
 *
 * Type definitions for comparing live trading results with backtest predictions
 *
 * @module backtest-live/ComparisonTypes
 */

import { BacktestStats } from '../backtest/types';
import { LivePerformanceMetrics, PerformanceDeviation } from './types';

/**
 * Metric comparison item for display
 */
export interface MetricComparison {
  /** Metric name */
  name: string;
  /** Metric key for i18n */
  key: string;
  /** Backtest value */
  backtestValue: number;
  /** Live value */
  liveValue: number;
  /** Unit (%, $, ratio, etc.) */
  unit: string;
  /** Deviation percentage */
  deviation: number;
  /** Deviation severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether higher is better */
  higherIsBetter: boolean;
  /** Description */
  description: string;
  /** Possible causes for deviation */
  possibleCauses: string[];
}

/**
 * Time period comparison
 */
export interface TimePeriodComparison {
  /** Period label */
  label: string;
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
  /** Backtest return for this period */
  backtestReturn: number;
  /** Live return for this period */
  liveReturn: number;
  /** Number of trades in backtest */
  backtestTrades: number;
  /** Number of trades in live */
  liveTrades: number;
}

/**
 * Slippage impact analysis
 */
export interface SlippageImpact {
  /** Average slippage per trade (percentage) */
  avgSlippagePercent: number;
  /** Total slippage cost */
  totalSlippageCost: number;
  /** Impact on return */
  returnImpact: number;
  /** Impact on Sharpe ratio */
  sharpeImpact: number;
  /** Comparison by trade type */
  byTradeType: {
    type: 'market' | 'limit' | 'stop';
    avgSlippage: number;
    count: number;
  }[];
}

/**
 * Fee impact analysis
 */
export interface FeeImpact {
  /** Total fees paid */
  totalFees: number;
  /** Fee rate */
  feeRate: number;
  /** Impact on return */
  returnImpact: number;
  /** Impact on Sharpe ratio */
  sharpeImpact: number;
  /** Fees by period */
  byPeriod: {
    period: string;
    fees: number;
    trades: number;
  }[];
}

/**
 * Execution delay impact analysis
 */
export interface ExecutionDelayImpact {
  /** Average execution delay in milliseconds */
  avgDelayMs: number;
  /** Maximum delay */
  maxDelayMs: number;
  /** Impact on return */
  returnImpact: number;
  /** Impact on win rate */
  winRateImpact: number;
  /** Trades affected by significant delay */
  affectedTrades: number;
  /** Percentage of trades affected */
  affectedPercent: number;
}

/**
 * Market environment comparison
 */
export interface MarketEnvironmentComparison {
  /** Backtest period market conditions */
  backtestPeriod: {
    avgVolatility: number;
    trendDirection: 'up' | 'down' | 'sideways';
    avgVolume: number;
    significantEvents: string[];
  };
  /** Live period market conditions */
  livePeriod: {
    avgVolatility: number;
    trendDirection: 'up' | 'down' | 'sideways';
    avgVolume: number;
    significantEvents: string[];
  };
  /** Similarity score (0-100) */
  similarityScore: number;
  /** Key differences */
  keyDifferences: string[];
}

/**
 * Divergence analysis result
 */
export interface DivergenceAnalysis {
  /** Overall divergence score (0-100) */
  overallDivergenceScore: number;
  /** Divergence trend (improving, stable, worsening) */
  trend: 'improving' | 'stable' | 'worsening';
  /** Divergence by category */
  byCategory: {
    category: string;
    score: number;
    contribution: number;
  }[];
  /** Root causes */
  rootCauses: {
    cause: string;
    likelihood: number;
    impact: number;
    suggestedAction: string;
  }[];
}

/**
 * Improvement insight
 */
export interface ImprovementInsight {
  /** Insight ID */
  id: string;
  /** Category */
  category: 'timing' | 'execution' | 'risk' | 'parameters' | 'market_conditions';
  /** Priority (1-5, 1 is highest) */
  priority: number;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Current situation */
  currentSituation: string;
  /** Recommended action */
  recommendedAction: string;
  /** Expected improvement */
  expectedImprovement: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Supporting data */
  supportingData: Record<string, any>;
}

/**
 * Comparison report configuration
 */
export interface ComparisonReportConfig {
  /** Integration ID */
  integrationId: string;
  /** User ID */
  userId: string;
  /** Comparison period start */
  periodStart: number;
  /** Comparison period end */
  periodEnd: number;
  /** Include detailed trade analysis */
  includeTradeAnalysis?: boolean;
  /** Include market environment comparison */
  includeMarketEnvironment?: boolean;
  /** Include slippage analysis */
  includeSlippageAnalysis?: boolean;
  /** Include fee analysis */
  includeFeeAnalysis?: boolean;
  /** Include execution delay analysis */
  includeExecutionDelayAnalysis?: boolean;
  /** Number of insights to generate */
  maxInsights?: number;
}

/**
 * Complete comparison report
 */
export interface LiveBacktestComparisonReport {
  /** Report ID */
  id: string;
  /** Generation timestamp */
  generatedAt: number;
  /** Configuration used */
  config: ComparisonReportConfig;
  /** Backtest metrics */
  backtestMetrics: BacktestStats;
  /** Live metrics */
  liveMetrics: LivePerformanceMetrics;
  /** Performance deviation */
  deviation: PerformanceDeviation;
  /** Metric comparisons */
  metricComparisons: MetricComparison[];
  /** Time period comparisons */
  timePeriodComparisons: TimePeriodComparison[];
  /** Slippage impact analysis */
  slippageImpact?: SlippageImpact;
  /** Fee impact analysis */
  feeImpact?: FeeImpact;
  /** Execution delay impact */
  executionDelayImpact?: ExecutionDelayImpact;
  /** Market environment comparison */
  marketEnvironment?: MarketEnvironmentComparison;
  /** Divergence analysis */
  divergenceAnalysis: DivergenceAnalysis;
  /** Improvement insights */
  insights: ImprovementInsight[];
  /** Summary */
  summary: {
    overallAssessment: 'outperforming' | 'on_track' | 'underperforming' | 'critical';
    keyFindings: string[];
    topRecommendations: string[];
    nextSteps: string[];
  };
  /** Visualization data */
  visualizationData: ComparisonVisualizationData;
}

/**
 * Visualization data for charts
 */
export interface ComparisonVisualizationData {
  /** Equity curve comparison */
  equityCurveComparison: {
    backtest: { timestamp: number; value: number }[];
    live: { timestamp: number; value: number }[];
  };
  /** Metrics radar chart data */
  metricsRadar: {
    metric: string;
    backtest: number;
    live: number;
  }[];
  /** Divergence timeline */
  divergenceTimeline: {
    timestamp: number;
    divergence: number;
  }[];
  /** Performance heatmap */
  performanceHeatmap: {
    period: string;
    backtestReturn: number;
    liveReturn: number;
    divergence: number;
  }[];
}

/**
 * Export format for comparison report
 */
export type ComparisonExportFormat = 'pdf' | 'html' | 'json' | 'csv';

/**
 * Comparison report export options
 */
export interface ComparisonExportOptions {
  /** Export format */
  format: ComparisonExportFormat;
  /** Include charts as images */
  includeCharts?: boolean;
  /** Include detailed data tables */
  includeDataTables?: boolean;
  /** Language for report */
  language?: string;
  /** Custom title */
  title?: string;
}