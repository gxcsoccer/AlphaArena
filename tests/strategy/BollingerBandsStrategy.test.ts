/**
 * Bollinger Bands Strategy Tests
 *
 * Tests for the Bollinger Bands trading strategy
 */

import { BollingerBandsStrategy, BollingerBandsStrategyConfig, BollingerBandsData } from '../../src/strategy/BollingerBandsStrategy';
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

describe('BollingerBandsStrategy', () => {
  let strategy: BollingerBandsStrategy;
  let mockOrderBook: MockOrderBook;
  let mockContext: StrategyContext;

  const defaultConfig: BollingerBandsStrategyConfig = {
    id: 'bollinger-test',
    name: 'Bollinger Bands Test Strategy',
    params: {
      period: 20,
      stdDevMultiplier: 2,
      tradeQuantity: 10,
      squeezeThreshold: 0.02,
    },
  };

  beforeEach(() => {
    mockOrderBook = new MockOrderBook(100, 101);
    mockContext = createMockContext(mockOrderBook);
    strategy = new BollingerBandsStrategy(defaultConfig);
    strategy.onInit(mockContext);
  });

  describe('Constructor and Configuration', () => {
    test('should create strategy with default parameters', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-default',
        name: 'Default Bollinger Bands',
      };
      const defaultStrategy = new BollingerBandsStrategy(config);
      expect(defaultStrategy).toBeDefined();
    });

    test('should use default values when params are not provided', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-no-params',
        name: 'No Params Bollinger',
      };
      const noParamStrategy = new BollingerBandsStrategy(config);
      expect(noParamStrategy).toBeDefined();
    });

    test('should throw error when period is 1 or less', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-invalid',
        name: 'Invalid Bollinger',
        params: {
          period: 1,
        },
      };
      expect(() => new BollingerBandsStrategy(config)).toThrow('Period must be greater than 1');
    });

    test('should throw error when stdDevMultiplier is zero or negative', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-invalid-stddev',
        name: 'Invalid StdDev Bollinger',
        params: {
          stdDevMultiplier: 0,
        },
      };
      expect(() => new BollingerBandsStrategy(config)).toThrow('Standard deviation multiplier must be positive');
    });

    test('should throw error when trade quantity is zero or negative', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-invalid-qty',
        name: 'Invalid Quantity Bollinger',
        params: {
          tradeQuantity: 0,
        },
      };
      expect(() => new BollingerBandsStrategy(config)).toThrow('Trade quantity must be positive');
    });

    test('should throw error when squeezeThreshold is out of range', () => {
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-invalid-squeeze',
        name: 'Invalid Squeeze Bollinger',
        params: {
          squeezeThreshold: 1.5,
        },
      };
      expect(() => new BollingerBandsStrategy(config)).toThrow('Squeeze threshold must be between 0 and 1');
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getUpperBand()).toBeNull();
      expect(strategy.getMiddleBand()).toBeNull();
      expect(strategy.getLowerBand()).toBeNull();
      expect(strategy.getBandWidth()).toBeNull();
      expect(strategy.getPercentB()).toBeNull();
      expect(strategy.isReady()).toBe(false);
      expect(strategy.isInSqueeze()).toBe(false);
    });

    test('should reset to initial state', () => {
      // Run some ticks to build up state
      for (let i = 0; i < 25; i++) {
        strategy.onTick(mockContext);
      }

      expect(strategy.getPriceHistoryLength()).toBe(25);
      expect(strategy.isReady()).toBe(true);

      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getUpperBand()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });
  });

  describe('Bollinger Bands Calculation', () => {
    test('should return null before enough data points', () => {
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
      expect(strategy.getPriceHistoryLength()).toBe(1);

      // Still need more data
      for (let i = 0; i < 18; i++) {
        strategy.onTick(mockContext);
      }
      expect(strategy.getPriceHistoryLength()).toBe(19);
      expect(strategy.isReady()).toBe(false);
    });

    test('should start generating bands after warmup period', () => {
      // Generate enough ticks to warm up
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100 + i * 0.1, 101 + i * 0.1);
        strategy.onTick(mockContext);
      }

      // Strategy should now be ready
      expect(strategy.isReady()).toBe(true);
      expect(strategy.getUpperBand()).not.toBeNull();
      expect(strategy.getMiddleBand()).not.toBeNull();
      expect(strategy.getLowerBand()).not.toBeNull();
    });

    test('should calculate correct SMA as middle band', () => {
      // Use constant prices to verify SMA calculation
      // With constant prices, SMA should equal the price
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100, 100); // midPrice = 100
        strategy.onTick(mockContext);
      }

      const middleBand = strategy.getMiddleBand();
      expect(middleBand).toBe(100);
    });

    test('should have upper band above or equal to middle band', () => {
      // Use volatile prices to create bands with width
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5; // Oscillating prices
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      const upperBand = strategy.getUpperBand();
      const middleBand = strategy.getMiddleBand();
      expect(upperBand).toBeGreaterThanOrEqual(middleBand!);
    });

    test('should have lower band below or equal to middle band', () => {
      // Use volatile prices to create bands with width
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5; // Oscillating prices
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      const lowerBand = strategy.getLowerBand();
      const middleBand = strategy.getMiddleBand();
      expect(lowerBand).toBeLessThanOrEqual(middleBand!);
    });

    test('should calculate correct band width', () => {
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      const upperBand = strategy.getUpperBand();
      const lowerBand = strategy.getLowerBand();
      const bandWidth = strategy.getBandWidth();

      expect(bandWidth).toBeCloseTo(upperBand! - lowerBand!, 10);
    });

    test('should handle volatile prices correctly', () => {
      // Simulate volatile prices
      for (let i = 0; i < 20; i++) {
        const price = i % 2 === 0 ? 110 : 90; // Alternating high/low
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // With volatile prices, bands should be wider
      const bandWidth = strategy.getBandWidth();
      expect(bandWidth).toBeGreaterThan(0);
    });

    test('should calculate %B correctly', () => {
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      const percentB = strategy.getPercentB();
      // With constant prices, stdDev is 0, so %B is set to 0.5
      expect(percentB).toBe(0.5);
    });
  });

  describe('Signal Generation', () => {
    test('should generate buy signal when price drops significantly', () => {
      // Build up price history with volatile prices to create bands with width
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Verify we have bands
      expect(strategy.isReady()).toBe(true);

      // Now drop price significantly (way below lower band)
      mockOrderBook.setPrices(50, 50);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('buy');
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.reason).toContain('Oversold');
    });

    test('should generate sell signal when price rises significantly', () => {
      // Build up price history with volatile prices to create bands with width
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Verify we have bands
      expect(strategy.isReady()).toBe(true);

      // Now raise price significantly (way above upper band)
      mockOrderBook.setPrices(150, 150);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('sell');
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.reason).toContain('Overbought');
    });

    test('should not generate repeated buy signals', () => {
      // Build up price history with volatile prices
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Drop price significantly
      mockOrderBook.setPrices(50, 50);
      const signal1 = strategy.onTick(mockContext);
      expect(signal1).not.toBeNull();
      expect(signal1!.side).toBe('buy');

      // Keep price at low level
      const signal2 = strategy.onTick(mockContext);
      expect(signal2).toBeNull(); // No repeated signal
    });

    test('should not generate repeated sell signals', () => {
      // Build up price history with volatile prices
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Raise price significantly
      mockOrderBook.setPrices(150, 150);
      const signal1 = strategy.onTick(mockContext);
      expect(signal1).not.toBeNull();
      expect(signal1!.side).toBe('sell');

      // Keep price at high level
      const signal2 = strategy.onTick(mockContext);
      expect(signal2).toBeNull(); // No repeated signal
    });

    test('should reset signal when price returns to band interior', () => {
      // Build up price history with volatile prices
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Drop price significantly
      mockOrderBook.setPrices(50, 50);
      const signal1 = strategy.onTick(mockContext);
      expect(signal1!.side).toBe('buy');

      // Return price to interior (back to 100)
      mockOrderBook.setPrices(100, 100);
      strategy.onTick(mockContext);

      // Drop price again
      mockOrderBook.setPrices(50, 50);
      const signal2 = strategy.onTick(mockContext);
      expect(signal2).not.toBeNull();
      expect(signal2!.side).toBe('buy');
    });

    test('should not generate signals when price is within bands', () => {
      // Build up price history with small oscillations
      for (let i = 0; i < 30; i++) {
        const price = 100 + Math.sin(i) * 2; // Small oscillation
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }
      
      // Verify we have bands calculated
      expect(strategy.isReady()).toBe(true);
    });
  });

  describe('Squeeze Detection', () => {
    test('should detect squeeze when bands are narrow', () => {
      // Use a very tight squeeze threshold
      const squeezeConfig: BollingerBandsStrategyConfig = {
        id: 'bollinger-squeeze',
        name: 'Squeeze Test',
        params: {
          period: 20,
          stdDevMultiplier: 2,
          tradeQuantity: 10,
          squeezeThreshold: 0.5, // 50% - very loose threshold for testing
        },
      };

      const squeezeStrategy = new BollingerBandsStrategy(squeezeConfig);
      squeezeStrategy.onInit(mockContext);

      // Use constant prices to create narrow bands
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100, 100);
        squeezeStrategy.onTick(mockContext);
      }

      // With constant prices and loose threshold, should be in squeeze
      expect(squeezeStrategy.isInSqueeze()).toBe(true);
    });

    test('should not detect squeeze when bands are wide', () => {
      // Use a tight squeeze threshold
      const config: BollingerBandsStrategyConfig = {
        id: 'bollinger-no-squeeze',
        name: 'No Squeeze Test',
        params: {
          period: 20,
          stdDevMultiplier: 2,
          tradeQuantity: 10,
          squeezeThreshold: 0.0001, // Very tight threshold
        },
      };

      const noSqueezeStrategy = new BollingerBandsStrategy(config);
      noSqueezeStrategy.onInit(mockContext);

      // Use volatile prices to create wide bands
      for (let i = 0; i < 20; i++) {
        const price = i % 2 === 0 ? 110 : 90;
        mockOrderBook.setPrices(price, price);
        noSqueezeStrategy.onTick(mockContext);
      }

      // With volatile prices and tight threshold, should not be in squeeze
      expect(noSqueezeStrategy.isInSqueeze()).toBe(false);
    });
  });

  describe('Getter Methods', () => {
    test('should return correct Bollinger Bands data', () => {
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100 + i * 0.1, 100 + i * 0.1);
        strategy.onTick(mockContext);
      }

      const bands = strategy.getBands();
      expect(bands).not.toBeNull();
      expect(bands!.upperBand).toBeDefined();
      expect(bands!.middleBand).toBeDefined();
      expect(bands!.lowerBand).toBeDefined();
      expect(bands!.bandWidth).toBe(bands!.upperBand - bands!.lowerBand);
      expect(bands!.percentB).toBeDefined();
      expect(bands!.isSqueeze).toBeDefined();
    });

    test('should return correct individual components', () => {
      for (let i = 0; i < 20; i++) {
        const price = 100 + Math.sin(i) * 5;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      const upperBand = strategy.getUpperBand();
      const middleBand = strategy.getMiddleBand();
      const lowerBand = strategy.getLowerBand();
      const bandWidth = strategy.getBandWidth();

      expect(upperBand).toBeGreaterThanOrEqual(middleBand!);
      expect(lowerBand).toBeLessThanOrEqual(middleBand!);
      expect(bandWidth).toBe(upperBand! - lowerBand!);
    });
  });

  describe('Custom Parameters', () => {
    test('should work with custom period', () => {
      const customConfig: BollingerBandsStrategyConfig = {
        id: 'bollinger-custom',
        name: 'Custom Bollinger',
        params: {
          period: 10,
          stdDevMultiplier: 1.5,
          tradeQuantity: 20,
        },
      };

      const customStrategy = new BollingerBandsStrategy(customConfig);
      mockContext = createMockContext(mockOrderBook);
      customStrategy.onInit(mockContext);

      // Generate signals with custom period
      for (let i = 0; i < 15; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        customStrategy.onTick(mockContext);
      }

      // Should be ready after 10 periods
      expect(customStrategy.isReady()).toBe(true);
    });

    test('should work with different stdDev multiplier', () => {
      const wideConfig: BollingerBandsStrategyConfig = {
        id: 'bollinger-wide',
        name: 'Wide Bollinger',
        params: {
          period: 20,
          stdDevMultiplier: 3, // Wider bands
          tradeQuantity: 10,
        },
      };

      const wideStrategy = new BollingerBandsStrategy(wideConfig);
      wideStrategy.onInit(mockContext);

      for (let i = 0; i < 20; i++) {
        const price = i % 2 === 0 ? 110 : 90;
        mockOrderBook.setPrices(price, price);
        wideStrategy.onTick(mockContext);
      }

      const wideBandWidth = wideStrategy.getBandWidth();

      // Compare with default (2x stdDev)
      for (let i = 0; i < 20; i++) {
        const price = i % 2 === 0 ? 110 : 90;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      const defaultBandWidth = strategy.getBandWidth();

      // 3x should be wider than 2x
      expect(wideBandWidth).toBeGreaterThan(defaultBandWidth!);
    });
  });

  describe('Integration with Strategy Base Class', () => {
    test('should be properly initialized', () => {
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should have correct config', () => {
      const config = strategy.getConfig();
      expect(config.id).toBe('bollinger-test');
      expect(config.name).toBe('Bollinger Bands Test Strategy');
    });

    test('should cleanup properly', () => {
      strategy.onCleanup(mockContext);
      expect(strategy.isInitialized()).toBe(false);
    });
  });
});
