/**
 * Trading Bot Configuration Types - 交易机器人配置类型
 *
 * Defines the configuration schema for automated trading bots
 */

/**
 * Supported trading strategies
 */
export type StrategyType = 'SMA' | 'RSI' | 'MACD' | 'Bollinger' | 'Stochastic' | 'ATR';

/**
 * Bot running status
 */
export enum BotStatus {
  STOPPED = 'stopped',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
}

/**
 * Trading mode
 */
export enum TradingMode {
  PAPER = 'paper', // Paper trading (simulation)
  LIVE = 'live', // Live trading
}

/**
 * Bot risk control settings
 */
export interface BotRiskSettings {
  /** Maximum capital per trade (absolute or percentage) */
  maxCapitalPerTrade: number;
  /** Use percentage for maxCapitalPerTrade */
  usePercentageCapital: boolean;
  /** Stop loss percentage (0-1) */
  stopLossPercent: number;
  /** Take profit percentage (0-1) */
  takeProfitPercent: number;
  /** Maximum position size */
  maxPositionSize: number;
  /** Maximum orders per minute */
  maxOrdersPerMinute: number;
  /** Maximum daily loss (0-1) */
  maxDailyLoss: number;
  /** Enable risk controls */
  riskControlEnabled: boolean;
}

/**
 * Strategy-specific parameters
 */
export interface StrategyParams {
  // SMA parameters
  shortPeriod?: number;
  longPeriod?: number;

  // RSI parameters
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;

  // MACD parameters
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;

  // Bollinger Bands parameters
  bollingerPeriod?: number;
  bollingerStdDev?: number;

  // Stochastic parameters
  stochasticK?: number;
  stochasticD?: number;
  stochasticOverbought?: number;
  stochasticOversold?: number;

  // ATR parameters
  atrPeriod?: number;
  atrMultiplier?: number;
}

/**
 * Trading pair configuration
 */
export interface TradingPair {
  /** Base currency symbol (e.g., 'BTC') */
  base: string;
  /** Quote currency symbol (e.g., 'USDT') */
  quote: string;
  /** Full symbol (e.g., 'BTCUSDT') */
  symbol: string;
}

/**
 * Time interval for strategy execution
 */
export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * Complete bot configuration
 */
export interface BotConfig {
  /** Unique bot identifier */
  id: string;
  /** Bot name */
  name: string;
  /** Bot description */
  description?: string;
  /** Trading strategy type */
  strategy: StrategyType;
  /** Strategy parameters */
  strategyParams: StrategyParams;
  /** Trading pair */
  tradingPair: TradingPair;
  /** Time interval for strategy execution */
  interval: TimeInterval;
  /** Trading mode (paper or live) */
  mode: TradingMode;
  /** Risk control settings */
  riskSettings: BotRiskSettings;
  /** Initial capital allocation */
  initialCapital: number;
  /** Bot creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Whether bot is enabled */
  enabled: boolean;
}

/**
 * Bot runtime state
 */
export interface BotState {
  /** Bot ID */
  botId: string;
  /** Current status */
  status: BotStatus;
  /** Current portfolio value */
  portfolioValue: number;
  /** Initial capital */
  initialCapital: number;
  /** Realized profit/loss */
  realizedPnL: number;
  /** Unrealized profit/loss */
  unrealizedPnL: number;
  /** Total P&L */
  totalPnL: number;
  /** Number of trades executed */
  tradeCount: number;
  /** Number of winning trades */
  winCount: number;
  /** Number of losing trades */
  lossCount: number;
  /** Current position quantity */
  positionQuantity: number;
  /** Average position price */
  positionAveragePrice: number;
  /** Last signal time */
  lastSignalTime?: Date;
  /** Last trade time */
  lastTradeTime?: Date;
  /** Last error message */
  lastError?: string;
  /** Start time of current run */
  startedAt?: Date;
  /** Total runtime in milliseconds */
  totalRuntimeMs: number;
  /** Daily P&L for risk control */
  dailyPnL: number;
  /** Last reset of daily P&L */
  dailyPnLResetAt?: Date;
}

/**
 * Bot execution log entry
 */
export interface BotLog {
  /** Log ID */
  id: string;
  /** Bot ID */
  botId: string;
  /** Log timestamp */
  timestamp: Date;
  /** Log level */
  level: 'info' | 'warn' | 'error' | 'debug';
  /** Log message */
  message: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Bot trade record
 */
export interface BotTrade {
  /** Trade ID */
  id: string;
  /** Bot ID */
  botId: string;
  /** Strategy ID */
  strategyId: string;
  /** Trading symbol */
  symbol: string;
  /** Trade side */
  side: 'buy' | 'sell';
  /** Trade price */
  price: number;
  /** Trade quantity */
  quantity: number;
  /** Total value */
  total: number;
  /** Fee amount */
  fee: number;
  /** Trade timestamp */
  executedAt: Date;
  /** Order ID */
  orderId: string;
  /** Whether this is a paper trade */
  isPaperTrade: boolean;
}

/**
 * Create bot request
 */
export interface CreateBotRequest {
  name: string;
  description?: string;
  strategy: StrategyType;
  strategyParams?: Partial<StrategyParams>;
  tradingPair: TradingPair;
  interval: TimeInterval;
  mode?: TradingMode;
  riskSettings?: Partial<BotRiskSettings>;
  initialCapital: number;
}

/**
 * Update bot request
 */
export interface UpdateBotRequest {
  name?: string;
  description?: string;
  strategyParams?: Partial<StrategyParams>;
  riskSettings?: Partial<BotRiskSettings>;
  enabled?: boolean;
}

/**
 * Bot configuration with default values
 */
export const DEFAULT_RISK_SETTINGS: BotRiskSettings = {
  maxCapitalPerTrade: 0.1, // 10% of capital
  usePercentageCapital: true,
  stopLossPercent: 0.05, // 5% stop loss
  takeProfitPercent: 0.15, // 15% take profit
  maxPositionSize: 1000,
  maxOrdersPerMinute: 10,
  maxDailyLoss: 0.1, // 10% max daily loss
  riskControlEnabled: true,
};

/**
 * Default strategy parameters by strategy type
 */
export const DEFAULT_STRATEGY_PARAMS: Record<StrategyType, StrategyParams> = {
  SMA: {
    shortPeriod: 10,
    longPeriod: 20,
  },
  RSI: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
  },
  MACD: {
    macdFastPeriod: 12,
    macdSlowPeriod: 26,
    macdSignalPeriod: 9,
  },
  Bollinger: {
    bollingerPeriod: 20,
    bollingerStdDev: 2,
  },
  Stochastic: {
    stochasticK: 14,
    stochasticD: 3,
    stochasticOverbought: 80,
    stochasticOversold: 20,
  },
  ATR: {
    atrPeriod: 14,
    atrMultiplier: 2,
  },
};

/**
 * Generate a unique bot ID
 */
export function generateBotId(): string {
  return `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique log ID
 */
export function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique trade ID
 */
export function generateTradeId(): string {
  return `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
