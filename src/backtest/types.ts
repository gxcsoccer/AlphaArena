/**
 * Backtest types and interfaces
 */

import { PortfolioSnapshot } from '../portfolio/types';

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  /** Initial capital */
  capital: number;
  /** Stock symbol to trade */
  symbol: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Strategy name */
  strategy: string;
  /** Strategy parameters */
  strategyParams?: Record<string, any>;
  /** Tick interval in ms (simulated) */
  tickInterval?: number;
}

/**
 * Historical price data point
 */
export interface PriceDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Backtest result statistics
 */
export interface BacktestStats {
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
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Starting capital */
  initialCapital: number;
  /** Ending capital */
  finalCapital: number;
  /** Total profit/loss */
  totalPnL: number;
}

/**
 * Performance timing metrics
 */
export interface TimingMetrics {
  avg: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
}

/**
 * Performance metrics collected during backtest
 */
export interface PerformanceMetrics {
  /** Timing metrics for various operations */
  timings: Record<string, TimingMetrics>;
  /** Current memory usage */
  memoryUsage: MemoryUsage;
  /** Memory snapshots during execution */
  memorySnapshots: MemorySnapshot[];
}

/**
 * Backtest result
 */
export interface BacktestResult {
  /** Configuration used */
  config: BacktestConfig;
  /** Final statistics */
  stats: BacktestStats;
  /** Portfolio snapshots over time */
  snapshots: PortfolioSnapshot[];
  /** Trade log */
  trades: any[];
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration in ms */
  duration: number;
  /** Performance metrics (optional, for optimized version) */
  performanceMetrics?: PerformanceMetrics;
}

/**
 * Real-time mode configuration
 */
export interface RealtimeConfig {
  /** Strategy name */
  strategy: string;
  /** Strategy parameters */
  strategyParams?: Record<string, any>;
  /** Initial capital */
  capital: number;
  /** Symbol to trade */
  symbol: string;
  /** Data source URL or provider */
  dataSource?: string;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Number of data points */
  dataPoints: number;
  /** Duration in ms */
  duration: number;
  /** Memory before (bytes) */
  memoryBefore: number;
  /** Memory after (bytes) */
  memoryAfter: number;
  /** Memory delta (bytes) */
  memoryDelta: number;
  /** Ticks per second */
  ticksPerSecond: number;
  /** Bytes per tick */
  bytesPerTick: number;
}
