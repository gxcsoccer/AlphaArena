/**
 * Real-time Trading Engine Types
 */

/**
 * Market tick data - 市场 tick 数据
 */
export interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

/**
 * Engine configuration - 引擎配置
 */
export interface EngineConfig {
  /** Tick interval in milliseconds */
  tickInterval: number;
  /** Symbols to simulate */
  symbols: string[];
  /** Initial prices for each symbol */
  initialPrices: Map<string, number>;
  /** Price volatility (0-1) */
  volatility: number;
  /** Enable logging */
  enableLogging: boolean;
}

/**
 * Engine state - 引擎状态
 */
export enum EngineState {
  STOPPED = 'stopped',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error'
}

/**
 * Engine event types - 引擎事件类型
 */
export type EngineEventType = 
  | 'engine:start'
  | 'engine:stop'
  | 'engine:pause'
  | 'engine:resume'
  | 'engine:error'
  | 'engine:tick'
  | 'market:tick'
  | 'signal:generated'
  | 'order:submitted'
  | 'order:filled'
  | 'trade:executed'
  | 'risk:triggered';

/**
 * Engine event - 引擎事件
 */
export interface EngineEvent {
  type: EngineEventType;
  timestamp: number;
  data?: any;
}

/**
 * Risk control settings - 风控设置
 */
export interface RiskControlConfig {
  /** Maximum position size per symbol */
  maxPositionSize: number;
  /** Maximum total exposure */
  maxTotalExposure: number;
  /** Stop loss percentage (0-1) */
  stopLossPercent: number;
  /** Maximum orders per minute */
  maxOrdersPerMinute: number;
  /** Enable risk control */
  enabled: boolean;
}

/**
 * Risk check result - 风控检查结果
 */
export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  riskType?: 'position_limit' | 'exposure_limit' | 'stop_loss' | 'rate_limit';
}

/**
 * Trading statistics - 交易统计
 */
export interface TradingStats {
  totalTicks: number;
  totalSignals: number;
  totalOrders: number;
  totalTrades: number;
  startTime?: number;
  endTime?: number;
}
