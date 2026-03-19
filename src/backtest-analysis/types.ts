/**
 * Deep Backtest Analysis Types
 *
 * @module backtest-analysis/types
 * @description Type definitions for comprehensive backtest analysis and reporting
 */

import { BacktestResult, BacktestStats } from '../backtest/types';
import { PortfolioSnapshot } from '../portfolio/types';

/**
 * Extended trade analysis
 */
export interface TradeAnalysis {
  /** Trade ID */
  id: string;
  /** Entry timestamp */
  entryTime: number;
  /** Exit timestamp */
  exitTime: number;
  /** Trade direction */
  side: 'long' | 'short';
  /** Entry price */
  entryPrice: number;
  /** Exit price */
  exitPrice: number;
  /** Position size */
  quantity: number;
  /** Profit/Loss */
  pnl: number;
  /** P&L percentage */
  pnlPercent: number;
  /** Trade duration in milliseconds */
  duration: number;
  /** Maximum favorable excursion */
  mfe: number;
  /** Maximum adverse excursion */
  mae: number;
  /** Risk-reward ratio achieved */
  riskRewardRatio: number;
  /** Holding period return */
  holdingReturn: number;
  /** Whether trade was profitable */
  isWinner: boolean;
  /** Exit reason */
  exitReason?: 'signal' | 'stop_loss' | 'take_profit' | 'end_of_period';
}

/**
 * Equity curve point
 */
export interface EquityCurvePoint {
  /** Timestamp */
  timestamp: number;
  /** Portfolio value */
  value: number;
  /** Cash value */
  cash: number;
  /** Position value */
  positionValue: number;
  /** Drawdown at this point */
  drawdown: number;
  /** Drawdown percentage */
  drawdownPercent: number;
  /** Daily return */
  dailyReturn?: number;
  /** Cumulative return */
  cumulativeReturn: number;
}

/**
 * Drawdown analysis
 */
export interface DrawdownAnalysis {
  /** Maximum drawdown percentage */
  maxDrawdown: number;
  /** Maximum drawdown duration in milliseconds */
  maxDrawdownDuration: number;
  /** Average drawdown */
  avgDrawdown: number;
  /** Drawdown periods */
  drawdownPeriods: DrawdownPeriod[];
  /** Recovery factor (total return / max drawdown) */
  recoveryFactor: number;
  /** Time underwater percentage */
  timeUnderwater: number;
}

/**
 * Individual drawdown period
 */
export interface DrawdownPeriod {
  /** Start timestamp */
  startTimestamp: number;
  /** Trough timestamp */
  troughTimestamp: number;
  /** End timestamp (null if not recovered) */
  endTimestamp: number | null;
  /** Peak value before drawdown */
  peakValue: number;
  /** Trough value */
  troughValue: number;
  /** Drawdown percentage */
  drawdownPercent: number;
  /** Duration in milliseconds */
  duration: number;
  /** Recovery duration in milliseconds (null if not recovered) */
  recoveryDuration: number | null;
}

/**
 * Position analysis
 */
export interface PositionAnalysis {
  /** Symbol */
  symbol: string;
  /** Total trades for this symbol */
  totalTrades: number;
  /** Winning trades */
  winningTrades: number;
  /** Losing trades */
  losingTrades: number;
  /** Win rate */
  winRate: number;
  /** Total P&L */
  totalPnL: number;
  /** Average P&L per trade */
  avgPnL: number;
  /** Maximum position size held */
  maxPositionSize: number;
  /** Average position size */
  avgPositionSize: number;
  /** Long trades count */
  longTrades: number;
  /** Short trades count */
  shortTrades: number;
  /** Long win rate */
  longWinRate: number;
  /** Short win rate */
  shortWinRate: number;
}

/**
 * Monthly performance breakdown
 */
export interface MonthlyPerformance {
  /** Year */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Monthly return percentage */
  returnPercent: number;
  /** Number of trades */
  trades: number;
  /** Win rate */
  winRate: number;
  /** Maximum drawdown in month */
  maxDrawdown: number;
  /** Total P&L */
  totalPnL: number;
  /** Starting capital */
  startCapital: number;
  /** Ending capital */
  endCapital: number;
}

/**
 * Risk metrics
 */
export interface RiskMetrics {
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio (downside risk adjusted) */
  sortinoRatio: number;
  /** Calmar ratio (annual return / max drawdown) */
  calmarRatio: number;
  /** Volatility (annualized standard deviation) */
  volatility: number;
  /** Downside deviation */
  downsideDeviation: number;
  /** Value at Risk (95%) */
  var95: number;
  /** Conditional VaR (Expected Shortfall) */
  cvar95: number;
  /** Beta (if benchmark provided) */
  beta?: number;
  /** Alpha (if benchmark provided) */
  alpha?: number;
  /** Information ratio (if benchmark provided) */
  informationRatio?: number;
  /** Maximum consecutive losses */
  maxConsecutiveLosses: number;
  /** Maximum consecutive wins */
  maxConsecutiveWins: number;
  /** Average leverage used */
  avgLeverage: number;
  /** Maximum leverage used */
  maxLeverage: number;
}

/**
 * Trade distribution statistics
 */
export interface TradeDistribution {
  /** Trade count by hour of day */
  byHour: number[];
  /** Trade count by day of week (0=Sunday) */
  byDayOfWeek: number[];
  /** Trade count by month */
  byMonth: number[];
  /** Trade count by size buckets */
  bySize: SizeBucket[];
  /** Trade count by duration buckets */
  byDuration: DurationBucket[];
  /** Trade count by P&L buckets */
  byPnL: PnLBucket[];
}

/**
 * Size bucket for distribution
 */
export interface SizeBucket {
  /** Size range label */
  label: string;
  /** Minimum size */
  min: number;
  /** Maximum size */
  max: number;
  /** Count of trades */
  count: number;
  /** Win rate in this bucket */
  winRate: number;
  /** Average P&L */
  avgPnL: number;
}

/**
 * Duration bucket for distribution
 */
export interface DurationBucket {
  /** Duration range label */
  label: string;
  /** Minimum duration in ms */
  minMs: number;
  /** Maximum duration in ms */
  maxMs: number;
  /** Count of trades */
  count: number;
  /** Win rate in this bucket */
  winRate: number;
  /** Average P&L */
  avgPnL: number;
}

/**
 * P&L bucket for distribution
 */
export interface PnLBucket {
  /** P&L range label */
  label: string;
  /** Minimum P&L */
  min: number;
  /** Maximum P&L */
  max: number;
  /** Count of trades */
  count: number;
}

/**
 * Strategy comparison result
 */
export interface StrategyComparisonResult {
  /** Strategy name */
  strategyName: string;
  /** Strategy parameters */
  parameters: Record<string, any>;
  /** Basic stats */
  stats: BacktestStats;
  /** Risk metrics */
  riskMetrics: RiskMetrics;
  /** Trade analysis summary */
  tradeSummary: {
    totalTrades: number;
    winners: number;
    losers: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
  };
  /** Drawdown analysis */
  drawdownAnalysis: {
    maxDrawdown: number;
    maxDrawdownDuration: number;
    recoveryFactor: number;
  };
  /** Return analysis */
  returnAnalysis: {
    totalReturn: number;
    annualizedReturn: number;
    monthlyReturns: MonthlyPerformance[];
  };
  /** Execution metrics */
  executionMetrics: {
    duration: number;
    tradesPerSecond: number;
  };
}

/**
 * Comparison ranking
 */
export interface ComparisonRanking {
  /** Metric name */
  metric: string;
  /** Rankings by strategy */
  rankings: {
    strategyName: string;
    value: number;
    rank: number;
  }[];
}

/**
 * Complete deep analysis report
 */
export interface DeepAnalysisReport {
  /** Report generation timestamp */
  generatedAt: number;
  /** Backtest configuration */
  config: {
    symbol: string;
    strategy: string;
    strategyParams?: Record<string, any>;
    initialCapital: number;
    startTime: number;
    endTime: number;
    duration: number;
  };
  /** Basic statistics */
  basicStats: BacktestStats;
  /** Risk metrics */
  riskMetrics: RiskMetrics;
  /** Extended trade analysis */
  tradeAnalysis: TradeAnalysis[];
  /** Equity curve */
  equityCurve: EquityCurvePoint[];
  /** Drawdown analysis */
  drawdownAnalysis: DrawdownAnalysis;
  /** Position analysis */
  positionAnalysis: PositionAnalysis[];
  /** Monthly performance */
  monthlyPerformance: MonthlyPerformance[];
  /** Trade distribution */
  tradeDistribution: TradeDistribution;
  /** Performance scorecard */
  performanceScorecard: PerformanceScorecard;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Performance scorecard
 */
export interface PerformanceScorecard {
  /** Overall score (0-100) */
  overallScore: number;
  /** Profitability score */
  profitabilityScore: number;
  /** Risk management score */
  riskScore: number;
  /** Consistency score */
  consistencyScore: number;
  /** Efficiency score */
  efficiencyScore: number;
  /** Score breakdown */
  breakdown: {
    category: string;
    score: number;
    weight: number;
    description: string;
  }[];
}

/**
 * Report export options
 */
export interface ReportExportOptions {
  /** Export format */
  format: 'pdf' | 'excel' | 'json';
  /** Include equity curve chart data */
  includeEquityCurve?: boolean;
  /** Include trade list */
  includeTradeList?: boolean;
  /** Include monthly breakdown */
  includeMonthlyBreakdown?: boolean;
  /** Include trade distribution */
  includeDistribution?: boolean;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Custom report title */
  title?: string;
  /** Locale for formatting */
  locale?: string;
}

/**
 * Strategy comparison options
 */
export interface StrategyComparisonOptions {
  /** Strategies to compare */
  strategies: {
    name: string;
    type: string;
    params?: Record<string, any>;
  }[];
  /** Common backtest configuration */
  backtestConfig: {
    capital: number;
    symbol: string;
    startTime: number;
    endTime: number;
    tickInterval?: number;
  };
  /** Comparison metrics to include */
  metrics?: string[];
}

/**
 * Comparison report
 */
export interface ComparisonReport {
  /** Report generation timestamp */
  generatedAt: number;
  /** Comparison configuration */
  config: StrategyComparisonOptions;
  /** Results per strategy */
  results: StrategyComparisonResult[];
  /** Rankings */
  rankings: ComparisonRanking[];
  /** Summary */
  summary: {
    bestOverall: string;
    bestReturn: string;
    lowestRisk: string;
    highestSharpe: string;
    mostConsistent: string;
  };
  /** Visual comparison data */
  comparisonCharts: {
    equityCurves: { strategyName: string; data: EquityCurvePoint[] }[];
    drawdownComparison: { strategyName: string; maxDrawdown: number }[];
    returnDistribution: { strategyName: string; returns: number[] }[];
  };
}

/**
 * Signal analysis for backtest
 */
export interface SignalAnalysis {
  /** Total signals generated */
  totalSignals: number;
  /** Signals by type */
  signalsByType: {
    type: string;
    count: number;
    winRate: number;
    avgPnL: number;
  }[];
  /** Signal timing analysis */
  timingAnalysis: {
    optimalHours: number[];
    optimalDays: number[];
    worstHours: number[];
    worstDays: number[];
  };
  /** Signal quality metrics */
  qualityMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export type { BacktestResult, BacktestStats, PortfolioSnapshot };