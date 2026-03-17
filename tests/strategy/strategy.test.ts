/**
 * Strategy Tests
 *
 * Tests for the Strategy interface and base class
 */

import { Strategy, StrategyConfig, StrategyContext, OrderSignal } from '../../src/strategy';
import { OrderBook } from '../../src/orderbook';

/**
 * Test strategy implementation
 */
class TestStrategy extends Strategy {
  private tickCount: number = 0;

  onTick(_context: StrategyContext): OrderSignal | null {
    this.tickCount++;

    // Generate a signal every 3 ticks
    if (this.tickCount % 3 === 0) {
      return this.createSignal('buy', 100, 10, {
        confidence: 0.8,
        reason: 'Test signal',
      });
    }

    return null;
  }

  public getTickCount(): number {
    return this.tickCount;
  }

  protected init(_context: StrategyContext): void {
    // Initialization logic
  }

  protected orderFilled(_context: StrategyContext, _signal: OrderSignal): void {
    // Order filled logic
  }
}

describe('Strategy', () => {
  let strategy: TestStrategy;
  let mockContext: StrategyContext;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      portfolio: {
        cash: 100000,
        positions: [],
        totalValue: 100000,
        unrealizedPnL: 0,
        timestamp: Date.now(),
      },
      clock: Date.now(),
      getMarketData: () => ({
        orderBook: {} as any,
        trades: [],
        timestamp: Date.now(),
      }),
      getPosition: (_symbol: string) => 0,
      getCash: () => 100000,
    };

    // Create test strategy
    const config: StrategyConfig = {
      id: 'test-strategy',
      name: 'Test Strategy',
    };
    strategy = new TestStrategy(config);
  });

  describe('Lifecycle', () => {
    test('should initialize strategy', () => {
      expect(strategy.isInitialized()).toBe(false);
      strategy.onInit(mockContext);
      expect(strategy.isInitialized()).toBe(true);
    });

    test('should cleanup strategy', () => {
      strategy.onInit(mockContext);
      expect(strategy.isInitialized()).toBe(true);
      strategy.onCleanup(mockContext);
      expect(strategy.isInitialized()).toBe(false);
    });

    test('should track initialization state', () => {
      strategy.onInit(mockContext);
      strategy.onCleanup(mockContext);
      strategy.onInit(mockContext);
      expect(strategy.isInitialized()).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should return strategy config', () => {
      const config = strategy.getConfig();
      expect(config.id).toBe('test-strategy');
      expect(config.name).toBe('Test Strategy');
    });

    test('should support custom parameters', () => {
      const config: StrategyConfig = {
        id: 'custom-strategy',
        name: 'Custom Strategy',
        params: {
          windowSize: 20,
          threshold: 0.5,
        },
      };
      const customStrategy = new TestStrategy(config);
      expect(customStrategy.getConfig().params?.windowSize).toBe(20);
    });
  });

  describe('Signal Generation', () => {
    beforeEach(() => {
      strategy.onInit(mockContext);
    });

    test('should generate signals with correct structure', () => {
      // Trigger signal generation (every 3rd tick)
      strategy.onTick(mockContext);
      strategy.onTick(mockContext);
      const signal = strategy.onTick(mockContext);

      expect(signal).not.toBeNull();
      expect(signal!.id).toBeDefined();
      expect(signal!.side).toBe('buy');
      expect(signal!.price).toBe(100);
      expect(signal!.quantity).toBe(10);
      expect(signal!.timestamp).toBeDefined();
      expect(signal!.confidence).toBe(0.8);
      expect(signal!.reason).toBe('Test signal');
    });

    test('should return null when no signal', () => {
      const signal = strategy.onTick(mockContext);
      expect(signal).toBeNull();
    });

    test('should generate unique signal IDs', () => {
      strategy.onTick(mockContext);
      strategy.onTick(mockContext);
      const signal1 = strategy.onTick(mockContext);
      strategy.onTick(mockContext);
      strategy.onTick(mockContext);
      const signal2 = strategy.onTick(mockContext);

      expect(signal1!.id).not.toBe(signal2!.id);
    });

    test('should create sell signals', () => {
      class SellStrategy extends Strategy {
        onTick(_context: StrategyContext): OrderSignal | null {
          return this.createSignal('sell', 150, 5);
        }
      }

      const sellStrategy = new SellStrategy({ id: 'sell', name: 'Sell' });
      sellStrategy.onInit(mockContext);
      const signal = sellStrategy.onTick(mockContext);

      expect(signal!.side).toBe('sell');
      expect(signal!.price).toBe(150);
      expect(signal!.quantity).toBe(5);
    });
  });

  describe('Order Filled Handler', () => {
    test('should call orderFilled callback', () => {
      let filledCalled = false;
      let capturedSignal: OrderSignal | null = null;

      class TrackingStrategy extends Strategy {
        protected orderFilled(_context: StrategyContext, signal: OrderSignal): void {
          filledCalled = true;
          capturedSignal = signal;
        }

        onTick(_context: StrategyContext): OrderSignal | null {
          return this.createSignal('buy', 100, 10);
        }
      }

      const trackingStrategy = new TrackingStrategy({ id: 'tracking', name: 'Tracking' });
      trackingStrategy.onInit(mockContext);

      const signal = trackingStrategy.onTick(mockContext);
      if (signal) {
        trackingStrategy.onOrderFilled(mockContext, signal);
      }

      expect(filledCalled).toBe(true);
      expect(capturedSignal).toBe(signal);
    });
  });

  describe('Context Access', () => {
    test('should access portfolio through context', () => {
      class PortfolioStrategy extends Strategy {
        private portfolioValue: number = 0;

        protected init(_context: StrategyContext): void {
          this.portfolioValue = _context.portfolio.totalValue;
        }

        onTick(_context: StrategyContext): OrderSignal | null {
          if (_context.portfolio.cash > 50000) {
            return this.createSignal('buy', 100, 10);
          }
          return null;
        }
      }

      const portfolioStrategy = new PortfolioStrategy({ id: 'portfolio', name: 'Portfolio' });
      portfolioStrategy.onInit(mockContext);
      const signal = portfolioStrategy.onTick(mockContext);

      expect(signal).not.toBeNull();
    });

    test('should access market data through context', () => {
      class MarketStrategy extends Strategy {
        onTick(_context: StrategyContext): OrderSignal | null {
          const marketData = _context.getMarketData();
          expect(marketData.orderBook).toBeDefined();
          expect(marketData.trades).toBeDefined();
          expect(marketData.timestamp).toBeDefined();
          return null;
        }
      }

      const marketStrategy = new MarketStrategy({ id: 'market', name: 'Market' });
      marketStrategy.onInit(mockContext);
      expect(() => marketStrategy.onTick(mockContext)).not.toThrow();
    });
  });
});

describe('OrderSignal', () => {
  test('should have required fields', () => {
    const signal: OrderSignal = {
      id: 'test-1',
      side: 'buy',
      price: 100,
      quantity: 10,
      timestamp: Date.now(),
    };

    expect(signal.id).toBeDefined();
    expect(signal.side).toBe('buy');
    expect(signal.price).toBe(100);
    expect(signal.quantity).toBe(10);
    expect(signal.timestamp).toBeDefined();
  });

  test('should support optional fields', () => {
    const signal: OrderSignal = {
      id: 'test-2',
      side: 'sell',
      bid: 99,
      ask: 101,
      price: 100,
      quantity: 5,
      timestamp: Date.now(),
      confidence: 0.9,
      reason: 'High confidence signal',
    };

    expect(signal.bid).toBe(99);
    expect(signal.ask).toBe(101);
    expect(signal.confidence).toBe(0.9);
    expect(signal.reason).toBe('High confidence signal');
  });
});

describe('MarketData', () => {
  test('should have required fields', () => {
    const orderBook = new OrderBook();
    const marketData: MarketData = {
      orderBook,
      trades: [],
      timestamp: Date.now(),
    };

    expect(marketData.orderBook).toBeDefined();
    expect(marketData.trades).toBeDefined();
    expect(marketData.timestamp).toBeDefined();
  });
});
