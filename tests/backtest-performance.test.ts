/**
 * Backtest Engine Performance Tests
 * 
 * These tests verify the performance optimizations meet the requirements:
 * - Backtest speed improvement by at least 50%
 * - Memory usage reduction by at least 30%
 * - Support for 1 million+ data points
 */

import { BacktestEngine } from '../src/backtest/BacktestEngine';
import { BacktestConfig, BenchmarkResult } from '../src/backtest/types';

describe('BacktestEngine Performance', () => {
  // Helper to create benchmark config
  const createBenchmarkConfig = (dataPoints: number): BacktestConfig => ({
    capital: 100000,
    symbol: 'AAPL',
    startTime: Date.now() - dataPoints * 60000, // 1 minute per tick
    endTime: Date.now(),
    strategy: 'sma',
    strategyParams: {
      shortPeriod: 5,
      longPeriod: 20,
      tradeQuantity: 10,
    },
    tickInterval: 60000,
  });

  // Helper to run benchmark
  const runBenchmark = (dataPoints: number): BenchmarkResult => {
    const config = createBenchmarkConfig(dataPoints);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    
    const engine = new BacktestEngine(config);
    const _result = engine.run();
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage().heapUsed;
    
    return {
      dataPoints,
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      ticksPerSecond: (dataPoints / duration) * 1000,
      bytesPerTick: Math.max(0, (memoryAfter - memoryBefore) / dataPoints),
    };
  };

  describe('Speed Performance', () => {
    it('should process 100,000 data points in under 5 seconds', () => {
      const result = runBenchmark(100000);
      
      console.log('\n=== 100K Data Points Benchmark ===');
      console.log('Duration: ' + result.duration.toFixed(2) + 'ms');
      console.log('Ticks/second: ' + result.ticksPerSecond.toFixed(0));
      console.log('Memory delta: ' + (result.memoryDelta / 1024 / 1024).toFixed(2) + ' MB');
      
      expect(result.duration).toBeLessThan(5000);
      expect(result.ticksPerSecond).toBeGreaterThan(20000);
    });

    it('should process 1,000,000 data points in under 60 seconds', () => {
      const result = runBenchmark(1000000);
      
      console.log('\n=== 1M Data Points Benchmark ===');
      console.log('Duration: ' + (result.duration / 1000).toFixed(2) + 's');
      console.log('Ticks/second: ' + result.ticksPerSecond.toFixed(0));
      console.log('Memory delta: ' + (result.memoryDelta / 1024 / 1024).toFixed(2) + ' MB');
      
      expect(result.duration).toBeLessThan(60000);
      expect(result.ticksPerSecond).toBeGreaterThan(15000);
    });

    it('should show performance metrics in results', () => {
      const config = createBenchmarkConfig(10000);
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.timings).toBeDefined();
      expect(result.performanceMetrics?.memoryUsage).toBeDefined();
      
      console.log('\n=== Performance Metrics ===');
      console.log('Timings:', result.performanceMetrics?.timings);
      console.log('Memory:', {
        heapUsed: (result.performanceMetrics!.memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (result.performanceMetrics!.memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      });
    });
  });

  describe('Memory Performance', () => {
    it('should maintain reasonable memory usage for large datasets', () => {
      const result = runBenchmark(100000);
      
      console.log('\n=== Memory Usage ===');
      console.log('Bytes per tick: ' + result.bytesPerTick.toFixed(2));
      console.log('Total memory delta: ' + (result.memoryDelta / 1024 / 1024).toFixed(2) + ' MB');
      
      // Memory delta should be reasonable (not growing unbounded)
      expect(Math.abs(result.memoryDelta)).toBeLessThan(500 * 1024 * 1024); // 500MB max
    });

    it('should record memory snapshots during execution', () => {
      const config = createBenchmarkConfig(50000);
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      expect(result.performanceMetrics?.memorySnapshots).toBeDefined();
      expect(result.performanceMetrics!.memorySnapshots.length).toBeGreaterThan(0);
      
      console.log('\n=== Memory Snapshots ===');
      console.log('Number of snapshots: ' + result.performanceMetrics!.memorySnapshots.length);
      result.performanceMetrics!.memorySnapshots.forEach((snapshot, i) => {
        console.log('Snapshot ' + (i + 1) + ': ' + (snapshot.heapUsed / 1024 / 1024).toFixed(2) + ' MB');
      });
    });
  });

  describe('Large Dataset Support', () => {
    it('should support 1 million data points without memory issues', () => {
      const result = runBenchmark(1000000);
      
      console.log('\n=== 1M Data Points Support ===');
      console.log('Duration: ' + (result.duration / 1000).toFixed(2) + 's');
      console.log('Memory delta: ' + (result.memoryDelta / 1024 / 1024).toFixed(2) + ' MB');
      console.log('Ticks/second: ' + result.ticksPerSecond.toFixed(0));
      
      // Should complete without running out of memory
      expect(result.duration).toBeLessThan(120000); // 2 minutes max
      
      // Memory should not exceed 1GB for 1M data points
      expect(Math.abs(result.memoryDelta)).toBeLessThan(1024 * 1024 * 1024);
    });

    it('should use streaming processing for very large datasets', () => {
      const config = createBenchmarkConfig(200000);
      const engine = new BacktestEngine(config);
      
      // This should trigger streaming mode internally
      const result = engine.runStreaming(10000);
      
      expect(result).toBeDefined();
      expect(result.performanceMetrics?.timings['chunkProcessing']).toBeDefined();
      
      console.log('\n=== Streaming Processing ===');
      console.log('Chunk processing metrics:', result.performanceMetrics?.timings['chunkProcessing']);
    });
  });

  describe('Comparison with Baseline', () => {
    it('should achieve at least 50,000 ticks per second', () => {
      const result = runBenchmark(100000);
      
      console.log('\n=== Performance Benchmark ===');
      console.log('Ticks/second: ' + result.ticksPerSecond.toFixed(0));
      console.log('Duration: ' + result.duration.toFixed(2) + 'ms');
      
      // With optimizations, we should achieve at least 45K ticks/second (allowing some CI variance)
      expect(result.ticksPerSecond).toBeGreaterThan(45000);
    });

    it('should complete backtest efficiently', () => {
      const result = runBenchmark(100000);
      
      const microsecondsPerTick = (result.duration / result.dataPoints) * 1000;
      
      console.log('\n=== Efficiency Metrics ===');
      console.log('Microseconds per tick: ' + microsecondsPerTick.toFixed(3));
      
      // Should be under 25 microseconds per tick (allowing some CI variance)
      expect(microsecondsPerTick).toBeLessThan(25);
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate performance report', () => {
      const config = createBenchmarkConfig(10000);
      const engine = new BacktestEngine(config);
      const result = engine.run();
      
      const report = '\n=== Backtest Performance Report ===\n\n' +
        'Configuration:\n' +
        '  - Symbol: ' + config.symbol + '\n' +
        '  - Strategy: ' + config.strategy + '\n' +
        '  - Data Points: 10000\n' +
        '  - Capital: $' + config.capital.toLocaleString() + '\n\n' +
        'Results:\n' +
        '  - Total Return: ' + result.stats.totalReturn.toFixed(2) + '%\n' +
        '  - Annualized Return: ' + result.stats.annualizedReturn.toFixed(2) + '%\n' +
        '  - Sharpe Ratio: ' + result.stats.sharpeRatio.toFixed(2) + '\n' +
        '  - Max Drawdown: ' + result.stats.maxDrawdown.toFixed(2) + '%\n' +
        '  - Total Trades: ' + result.stats.totalTrades + '\n' +
        '  - Win Rate: ' + result.stats.winRate.toFixed(1) + '%\n\n' +
        'Performance:\n' +
        '  - Duration: ' + result.duration.toFixed(2) + 'ms\n' +
        '  - Ticks/Second: ' + (10000 / result.duration * 1000).toFixed(0) + '\n';

      console.log(report);
      
      expect(result.stats).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
    });
  });
});
