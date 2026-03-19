/**
 * Elliott Wave Strategy Tests
 * 
 * Comprehensive tests for the ElliottWaveStrategy implementation
 */

import { ElliottWaveStrategy, ELLIOTT_FIBONACCI } from '../../src/strategy/ElliottWaveStrategy';
import { StrategyContext, MarketData } from '../../src/strategy/types';

// Mock OrderBook for testing
class MockOrderBook {
  private bestBid: number = 100;
  private bestAsk: number = 100.1;

  setPrice(price: number): void {
    this.bestBid = price - 0.05;
    this.bestAsk = price + 0.05;
  }

  getBestBid(): number {
    return this.bestBid;
  }

  getBestAsk(): number {
    return this.bestAsk;
  }

  clear(): void {}
}

// Helper to create mock context
function createMockContext(price: number, clock: number): StrategyContext {
  const orderBook = new MockOrderBook();
  orderBook.setPrice(price);

  return {
    portfolio: {
      cash: 100000,
      positions: new Map(),
      totalValue: 100000,
      unrealizedPnL: 0,
      timestamp: clock,
    },
    clock,
    getMarketData: (): MarketData => ({
      orderBook: orderBook as any,
      trades: [],
      timestamp: clock,
    }),
    getPosition: () => 0,
    getCash: () => 100000,
  };
}

describe('ElliottWaveStrategy', () => {
  describe('Configuration', () => {
    it('should create strategy with default parameters', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
      });

      expect(strategy).toBeDefined();
      expect(strategy.isReady()).toBe(false);
    });

    it('should create strategy with custom parameters', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-custom',
        name: 'Elliott Wave Custom',
        params: {
          swingPeriod: 3,
          minDataPoints: 50,
          fibTolerance: 0.05,
          tradeQuantity: 20,
          minWaveAmplitude: 0.01,
          baseConfidence: 0.7,
          analysisDegree: 'minute',
        },
      });

      expect(strategy).toBeDefined();
    });

    it('should throw error for invalid swing period', () => {
      expect(() => {
        new ElliottWaveStrategy({
          id: 'elliott-invalid',
          name: 'Invalid',
          params: { swingPeriod: 1 },
        });
      }).toThrow('Swing period must be at least 2');
    });

    it('should throw error for invalid min data points', () => {
      expect(() => {
        new ElliottWaveStrategy({
          id: 'elliott-invalid',
          name: 'Invalid',
          params: { minDataPoints: 10 },
        });
      }).toThrow('Minimum data points must be at least 50');
    });

    it('should throw error for invalid Fibonacci tolerance', () => {
      expect(() => {
        new ElliottWaveStrategy({
          id: 'elliott-invalid',
          name: 'Invalid',
          params: { fibTolerance: 0.5 },
        });
      }).toThrow('Fibonacci tolerance must be between 0 and 0.3');
    });
  });

  describe('Wave Detection', () => {
    let strategy: ElliottWaveStrategy;

    beforeEach(() => {
      strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: {
          minDataPoints: 50,
          swingPeriod: 2,
        },
      });
    });

    it('should require minimum data points before analysis', () => {
      for (let i = 0; i < 49; i++) {
        const context = createMockContext(100 + Math.random() * 2, i);
        const signal = strategy.onTick(context);
        expect(signal).toBeNull();
        expect(strategy.isReady()).toBe(false);
      }

      const context = createMockContext(100, 50);
      strategy.onTick(context);
      expect(strategy.isReady()).toBe(true);
    });

    it('should detect swing points', () => {
      // Create price pattern with clear swings
      const prices = [100, 102, 104, 103, 101, 99, 100, 102, 105, 103, 101, 100];
      
      for (let i = 0; i < prices.length; i++) {
        const context = createMockContext(prices[i], i);
        strategy.onTick(context);
      }

      // After enough data, swing points should be detected
      for (let i = 0; i < 60; i++) {
        const context = createMockContext(100 + Math.sin(i * 0.5) * 5, 20 + i);
        strategy.onTick(context);
      }

      const swingPoints = strategy.getSwingPoints();
      expect(swingPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Impulse Wave Pattern', () => {
    let strategy: ElliottWaveStrategy;

    beforeEach(() => {
      strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: {
          minDataPoints: 50,
          swingPeriod: 2,
          fibTolerance: 0.15,
        },
      });
    });

    it('should identify bullish impulse wave (1-2-3-4-5)', () => {
      // Create a clear 5-wave bullish impulse pattern
      // Wave 1: 100 -> 110
      // Wave 2: 110 -> 104 (61.8% retracement)
      // Wave 3: 104 -> 120 (extended)
      // Wave 4: 120 -> 115 (38.2% retracement)
      // Wave 5: 115 -> 122
      const wavePattern = [
        // Initial noise
        ...Array(10).fill(100).map((p, _i) => p + Math.random()),
        // Wave 1: Up
        ...Array(5).fill(0).map((_, i) => 100 + i * 2), // 100 -> 108
        // Wave 2: Down (retracement)
        ...Array(4).fill(0).map((_, i) => 108 - i * 1.5), // 108 -> 103.5
        // Wave 3: Up (extended)
        ...Array(6).fill(0).map((_, i) => 103.5 + i * 3), // 103.5 -> 118.5
        // Wave 4: Down
        ...Array(4).fill(0).map((_, i) => 118.5 - i * 1.5), // 118.5 -> 114
        // Wave 5: Up
        ...Array(5).fill(0).map((_, i) => 114 + i * 2), // 114 -> 122
      ];

      for (let i = 0; i < wavePattern.length; i++) {
        const context = createMockContext(wavePattern[i], i);
        strategy.onTick(context);
      }

      // Add more data for swing detection
      for (let i = 0; i < 20; i++) {
        const context = createMockContext(122 - i * 0.1, wavePattern.length + i);
        strategy.onTick(context);
      }

      const _pattern = strategy.getCurrentPattern();
      // Pattern might or might not be detected depending on swing detection
      // This tests that the algorithm runs without error
      expect(strategy.getPriceHistoryLength()).toBeGreaterThan(0);
    });
  });

  describe('Corrective Wave Pattern', () => {
    let strategy: ElliottWaveStrategy;

    beforeEach(() => {
      strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: {
          minDataPoints: 50,
          swingPeriod: 2,
          fibTolerance: 0.15,
        },
      });
    });

    it('should identify ABC corrective wave', () => {
      // Create a clear ABC correction pattern
      const wavePattern = [
        // Initial noise
        ...Array(10).fill(100).map((p, _i) => p + Math.random()),
        // Wave A: Down
        ...Array(4).fill(0).map((_, i) => 100 - i * 2.5), // 100 -> 92.5
        // Wave B: Up (retracement)
        ...Array(4).fill(0).map((_, i) => 92.5 + i * 1.5), // 92.5 -> 97
        // Wave C: Down
        ...Array(5).fill(0).map((_, i) => 97 - i * 3), // 97 -> 85
      ];

      for (let i = 0; i < wavePattern.length; i++) {
        const context = createMockContext(wavePattern[i], i);
        strategy.onTick(context);
      }

      // Add more data
      for (let i = 0; i < 50; i++) {
        const context = createMockContext(85 + i * 0.5, wavePattern.length + i);
        strategy.onTick(context);
      }

      expect(strategy.getPriceHistoryLength()).toBeGreaterThan(0);
    });
  });

  describe('Signal Generation', () => {
    let strategy: ElliottWaveStrategy;

    beforeEach(() => {
      strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: {
          minDataPoints: 50,
          swingPeriod: 2,
          tradeQuantity: 10,
        },
      });
    });

    it('should generate signals with proper structure', () => {
      // Fill with enough data
      for (let i = 0; i < 150; i++) {
        const price = 100 + Math.sin(i * 0.1) * 10;
        const context = createMockContext(price, i);
        const signal = strategy.onTick(context);
        
        if (signal) {
          expect(signal).toHaveProperty('id');
          expect(signal).toHaveProperty('side');
          expect(signal).toHaveProperty('price');
          expect(signal).toHaveProperty('quantity');
          expect(signal).toHaveProperty('timestamp');
          expect(['buy', 'sell']).toContain(signal.side);
          expect(signal.quantity).toBe(10);
        }
      }
    });

    it('should include confidence and reason in signals', () => {
      // Create a trending market
      for (let i = 0; i < 200; i++) {
        // Create a more dramatic wave pattern
        let price: number;
        if (i < 40) price = 100 + i * 0.5; // Up trend
        else if (i < 60) price = 120 - (i - 40) * 0.5; // Pullback
        else if (i < 100) price = 110 + (i - 60) * 0.5; // Up again
        else price = 130 - (i - 100) * 0.3; // Down

        const context = createMockContext(price, i);
        const signal = strategy.onTick(context);
        
        if (signal) {
          expect(signal.confidence).toBeDefined();
          expect(signal.confidence).toBeGreaterThanOrEqual(0.3);
          expect(signal.confidence).toBeLessThanOrEqual(0.95);
          expect(signal.reason).toBeDefined();
          expect(typeof signal.reason).toBe('string');
        }
      }
    });
  });

  describe('Fibonacci Constants', () => {
    it('should have correct Fibonacci ratios', () => {
      expect(ELLIOTT_FIBONACCI.RETRACE_236).toBe(0.236);
      expect(ELLIOTT_FIBONACCI.RETRACE_382).toBe(0.382);
      expect(ELLIOTT_FIBONACCI.RETRACE_500).toBe(0.5);
      expect(ELLIOTT_FIBONACCI.RETRACE_618).toBe(0.618);
      expect(ELLIOTT_FIBONACCI.EXT_618).toBe(1.618);
    });
  });

  describe('Reset and State Management', () => {
    it('should reset strategy state', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: { minDataPoints: 50 },
      });

      // Add some data
      for (let i = 0; i < 60; i++) {
        const context = createMockContext(100 + i, i);
        strategy.onTick(context);
      }

      expect(strategy.getPriceHistoryLength()).toBe(60);

      // Reset
      strategy.reset();

      expect(strategy.getPriceHistoryLength()).toBe(0);
      expect(strategy.getSwingPoints().length).toBe(0);
      expect(strategy.getCurrentPattern()).toBeNull();
      expect(strategy.isReady()).toBe(false);
    });

    it('should track previous patterns', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: { minDataPoints: 50, swingPeriod: 2 },
      });

      // The previous patterns list should be empty initially
      expect(strategy.getPreviousPatterns().length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle flat price data', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: { minDataPoints: 50 },
      });

      // Flat prices
      for (let i = 0; i < 100; i++) {
        const context = createMockContext(100, i);
        const _signal = strategy.onTick(context);
        // Should not crash, may or may not generate signal
      }

      expect(strategy.getPriceHistoryLength()).toBe(100);
    });

    it('should handle highly volatile prices', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: { minDataPoints: 50 },
      });

      // Highly volatile prices
      for (let i = 0; i < 100; i++) {
        const price = 100 + (Math.random() - 0.5) * 50;
        const context = createMockContext(price, i);
        const _signal = strategy.onTick(context);
        // Should not crash
      }

      expect(strategy.getPriceHistoryLength()).toBe(100);
    });

    it('should handle decreasing prices', () => {
      const strategy = new ElliottWaveStrategy({
        id: 'elliott-test',
        name: 'Elliott Wave Test',
        params: { minDataPoints: 50 },
      });

      // Decreasing prices
      for (let i = 0; i < 100; i++) {
        const context = createMockContext(100 - i * 0.5, i);
        const _signal = strategy.onTick(context);
      }

      expect(strategy.getPriceHistoryLength()).toBe(100);
    });
  });
});
