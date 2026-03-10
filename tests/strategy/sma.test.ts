/**
 * SMA Strategy Tests
 * 
 * Tests for the SMA Crossover Strategy implementation
 */

import { SMAStrategy, SMAStrategyConfig } from '../../src/strategy/SMAStrategy';
import { StrategyContext, OrderSignal } from '../../src/strategy';
import { OrderBook } from '../../src/orderbook';
import { Portfolio } from '../../src/portfolio';

/**
 * Mock OrderBook for testing
 */
class MockOrderBook {
  private bestBidPrice: number;
  private bestAskPrice: number;

  constructor(bid: number, ask: number) {
    this.bestBidPrice = bid;
    this.bestAskPrice = ask;
  }

  getBestBid() {
    return { price: this.bestBidPrice, quantity: 100 };
  }

  getBestAsk() {
    return { price: this.bestAskPrice, quantity: 100 };
  }

  setPrices(bid: number, ask: number) {
    this.bestBidPrice = bid;
    this.bestAskPrice = ask;
  }
}

/**
 * Create mock context with configurable order book
 */
function createMockContext(orderBook: MockOrderBook): StrategyContext {
  return {
    portfolio: {
      cash: 100000,
      positions: [],
      totalValue: 100000,
      unrealizedPnL: 0,
      timestamp: Date.now()
    },
    clock: Date.now(),
    getMarketData: () => ({
      orderBook: orderBook as any,
      trades: [],
      timestamp: Date.now()
    }),
    getPosition: (symbol: string) => 0,
    getCash: () => 100000
  };
}

describe('SMAStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with default parameters', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-default',
        name: 'SMA Default Strategy'
      };
      const strategy = new SMAStrategy(config);
      
      expect(strategy).toBeDefined();
      // Strategy should work with defaults even if params are not explicitly set
      // Internal defaults: shortPeriod=5, longPeriod=20, tradeQuantity=10
    });

    test('should create strategy with custom parameters', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-custom',
        name: 'SMA Custom Strategy',
        params: {
          shortPeriod: 10,
          longPeriod: 50,
          tradeQuantity: 25
        }
      };
      const strategy = new SMAStrategy(config);
      
      expect(strategy.getConfig().params?.shortPeriod).toBe(10);
      expect(strategy.getConfig().params?.longPeriod).toBe(50);
      expect(strategy.getConfig().params?.tradeQuantity).toBe(25);
    });

    test('should throw error when short period >= long period', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-invalid',
        name: 'SMA Invalid Strategy',
        params: {
          shortPeriod: 20,
          longPeriod: 20
        }
      };
      
      expect(() => new SMAStrategy(config)).toThrow('Short period must be less than long period');
    });

    test('should throw error when periods are negative', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-negative',
        name: 'SMA Negative Strategy',
        params: {
          shortPeriod: -5,
          longPeriod: 20
        }
      };
      
      expect(() => new SMAStrategy(config)).toThrow('SMA periods must be positive');
    });
  });

  describe('SMA Calculation', () => {
    let strategy: SMAStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: SMAStrategyConfig = {
        id: 'sma-test',
        name: 'SMA Test Strategy',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      strategy = new SMAStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should calculate SMA correctly', () => {
      // Feed prices: 10, 20, 30, 40, 50
      const prices = [10, 20, 30, 40, 50];
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }
      
      // Short SMA (3 periods): (30 + 40 + 50) / 3 = 40
      // Long SMA (5 periods): (10 + 20 + 30 + 40 + 50) / 5 = 30
      expect(strategy.getShortSMA()).toBeCloseTo(40, 0);
      expect(strategy.getLongSMA()).toBeCloseTo(30, 0);
    });

    test('should not generate signal until long period is reached', () => {
      // Only feed 4 prices (less than long period of 5)
      for (let i = 0; i < 4; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        const signal = strategy.onTick(context);
        expect(signal).toBeNull();
      }
    });

    test('should track price history length', () => {
      expect(strategy.getPriceHistoryLength()).toBe(0);
      
      for (let i = 0; i < 10; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }
      
      expect(strategy.getPriceHistoryLength()).toBe(10);
    });
  });

  describe('Golden Cross (金叉)', () => {
    let strategy: SMAStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: SMAStrategyConfig = {
        id: 'sma-golden',
        name: 'SMA Golden Cross Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      strategy = new SMAStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate buy signal on golden cross', () => {
      // Create a scenario where short SMA crosses above long SMA
      // Prices: 10, 10, 10, 10, 10 (both SMAs = 10)
      // Then: 20, 30 (short SMA rises faster)
      
      const prices = [10, 10, 10, 10, 10, 20, 30];
      let goldenCrossSignal: OrderSignal | null = null;
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          goldenCrossSignal = signal;
        }
      }
      
      expect(goldenCrossSignal).not.toBeNull();
      expect(goldenCrossSignal!.side).toBe('buy');
      expect(goldenCrossSignal!.reason).toContain('Golden Cross');
    });

    test('should include confidence and reason in buy signal', () => {
      const prices = [10, 10, 10, 10, 10, 20, 30];
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          expect(signal.confidence).toBe(0.7);
          expect(signal.reason).toBeDefined();
          expect(signal.reason).toContain('SMA');
          break;
        }
      }
    });
  });

  describe('Death Cross (死叉)', () => {
    let strategy: SMAStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: SMAStrategyConfig = {
        id: 'sma-death',
        name: 'SMA Death Cross Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      strategy = new SMAStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate sell signal on death cross', () => {
      // Create a scenario where short SMA crosses below long SMA
      // Prices: 30, 30, 30, 30, 30 (both SMAs = 30)
      // Then: 20, 10 (short SMA falls faster)
      
      const prices = [30, 30, 30, 30, 30, 20, 10];
      let deathCrossSignal: OrderSignal | null = null;
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'sell') {
          deathCrossSignal = signal;
        }
      }
      
      expect(deathCrossSignal).not.toBeNull();
      expect(deathCrossSignal!.side).toBe('sell');
      expect(deathCrossSignal!.reason).toContain('Death Cross');
    });
  });

  describe('Signal Structure', () => {
    let strategy: SMAStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: SMAStrategyConfig = {
        id: 'sma-signal',
        name: 'SMA Signal Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5,
          tradeQuantity: 15
        }
      };
      strategy = new SMAStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate signal with correct quantity', () => {
      const prices = [10, 10, 10, 10, 10, 20, 30];
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal) {
          expect(signal.quantity).toBe(15);
          break;
        }
      }
    });

    test('should generate signal with valid structure', () => {
      const prices = [10, 10, 10, 10, 10, 20, 30];
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal) {
          expect(signal.id).toBeDefined();
          expect(signal.side).toBeDefined();
          expect(signal.price).toBeDefined();
          expect(signal.quantity).toBeDefined();
          expect(signal.timestamp).toBeDefined();
          break;
        }
      }
    });
  });

  describe('Reset Functionality', () => {
    let strategy: SMAStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: SMAStrategyConfig = {
        id: 'sma-reset',
        name: 'SMA Reset Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      strategy = new SMAStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should reset strategy state', () => {
      // Feed some prices
      for (let i = 0; i < 10; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }
      
      expect(strategy.getPriceHistoryLength()).toBe(10);
      expect(strategy.getShortSMA()).not.toBeNull();
      
      // Reset
      strategy.reset();
      
      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getShortSMA()).toBeNull();
      expect(strategy.getLongSMA()).toBeNull();
    });

    test('should work correctly after reset', () => {
      // First round
      for (let i = 0; i < 10; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }
      
      // Reset and start again
      strategy.reset();
      
      // Should not generate signals until long period is reached again
      for (let i = 0; i < 4; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        const signal = strategy.onTick(context);
        expect(signal).toBeNull();
      }
    });
  });

  describe('Backtesting Support', () => {
    test('should support multiple reset cycles for backtesting', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-backtest',
        name: 'SMA Backtest',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      const strategy = new SMAStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);
      
      // Run multiple backtest cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        strategy.onInit(context);
        
        // Feed prices
        for (let i = 0; i < 10; i++) {
          orderBook.setPrices(100 + i + (cycle * 10), 102 + i + (cycle * 10));
          strategy.onTick(context);
        }
        
        expect(strategy.getPriceHistoryLength()).toBe(10);
        strategy.reset();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty order book gracefully', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-edge',
        name: 'SMA Edge Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      const strategy = new SMAStrategy(config);
      
      const emptyOrderBook = {};
      const context: StrategyContext = {
        portfolio: {
          cash: 100000,
          positions: [],
          totalValue: 100000,
          unrealizedPnL: 0,
          timestamp: Date.now()
        },
        clock: Date.now(),
        getMarketData: () => ({
          orderBook: emptyOrderBook as any,
          trades: [],
          timestamp: Date.now()
        }),
        getPosition: (symbol: string) => 0,
        getCash: () => 100000
      };
      
      strategy.onInit(context);
      
      // Should not throw, just return null
      expect(() => strategy.onTick(context)).not.toThrow();
      expect(strategy.onTick(context)).toBeNull();
    });

    test('should handle rapid price changes', () => {
      const config: SMAStrategyConfig = {
        id: 'sma-rapid',
        name: 'SMA Rapid Test',
        params: {
          shortPeriod: 3,
          longPeriod: 5
        }
      };
      const strategy = new SMAStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);
      strategy.onInit(context);
      
      // Rapid price changes
      const prices = [100, 50, 150, 25, 200, 10, 250];
      
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        // Should not throw
        expect(signal === null || typeof signal === 'object').toBe(true);
      }
    });
  });
});
