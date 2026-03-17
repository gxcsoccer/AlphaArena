/**
 * Backtest types and interfaces
 * 
 * @module backtest/types
 * @description Type definitions for the backtesting engine
 */

import { PortfolioSnapshot } from '../portfolio/types';

/**
 * Backtest configuration interface
 * 
 * Defines all parameters for running a backtest simulation.
 * 
 * @property {number} capital - Initial capital in quote currency
 * @property {string} symbol - Trading pair to backtest (e.g., 'BTC/USDT')
 * @property {number} startTime - Start timestamp (Unix milliseconds)
 * @property {number} endTime - End timestamp (Unix milliseconds)
 * @property {string} strategy - Strategy name to use
 * @property {Record<string, any>} [strategyParams] - Strategy-specific parameters
 * @property {number} [tickInterval] - Simulated tick interval in milliseconds
 * 
 * @example
 * ```typescript
 * const config: BacktestConfig = {
 *   capital: 10000,
 *   symbol: 'BTC/USDT',
 *   startTime: new Date('2024-01-01').getTime(),
 *   endTime: new Date('2024-12-31').getTime(),
 *   strategy: 'sma',
 *   strategyParams: { shortPeriod: 5, longPeriod: 20 },
 *   tickInterval: 60000, // 1 minute
 * };
 * ```
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
 * 
 * Standard OHLCV (Open, High, Low, Close, Volume) data structure.
 * 
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} open - Opening price
 * @property {number} high - Highest price during the period
 * @property {number} low - Lowest price during the period
 * @property {number} close - Closing price
 * @property {number} volume - Trading volume during the period
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
 * 
 * Comprehensive performance metrics for a backtest run.
 * 
 * @property {number} totalReturn - Total return percentage
 * @property {number} annualizedReturn - Annualized return percentage
 * @property {number} sharpeRatio - Risk-adjusted return (Sharpe ratio)
 * @property {number} maxDrawdown - Maximum drawdown percentage
 * @property {number} totalTrades - Total number of trades executed
 * @property {number} winningTrades - Number of profitable trades
 * @property {number} losingTrades - Number of unprofitable trades
 * @property {number} winRate - Percentage of winning trades
 * @property {number} avgWin - Average profit per winning trade
 * @property {number} avgLoss - Average loss per losing trade
 * @property {number} profitFactor - Gross profit / gross loss ratio
 * @property {number} initialCapital - Starting capital
 * @property {number} finalCapital - Ending capital
 * @property {number} totalPnL - Total profit/loss
 * 
 * @example
 * ```typescript
 * const stats: BacktestStats = {
 *   totalReturn: 25.5,
 *   annualizedReturn: 25.5,
 *   sharpeRatio: 1.8,
 *   maxDrawdown: 15.2,
 *   totalTrades: 150,
 *   winningTrades: 90,
 *   losingTrades: 60,
 *   winRate: 60,
 *   avgWin: 500,
 *   avgLoss: 300,
 *   profitFactor: 2.5,
 *   initialCapital: 10000,
 *   finalCapital: 12550,
 *   totalPnL: 2550,
 * };
 * ```
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
 * 
 * Tracks execution timing for performance analysis.
 * 
 * @property {number} avg - Average time in milliseconds
 * @property {number} min - Minimum time in milliseconds
 * @property {number} max - Maximum time in milliseconds
 * @property {number} count - Number of measurements
 */
export interface TimingMetrics {
  avg: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Memory usage metrics
 * 
 * Current memory consumption in bytes.
 * 
 * @property {number} heapUsed - Used heap size
 * @property {number} heapTotal - Total heap size
 * @property {number} external - External memory usage
 * @property {number} rss - Resident Set Size
 */
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory snapshot
 * 
 * Memory usage at a specific point in time.
 * 
 * @property {number} timestamp - Unix timestamp
 * @property {number} heapUsed - Used heap size
 * @property {number} heapTotal - Total heap size
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
}

/**
 * Performance metrics collected during backtest
 * 
 * Comprehensive performance tracking for optimization.
 * 
 * @property {Record<string, TimingMetrics>} timings - Timing metrics by operation
 * @property {MemoryUsage} memoryUsage - Current memory usage
 * @property {MemorySnapshot[]} memorySnapshots - Memory snapshots during execution
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
 * Backtest result interface
 * 
 * Complete output of a backtest run including configuration, statistics, and detailed data.
 * 
 * @property {BacktestConfig} config - Configuration used for the backtest
 * @property {BacktestStats} stats - Final statistics
 * @property {PortfolioSnapshot[]} snapshots - Portfolio snapshots over time
 * @property {any[]} trades - Trade log
 * @property {number} startTime - Backtest start timestamp
 * @property {number} endTime - Backtest end timestamp
 * @property {number} duration - Total duration in milliseconds
 * @property {PerformanceMetrics} [performanceMetrics] - Performance metrics (optional)
 * 
 * @example
 * ```typescript
 * const result: BacktestResult = await engine.run();
 * 
 * console.log('Total Return:', result.stats.totalReturn.toFixed(2) + '%');
 * console.log('Sharpe Ratio:', result.stats.sharpeRatio.toFixed(2));
 * console.log('Max Drawdown:', result.stats.maxDrawdown.toFixed(2) + '%');
 * ```
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
 * 
 * Configuration for running strategies in real-time mode.
 * 
 * @property {string} strategy - Strategy name
 * @property {Record<string, any>} [strategyParams] - Strategy parameters
 * @property {number} capital - Initial capital
 * @property {string} symbol - Symbol to trade
 * @property {string} [dataSource] - Data source URL or provider
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
 * Benchmark result interface
 * 
 * Results from performance benchmarking.
 * 
 * @property {number} dataPoints - Number of data points processed
 * @property {number} duration - Duration in milliseconds
 * @property {number} memoryBefore - Memory before (bytes)
 * @property {number} memoryAfter - Memory after (bytes)
 * @property {number} memoryDelta - Memory change (bytes)
 * @property {number} ticksPerSecond - Processing speed
 * @property {number} bytesPerTick - Memory per tick
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
