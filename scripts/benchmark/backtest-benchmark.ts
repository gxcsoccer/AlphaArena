/**
 * Backtest Engine Benchmark
 * 
 * Measures performance of the backtesting engine including:
 * - Ticks per second processing rate
 * - Memory usage during backtests
 * - Strategy calculation times
 * - Comparison with baselines
 */

import { BacktestEngine } from '../../src/backtest/BacktestEngine';
import { BacktestConfig } from '../../src/backtest/types';
import {
  formatBytes,
  formatDuration,
  formatNumber,
  forceGC,
  getMemoryUsage,
  calculateStats,
  compareWithBaseline,
  progressBar,
} from './utils';

// Baseline performance metrics (can be updated over time)
const BASELINES: Record<string, { ticksPerSecond: number; memoryMB: number }> = {
  'sma': { ticksPerSecond: 90000, memoryMB: 40 },
  'rsi': { ticksPerSecond: 85000, memoryMB: 45 },
  'macd': { ticksPerSecond: 80000, memoryMB: 50 },
  'bollinger': { ticksPerSecond: 75000, memoryMB: 48 },
};

export interface BacktestBenchmarkConfig {
  dataPoints: number;
  strategy: string;
  strategyParams: Record<string, any>;
  capital?: number;
  symbol?: string;
  warmupRuns?: number;
  testRuns?: number;
}

export interface BacktestBenchmarkResult {
  config: BacktestBenchmarkConfig;
  ticksPerSecond: number;
  durationMs: number;
  memoryDeltaMB: number;
  stats: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
  };
  comparison?: {
    ticksPerSecond: { changePercent: number; improved: boolean };
    memory: { changePercent: number; improved: boolean };
  };
}

/**
 * Create benchmark configuration
 */
function createBenchmarkConfig(config: BacktestBenchmarkConfig): BacktestConfig {
  const now = Date.now();
  const tickInterval = 60000; // 1 minute per tick
  
  return {
    capital: config.capital ?? 100000,
    symbol: config.symbol ?? 'BTC/USDT',
    startTime: now - config.dataPoints * tickInterval,
    endTime: now,
    strategy: config.strategy,
    strategyParams: config.strategyParams,
    tickInterval,
  };
}

/**
 * Run a single backtest benchmark
 */
function runSingleBenchmark(config: BacktestBenchmarkConfig): BacktestBenchmarkResult {
  forceGC();
  
  const btConfig = createBenchmarkConfig(config);
  const memoryBefore = getMemoryUsage().heapUsed;
  const startTime = performance.now();
  
  const engine = new BacktestEngine(btConfig);
  const result = engine.run();
  
  const durationMs = performance.now() - startTime;
  const memoryAfter = getMemoryUsage().heapUsed;
  
  const ticksPerSecond = (config.dataPoints / durationMs) * 1000;
  const memoryDeltaMB = (memoryAfter - memoryBefore) / (1024 * 1024);
  
  const benchmarkResult: BacktestBenchmarkResult = {
    config,
    ticksPerSecond,
    durationMs,
    memoryDeltaMB,
    stats: {
      totalReturn: result.stats.totalReturn,
      sharpeRatio: result.stats.sharpeRatio,
      maxDrawdown: result.stats.maxDrawdown,
      totalTrades: result.stats.totalTrades,
    },
  };
  
  // Compare with baseline if available
  const baseline = BASELINES[config.strategy];
  if (baseline) {
    benchmarkResult.comparison = {
      ticksPerSecond: compareWithBaseline(ticksPerSecond, baseline.ticksPerSecond),
      memory: compareWithBaseline(Math.abs(memoryDeltaMB), baseline.memoryMB, false),
    };
  }
  
  return benchmarkResult;
}

/**
 * Run backtest benchmark with multiple iterations
 */
export function runBacktestBenchmark(
  config: BacktestBenchmarkConfig
): BacktestBenchmarkResult {
  const { warmupRuns = 1, testRuns = 3 } = config;
  
  console.log(`\n📊 Backtest Benchmark: ${config.strategy.toUpperCase()}`);
  console.log(`   Data Points: ${formatNumber(config.dataPoints)}`);
  console.log(`   Warmup: ${warmupRuns} | Test Runs: ${testRuns}`);
  console.log('');
  
  // Warmup runs
  for (let i = 0; i < warmupRuns; i++) {
    console.log(`   Warmup ${i + 1}/${warmupRuns}...`);
    runSingleBenchmark({ ...config, dataPoints: Math.min(10000, config.dataPoints) });
  }
  
  // Test runs
  const results: BacktestBenchmarkResult[] = [];
  for (let i = 0; i < testRuns; i++) {
    console.log(`   Run ${i + 1}/${testRuns}...`);
    results.push(runSingleBenchmark(config));
  }
  
  // Calculate aggregate results
  const ticksPerSecondValues = results.map(r => r.ticksPerSecond);
  const memoryValues = results.map(r => r.memoryDeltaMB);
  const durationValues = results.map(r => r.durationMs);
  
  const tickStats = calculateStats(ticksPerSecondValues);
  const memStats = calculateStats(memoryValues.map(Math.abs));
  
  const aggregateResult: BacktestBenchmarkResult = {
    config,
    ticksPerSecond: tickStats.median,
    durationMs: calculateStats(durationValues).median,
    memoryDeltaMB: memStats.median,
    stats: results[0].stats, // Use first run's stats
    comparison: results[0].comparison,
  };
  
  return aggregateResult;
}

/**
 * Run benchmarks for all strategies
 */
export function runAllStrategyBenchmarks(
  dataPoints: number = 100000
): BacktestBenchmarkResult[] {
  console.log('\n' + '='.repeat(60));
  console.log('  BACKTEST ENGINE BENCHMARK');
  console.log('='.repeat(60));
  
  // Only test strategies that are supported by BacktestEngine
  const strategies: BacktestBenchmarkConfig[] = [
    {
      dataPoints,
      strategy: 'sma',
      strategyParams: { shortPeriod: 5, longPeriod: 20, tradeQuantity: 10 },
    },
    {
      dataPoints,
      strategy: 'rsi',
      strategyParams: { period: 14, overbought: 70, oversold: 30, tradeQuantity: 10 },
    },
    {
      dataPoints,
      strategy: 'macd',
      strategyParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, tradeQuantity: 10 },
    },
    {
      dataPoints,
      strategy: 'bollinger',
      strategyParams: { period: 20, stdDev: 2, tradeQuantity: 10 },
    },
  ];
  
  const results: BacktestBenchmarkResult[] = [];
  
  for (const config of strategies) {
    try {
      const result = runBacktestBenchmark(config);
      results.push(result);
    } catch (error: any) {
      console.error(`   ❌ Error benchmarking ${config.strategy}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Print benchmark results in a formatted table
 */
export function printBacktestResults(results: BacktestBenchmarkResult[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('  BACKTEST BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log('');
  
  // Header
  console.log(
    'Strategy'.padEnd(12) +
    'Ticks/sec'.padEnd(15) +
    'Memory'.padEnd(12) +
    'Duration'.padEnd(12) +
    'vs Baseline'
  );
  console.log('-'.repeat(70));
  
  for (const result of results) {
    const strategy = result.config.strategy.toUpperCase().padEnd(12);
    const ticks = formatNumber(Math.round(result.ticksPerSecond)).padEnd(15);
    const memory = formatBytes(Math.abs(result.memoryDeltaMB) * 1024 * 1024).padEnd(12);
    const duration = formatDuration(result.durationMs).padEnd(12);
    
    let comparison = 'N/A';
    if (result.comparison) {
      const tickChange = result.comparison.ticksPerSecond.changePercent;
      const improved = result.comparison.ticksPerSecond.improved;
      const symbol = improved ? '✓' : '✗';
      comparison = `${tickChange >= 0 ? '+' : ''}${tickChange.toFixed(1)}% ${symbol}`;
    }
    
    console.log(strategy + ticks + memory + duration + comparison);
  }
  
  console.log('');
  console.log('='.repeat(70));
}

/**
 * Generate benchmark report for CI
 */
export function generateCIReport(results: BacktestBenchmarkResult[]): string {
  const lines: string[] = [
    '# Backtest Benchmark Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Results',
    '',
    '| Strategy | Ticks/sec | Memory | Duration | vs Baseline |',
    '|----------|----------|--------|----------|--------------|',
  ];
  
  for (const result of results) {
    const strategy = result.config.strategy.toUpperCase();
    const ticks = formatNumber(Math.round(result.ticksPerSecond));
    const memory = formatBytes(Math.abs(result.memoryDeltaMB) * 1024 * 1024);
    const duration = formatDuration(result.durationMs);
    
    let comparison = 'N/A';
    if (result.comparison) {
      const tickChange = result.comparison.ticksPerSecond.changePercent;
      comparison = `${tickChange >= 0 ? '+' : ''}${tickChange.toFixed(1)}%`;
    }
    
    lines.push(`| ${strategy} | ${ticks} | ${memory} | ${duration} | ${comparison} |`);
  }
  
  return lines.join('\n');
}

// CLI entry point
if (require.main === module) {
  const dataPoints = parseInt(process.argv[2]) || 100000;
  
  console.log(`\n🚀 Running backtest benchmarks with ${formatNumber(dataPoints)} data points...\n`);
  
  const results = runAllStrategyBenchmarks(dataPoints);
  printBacktestResults(results);
  
  // Generate CI report
  console.log('\n--- CI Report ---\n');
  console.log(generateCIReport(results));
  
  // Export for CI benchmark action
  const ciOutput = {
    name: 'Backtest Benchmark',
    value: results[0]?.ticksPerSecond || 0,
    unit: 'ticks/sec',
    biggerIsBetter: true,
  };
  console.log('\n--- JSON Output for CI ---\n');
  console.log(JSON.stringify(ciOutput, null, 2));
}
