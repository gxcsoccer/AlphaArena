/**
 * AlphaArena - Algorithmic Trading Platform
 *
 * Main entry point exporting all modules
 */

export * from './orderbook';
export * from './matching';
export * from './portfolio';
export * from './strategy';
export * from './backtest';

// Backtest Analysis Module
export {
  BacktestAnalyzer,
  StrategyComparator,
  ReportGenerator,
} from './backtest-analysis';
export type {
  DeepAnalysisReport,
  StrategyComparisonOptions,
  StrategyComparisonResult,
  ComparisonReport,
  EquityCurvePoint,
  TradeAnalysis,
  MonthlyPerformance,
  RiskMetrics,
  PerformanceScorecard,
  DrawdownAnalysis,
  PositionAnalysis,
  TradeDistribution,
  ReportExportOptions,
} from './backtest-analysis';

// Risk Alerting Module
export {
  RiskCalculator,
  riskCalculator,
  RiskAlertService,
  getRiskAlertService,
} from './risk-alerting';

export type {
  RiskType,
  RiskSeverity,
  RiskAlertStatus,
  NotificationChannels,
  RiskAlertRule,
  RiskMetrics as RiskAlertMetrics,
  RiskAlert,
  PositionData,
  PortfolioData,
  RiskAlertTrigger,
  UserRiskConfig,
  RiskAlertHistory,
  RiskCalculationResult,
  RiskAlertStats,
} from './risk-alerting';
