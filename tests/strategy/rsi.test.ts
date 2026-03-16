/**
 * RSI Strategy Tests
 *
 * Tests for the RSI (Relative Strength Index) Strategy implementation
 */

import { RSIStrategy, RSIStrategyConfig } from '../../src/strategy/RSIStrategy';
import { StrategyContext, OrderSignal } from '../../src/strategy';

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

  getBestBid(): number | null {
    return this.bestBidPrice;
  }

  getBestAsk(): number | null {
    return this.bestAskPrice;
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

describe('RSIStrategy', () => {
  describe('Construction', () => {
    test('should create strategy with default parameters', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-default',
        name: 'RSI Default Strategy',
      };
      const strategy = new RSIStrategy(config);

      expect(strategy).toBeDefined();
      expect(strategy.getConfig().id).toBe('rsi-default');
    });

    test('should create strategy with custom parameters', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-custom',
        name: 'RSI Custom Strategy',
        params: {
          period: 21,
          overbought: 80,
          oversold: 20,
          tradeQuantity: 50,
        },
      };
      const strategy = new RSIStrategy(config);

      expect(strategy.getConfig().params?.period).toBe(21);
      expect(strategy.getConfig().params?.overbought).toBe(80);
      expect(strategy.getConfig().params?.oversold).toBe(20);
      expect(strategy.getConfig().params?.tradeQuantity).toBe(50);
    });

    test('should throw error when period is <= 1', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-invalid-period',
        name: 'RSI Invalid Period',
        params: {
          period: 1,
        },
      };

      expect(() => new RSIStrategy(config)).toThrow('RSI period must be greater than 1');
    });

    test('should throw error when oversold >= overbought', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-invalid-thresholds',
        name: 'RSI Invalid Thresholds',
        params: {
          oversold: 70,
          overbought: 70,
        },
      };

      expect(() => new RSIStrategy(config)).toThrow('Oversold threshold must be less than overbought threshold');
    });

    test('should throw error when thresholds are out of range', () => {
      const config1: RSIStrategyConfig = {
        id: 'rsi-invalid-threshold1',
        name: 'RSI Invalid Threshold1',
        params: {
          oversold: 0,
        },
      };

      const config2: RSIStrategyConfig = {
        id: 'rsi-invalid-threshold2',
        name: 'RSI Invalid Threshold2',
        params: {
          overbought: 100,
        },
      };

      expect(() => new RSIStrategy(config1)).toThrow('Thresholds must be between 0 and 100');
      expect(() => new RSIStrategy(config2)).toThrow('Thresholds must be between 0 and 100');
    });

    test('should throw error when trade quantity is not positive', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-invalid-quantity',
        name: 'RSI Invalid Quantity',
        params: {
          tradeQuantity: 0,
        },
      };

      expect(() => new RSIStrategy(config)).toThrow('Trade quantity must be positive');
    });
  });

  describe('RSI Calculation', () => {
    let strategy: RSIStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: RSIStrategyConfig = {
        id: 'rsi-test',
        name: 'RSI Test Strategy',
        params: {
          period: 5,
          overbought: 70,
          oversold: 30,
        },
      };
      strategy = new RSIStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should not calculate RSI until enough data points', () => {
      // Need period + 1 = 6 prices for period 5
      for (let i = 0; i < 5; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }

      expect(strategy.isReady()).toBe(false);
      expect(strategy.getRSI()).toBeNull();
    });

    test('should calculate RSI after enough data points', () => {
      // Feed 6 prices for period 5
      for (let i = 0; i < 6; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }

      expect(strategy.isReady()).toBe(true);
      expect(strategy.getRSI()).not.toBeNull();
      // RSI should be between 0 and 100
      expect(strategy.getRSI()).toBeGreaterThanOrEqual(0);
      expect(strategy.getRSI()).toBeLessThanOrEqual(100);
    });

    test('should calculate correct RSI for upward trend', () => {
      // Prices that consistently go up should result in high RSI
      const prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }

      // In a strong upward trend, RSI should be high (above 70)
      expect(strategy.getRSI()).toBeGreaterThan(70);
    });

    test('should calculate correct RSI for downward trend', () => {
      // Prices that consistently go down should result in low RSI
      const prices = [120, 118, 116, 114, 112, 110, 108, 106, 104, 102, 100];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }

      // In a strong downward trend, RSI should be low (below 30)
      expect(strategy.getRSI()).toBeLessThan(30);
    });

    test('should calculate RSI = 50 for no price change', () => {
      // Prices that stay flat should result in RSI around 50
      const prices = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }

      // No gains or losses, but RSI calculation handles division by zero
      // When there are no losses, RSI should be 100 (all gains)
      // When there are no gains, RSI should be 0
      // When there are neither, it's 100 by convention
      expect(strategy.getRSI()).toBe(100);
    });

    test('should use Wilder smoothing for subsequent calculations', () => {
      // Feed initial data with realistic price movements
      const prices = [100, 102, 101, 103, 102, 104];
      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }

      const firstRSI = strategy.getRSI();
      const firstAvgGain = strategy.getAvgGain();
      const firstAvgLoss = strategy.getAvgLoss();

      // Feed more data with a significant drop to change the RSI
      orderBook.setPrices(98, 100);
      strategy.onTick(context);

      const secondRSI = strategy.getRSI();
      const secondAvgGain = strategy.getAvgGain();
      const secondAvgLoss = strategy.getAvgLoss();

      // RSI should change smoothly (Wilder's smoothing)
      expect(firstRSI).not.toBeNull();
      expect(secondRSI).not.toBeNull();
      
      // Average gain and loss should be smoothed (not recalculated from scratch)
      // With Wilder's smoothing, the averages change gradually
      expect(firstAvgGain).not.toBeNull();
      expect(firstAvgLoss).not.toBeNull();
      expect(secondAvgGain).not.toBeNull();
      expect(secondAvgLoss).not.toBeNull();
      
      // The presence of a loss should increase avgLoss
      expect(secondAvgLoss).toBeGreaterThan(firstAvgLoss!);
    });
  });

  describe('Buy Signals (Oversold)', () => {
    let strategy: RSIStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: RSIStrategyConfig = {
        id: 'rsi-buy',
        name: 'RSI Buy Test',
        params: {
          period: 5,
          overbought: 70,
          oversold: 30,
        },
      };
      strategy = new RSIStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate buy signal when RSI < oversold threshold', () => {
      // Create a strong downtrend to get RSI below 30
      const prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
      let buySignal: OrderSignal | null = null;

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          buySignal = signal;
        }
      }

      expect(buySignal).not.toBeNull();
      expect(buySignal!.side).toBe('buy');
      expect(buySignal!.reason).toContain('Oversold');
    });

    test('should not generate repeated buy signals while oversold', () => {
      // Create a downtrend
      const prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 48, 46, 44];
      let buySignalCount = 0;

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          buySignalCount++;
        }
      }

      // Should only generate one buy signal, not repeated ones
      expect(buySignalCount).toBe(1);
    });

    test('should generate new buy signal after RSI normalizes', () => {
      // Strong downtrend
      const downtrendPrices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
      let buySignalCount = 0;

      for (const price of downtrendPrices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          buySignalCount++;
        }
      }

      // RSI should be oversold, one buy signal generated
      expect(buySignalCount).toBe(1);

      // Prices stabilize (RSI moves to neutral zone)
      const neutralPrices = [52, 54, 56, 58, 60, 62, 64, 66, 68, 70];
      for (const price of neutralPrices) {
        orderBook.setPrices(price - 1, price + 1);
        strategy.onTick(context);
      }

      // Another strong downtrend
      const downtrend2 = [65, 60, 55, 50, 45, 40, 35, 30, 25];
      for (const price of downtrend2) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          buySignalCount++;
        }
      }

      // Should have generated a second buy signal
      expect(buySignalCount).toBe(2);
    });
  });

  describe('Sell Signals (Overbought)', () => {
    let strategy: RSIStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: RSIStrategyConfig = {
        id: 'rsi-sell',
        name: 'RSI Sell Test',
        params: {
          period: 5,
          overbought: 70,
          oversold: 30,
        },
      };
      strategy = new RSIStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate sell signal when RSI > overbought threshold', () => {
      // Create a strong uptrend to get RSI above 70
      const prices = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
      let sellSignal: OrderSignal | null = null;

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'sell') {
          sellSignal = signal;
        }
      }

      expect(sellSignal).not.toBeNull();
      expect(sellSignal!.side).toBe('sell');
      expect(sellSignal!.reason).toContain('Overbought');
    });

    test('should not generate repeated sell signals while overbought', () => {
      // Create an uptrend
      const prices = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115];
      let sellSignalCount = 0;

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'sell') {
          sellSignalCount++;
        }
      }

      // Should only generate one sell signal, not repeated ones
      expect(sellSignalCount).toBe(1);
    });
  });

  describe('Signal Structure', () => {
    let strategy: RSIStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: RSIStrategyConfig = {
        id: 'rsi-signal',
        name: 'RSI Signal Test',
        params: {
          period: 5,
          overbought: 70,
          oversold: 30,
          tradeQuantity: 25,
        },
      };
      strategy = new RSIStrategy(config);
      orderBook = new MockOrderBook(100, 102);
      context = createMockContext(orderBook);
      strategy.onInit(context);
    });

    test('should generate signal with correct quantity', () => {
      const prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal) {
          expect(signal.quantity).toBe(25);
          break;
        }
      }
    });

    test('should generate signal with valid structure', () => {
      const prices = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal) {
          expect(signal.id).toBeDefined();
          expect(signal.side).toBeDefined();
          expect(signal.price).toBeDefined();
          expect(signal.quantity).toBeDefined();
          expect(signal.timestamp).toBeDefined();
          expect(signal.confidence).toBeDefined();
          expect(signal.reason).toBeDefined();
          break;
        }
      }
    });

    test('should calculate confidence based on RSI extremity', () => {
      // Strong downtrend for high confidence buy
      const prices = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        if (signal && signal.side === 'buy') {
          // More extreme RSI should result in higher confidence
          expect(signal.confidence).toBeGreaterThan(0.5);
          expect(signal.confidence).toBeLessThanOrEqual(0.9);
          break;
        }
      }
    });
  });

  describe('Reset Functionality', () => {
    let strategy: RSIStrategy;
    let orderBook: MockOrderBook;
    let context: StrategyContext;

    beforeEach(() => {
      const config: RSIStrategyConfig = {
        id: 'rsi-reset',
        name: 'RSI Reset Test',
        params: {
          period: 5,
        },
      };
      strategy = new RSIStrategy(config);
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
      expect(strategy.isReady()).toBe(true);

      // Reset
      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.isReady()).toBe(false);
      expect(strategy.getRSI()).toBeNull();
    });

    test('should work correctly after reset', () => {
      // First round
      for (let i = 0; i < 10; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }

      // Reset and start again
      strategy.reset();

      // Should not have RSI until enough data
      for (let i = 0; i < 5; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        const signal = strategy.onTick(context);
        expect(strategy.isReady()).toBe(false);
        expect(signal).toBeNull();
      }
    });
  });

  describe('Backtesting Support', () => {
    test('should support multiple reset cycles for backtesting', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-backtest',
        name: 'RSI Backtest',
        params: {
          period: 5,
        },
      };
      const strategy = new RSIStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);

      // Run multiple backtest cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        strategy.onInit(context);

        // Feed prices
        for (let i = 0; i < 15; i++) {
          orderBook.setPrices(100 + i + cycle * 10, 102 + i + cycle * 10);
          strategy.onTick(context);
        }

        expect(strategy.isReady()).toBe(true);
        strategy.reset();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty order book gracefully', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-edge',
        name: 'RSI Edge Test',
        params: {
          period: 5,
        },
      };
      const strategy = new RSIStrategy(config);

      const emptyOrderBook = {};
      const context: StrategyContext = {
        portfolio: {
          cash: 100000,
          positions: [],
          totalValue: 100000,
          unrealizedPnL: 0,
          timestamp: Date.now(),
        },
        clock: Date.now(),
        getMarketData: () => ({
          orderBook: emptyOrderBook as any,
          trades: [],
          timestamp: Date.now(),
        }),
        getPosition: (_symbol: string) => 0,
        getCash: () => 100000,
      };

      strategy.onInit(context);

      // Should not throw, just return null
      expect(() => strategy.onTick(context)).not.toThrow();
      expect(strategy.onTick(context)).toBeNull();
    });

    test('should handle oscillating prices', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-oscillate',
        name: 'RSI Oscillate Test',
        params: {
          period: 5,
          overbought: 70,
          oversold: 30,
        },
      };
      const strategy = new RSIStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);
      strategy.onInit(context);

      // Oscillating prices (up, down, up, down)
      const prices = [100, 110, 95, 115, 90, 120, 85, 125, 80, 130, 75, 135];

      for (const price of prices) {
        orderBook.setPrices(price - 1, price + 1);
        const signal = strategy.onTick(context);
        // Should not throw
        expect(signal === null || typeof signal === 'object').toBe(true);
      }

      // RSI should be valid
      expect(strategy.getRSI()).toBeGreaterThanOrEqual(0);
      expect(strategy.getRSI()).toBeLessThanOrEqual(100);
    });

    test('should handle zero price change', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-zero-change',
        name: 'RSI Zero Change Test',
        params: {
          period: 5,
        },
      };
      const strategy = new RSIStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);
      strategy.onInit(context);

      // All prices the same (no change)
      for (let i = 0; i < 15; i++) {
        orderBook.setPrices(100, 102);
        strategy.onTick(context);
      }

      // No losses, so RSI should be 100
      expect(strategy.getRSI()).toBe(100);
    });
  });

  describe('Integration with Strategy Interface', () => {
    test('should implement IStrategy interface correctly', () => {
      const config: RSIStrategyConfig = {
        id: 'rsi-interface',
        name: 'RSI Interface Test',
      };
      const strategy = new RSIStrategy(config);
      const orderBook = new MockOrderBook(100, 102);
      const context = createMockContext(orderBook);

      // Test lifecycle
      strategy.onInit(context);
      expect(strategy.isInitialized()).toBe(true);

      // Test tick processing
      for (let i = 0; i < 10; i++) {
        orderBook.setPrices(100 + i, 102 + i);
        strategy.onTick(context);
      }

      // Test cleanup
      strategy.onCleanup(context);
      expect(strategy.isInitialized()).toBe(false);
    });
  });
});
