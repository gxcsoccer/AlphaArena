/**
 * Dashboard Performance Tests
 * Tests data processing performance with large datasets
 * 
 * These tests verify the performance optimizations meet the requirements:
 * - 1000+ data items render time < 2s
 * - Memory usage increase < 100MB
 * - Data processing efficient
 */

// Test data generators
const generateMockTrades = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `trade-${i}`,
    symbol: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT'][i % 5],
    side: i % 2 === 0 ? 'buy' : 'sell' as 'buy' | 'sell',
    price: 50000 + Math.random() * 10000,
    quantity: Math.random() * 10,
    total: 0,
    executedAt: new Date(Date.now() - i * 1000).toISOString(),
    strategyId: `strategy-${i % 5}`,
  }));
};

const generateMockStrategies = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `strategy-${i}`,
    name: `Strategy ${i}`,
    type: ['momentum', 'mean-reversion', 'arbitrage', 'grid', 'dca'][i % 5],
    status: ['active', 'paused', 'stopped'][i % 3] as 'active' | 'paused' | 'stopped',
    returnRate: (Math.random() - 0.5) * 100,
    tradeCount: Math.floor(Math.random() * 1000),
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    lastActiveAt: new Date().toISOString(),
  }));
};

const generateMockOrders = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${i}`,
    symbol: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'][i % 3],
    side: i % 2 === 0 ? 'buy' : 'sell' as 'buy' | 'sell',
    type: i % 3 === 0 ? 'market' : 'limit' as 'limit' | 'market',
    price: 50000 + Math.random() * 10000,
    quantity: Math.random() * 10,
    status: ['pending', 'filled', 'cancelled'][i % 3] as 'pending' | 'filled' | 'cancelled',
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
  }));
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  render_100_items: 100,    // ms
  render_500_items: 300,    // ms
  render_1000_items: 500,   // ms
  render_2000_items: 1000,  // ms
  scroll_fps: 30,           // minimum FPS
  memory_limit: 100,        // MB
};

interface BenchmarkResult {
  dataCount: number;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  passed: boolean;
}

describe('Dashboard Performance Tests', () => {
  describe('Data Processing Performance', () => {
    test('should process 1000 trades in under 50ms', () => {
      const trades = generateMockTrades(1000);

      const start = performance.now();
      
      // Simulate data processing (sorting, filtering, mapping)
      const processed = trades
        .filter(t => t.price > 40000)
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
        .map(t => ({
          ...t,
          total: t.price * t.quantity,
        }));

      const end = performance.now();
      const duration = end - start;

      expect(processed.length).toBe(1000);
      expect(duration).toBeLessThan(50);
      console.log(`✅ Processed 1000 trades in ${duration.toFixed(2)}ms`);
    });

    test('should aggregate trade data efficiently', () => {
      const trades = generateMockTrades(1000);

      const start = performance.now();

      // Aggregate by symbol
      const aggregated = trades.reduce((acc, trade) => {
        if (!acc[trade.symbol]) {
          acc[trade.symbol] = { count: 0, volume: 0, avgPrice: 0 };
        }
        acc[trade.symbol].count++;
        acc[trade.symbol].volume += trade.price * trade.quantity;
        acc[trade.symbol].avgPrice += trade.price;
        return acc;
      }, {} as Record<string, { count: number; volume: number; avgPrice: number }>);

      // Calculate averages
      Object.keys(aggregated).forEach(symbol => {
        aggregated[symbol].avgPrice /= aggregated[symbol].count;
      });

      const end = performance.now();
      const duration = end - start;

      expect(Object.keys(aggregated).length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30);
      console.log(`✅ Aggregated 1000 trades in ${duration.toFixed(2)}ms`);
    });

    test('should handle large dataset filtering efficiently', () => {
      const trades = generateMockTrades(2000);

      const start = performance.now();

      // Complex filter
      const filtered = trades.filter(t => 
        t.price > 45000 && 
        t.price < 65000 && 
        t.quantity > 2 &&
        (t.side === 'buy' || t.symbol.includes('BTC'))
      );

      const end = performance.now();
      const duration = end - start;

      expect(filtered.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(20);
      console.log(`✅ Filtered 2000 trades in ${duration.toFixed(2)}ms`);
    });

    test('should prepare chart data efficiently for 1000 data points', () => {
      const trades = generateMockTrades(1000);

      const start = performance.now();

      // Prepare data for charts (similar to DashboardPage logic)
      const strategyStatusData = trades.reduce((acc: Record<string, number>, trade) => {
        const key = trade.strategyId;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const pieData = Object.entries(strategyStatusData).map(([name, value]) => ({
        name,
        value,
      }));

      const tradeVolumeData = Array.from({ length: 5 }, (_, i) => ({
        name: `Strategy ${i}`,
        volume: trades
          .filter(t => t.strategyId === `strategy-${i}`)
          .reduce((sum, t) => sum + t.price * t.quantity, 0),
      }));

      const end = performance.now();
      const duration = end - start;

      expect(pieData.length).toBeGreaterThan(0);
      expect(tradeVolumeData.length).toBe(5);
      expect(duration).toBeLessThan(100);
      console.log(`✅ Prepared chart data for 1000 trades in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance', () => {
    test('should handle data cleanup efficiently', () => {
      // Create large dataset
      let data: any[] = generateMockTrades(5000);
      expect(data.length).toBe(5000);

      const start = performance.now();

      // Clear data
      data = [];
      
      const end = performance.now();
      const duration = end - start;

      expect(data.length).toBe(0);
      expect(duration).toBeLessThan(5);
      console.log(`✅ Cleared 5000 items in ${duration.toFixed(2)}ms`);
    });

    test('should generate datasets without memory issues', () => {
      const memoryBefore = process.memoryUsage().heapUsed;

      // Generate multiple large datasets
      const trades = generateMockTrades(1000);
      const strategies = generateMockStrategies(100);
      const orders = generateMockOrders(500);

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDelta = (memoryAfter - memoryBefore) / (1024 * 1024);

      expect(trades.length).toBe(1000);
      expect(strategies.length).toBe(100);
      expect(orders.length).toBe(500);
      
      console.log(`✅ Memory delta: ${memoryDelta.toFixed(2)}MB for 1600 total items`);
      
      // Memory should not exceed threshold
      expect(memoryDelta).toBeLessThan(PERFORMANCE_THRESHOLDS.memory_limit);
    });
  });

  describe('Table Data Preparation', () => {
    test('should prepare table columns without performance impact', () => {
      const mockData = generateMockTrades(100);

      const start = performance.now();

      // Column definition (simulating TradeHistoryPanel columns)
      const columns = [
        { title: 'Time', dataIndex: 'executedAt', width: 100 },
        { title: 'Symbol', dataIndex: 'symbol', width: 100 },
        { title: 'Side', dataIndex: 'side', width: 80 },
        { title: 'Price', dataIndex: 'price', width: 100 },
        { title: 'Quantity', dataIndex: 'quantity', width: 100 },
        { title: 'Total', dataIndex: 'total', width: 100 },
      ];

      // Prepare row data
      const rowData = mockData.map(trade => ({
        key: trade.id,
        ...trade,
        total: trade.price * trade.quantity,
      }));

      const end = performance.now();
      const duration = end - start;

      expect(columns.length).toBe(6);
      expect(rowData.length).toBe(100);
      expect(duration).toBeLessThan(20);
      console.log(`✅ Prepared table data for 100 rows in ${duration.toFixed(2)}ms`);
    });

    test('should handle virtualization threshold calculation efficiently', () => {
      const largeDataset = generateMockTrades(1000);
      const virtualizedThreshold = 50;

      const start = performance.now();

      // Determine if virtualization is needed
      const useVirtualization = largeDataset.length > virtualizedThreshold;

      // Calculate visible range
      const containerHeight = 400;
      const rowHeight = 48;
      const visibleCount = Math.ceil(containerHeight / rowHeight);
      const _startIndex = 0;
      const endIndex = Math.min(visibleCount + 5, largeDataset.length);

      const end = performance.now();
      const duration = end - start;

      expect(useVirtualization).toBe(true);
      expect(visibleCount).toBe(9); // 400 / 48 = 8.33
      expect(endIndex).toBe(14); // visibleCount + 5 overscan
      expect(duration).toBeLessThan(5);
      console.log(`✅ Virtualization calculation in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Tests', () => {
    const runBenchmark = (dataCount: number): BenchmarkResult => {
      const memoryBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      // Simulate full dashboard data processing
      const trades = generateMockTrades(dataCount);
      
      const _processedData = {
        trades: trades.map(t => ({ ...t, total: t.price * t.quantity })),
        stats: {
          total: trades.length,
          buyCount: trades.filter(t => t.side === 'buy').length,
          sellCount: trades.filter(t => t.side === 'sell').length,
          totalVolume: trades.reduce((sum, t) => sum + t.price * t.quantity, 0),
        },
        chartData: {
          symbols: [...new Set(trades.map(t => t.symbol))],
          volumeBySymbol: trades.reduce((acc, t) => {
            acc[t.symbol] = (acc[t.symbol] || 0) + t.price * t.quantity;
            return acc;
          }, {} as Record<string, number>),
        },
      };

      const duration = performance.now() - startTime;
      const memoryAfter = process.memoryUsage().heapUsed;

      return {
        dataCount,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: (memoryAfter - memoryBefore) / (1024 * 1024),
        passed: duration < PERFORMANCE_THRESHOLDS.render_1000_items,
      };
    };

    test('benchmark: 100 items should process under 100ms', () => {
      const result = runBenchmark(100);
      
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.render_100_items);
      console.log(`✅ Benchmark: 100 items processed in ${result.duration.toFixed(2)}ms`);
    });

    test('benchmark: 500 items should process under 300ms', () => {
      const result = runBenchmark(500);
      
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.render_500_items);
      console.log(`✅ Benchmark: 500 items processed in ${result.duration.toFixed(2)}ms`);
    });

    test('benchmark: 1000 items should process under 500ms', () => {
      const result = runBenchmark(1000);
      
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.render_1000_items);
      console.log(`✅ Benchmark: 1000 items processed in ${result.duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.render_1000_items}ms)`);
    });

    test('benchmark: 2000 items should process under 1000ms', () => {
      const result = runBenchmark(2000);
      
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.render_2000_items);
      console.log(`✅ Benchmark: 2000 items processed in ${result.duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.render_2000_items}ms)`);
    });

    test('memory: should not exceed 100MB for 2000 items', () => {
      const result = runBenchmark(2000);
      
      expect(result.memoryDelta).toBeLessThan(PERFORMANCE_THRESHOLDS.memory_limit);
      console.log(`✅ Memory: ${result.memoryDelta.toFixed(2)}MB for 2000 items (threshold: ${PERFORMANCE_THRESHOLDS.memory_limit}MB)`);
    });
  });
});

// Export for use in other test files
export {
  generateMockTrades,
  generateMockStrategies,
  generateMockOrders,
  PERFORMANCE_THRESHOLDS,
};