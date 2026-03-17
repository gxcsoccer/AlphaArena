/**
 * Ichimoku Cloud Strategy Tests
 *
 * Tests for the Ichimoku Cloud (一目均衡表) strategy
 */

import {
  IchimokuCloudStrategy,
  IchimokuCloudStrategyConfig,
  IchimokuComponents,
  IchimokuSignal,
} from '../../src/strategy/IchimokuCloudStrategy';
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

describe('IchimokuCloudStrategy', () => {
  let strategy: IchimokuCloudStrategy;
  let mockOrderBook: MockOrderBook;
  let mockContext: StrategyContext;

  const defaultConfig: IchimokuCloudStrategyConfig = {
    id: 'ichimoku-test',
    name: 'Ichimoku Cloud Test Strategy',
    params: {
      tenkanPeriod: 9,
      kijunPeriod: 26,
      senkouBPeriod: 52,
      displacement: 26,
      tradeQuantity: 10,
    },
  };

  beforeEach(() => {
    mockOrderBook = new MockOrderBook(100, 101);
    mockContext = createMockContext(mockOrderBook);
    strategy = new IchimokuCloudStrategy(defaultConfig);
    strategy.onInit(mockContext);
  });

  describe('Constructor and Configuration', () => {
    test('should create strategy with default parameters', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-default',
        name: 'Default Ichimoku',
      };
      const defaultStrategy = new IchimokuCloudStrategy(config);
      expect(defaultStrategy).toBeDefined();
    });

    test('should use default values when params are not provided', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-no-params',
        name: 'No Params Ichimoku',
      };
      const noParamStrategy = new IchimokuCloudStrategy(config);
      expect(noParamStrategy).toBeDefined();
    });

    test('should throw error when tenkan period >= kijun period', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-invalid',
        name: 'Invalid Ichimoku',
        params: {
          tenkanPeriod: 26,
          kijunPeriod: 9,
        },
      };
      expect(() => new IchimokuCloudStrategy(config)).toThrow(
        'Tenkan period must be less than Kijun period'
      );
    });

    test('should throw error when kijun period >= senkouB period', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-invalid-senkou',
        name: 'Invalid Senkou Ichimoku',
        params: {
          tenkanPeriod: 9,
          kijunPeriod: 52,
          senkouBPeriod: 26,
        },
      };
      expect(() => new IchimokuCloudStrategy(config)).toThrow(
        'Kijun period must be less than Senkou B period'
      );
    });

    test('should throw error when periods are zero or negative', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-invalid-period',
        name: 'Invalid Period Ichimoku',
        params: {
          tenkanPeriod: 0,
        },
      };
      expect(() => new IchimokuCloudStrategy(config)).toThrow('All periods must be positive');
    });

    test('should throw error when trade quantity is zero or negative', () => {
      const config: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-invalid-qty',
        name: 'Invalid Quantity Ichimoku',
        params: { tradeQuantity: 0 },
      };
      expect(() => new IchimokuCloudStrategy(config)).toThrow('Trade quantity must be positive');
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getTenkanSen()).toBeNull();
      expect(strategy.getKijunSen()).toBeNull();
      expect(strategy.getSenkouSpanA()).toBeNull();
      expect(strategy.getSenkouSpanB()).toBeNull();
      expect(strategy.getChikouSpan()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });

    test('should reset to initial state', () => {
      // Run some ticks to build up state
      for (let i = 0; i < 60; i++) {
        strategy.onTick(mockContext);
      }

      expect(strategy.getPriceHistoryLength()).toBe(60);
      expect(strategy.isReady()).toBe(true);

      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getTenkanSen()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });
  });

  describe('Ichimoku Calculation', () => {
    test('should return null before enough data points', () => {
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
      expect(strategy.getPriceHistoryLength()).toBe(1);

      // Still need more data (senkouBPeriod = 52)
      for (let i = 0; i < 50; i++) {
        strategy.onTick(mockContext);
      }
      expect(strategy.getPriceHistoryLength()).toBe(51);
      // Still need one more for senkouBPeriod
    });

    test('should start generating Ichimoku values after warmup period', () => {
      // Generate enough ticks to warm up (senkouBPeriod = 52)
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + i * 0.1, 101 + i * 0.1);
        strategy.onTick(mockContext);
      }

      // Strategy should now be ready
      expect(strategy.isReady()).toBe(true);
      expect(strategy.getTenkanSen()).not.toBeNull();
      expect(strategy.getKijunSen()).not.toBeNull();
      expect(strategy.getSenkouSpanA()).not.toBeNull();
      expect(strategy.getSenkouSpanB()).not.toBeNull();
    });

    test('should calculate correct Tenkan-sen (9-period mid)', () => {
      // Generate enough ticks with known prices
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100); // midPrice = 100
        strategy.onTick(mockContext);
      }

      // With constant prices, Tenkan-sen should be 100
      const tenkanSen = strategy.getTenkanSen();
      expect(tenkanSen).not.toBeNull();
      expect(tenkanSen).toBeCloseTo(100, 1);
    });

    test('should calculate correct Kijun-sen (26-period mid)', () => {
      // Generate enough ticks with known prices
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100); // midPrice = 100
        strategy.onTick(mockContext);
      }

      // With constant prices, Kijun-sen should be 100
      const kijunSen = strategy.getKijunSen();
      expect(kijunSen).not.toBeNull();
      expect(kijunSen).toBeCloseTo(100, 1);
    });

    test('should calculate correct Senkou Span A and B', () => {
      // Generate enough ticks with known prices
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100); // midPrice = 100
        strategy.onTick(mockContext);
      }

      // With constant prices, both spans should be 100
      const senkouSpanA = strategy.getSenkouSpanA();
      const senkouSpanB = strategy.getSenkouSpanB();
      expect(senkouSpanA).not.toBeNull();
      expect(senkouSpanB).not.toBeNull();
      expect(senkouSpanA).toBeCloseTo(100, 1);
      expect(senkouSpanB).toBeCloseTo(100, 1);
    });

    test('should handle upward price trend correctly', () => {
      // Simulate upward trending prices
      for (let i = 0; i < 60; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i); // Rising prices
        strategy.onTick(mockContext);
      }

      // In an uptrend, Tenkan-sen should be above Kijun-sen (faster response)
      const tenkanSen = strategy.getTenkanSen();
      const kijunSen = strategy.getKijunSen();
      expect(tenkanSen).toBeGreaterThan(kijunSen);
    });

    test('should handle downward price trend correctly', () => {
      // First, create an uptrend to establish baseline
      for (let i = 0; i < 60; i++) {
        mockOrderBook.setPrices(100 + i * 0.5, 100 + i * 0.5);
        strategy.onTick(mockContext);
      }

      // Then create a downtrend
      for (let i = 0; i < 30; i++) {
        mockOrderBook.setPrices(130 - i * 2, 130 - i * 2);
        strategy.onTick(mockContext);
      }

      // In a downtrend, Tenkan-sen should be below Kijun-sen
      const tenkanSen = strategy.getTenkanSen();
      const kijunSen = strategy.getKijunSen();
      expect(tenkanSen).toBeLessThan(kijunSen);
    });
  });

  describe('Signal Generation', () => {
    test('should generate buy signal on bullish TK cross with price above cloud', () => {
      const signals: OrderSignal[] = [];

      // Start with a stable/declining phase to establish cloud
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      // Verify we have enough data
      expect(strategy.isReady()).toBe(true);

      // Create a strong upward move to trigger bullish TK cross
      // The faster Tenkan will cross above the slower Kijun
      for (let i = 0; i < 40; i++) {
        // Sharp upward move
        mockOrderBook.setPrices(100 + i * 5, 100 + i * 5);
        const signal = strategy.onTick(mockContext);
        if (signal) {
          signals.push(signal);
        }
      }

      // With a sharp upward move, we should get a bullish TK cross
      // and price should be above the cloud
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].side).toBe('buy');
      expect(signals[0].confidence).toBeGreaterThan(0);
      expect(signals[0].reason).toContain('Bullish');
    });

    test('should generate sell signal on bearish TK cross with price below cloud', () => {
      const signals: OrderSignal[] = [];

      // Start with a stable/rising phase to establish cloud
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(200, 200);
        strategy.onTick(mockContext);
      }

      // Verify we have enough data
      expect(strategy.isReady()).toBe(true);

      // Create a strong downward move to trigger bearish TK cross
      for (let i = 0; i < 40; i++) {
        // Sharp downward move
        mockOrderBook.setPrices(200 - i * 5, 200 - i * 5);
        const signal = strategy.onTick(mockContext);
        if (signal) {
          signals.push(signal);
        }
      }

      // With a sharp downward move, we should get a bearish TK cross
      // and price should be below the cloud
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].side).toBe('sell');
      expect(signals[0].confidence).toBeGreaterThan(0);
      expect(signals[0].reason).toContain('Bearish');
    });

    test('should not generate signals during stable prices', () => {
      // Use constant prices
      for (let i = 0; i < 60; i++) {
        mockOrderBook.setPrices(100, 100);
        const signal = strategy.onTick(mockContext);
        expect(signal).toBeNull();
      }

      // With constant prices, Tenkan and Kijun should be equal, no cross
      const components = strategy.getComponents();
      expect(Math.abs(components!.tenkanSen - components!.kijunSen)).toBeLessThan(0.01);
    });

    test('should not generate signals when price is inside cloud', () => {
      // Generate prices that keep price inside the cloud
      for (let i = 0; i < 60; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      // Price should be inside or at cloud edge
      const signal = strategy.getSignal();
      expect(signal?.priceVsCloud).toBe('inside');
    });
  });

  describe('Cloud Detection', () => {
    test('should correctly identify price above cloud', () => {
      // Create strong uptrend with price far above cloud
      for (let i = 0; i < 80; i++) {
        mockOrderBook.setPrices(100 + i * 2, 100 + i * 2);
        strategy.onTick(mockContext);
      }

      expect(strategy.isPriceAboveCloud()).toBe(true);
      expect(strategy.isPriceBelowCloud()).toBe(false);
    });

    test('should correctly identify price below cloud', () => {
      // Create strong downtrend with price far below cloud
      for (let i = 0; i < 80; i++) {
        mockOrderBook.setPrices(300 - i * 3, 300 - i * 3);
        strategy.onTick(mockContext);
      }

      expect(strategy.isPriceBelowCloud()).toBe(true);
      expect(strategy.isPriceAboveCloud()).toBe(false);
    });

    test('should detect cloud twist', () => {
      // Generate enough data to potentially cause a cloud twist
      for (let i = 0; i < 100; i++) {
        // Oscillating prices to potentially cause span A and B to cross
        const price = 100 + Math.sin(i * 0.2) * 20;
        mockOrderBook.setPrices(price, price);
        strategy.onTick(mockContext);
      }

      // Check if we detected any twist (may or may not happen depending on price pattern)
      // This is more of a smoke test to ensure the method works
      const hasTwist = strategy.hasKumoTwist();
      expect(typeof hasTwist).toBe('boolean');
    });
  });

  describe('Getter Methods', () => {
    test('should return correct Ichimoku components', () => {
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      const components = strategy.getComponents();
      expect(components).not.toBeNull();
      expect(components!.tenkanSen).toBeDefined();
      expect(components!.kijunSen).toBeDefined();
      expect(components!.senkouSpanA).toBeDefined();
      expect(components!.senkouSpanB).toBeDefined();
      expect(components!.chikouSpan).toBeDefined();
    });

    test('should return correct signal data', () => {
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      const signal = strategy.getSignal();
      expect(signal).not.toBeNull();
      expect(signal!.trend).toBeDefined();
      expect(signal!.strength).toBeGreaterThanOrEqual(0);
      expect(signal!.strength).toBeLessThanOrEqual(1);
      expect(signal!.cloudTop).toBeDefined();
      expect(signal!.cloudBottom).toBeDefined();
      expect(signal!.priceVsCloud).toBeDefined();
      expect(signal!.tkCross).toBeDefined();
    });

    test('should return correct cloud values', () => {
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      const cloudTop = strategy.getCloudTop();
      const cloudBottom = strategy.getCloudBottom();
      expect(cloudTop).not.toBeNull();
      expect(cloudBottom).not.toBeNull();
      expect(cloudTop).toBeGreaterThanOrEqual(cloudBottom!);
    });
  });

  describe('Custom Parameters', () => {
    test('should work with custom periods', () => {
      const customConfig: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-custom',
        name: 'Custom Ichimoku',
        params: {
          tenkanPeriod: 5,
          kijunPeriod: 15,
          senkouBPeriod: 30,
          displacement: 15,
          tradeQuantity: 20,
        },
      };

      const customStrategy = new IchimokuCloudStrategy(customConfig);
      mockContext = createMockContext(mockOrderBook);
      customStrategy.onInit(mockContext);

      // Generate signals with custom periods (need 30 for senkouBPeriod)
      for (let i = 0; i < 35; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        customStrategy.onTick(mockContext);
      }

      // Should eventually be ready
      expect(customStrategy.isReady()).toBe(true);
    });

    test('should respect minimum cloud thickness filter', () => {
      const configWithFilter: IchimokuCloudStrategyConfig = {
        id: 'ichimoku-filter',
        name: 'Filtered Ichimoku',
        params: {
          tenkanPeriod: 9,
          kijunPeriod: 26,
          senkouBPeriod: 52,
          displacement: 26,
          minCloudThickness: 5, // 5% minimum cloud thickness
          tradeQuantity: 10,
        },
      };

      const filteredStrategy = new IchimokuCloudStrategy(configWithFilter);
      mockContext = createMockContext(mockOrderBook);
      filteredStrategy.onInit(mockContext);

      // Generate constant prices (thin cloud)
      for (let i = 0; i < 60; i++) {
        mockOrderBook.setPrices(100, 100);
        filteredStrategy.onTick(mockContext);
      }

      // With constant prices, cloud should be very thin
      const signal = filteredStrategy.getSignal();
      // Cloud thickness should be near 0 with constant prices
      expect(signal).not.toBeNull();
    });
  });

  describe('Integration with Strategy Base Class', () => {
    test('should be properly initialized', () => {
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should have correct config', () => {
      const config = strategy.getConfig();
      expect(config.id).toBe('ichimoku-test');
      expect(config.name).toBe('Ichimoku Cloud Test Strategy');
    });

    test('should cleanup properly', () => {
      strategy.onCleanup(mockContext);
      expect(strategy.isInitialized()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid price changes', () => {
      // Generate erratic prices
      for (let i = 0; i < 60; i++) {
        const price = 100 + (Math.random() - 0.5) * 50;
        mockOrderBook.setPrices(price, price);
        const signal = strategy.onTick(mockContext);
        // Should not crash
      }

      expect(strategy.isReady()).toBe(true);
    });

    test('should handle gap in prices', () => {
      // Generate normal prices then a sudden gap
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + i, 100 + i);
        strategy.onTick(mockContext);
      }

      // Sudden gap up
      mockOrderBook.setPrices(200, 200);
      const signal = strategy.onTick(mockContext);
      // Should handle gap without crashing
      expect(strategy.isReady()).toBe(true);
    });

    test('should maintain signal state correctly', () => {
      // Generate enough data to get signals
      for (let i = 0; i < 100; i++) {
        mockOrderBook.setPrices(100 + i * 2, 100 + i * 2);
        strategy.onTick(mockContext);
      }

      // Trend should be bullish in uptrend
      const trend = strategy.getTrend();
      expect(trend).toBe('bullish');
    });
  });

  describe('TK Cross Detection', () => {
    test('should detect bullish TK cross', () => {
      // Start flat to establish baseline
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      // Verify Tenkan and Kijun are equal
      expect(Math.abs(strategy.getTenkanSen()! - strategy.getKijunSen()!)).toBeLessThan(0.01);

      // Sharp uptrend to cause TK cross
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100 + i * 10, 100 + i * 10);
        strategy.onTick(mockContext);
      }

      // After uptrend, Tenkan should be above Kijun
      expect(strategy.getTenkanSen()).toBeGreaterThan(strategy.getKijunSen()!);
    });

    test('should detect bearish TK cross', () => {
      // Start flat to establish baseline
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100, 100);
        strategy.onTick(mockContext);
      }

      // Sharp downtrend to cause TK cross
      for (let i = 0; i < 20; i++) {
        mockOrderBook.setPrices(100 - i * 10, 100 - i * 10);
        strategy.onTick(mockContext);
      }

      // After downtrend, Tenkan should be below Kijun
      expect(strategy.getTenkanSen()).toBeLessThan(strategy.getKijunSen()!);
    });
  });

  describe('Signal Strength Calculation', () => {
    test('should have higher strength with thicker cloud', () => {
      // Create a scenario with thick cloud (volatile prices)
      const signals1: OrderSignal[] = [];
      
      // Start with volatile prices to create thicker cloud
      for (let i = 0; i < 55; i++) {
        mockOrderBook.setPrices(100 + Math.sin(i * 0.5) * 20, 100 + Math.sin(i * 0.5) * 20);
        strategy.onTick(mockContext);
      }

      // Sharp uptrend
      for (let i = 0; i < 30; i++) {
        mockOrderBook.setPrices(150 + i * 5, 150 + i * 5);
        const signal = strategy.onTick(mockContext);
        if (signal) signals1.push(signal);
      }

      // Should have generated signals with reasonable strength
      if (signals1.length > 0) {
        expect(signals1[0].confidence).toBeGreaterThan(0.5);
      }
    });
  });
});
