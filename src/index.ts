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
  RiskMetrics,
  RiskAlert,
  PositionData,
  PortfolioData,
  RiskAlertTrigger,
  UserRiskConfig,
  RiskAlertHistory,
  RiskCalculationResult,
  RiskAlertStats,
} from './risk-alerting';
