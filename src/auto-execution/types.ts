/**
 * Auto Execution Types
 * Type definitions for automated strategy execution - VIP exclusive feature
 */

/**
 * Auto execution status
 */
export type AutoExecutionStatus = 'enabled' | 'disabled' | 'paused' | 'error';

/**
 * Execution mode - how signals are processed
 */
export type ExecutionMode = 'immediate' | 'batch' | 'threshold';

/**
 * Order type for auto execution
 */
export type AutoOrderType = 'market' | 'limit' | 'smart';

/**
 * Signal source for auto execution
 */
export type SignalSource = 'strategy' | 'signal_subscription' | 'copy_trading';

/**
 * Risk control configuration
 */
export interface RiskControls {
  /** Maximum position size per trade (in base currency) */
  maxPositionSize: number;
  /** Maximum position as percentage of portfolio */
  maxPositionPercent: number;
  /** Maximum total exposure across all auto-executed positions */
  maxTotalExposure: number;
  /** Stop loss percentage (0 = disabled) */
  stopLossPercent: number;
  /** Take profit percentage (0 = disabled) */
  takeProfitPercent: number;
  /** Maximum number of trades per day */
  maxDailyTrades: number;
  /** Maximum daily trading volume (in base currency) */
  maxDailyVolume: number;
  /** Maximum trades per hour */
  maxHourlyTrades: number;
  /** Minimum time between trades (in seconds) */
  minTradeInterval: number;
  /** Cooldown period after a loss (in minutes) */
  lossCooldownMinutes: number;
  /** Maximum drawdown percentage before pausing */
  maxDrawdownPercent: number;
  /** Enable circuit breaker on consecutive losses */
  circuitBreakerEnabled: boolean;
  /** Number of consecutive losses to trigger circuit breaker */
  circuitBreakerThreshold: number;
}

/**
 * Trading pair configuration
 */
export interface TradingPairConfig {
  /** Trading pair symbol (e.g., 'BTC/USDT') */
  symbol: string;
  /** Enabled for auto execution */
  enabled: boolean;
  /** Maximum position for this pair */
  maxPosition?: number;
  /** Custom stop loss (overrides global) */
  stopLossPercent?: number;
  /** Custom take profit (overrides global) */
  takeProfitPercent?: number;
  /** Order type for this pair */
  orderType: AutoOrderType;
  /** Slippage tolerance for market orders (percentage) */
  slippageTolerance: number;
}

/**
 * Execution time window
 */
export interface ExecutionWindow {
  /** Start time (HH:mm format) */
  startTime: string;
  /** End time (HH:mm format) */
  endTime: string;
  /** Timezone for the window */
  timezone: string;
  /** Days of week (0 = Sunday, 6 = Saturday) */
  daysOfWeek: number[];
}

/**
 * Auto execution configuration
 */
export interface AutoExecutionConfig {
  id: string;
  userId: string;
  status: AutoExecutionStatus;
  
  // Source configuration
  signalSource: SignalSource;
  strategyId?: string;
  signalSubscriptionId?: string;
  copyTradingId?: string;
  
  // Execution settings
  executionMode: ExecutionMode;
  defaultOrderType: AutoOrderType;
  batchIntervalMinutes: number;
  signalThreshold: number; // Minimum confidence to execute (0-1)
  
  // Trading configuration
  tradingPairs: TradingPairConfig[];
  executionWindows: ExecutionWindow[];
  
  // Risk controls
  riskControls: RiskControls;
  
  // Notification settings
  notifyOnExecution: boolean;
  notifyOnError: boolean;
  notifyOnRiskEvent: boolean;
  
  // Statistics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalVolume: number;
  totalPnl: number;
  
  // Timestamps
  lastExecutionAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create auto execution config input
 */
export interface CreateAutoExecutionInput {
  userId: string;
  signalSource: SignalSource;
  strategyId?: string;
  signalSubscriptionId?: string;
  copyTradingId?: string;
  executionMode?: ExecutionMode;
  defaultOrderType?: AutoOrderType;
  batchIntervalMinutes?: number;
  signalThreshold?: number;
  tradingPairs?: TradingPairConfig[];
  executionWindows?: ExecutionWindow[];
  riskControls?: Partial<RiskControls>;
  notifyOnExecution?: boolean;
  notifyOnError?: boolean;
  notifyOnRiskEvent?: boolean;
}

/**
 * Update auto execution config input
 */
export interface UpdateAutoExecutionInput {
  status?: AutoExecutionStatus;
  executionMode?: ExecutionMode;
  defaultOrderType?: AutoOrderType;
  batchIntervalMinutes?: number;
  signalThreshold?: number;
  tradingPairs?: TradingPairConfig[];
  executionWindows?: ExecutionWindow[];
  riskControls?: Partial<RiskControls>;
  notifyOnExecution?: boolean;
  notifyOnError?: boolean;
  notifyOnRiskEvent?: boolean;
}

/**
 * Auto execution log entry
 */
export interface AutoExecutionLog {
  id: string;
  configId: string;
  userId: string;
  
  // Signal details
  signalId: string;
  signalSource: SignalSource;
  signalSide: 'buy' | 'sell';
  signalPrice: number;
  signalQuantity: number;
  signalConfidence: number;
  signalTimestamp: Date;
  
  // Execution details
  executionStatus: 'pending' | 'executing' | 'filled' | 'failed' | 'skipped' | 'rejected';
  orderType?: AutoOrderType;
  executedPrice?: number;
  executedQuantity?: number;
  orderId?: string;
  tradeId?: string;
  
  // Risk check results
  riskCheckPassed: boolean;
  riskCheckReasons: string[];
  
  // Execution timing
  receivedAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;
  
  // Fees and costs
  feeAmount?: number;
  feeCurrency?: string;
  
  // PnL (for closed positions)
  pnl?: number;
  pnlPercent?: number;
  
  // Error information
  errorMessage?: string;
  errorCode?: string;
  
  // Audit trail
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Create execution log input
 */
export interface CreateExecutionLogInput {
  configId: string;
  userId: string;
  signalId: string;
  signalSource: SignalSource;
  signalSide: 'buy' | 'sell';
  signalPrice: number;
  signalQuantity: number;
  signalConfidence: number;
  signalTimestamp: Date;
}

/**
 * Update execution log input
 */
export interface UpdateExecutionLogInput {
  executionStatus?: 'pending' | 'executing' | 'filled' | 'failed' | 'skipped' | 'rejected';
  orderType?: AutoOrderType;
  executedPrice?: number;
  executedQuantity?: number;
  orderId?: string;
  tradeId?: string;
  riskCheckPassed?: boolean;
  riskCheckReasons?: string[];
  executedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;
  feeAmount?: number;
  feeCurrency?: string;
  pnl?: number;
  pnlPercent?: number;
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Risk check result
 */
export interface RiskCheckResult {
  passed: boolean;
  reasons: string[];
  warnings: string[];
  adjustedQuantity?: number;
  adjustedPrice?: number;
}

/**
 * Daily execution statistics
 */
export interface DailyExecutionStats {
  date: Date;
  configId: string;
  userId: string;
  totalSignals: number;
  executedSignals: number;
  skippedSignals: number;
  failedSignals: number;
  totalVolume: number;
  totalFees: number;
  realizedPnl: number;
  tradesCount: number;
  winRate: number;
  avgExecutionTime: number;
}

/**
 * Auto execution filters
 */
export interface AutoExecutionFilters {
  userId?: string;
  status?: AutoExecutionStatus;
  signalSource?: SignalSource;
  strategyId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Execution log filters
 */
export interface ExecutionLogFilters {
  configId?: string;
  userId?: string;
  signalSource?: SignalSource;
  executionStatus?: 'pending' | 'executing' | 'filled' | 'failed' | 'skipped' | 'rejected';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Default risk controls
 */
export const DEFAULT_RISK_CONTROLS: RiskControls = {
  maxPositionSize: 1000,
  maxPositionPercent: 5,
  maxTotalExposure: 50,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  maxDailyTrades: 20,
  maxDailyVolume: 10000,
  maxHourlyTrades: 5,
  minTradeInterval: 60,
  lossCooldownMinutes: 30,
  maxDrawdownPercent: 10,
  circuitBreakerEnabled: true,
  circuitBreakerThreshold: 3,
};

/**
 * Default trading pair config
 */
export const DEFAULT_TRADING_PAIR_CONFIG: Omit<TradingPairConfig, 'symbol'> = {
  enabled: true,
  orderType: 'market',
  slippageTolerance: 0.5,
};