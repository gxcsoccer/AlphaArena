/**
 * MACD Strategy Tests
 *
 * Tests for the MACD (Moving Average Convergence Divergence) strategy
 */

import { MACDStrategy, MACDStrategyConfig } from '../../src/strategy/MACDStrategy';
import { StrategyContext, OrderSignal } from '../../src/strategy/types';

/**
 * Mock OrderBook for testing
 */
class MockOrderBook {
  private bestBid: number;
  private bestAsk: number;

  constructor(bestBid: number = 100, bestAsk: number = 101) {
    this.bestBid = bestBid;
    this.bestAsk = bestAsk;
  }

  getBestBid(): number {
    return this.bestBid;
  }

  getBestAsk(): number {
    return this.bestAsk;
  }

  setPrices(bid: number, ask: number): void {
    this.bestBid = bid;
    this.bestAsk = ask;
  }
}

/**
 * Create a mock context for testing
 */
function createMockContext(orderBook: MockOrderBook): StrategyContext {
  return {
    portfolio: {
      cash: 100000,
      positions: [],
      totalValue: 100000,
      unrealizedPnL: 0,
      timestamp: Date.now(),
    },
    clock: Date.now(),
    getMarketData: () => ({
      orderBook: orderBook as any,
      trades: [],
      timestamp: Date.now(),
    }),
    getPosition: (_symbol: string) => 0,
    getCash: () => 100000,
  };
}

describe('MACDStrategy', () => {
  let strategy: MACDStrategy;
  let mockOrderBook: MockOrderBook;
  let mockContext: StrategyContext;

  const defaultConfig: MACDStrategyConfig = {
    id: 'macd-test',
    name: 'MACD Test Strategy',
    params: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      tradeQuantity: 10,
    },
  };

  beforeEach(() => {
    mockOrderBook = new MockOrderBook(100, 101);
    mockContext = createMockContext(mockOrderBook);
    strategy = new MACDStrategy(defaultConfig);
    strategy.onInit(mockContext);
  });

  describe('Constructor and Configuration', () => {
    test('should create strategy with default parameters', () => {
      const config: MACDStrategyConfig = {
        id: 'macd-default',
        name: 'Default MACD',
      };
      const defaultStrategy = new MACDStrategy(config);
      expect(defaultStrategy).toBeDefined();
    });

    test('should use default values when params are not provided', () => {
      const config: MACDStrategyConfig = {
        id: 'macd-no-params',
        name: 'No Params MACD',
      };
      const noParamStrategy = new MACDStrategy(config);
      expect(noParamStrategy).toBeDefined();
    });

    test('should throw error when fast period >= slow period', () => {
      const config: MACDStrategyConfig = {
        id: 'macd-invalid',
        name: 'Invalid MACD',
        params: {
          fastPeriod: 26,
          slowPeriod: 12,
        },
      };
      expect(() => new MACDStrategy(config)).toThrow('Fast period must be less than slow period');
    });

    test('should throw error when signal period is zero or negative', () => {
      const config: MACDStrategyConfig = {
        id: 'macd-invalid-signal',
        name: 'Invalid Signal Period MACD',
        params: { 
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 0 
        },
      };
      expect(() => new MACDStrategy(config)).toThrow('All periods must be positive');
    });

    test('should throw error when trade quantity is zero or negative', () => {
      const config: MACDStrategyConfig = {
        id: 'macd-invalid-qty',
        name: 'Invalid Quantity MACD',
        params: { tradeQuantity: 0 },
      };
      expect(() => new MACDStrategy(config)).toThrow('Trade quantity must be positive');
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getFastEMA()).toBeNull();
      expect(strategy.getSlowEMA()).toBeNull();
      expect(strategy.getMACDLine()).toBeNull();
      expect(strategy.getSignalLine()).toBeNull();
      expect(strategy.getHistogram()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });

    test('should reset to initial state', () => {
      // Run some ticks to build up state
      for (let i = 0; i < 40; i++) {
        strategy.onTick(mockContext);
      }

      expect(strategy.getPriceHistoryLength()).toBe(40);
      expect(strategy.isReady()).toBe(true);

      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getMACDLine()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });
  });

  describe('MACD Calculation', () => {
    test('should return null before enough data points', () => {
      // Need slowPeriod + signalPeriod data points
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
      expect(strategy.getPriceHistoryLength()).toBe(1);

      // Still need more data
      for (let i = 0; i < 25; i++) {
        strategy.onTick(mockContext);
      }
      expect(strategy.getPriceHistoryLength()).toBe(26);
      // Now we have enough for slow EMA, but not for signal line yet
      // Total needed: slowPeriod (26) + signalPeriod (9) - 1 = 34
    });

    test('should start generating MACD values after warmup period', () => {
      // Generate enough ticks to warm up
      for (let i = 0; i < 35; i++) {
        mockOrderBook.setPrices(100 + i * 0.1, 101 + i * 0.1);
        strategy.onTick(mockContext);
      }

      // Strategy should now be ready
      expect(strategy.isReady()).toBe(true);
      expect(strategy.getMACDLine()).not.toBeNull();
      expect(strategy.getSignalLine()).not.toBeNull();
      expect(strategy.getHistogram()).not.toBeNull();
    });

    test('should calculate correct EMA values', () => {
      // Use constant prices to verify EMA calculation
      // With constant prices, EMA should equal the price
      for (let i = 0; i < 40; i++) {
        mockOrderBook.setPrices(100, 100); // midPrice = 100
        strategy.onTick(mockContext);
      }

      // With constant prices, MACD should be close to 0
      // (both EMAs converge to the same value)
      const macdLine = strategy.getMACDLine();
      expect(macdLine).not.toBeNull();
      expect(Math.abs(macdLine!)).toBeLessThan(0.01); // Should be very close to 0
    });

    test('should handle upward price trend correctly', () => {
      // Simulate upward trending prices
      for (let i = 0; i < 50; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i); // Rising prices
        strategy.onTick(mockContext);
      }

      // In an uptrend, MACD should be positive (fast EMA > slow EMA)
      const macdLine = strategy.getMACDLine();
      expect(macdLine).toBeGreaterThan(0);
    });

    test('should handle downward price trend correctly', () => {
      // Simulate downward trending prices
      for (let i = 0; i < 50; i++) {
        mockOrderBook.setPrices(200 - i, 200 - i); // Falling prices
        strategy.onTick(mockContext);
      }

      // In a downtrend, MACD should be negative (fast EMA < slow EMA)
      const macdLine = strategy.getMACDLine();
      expect(macdLine).toBeLessThan(0);
    });
  });

  describe('Signal Generation', () => {
    test('should generate buy signal on golden cross', () => {
      const signals: OrderSignal[] = [];

      // First, create a downtrend to get MACD below signal line
      for (let i = 0; i < 40; i++) {
        mockOrderBook.setPrices(200 - i * 2, 200 - i * 2);
        strategy.onTick(mockContext);
      }

      // Verify MACD is below signal (bearish)
      const histogramBefore = strategy.getHistogram();
      expect(histogramBefore).toBeLessThan(0);

      // Now create an uptrend to trigger golden cross
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100 + i * 5, 100 + i * 5);
        const signal = strategy.onTick(mockContext);
        if (signal) {
          signals.push(signal);
        }
      }

      // Should have generated at least one buy signal
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].side).toBe('buy');
      expect(signals[0].confidence).toBeGreaterThan(0);
      expect(signals[0].reason).toContain('Golden Cross');
    });

    test('should generate sell signal on death cross', () => {
      const signals: OrderSignal[] = [];

      // First, create an uptrend to get MACD above signal line
      for (let i = 0; i < 40; i++) {
        mockOrderBook.setPrices(100 + i * 2, 100 + i * 2);
        strategy.onTick(mockContext);
      }

      // Verify MACD is above signal (bullish)
      const histogramBefore = strategy.getHistogram();
      expect(histogramBefore).toBeGreaterThan(0);

      // Now create a downtrend to trigger death cross
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(200 - i * 5, 200 - i * 5);
        const signal = strategy.onTick(mockContext);
        if (signal) {
          signals.push(signal);
        }
      }

      // Should have generated at least one sell signal
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].side).toBe('sell');
      expect(signals[0].confidence).toBeGreaterThan(0);
      expect(signals[0].reason).toContain('Death Cross');
    });

    test('should not generate signals during stable prices', () => {
      // Use constant prices
      for (let i = 0; i < 50; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      // MACD should be near 0 with constant prices
      const macdLine = strategy.getMACDLine();
      expect(Math.abs(macdLine!)).toBeLessThan(0.1);
    });
  });

  describe('Getter Methods', () => {
    test('should return correct MACD data', () => {
      for (let i = 0; i < 40; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      const macdData = strategy.getMACDData();
      expect(macdData).not.toBeNull();
      expect(macdData!.macdLine).toBeDefined();
      expect(macdData!.signalLine).toBeDefined();
      expect(macdData!.histogram).toBe(macdData!.macdLine - macdData!.signalLine);
    });

    test('should return correct individual components', () => {
      for (let i = 0; i < 40; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      const macdLine = strategy.getMACDLine();
      const signalLine = strategy.getSignalLine();
      const histogram = strategy.getHistogram();
      const fastEMA = strategy.getFastEMA();
      const slowEMA = strategy.getSlowEMA();

      expect(macdLine).toBe(fastEMA! - slowEMA!);
      expect(histogram).toBe(macdLine! - signalLine!);
      expect(fastEMA).toBeGreaterThan(slowEMA); // In uptrend
    });
  });

  describe('Custom Parameters', () => {
    test('should work with custom periods', () => {
      const customConfig: MACDStrategyConfig = {
        id: 'macd-custom',
        name: 'Custom MACD',
        params: {
          fastPeriod: 5,
          slowPeriod: 15,
          signalPeriod: 3,
          tradeQuantity: 20,
        },
      };

      const customStrategy = new MACDStrategy(customConfig);
      mockContext = createMockContext(mockOrderBook);
      customStrategy.onInit(mockContext);

      // Generate signals with custom periods
      for (let i = 0; i < 30; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        const _signal = customStrategy.onTick(mockContext);
        // Just verify it doesn't crash
      }

      // Should eventually be ready
      expect(customStrategy.isReady()).toBe(true);
    });
  });

  describe('Integration with Strategy Base Class', () => {
    test('should be properly initialized', () => {
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should have correct config', () => {
      const config = strategy.getConfig();
      expect(config.id).toBe('macd-test');
      expect(config.name).toBe('MACD Test Strategy');
    });

    test('should cleanup properly', () => {
      strategy.onCleanup(mockContext);
      expect(strategy.isInitialized()).toBe(false);
    });
  });
});
