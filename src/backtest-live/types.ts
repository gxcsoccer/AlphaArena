/**
 * Backtest-Live Integration Types
 *
 * Type definitions for backtest-to-live trading integration
 *
 * @module backtest-live/types
 */

import { BacktestConfig, BacktestStats } from '../backtest/types';

/**
 * Environment type for trading modes
 */
export type TradingEnvironment = 'backtest' | 'paper' | 'live';

/**
 * Strategy configuration that can be shared across environments
 */
export interface StrategyConfig {
  /** Strategy unique identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Strategy type (sma, rsi, macd, etc.) */
  type: string;
  /** Strategy parameters */
  params: Record<string, any>;
  /** Risk management settings */
  riskManagement?: RiskManagementConfig;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** User ID who created this config */
  userId: string;
}

/**
 * Risk management configuration
 */
export interface RiskManagementConfig {
  /** Maximum position size per trade (percentage of portfolio) */
  maxPositionSize: number;
  /** Stop loss percentage */
  stopLossPercentage?: number;
  /** Take profit percentage */
  takeProfitPercentage?: number;
  /** Maximum daily loss limit (percentage) */
  maxDailyLoss?: number;
  /** Maximum drawdown limit (percentage) */
  maxDrawdown?: number;
  /** Maximum number of concurrent positions */
  maxConcurrentPositions?: number;
}

/**
 * Integrated strategy configuration that links backtest and live
 */
export interface IntegratedStrategyConfig {
  /** Unique identifier for the integration */
  id: string;
  /** User ID */
  userId: string;
  /** Strategy configuration */
  strategy: StrategyConfig;
  /** Backtest configuration */
  backtestConfig: BacktestConfig;
  /** Current trading environment */
  environment: TradingEnvironment;
  /** Paper trading configuration (optional) */
  paperConfig?: PaperTradingConfig;
  /** Live trading configuration (optional) */
  liveConfig?: LiveTradingConfig;
  /** Backtest result reference */
  backtestResultId?: string;
  /** Performance monitoring settings */
  monitoring: MonitoringConfig;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Status */
  status: IntegrationStatus;
}

/**
 * Paper trading configuration
 */
export interface PaperTradingConfig {
  /** Initial virtual capital */
  initialCapital: number;
  /** Trading fees (percentage) */
  tradingFees: number;
  /** Slippage simulation (percentage) */
  slippage: number;
  /** Latency simulation (milliseconds) */
  latencyMs: number;
}

/**
 * Live trading configuration
 */
export interface LiveTradingConfig {
  /** Exchange adapter ID */
  exchangeId: string;
  /** API key reference (encrypted) */
  apiKeyRef: string;
  /** Trading pair */
  symbol: string;
  /** Auto-start on system startup */
  autoStart: boolean;
  /** Risk limits override */
  riskLimits: RiskManagementConfig;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable real-time performance comparison */
  enableComparison: boolean;
  /** Deviation alert threshold (percentage) */
  deviationThreshold: number;
  /** Comparison interval (milliseconds) */
  comparisonInterval: number;
  /** Enable automatic optimization suggestions */
  enableOptimization: boolean;
  /** Notification channels */
  notificationChannels: NotificationChannel[];
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  /** Channel type */
  type: 'email' | 'webhook' | 'push' | 'sms';
  /** Channel endpoint or address */
  endpoint: string;
  /** Enabled status */
  enabled: boolean;
}

/**
 * Integration status
 */
export type IntegrationStatus = 'draft' | 'backtesting' | 'paper_trading' | 'live' | 'paused' | 'stopped' | 'error';

/**
 * Performance comparison between backtest and live trading
 */
export interface PerformanceComparison {
  /** Integration ID */
  integrationId: string;
  /** Comparison timestamp */
  timestamp: number;
  /** Period being compared (start time) */
  periodStart: number;
  /** Period being compared (end time) */
  periodEnd: number;
  /** Backtest performance metrics */
  backtestMetrics: BacktestStats;
  /** Live/paper trading performance metrics */
  liveMetrics: LivePerformanceMetrics;
  /** Deviation analysis */
  deviation: PerformanceDeviation;
  /** Alert status */
  alertStatus: AlertStatus;
}

/**
 * Live trading performance metrics
 */
export interface LivePerformanceMetrics {
  /** Total return percentage */
  totalReturn: number;
  /** Annualized return percentage */
  annualizedReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Maximum drawdown percentage */
  maxDrawdown: number;
  /** Total number of trades */
  totalTrades: number;
  /** Number of winning trades */
  winningTrades: number;
  /** Number of losing trades */
  losingTrades: number;
  /** Win rate percentage */
  winRate: number;
  /** Average profit per winning trade */
  avgWin: number;
  /** Average loss per losing trade */
  avgLoss: number;
  /** Profit factor */
  profitFactor: number;
  /** Current equity */
  currentEquity: number;
  /** Cash balance */
  cashBalance: number;
  /** Unrealized PnL */
  unrealizedPnL: number;
  /** Number of open positions */
  openPositions: number;
}

/**
 * Performance deviation analysis
 */
export interface PerformanceDeviation {
  /** Return deviation percentage */
  returnDeviation: number;
  /** Sharpe ratio deviation */
  sharpeDeviation: number;
  /** Drawdown deviation percentage */
  drawdownDeviation: number;
  /** Win rate deviation percentage */
  winRateDeviation: number;
  /** Trade count deviation percentage */
  tradeCountDeviation: number;
  /** Overall deviation score (0-100, lower is better) */
  overallScore: number;
  /** Significant deviations detected */
  significantDeviations: DeviationDetail[];
}

/**
 * Deviation detail
 */
export interface DeviationDetail {
  /** Metric name */
  metric: string;
  /** Expected value (backtest) */
  expected: number;
  /** Actual value (live) */
  actual: number;
  /** Deviation percentage */
  deviation: number;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Possible causes */
  possibleCauses: string[];
}

/**
 * Alert status
 */
export interface AlertStatus {
  /** Has alerts */
  hasAlerts: boolean;
  /** Alert level */
  level: 'info' | 'warning' | 'error' | 'critical';
  /** Alert messages */
  messages: AlertMessage[];
  /** Last alert timestamp */
  lastAlertTime?: number;
}

/**
 * Alert message
 */
export interface AlertMessage {
  /** Alert ID */
  id: string;
  /** Alert level */
  level: 'info' | 'warning' | 'error' | 'critical';
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Suggested actions */
  suggestedActions?: string[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion ID */
  id: string;
  /** Integration ID */
  integrationId: string;
  /** Suggestion type */
  type: 'parameter_adjustment' | 'risk_management' | 'strategy_change' | 'timing_adjustment';
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Current value */
  currentValue: any;
  /** Suggested value */
  suggestedValue: any;
  /** Expected improvement */
  expectedImprovement: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Supporting data */
  supportingData: Record<string, any>;
  /** Created timestamp */
  createdAt: number;
  /** Applied status */
  applied: boolean;
  /** Applied timestamp */
  appliedAt?: number;
}

/**
 * Environment migration request
 */
export interface EnvironmentMigrationRequest {
  /** Integration ID */
  integrationId: string;
  /** Target environment */
  targetEnvironment: TradingEnvironment;
  /** Copy backtest results */
  copyBacktestResults?: boolean;
  /** Reset paper trading stats */
  resetPaperStats?: boolean;
  /** Custom configuration override */
  configOverride?: Partial<StrategyConfig>;
}

/**
 * Environment migration result
 */
export interface EnvironmentMigrationResult {
  /** Success status */
  success: boolean;
  /** New environment */
  environment: TradingEnvironment;
  /** Migration timestamp */
  migratedAt: number;
  /** Warnings during migration */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Historical comparison record
 */
export interface HistoricalComparisonRecord {
  /** Record ID */
  id: string;
  /** Integration ID */
  integrationId: string;
  /** Comparison timestamp */
  timestamp: number;
  /** Comparison data */
  comparison: PerformanceComparison;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Backtest result storage record
 */
export interface BacktestResultRecord {
  /** Record ID */
  id: string;
  /** Integration ID (optional) */
  integrationId?: string;
  /** User ID */
  userId: string;
  /** Backtest configuration */
  config: BacktestConfig;
  /** Backtest statistics */
  stats: BacktestStats;
  /** Trade snapshots (summary) */
  tradeSummary: {
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    avgTradeSize: number;
  };
  /** Performance metrics */
  performanceMetrics?: {
    duration: number;
    memoryUsed: number;
    ticksPerSecond: number;
  };
  /** Created timestamp */
  createdAt: number;
  /** Tags for searching */
  tags?: string[];
}