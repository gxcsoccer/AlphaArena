/**
 * Performance Analytics Types
 *
 * Type definitions for strategy performance analytics
 *
 * @module analytics/types
 */

/**
 * Return metrics - 收益指标
 */
export interface ReturnMetrics {
  /** Total return percentage */
  totalReturn: number;
  /** Annualized return percentage */
  annualizedReturn: number;
  /** Cumulative returns over time */
  cumulativeReturns: number[];
  /** Monthly returns map (key: 'YYYY-MM', value: return %) */
  monthlyReturns: Map<string, number>;
  /** Win rate percentage */
  winRate: number;
  /** Profit/Loss ratio (avg win / avg loss) */
  profitLossRatio: number;
  /** Average winning trade amount */
  avgWin: number;
  /** Average losing trade amount */
  avgLoss: number;
}

/**
 * Risk metrics - 风险指标
 */
export interface RiskMetrics {
  /** Maximum drawdown percentage */
  maxDrawdown: number;
  /** Maximum drawdown duration in days */
  maxDrawdownDuration: number;
  /** Annualized volatility */
  volatility: number;
  /** Downside risk (semi-deviation) */
  downsideRisk: number;
  /** Value at Risk (95% confidence) */
  var95: number;
  /** Conditional VaR (Expected Shortfall) */
  cvar: number;
  /** Beta relative to benchmark */
  beta?: number;
}

/**
 * Risk-adjusted return metrics - 风险调整收益
 */
export interface RiskAdjustedMetrics {
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio */
  sortinoRatio: number;
  /** Calmar ratio */
  calmarRatio: number;
  /** Information ratio (vs benchmark) */
  informationRatio?: number;
  /** Treynor ratio */
  treynorRatio?: number;
}

/**
 * Trading statistics - 交易统计
 */
export interface TradingMetrics {
  /** Total number of trades */
  totalTrades: number;
  /** Average holding time in hours */
  avgHoldingTime: number;
  /** Maximum consecutive wins */
  maxConsecutiveWins: number;
  /** Maximum consecutive losses */
  maxConsecutiveLosses: number;
  /** Trading frequency (trades per day) */
  tradingFrequency: number;
  /** Turnover rate */
  turnoverRate: number;
  /** Average trade size */
  avgTradeSize: number;
  /** Largest winning trade */
  largestWin: number;
  /** Largest losing trade */
  largestLoss: number;
}

/**
 * Complete performance metrics
 */
export interface PerformanceMetrics {
  /** Return metrics */
  returns: ReturnMetrics;
  /** Risk metrics */
  risk: RiskMetrics;
  /** Risk-adjusted metrics */
  riskAdjusted: RiskAdjustedMetrics;
  /** Trading metrics */
  trading: TradingMetrics;
  /** Calculation timestamp */
  calculatedAt: number;
}

/**
 * Equity curve point
 */
export interface EquityCurvePoint {
  /** Timestamp */
  timestamp: number;
  /** Account value */
  value: number;
  /** Return percentage from start */
  return: number;
  /** Drawdown percentage from peak */
  drawdown: number;
  /** Benchmark value (optional) */
  benchmarkValue?: number;
  /** Benchmark return (optional) */
  benchmarkReturn?: number;
}

/**
 * Equity curve data
 */
export interface EquityCurve {
  /** Data points */
  points: EquityCurvePoint[];
  /** Initial capital */
  initialCapital: number;
  /** Final capital */
  finalCapital: number;
  /** Period start */
  startTimestamp: number;
  /** Period end */
  endTimestamp: number;
}

/**
 * Monthly return entry
 */
export interface MonthlyReturnEntry {
  /** Year */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Return percentage */
  return: number;
  /** Number of trades */
  trades: number;
  /** Profit/Loss amount */
  pnl: number;
}

/**
 * Monthly returns heatmap data
 */
export interface MonthlyReturnsHeatmap {
  /** Monthly data entries */
  entries: MonthlyReturnEntry[];
  /** Years covered */
  years: number[];
  /** Best month */
  bestMonth: { year: number; month: number; return: number };
  /** Worst month */
  worstMonth: { year: number; month: number; return: number };
}

/**
 * Position distribution
 */
export interface PositionDistribution {
  /** By asset class */
  byAssetClass: Map<string, { value: number; percentage: number }>;
  /** By strategy */
  byStrategy: Map<string, { value: number; percentage: number }>;
  /** By profit/loss status */
  byPnLStatus: {
    profitable: { count: number; value: number };
    losing: { count: number; value: number };
    breakeven: { count: number; value: number };
  };
}

/**
 * Drawdown analysis point
 */
export interface DrawdownPoint {
  /** Start timestamp */
  startTimestamp: number;
  /** End timestamp */
  endTimestamp: number;
  /** Trough timestamp */
  troughTimestamp: number;
  /** Drawdown percentage */
  drawdown: number;
  /** Duration in days */
  duration: number;
  /** Recovery time in days (null if not recovered) */
  recoveryTime: number | null;
}

/**
 * Drawdown analysis
 */
export interface DrawdownAnalysis {
  /** All drawdown periods */
  periods: DrawdownPoint[];
  /** Maximum drawdown */
  maxDrawdown: number;
  /** Average drawdown */
  avgDrawdown: number;
  /** Average drawdown duration */
  avgDuration: number;
  /** Current drawdown (if underwater) */
  currentDrawdown: number | null;
  /** Time underwater percentage */
  timeUnderwater: number;
}

/**
 * Strategy performance snapshot (stored in database)
 */
export interface StrategyPerformanceSnapshot {
  /** Unique ID */
  id: string;
  /** Strategy ID */
  strategyId: string;
  /** User ID */
  userId?: string;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Total return */
  totalReturn: number;
  /** Annualized return */
  annualizedReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Max drawdown */
  maxDrawdown: number;
  /** Win rate */
  winRate: number;
  /** Profit factor */
  profitFactor: number;
  /** Total trades */
  totalTrades: number;
  /** Additional metrics as JSON */
  additionalMetrics?: Record<string, number>;
  /** Created at */
  createdAt: Date;
}

/**
 * Daily account value record (stored in database)
 */
export interface DailyAccountValue {
  /** Unique ID */
  id: string;
  /** Account ID */
  accountId: string;
  /** Date */
  date: Date;
  /** Cash balance */
  cash: number;
  /** Positions value */
  positionsValue: number;
  /** Total account value */
  totalValue: number;
  /** Daily return percentage */
  dailyReturn: number;
  /** Cumulative return percentage */
  cumulativeReturn: number;
  /** Created at */
  createdAt: Date;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  /** Report ID */
  id: string;
  /** Strategy ID */
  strategyId: string;
  /** Strategy name */
  strategyName: string;
  /** Report period */
  period: {
    start: Date;
    end: Date;
    duration: string;
  };
  /** Summary metrics */
  summary: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  /** Detailed metrics */
  detailedMetrics: PerformanceMetrics;
  /** Equity curve */
  equityCurve: EquityCurve;
  /** Drawdown analysis */
  drawdownAnalysis: DrawdownAnalysis;
  /** Monthly returns */
  monthlyReturns: MonthlyReturnsHeatmap;
  /** Position distribution */
  positionDistribution?: PositionDistribution;
  /** Trade list (optional, for detailed reports) */
  trades?: any[];
  /** Benchmark comparison */
  benchmarkComparison?: {
    benchmarkName: string;
    benchmarkReturn: number;
    excessReturn: number;
    informationRatio: number;
  };
  /** Generated at */
  generatedAt: Date;
}

/**
 * Strategy comparison result (enhanced)
 */
export interface EnhancedStrategyComparison {
  /** Comparison ID */
  id: string;
  /** Strategies compared */
  strategies: {
    id: string;
    name: string;
    metrics: PerformanceMetrics;
    equityCurve: EquityCurve;
  }[];
  /** Relative rankings */
  rankings: {
    strategyId: string;
    strategyName: string;
    overallRank: number;
    metricRanks: {
      totalReturn: number;
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      profitFactor: number;
      sortinoRatio: number;
    };
    compositeScore: number;
  }[];
  /** Comparison charts data */
  chartsData: {
    equityCurves: EquityCurve[];
    monthlyReturns: Map<string, MonthlyReturnEntry[]>[];
    drawdownComparison: Map<string, DrawdownAnalysis>;
  };
  /** Execution metadata */
  metadata: {
    executionTime: number;
    createdAt: number;
    symbol: string;
    capital: number;
    periodStart: number;
    periodEnd: number;
  };
}

/**
 * Analytics query options
 */
export interface AnalyticsQueryOptions {
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Include benchmark */
  includeBenchmark?: boolean;
  /** Benchmark symbol */
  benchmarkSymbol?: string;
  /** Granularity for equity curve ('daily' | 'hourly' | 'tick') */
  granularity?: 'daily' | 'hourly' | 'tick';
  /** Include trade list */
  includeTrades?: boolean;
}

/**
 * Benchmark data
 */
export interface BenchmarkData {
  /** Symbol */
  symbol: string;
  /** Name */
  name: string;
  /** Data points */
  data: {
    timestamp: number;
    value: number;
    return: number;
  }[];
  /** Period return */
  totalReturn: number;
  /** Annualized return */
  annualizedReturn: number;
  /** Volatility */
  volatility: number;
}