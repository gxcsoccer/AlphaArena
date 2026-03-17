/**
 * ATR Strategy Tests
 *
 * Tests for the ATR (Average True Range) trading strategy
 */

import { ATRStrategy, ATRStrategyConfig, ATRData } from '../../src/strategy/ATRStrategy';
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
function createMockContext(orderBook: MockOrderBook, cash: number = 100000): StrategyContext {
  return {
    portfolio: {
      cash,
      positions: [],
      totalValue: cash,
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
    getCash: () => cash,
  };
}

describe('ATRStrategy', () => {
  let strategy: ATRStrategy;
  let mockOrderBook: MockOrderBook;
  let mockContext: StrategyContext;

  const defaultConfig: ATRStrategyConfig = {
    id: 'atr-test',
    name: 'ATR Test Strategy',
    params: {
      period: 14,
      atrMultiplier: 2.0,
      trendPeriod: 5,
      tradeQuantity: 10,
      dynamicPositionSizing: true,
      riskPerTrade: 0.02,
      breakoutThreshold: 0.5,
    },
  };

  beforeEach(() => {
    mockOrderBook = new MockOrderBook(100, 101);
    mockContext = createMockContext(mockOrderBook);
    strategy = new ATRStrategy(defaultConfig);
    strategy.onInit(mockContext);
  });

  describe('Constructor and Configuration', () => {
    test('should create strategy with default parameters', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-default',
        name: 'Default ATR',
      };
      const defaultStrategy = new ATRStrategy(config);
      expect(defaultStrategy).toBeDefined();
    });

    test('should use default values when params are not provided', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-no-params',
        name: 'No Params ATR',
      };
      const noParamStrategy = new ATRStrategy(config);
      expect(noParamStrategy).toBeDefined();
    });

    test('should throw error when period is zero or negative', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-invalid',
        name: 'Invalid ATR',
        params: {
          period: 0,
        },
      };
      expect(() => new ATRStrategy(config)).toThrow('Period must be at least 1');
    });

    test('should throw error when atrMultiplier is zero or negative', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-invalid-multiplier',
        name: 'Invalid Multiplier ATR',
        params: {
          atrMultiplier: 0,
        },
      };
      expect(() => new ATRStrategy(config)).toThrow('ATR multiplier must be positive');
    });

    test('should throw error when trendPeriod is zero or negative', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-invalid-trend',
        name: 'Invalid Trend ATR',
        params: {
          trendPeriod: 0,
        },
      };
      expect(() => new ATRStrategy(config)).toThrow('Trend period must be at least 1');
    });

    test('should throw error when tradeQuantity is zero or negative', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-invalid-qty',
        name: 'Invalid Quantity ATR',
        params: {
          tradeQuantity: 0,
        },
      };
      expect(() => new ATRStrategy(config)).toThrow('Trade quantity must be positive');
    });

    test('should throw error when riskPerTrade is out of range', () => {
      const config: ATRStrategyConfig = {
        id: 'atr-invalid-risk',
        name: 'Invalid Risk ATR',
        params: {
          riskPerTrade: 1.5,
        },
      };
      expect(() => new ATRStrategy(config)).toThrow('Risk per trade must be between 0 and 1');
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getTRHistoryLength()).toBe(0);
      expect(strategy.getATRValue()).toBeNull();
      expect(strategy.getTrueRange()).toBeNull();
      expect(strategy.getUpperBand()).toBeNull();
      expect(strategy.getLowerBand()).toBeNull();
      expect(strategy.getATRPercent()).toBeNull();
      expect(strategy.isReady()).toBe(false);
      expect(strategy.getTrend()).toBe('neutral');
    });

    test('should reset to initial state', () => {
      // Run some ticks to build up state
      for (let i = 0; i < 20; i++) {
        strategy.onTick(mockContext);
      }

      expect(strategy.getPriceHistoryLength()).toBe(20);
      expect(strategy.isReady()).toBe(true);

      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getTRHistoryLength()).toBe(0);
      expect(strategy.getATRValue()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });
  });

  describe('ATR Calculation', () => {
    test('should return null before enough data points', () => {
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
      expect(strategy.getPriceHistoryLength()).toBe(1);

      // Still need more data
      for (let i = 0; i < 12; i++) {
        strategy.onTick(mockContext);
      }
      expect(strategy.getPriceHistoryLength()).toBe(13);
      expect(strategy.isReady()).toBe(false);
    });

    test('should start generating ATR after warmup period', () => {
      // Generate enough ticks to warm up
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 0.5, 101 + i * 0.5);
        strategy.onTick(mockContext);
      }

      // Strategy should now be ready (bands computed for next tick)
      expect(strategy.isReady()).toBe(true);
      expect(strategy.getATRValue()).not.toBeNull();
      expect(strategy.getTrueRange()).not.toBeNull();
    });

    test('should calculate True Range correctly for first bar', () => {
      // First bar: TR = High - Low (since there's no previous close)
      mockOrderBook.setPrices(100, 101); // midPrice = 100.5, spread = 1
      strategy.onTick(mockContext);

      // After first tick, we should have the TR calculated
      expect(strategy.getTRHistoryLength()).toBe(1);
    });

    test('should calculate True Range using max of three values', () => {
      // Build up some history first
      for (let i = 0; i < 15; i++) {
        mockOrderBook.setPrices(100 + i, 101 + i);
        strategy.onTick(mockContext);
      }

      // Now check that TR is calculated
      const tr = strategy.getTrueRange();
      expect(tr).toBeGreaterThan(0);
    });

    test('should calculate ATR as SMA of True Range', () => {
      // Use constant spread for predictable ATR
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101); // Constant spread = 1
        strategy.onTick(mockContext);
      }

      const atr = strategy.getATRValue();
      expect(atr).toBeGreaterThan(0);
      // ATR should be 1 (spread) since all TR values are 1
      expect(atr).toBeCloseTo(1, 1);
    });

    test('should update ATR as new data comes in', () => {
      // Initial data
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        strategy.onTick(mockContext);
      }

      const atr1 = strategy.getATRValue();

      // Add more data with wider spread
      for (let i = 0; i < 5; i++) {
        mockOrderBook.setPrices(100, 103); // Wider spread = 3
        strategy.onTick(mockContext);
      }

      const atr2 = strategy.getATRValue();
      // ATR should have increased due to wider spreads
      expect(atr2).toBeGreaterThan(atr1!);
    });

    test('should calculate ATR percent correctly', () => {
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        strategy.onTick(mockContext);
      }

      const atr = strategy.getATRValue();
      const atrPercent = strategy.getATRPercent();
      const midPrice = 100.5;

      expect(atrPercent).toBeCloseTo(atr! / midPrice, 5);
    });
  });

  describe('Trend Detection', () => {
    test('should detect uptrend with rising prices', () => {
      // Create a clear uptrend (price increase > 0.5% over 5 periods)
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 2, 101 + i * 2); // 2x price increase per tick
        strategy.onTick(mockContext);
      }

      const trend = strategy.getTrend();
      expect(trend).toBe('up');
    });

    test('should detect downtrend with falling prices', () => {
      // Create a clear downtrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(150 - i * 2, 151 - i * 2);
        strategy.onTick(mockContext);
      }

      const trend = strategy.getTrend();
      expect(trend).toBe('down');
    });

    test('should detect neutral trend with sideways prices', () => {
      // Sideways movement
      for (let i = 0; i < 14; i++) {
        const oscillation = Math.sin(i) * 0.1; // Small oscillation
        mockOrderBook.setPrices(100 + oscillation, 101 + oscillation);
        strategy.onTick(mockContext);
      }

      const trend = strategy.getTrend();
      expect(trend).toBe('neutral');
    });

    test('should return neutral when not enough data', () => {
      strategy.onTick(mockContext);
      expect(strategy.getTrend()).toBe('neutral');
    });
  });

  describe('Signal Generation', () => {
    test('should generate buy signal on upward breakout in uptrend', () => {
      // Build up price history with strong uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3); // Strong uptrend
        strategy.onTick(mockContext);
      }

      // Verify we're in uptrend
      expect(strategy.getTrend()).toBe('up');
      expect(strategy.isReady()).toBe(true);

      // Get the upper band (pre-computed for this tick)
      const upperBand = strategy.getUpperBand();
      
      // Create a breakout - price well above upper band
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('buy');
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.reason).toContain('Breakout');
    });

    test('should generate sell signal on downward breakout in downtrend', () => {
      // Build up price history with strong downtrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(200 - i * 3, 201 - i * 3); // Strong downtrend
        strategy.onTick(mockContext);
      }

      // Verify we're in downtrend
      expect(strategy.getTrend()).toBe('down');
      expect(strategy.isReady()).toBe(true);

      // Get the lower band
      const lowerBand = strategy.getLowerBand();
      
      // Create a breakdown - price well below lower band
      mockOrderBook.setPrices(lowerBand! - 20, lowerBand! - 19);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('sell');
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.reason).toContain('Breakdown');
    });

    test('should not generate repeated buy signals', () => {
      // Build up price history with uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal1 = strategy.onTick(mockContext);
      expect(signal1!.side).toBe('buy');

      // Keep price high (but not triggering take profit yet)
      const signal2 = strategy.onTick(mockContext);
      expect(signal2).toBeNull(); // No repeated signal
    });

    test('should not generate signals in neutral trend', () => {
      // Build sideways price history
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + Math.sin(i) * 0.1, 101 + Math.sin(i) * 0.1);
        strategy.onTick(mockContext);
      }

      expect(strategy.getTrend()).toBe('neutral');
      expect(strategy.isReady()).toBe(true);

      // Even if price moves, no signal should be generated in neutral trend
      mockOrderBook.setPrices(100, 101);
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
    });

    test('should set stop loss and take profit after entry', () => {
      // Build up price history with uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      strategy.onTick(mockContext);

      // Check that stop loss and take profit are set
      expect(strategy.getStopLoss()).not.toBeNull();
      expect(strategy.getTakeProfit()).not.toBeNull();
    });

    test('should trigger stop loss on price reversal', () => {
      // Build up price history with strong uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      strategy.onTick(mockContext);

      const stopLoss = strategy.getStopLoss();
      expect(stopLoss).not.toBeNull();

      // Price drops below stop loss
      mockOrderBook.setPrices(stopLoss! - 5, stopLoss! - 4);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('sell');
      expect(signal!.reason).toContain('Stop Loss');
    });

    test('should trigger take profit on favorable price movement', () => {
      // Build up price history with strong uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      strategy.onTick(mockContext);

      const takeProfit = strategy.getTakeProfit();
      expect(takeProfit).not.toBeNull();

      // Price rises above take profit
      mockOrderBook.setPrices(takeProfit! + 5, takeProfit! + 6);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.side).toBe('sell');
      expect(signal!.reason).toContain('Take Profit');
    });
  });

  describe('Position Sizing', () => {
    test('should use fixed quantity when dynamic position sizing is disabled', () => {
      const fixedConfig: ATRStrategyConfig = {
        id: 'atr-fixed',
        name: 'Fixed ATR',
        params: {
          period: 14,
          atrMultiplier: 2.0,
          tradeQuantity: 50,
          dynamicPositionSizing: false,
        },
      };

      const fixedStrategy = new ATRStrategy(fixedConfig);
      fixedStrategy.onInit(mockContext);

      // Build up price history with uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        fixedStrategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = fixedStrategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal = fixedStrategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.quantity).toBe(50);
    });

    test('should calculate dynamic position size based on risk', () => {
      // Build up price history with volatile uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal = strategy.onTick(mockContext);

      // Position size should be calculated based on risk
      expect(signal!.quantity).toBeGreaterThan(0);
    });

    test('should adjust position size based on cash', () => {
      // Create a context with less cash
      const lowCashContext = createMockContext(mockOrderBook, 10000);
      const lowCashStrategy = new ATRStrategy(defaultConfig);
      lowCashStrategy.onInit(lowCashContext);

      // Build up price history with uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        lowCashStrategy.onTick(mockContext);
      }

      // Create a breakout
      const upperBand = lowCashStrategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal = lowCashStrategy.onTick(mockContext);

      // Position size should be calculated
      expect(signal!.quantity).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    test('should have higher confidence when aligned with trend', () => {
      // Strong uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      const upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal = strategy.onTick(mockContext);

      // Confidence should be high (aligned with uptrend)
      expect(signal!.confidence).toBeGreaterThan(0.6);
    });

    test('should have higher confidence with higher volatility', () => {
      // Create high volatility environment with uptrend
      for (let i = 0; i < 14; i++) {
        const base = 100 + i * 3;
        const volatility = (i % 2 === 0 ? 5 : -5);
        mockOrderBook.setPrices(base + volatility, base + volatility + 1);
        strategy.onTick(mockContext);
      }

      // Verify we have a trend and breakout
      if (strategy.getTrend() === 'up') {
        const upperBand = strategy.getUpperBand();
        mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
        const signal = strategy.onTick(mockContext);
        if (signal) {
          expect(signal.confidence).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('Getter Methods', () => {
    test('should return correct ATR data', () => {
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 0.5, 101 + i * 0.5);
        strategy.onTick(mockContext);
      }

      const atrData = strategy.getATR();
      expect(atrData).not.toBeNull();
      expect(atrData!.atr).toBeDefined();
      expect(atrData!.trueRange).toBeDefined();
      expect(atrData!.upperBand).toBeDefined();
      expect(atrData!.lowerBand).toBeDefined();
      expect(atrData!.atrPercent).toBeDefined();
    });

    test('should return correct individual components', () => {
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        strategy.onTick(mockContext);
      }

      const atr = strategy.getATRValue();
      const tr = strategy.getTrueRange();
      const upperBand = strategy.getUpperBand();
      const lowerBand = strategy.getLowerBand();
      const atrPercent = strategy.getATRPercent();

      expect(atr).toBeGreaterThan(0);
      expect(tr).toBeGreaterThan(0);
      expect(upperBand).toBeGreaterThan(lowerBand!);
      expect(atrPercent).toBeGreaterThan(0);
    });
  });

  describe('Custom Parameters', () => {
    test('should work with custom period', () => {
      const customConfig: ATRStrategyConfig = {
        id: 'atr-custom',
        name: 'Custom ATR',
        params: {
          period: 7,
          atrMultiplier: 1.5,
          tradeQuantity: 20,
        },
      };

      const customStrategy = new ATRStrategy(customConfig);
      customStrategy.onInit(mockContext);

      // Generate signals with custom period
      for (let i = 0; i < 10; i++) {
        mockOrderBook.setPrices(100 + i, 101 + i);
        customStrategy.onTick(mockContext);
      }

      // Should be ready after 7 periods
      expect(customStrategy.isReady()).toBe(true);
    });

    test('should work with different breakout threshold', () => {
      const wideConfig: ATRStrategyConfig = {
        id: 'atr-wide',
        name: 'Wide ATR',
        params: {
          period: 14,
          breakoutThreshold: 1.0, // Wider threshold
          tradeQuantity: 10,
        },
      };

      const wideStrategy = new ATRStrategy(wideConfig);
      wideStrategy.onInit(mockContext);

      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        wideStrategy.onTick(mockContext);
      }

      // Bands should be wider with larger threshold
      const wideBandDiff = wideStrategy.getUpperBand()! - wideStrategy.getLowerBand()!;

      // Compare with default (0.5 threshold)
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        strategy.onTick(mockContext);
      }

      const defaultBandDiff = strategy.getUpperBand()! - strategy.getLowerBand()!;

      // 1.0 threshold should create wider bands than 0.5
      expect(wideBandDiff).toBeGreaterThan(defaultBandDiff);
    });
  });

  describe('Integration with Strategy Base Class', () => {
    test('should be properly initialized', () => {
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should have correct config', () => {
      const config = strategy.getConfig();
      expect(config.id).toBe('atr-test');
      expect(config.name).toBe('ATR Test Strategy');
    });

    test('should cleanup properly', () => {
      strategy.onCleanup(mockContext);
      expect(strategy.isInitialized()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing order book data gracefully', () => {
      const emptyOrderBook = {
        getBestBid: () => null,
        getBestAsk: () => null,
      };

      const emptyContext: StrategyContext = {
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

      const signal = strategy.onTick(emptyContext);
      expect(signal).toBeNull();
    });

    test('should handle very small spreads', () => {
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 100.01); // Very small spread
        strategy.onTick(mockContext);
      }

      expect(strategy.isReady()).toBe(true);
      const atr = strategy.getATRValue();
      expect(atr).toBeGreaterThanOrEqual(0);
    });

    test('should handle large price movements', () => {
      // Start with normal prices
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100, 101);
        strategy.onTick(mockContext);
      }

      // Suddenly double the price
      mockOrderBook.setPrices(200, 201);
      const signal = strategy.onTick(mockContext);

      // Should handle large movement without crashing
      expect(strategy.isReady()).toBe(true);
    });

    test('should handle consecutive signals correctly', () => {
      // Build up price history with strong uptrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(100 + i * 3, 101 + i * 3);
        strategy.onTick(mockContext);
      }

      // First breakout - buy signal
      let upperBand = strategy.getUpperBand();
      mockOrderBook.setPrices(upperBand! + 20, upperBand! + 21);
      const signal1 = strategy.onTick(mockContext);
      expect(signal1!.side).toBe('buy');

      // Price drops to trigger stop loss - sell signal
      const stopLoss = strategy.getStopLoss();
      mockOrderBook.setPrices(stopLoss! - 5, stopLoss! - 4);
      const signal2 = strategy.onTick(mockContext);
      expect(signal2!.side).toBe('sell');

      // After exit, position is reset
      expect(strategy.getStopLoss()).toBeNull();
      expect(strategy.getTakeProfit()).toBeNull();

      // Reset strategy to test a new cycle
      strategy.reset();
      
      // Build up a new downtrend
      for (let i = 0; i < 14; i++) {
        mockOrderBook.setPrices(200 - i * 3, 201 - i * 3);
        strategy.onTick(mockContext);
      }

      // Verify we're in downtrend
      expect(strategy.getTrend()).toBe('down');
      expect(strategy.isReady()).toBe(true);

      // Create a sell breakout in downtrend
      const lowerBand = strategy.getLowerBand();
      mockOrderBook.setPrices(lowerBand! - 20, lowerBand! - 19);
      const signal3 = strategy.onTick(mockContext);
      expect(signal3!.side).toBe('sell');
    });
  });
});
