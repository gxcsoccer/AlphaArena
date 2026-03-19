/**
 * Strategy Manager Tests
 *
 * Tests for the multi-strategy management system
 */

import { StrategyManager, StrategyManagerConfig } from '../../src/strategy/StrategyManager';
import { Strategy } from '../../src/strategy/Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from '../../src/strategy/types';
import { OrderBook } from '../../src/orderbook/OrderBook';
import { Trade } from '../../src/matching/types';

/**
 * Mock strategy for testing - 测试用模拟策略
 */
class MockStrategy extends Strategy {
  private tickCount: number = 0;
  private signalToGenerate?: 'buy' | 'sell';

  constructor(config: StrategyConfig, signalToGenerate?: 'buy' | 'sell') {
    super(config);
    this.signalToGenerate = signalToGenerate;
  }

  onTick(context: StrategyContext): OrderSignal | null {
    this.tickCount++;

    if (this.signalToGenerate) {
      return this.createSignal(this.signalToGenerate, 100, 10, {
        reason: `Mock signal #${this.tickCount}`,
      });
    }

    return null;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  resetTickCount(): void {
    this.tickCount = 0;
  }
}

/**
 * Create mock market data - 创建模拟市场数据
 */
function createMockMarketData(): any {
  const orderBook = new OrderBook();
  // Add some mock orders
  orderBook.add({
    id: 'bid-1',
    type: 'bid' as any,
    price: 99,
    quantity: 100,
    timestamp: Date.now(),
  });
  orderBook.add({
    id: 'ask-1',
    type: 'ask' as any,
    price: 101,
    quantity: 100,
    timestamp: Date.now(),
  });

  return {
    orderBook,
    trades: [],
    timestamp: Date.now(),
  };
}

/**
 * Create a mock trade - 创建模拟交易
 */
function createMockTrade(buyOrderId: string, sellOrderId: string): Trade {
  return {
    id: `trade-${Date.now()}`,
    buyOrderId,
    sellOrderId,
    price: 100,
    quantity: 10,
    timestamp: Date.now(),
    status: 'filled' as any,
  };
}

describe('StrategyManager', () => {
  let manager: StrategyManager;

  beforeEach(() => {
    const config: StrategyManagerConfig = {
      enableCommunication: false,
      enablePersistence: false,
      initialCash: 100000,
      enableLogging: false,
    };
    manager = new StrategyManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Strategy Registration', () => {
    test('should register a strategy successfully', async () => {
      const config: StrategyConfig = {
        id: 'mock-1',
        name: 'Mock Strategy 1',
      };

      const strategyId = await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg)
      );

      expect(strategyId).toBe('mock-1');
      expect(manager.getStrategyCount()).toBe(1);
      expect(manager.getStrategyIds()).toContain('mock-1');
    });

    test('should throw error when registering duplicate strategy ID', async () => {
      const config: StrategyConfig = {
        id: 'mock-duplicate',
        name: 'Mock Duplicate',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));

      await expect(
        manager.registerStrategy(config, (cfg) => new MockStrategy(cfg))
      ).rejects.toThrow("Strategy with ID 'mock-duplicate' already exists");
    });

    test('should register multiple strategies', async () => {
      const strategies = [
        { id: 'mock-1', name: 'Mock Strategy 1' },
        { id: 'mock-2', name: 'Mock Strategy 2' },
        { id: 'mock-3', name: 'Mock Strategy 3' },
      ];

      for (const strat of strategies) {
        await manager.registerStrategy(
          { id: strat.id, name: strat.name },
          (cfg) => new MockStrategy(cfg)
        );
      }

      expect(manager.getStrategyCount()).toBe(3);
      expect(manager.getStrategyIds()).toEqual(
        expect.arrayContaining(['mock-1', 'mock-2', 'mock-3'])
      );
    });
  });

  describe('Strategy Lifecycle', () => {
    test('should start and stop a strategy', async () => {
      const config: StrategyConfig = {
        id: 'mock-lifecycle',
        name: 'Mock Lifecycle',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));

      // Start strategy
      await manager.startStrategy('mock-lifecycle');
      let status = manager.getStrategyStatus('mock-lifecycle');
      expect(status?.isRunning).toBe(true);

      // Stop strategy
      await manager.stopStrategy('mock-lifecycle');
      status = manager.getStrategyStatus('mock-lifecycle');
      expect(status?.isRunning).toBe(false);
    });

    test('should pause and resume a strategy', async () => {
      const config: StrategyConfig = {
        id: 'mock-pause',
        name: 'Mock Pause',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('mock-pause');

      // Pause
      await manager.pauseStrategy('mock-pause');
      let status = manager.getStrategyStatus('mock-pause');
      expect(status?.isRunning).toBe(false);

      // Resume
      await manager.resumeStrategy('mock-pause');
      status = manager.getStrategyStatus('mock-pause');
      expect(status?.isRunning).toBe(true);
    });

    test('should handle start/stop on non-existent strategy', async () => {
      await expect(manager.startStrategy('non-existent')).rejects.toThrow(
        "Strategy 'non-existent' not found"
      );
      await expect(manager.stopStrategy('non-existent')).rejects.toThrow(
        "Strategy 'non-existent' not found"
      );
    });

    test('should unregister a strategy', async () => {
      const config: StrategyConfig = {
        id: 'mock-unregister',
        name: 'Mock Unregister',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      expect(manager.getStrategyCount()).toBe(1);

      const result = await manager.unregisterStrategy('mock-unregister');
      expect(result).toBe(true);
      expect(manager.getStrategyCount()).toBe(0);
    });

    test('should return false when unregistering non-existent strategy', async () => {
      const result = await manager.unregisterStrategy('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Strategy Execution', () => {
    test('should execute tick for running strategies', async () => {
      const config: StrategyConfig = {
        id: 'mock-exec',
        name: 'Mock Execution',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.startStrategy('mock-exec');

      const marketData = createMockMarketData();
      const results = await manager.executeTick(marketData);

      expect(results.size).toBe(1);
      const signal = results.get('mock-exec');
      expect(signal).not.toBeNull();
      expect(signal?.side).toBe('buy');
    });

    test('should not execute tick for stopped strategies', async () => {
      const config: StrategyConfig = {
        id: 'mock-stopped',
        name: 'Mock Stopped',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      // Don't start the strategy

      const marketData = createMockMarketData();
      const results = await manager.executeTick(marketData);

      expect(results.size).toBe(0);
    });

    test('should execute multiple strategies', async () => {
      await manager.registerStrategy(
        { id: 'mock-1', name: 'Mock 1' },
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.registerStrategy(
        { id: 'mock-2', name: 'Mock 2' },
        (cfg) => new MockStrategy(cfg, 'sell')
      );
      await manager.registerStrategy(
        { id: 'mock-3', name: 'Mock 3' },
        (cfg) => new MockStrategy(cfg) // No signal
      );

      await manager.startStrategy('mock-1');
      await manager.startStrategy('mock-2');
      await manager.startStrategy('mock-3');

      const marketData = createMockMarketData();
      const results = await manager.executeTick(marketData);

      expect(results.size).toBe(3);
      expect(results.get('mock-1')?.side).toBe('buy');
      expect(results.get('mock-2')?.side).toBe('sell');
      expect(results.get('mock-3')).toBeNull();
    });

    test('should track signal count', async () => {
      const config: StrategyConfig = {
        id: 'mock-count',
        name: 'Mock Count',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.startStrategy('mock-count');

      const marketData = createMockMarketData();

      // Execute 5 ticks
      for (let i = 0; i < 5; i++) {
        await manager.executeTick(marketData);
      }

      const status = manager.getStrategyStatus('mock-count');
      expect(status?.totalSignals).toBe(5);
    });
  });

  describe('Strategy Isolation', () => {
    test('should maintain isolated portfolios', async () => {
      await manager.registerStrategy(
        { id: 'mock-a', name: 'Mock A' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'mock-b', name: 'Mock B' },
        (cfg) => new MockStrategy(cfg)
      );

      const portfolioA = manager.getStrategyPortfolio('mock-a');
      const portfolioB = manager.getStrategyPortfolio('mock-b');

      expect(portfolioA).toBeDefined();
      expect(portfolioB).toBeDefined();
      expect(portfolioA).not.toBe(portfolioB);

      // Each should have initial cash
      expect(portfolioA?.getCash()).toBe(100000);
      expect(portfolioB?.getCash()).toBe(100000);
    });

    test('should process trades for specific strategy', async () => {
      await manager.registerStrategy(
        { id: 'mock-trade', name: 'Mock Trade' },
        (cfg) => new MockStrategy(cfg)
      );

      const portfolio = manager.getStrategyPortfolio('mock-trade');
      const initialCash = portfolio?.getCash() || 0;

      // Simulate a trade
      const trade = createMockTrade('mock-trade-buy-1', 'other-sell-1');
      manager.processTrade('mock-trade', trade, true); // Strategy is buyer

      const newCash = portfolio?.getCash() || 0;
      expect(newCash).toBeLessThan(initialCash); // Cash decreased due to buy
    });

    test('should maintain isolated order books', async () => {
      await manager.registerStrategy(
        { id: 'mock-ob-1', name: 'Mock OB 1' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'mock-ob-2', name: 'Mock OB 2' },
        (cfg) => new MockStrategy(cfg)
      );

      const status1 = manager.getStrategyStatus('mock-ob-1');
      const status2 = manager.getStrategyStatus('mock-ob-2');

      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
      // Each strategy should have independent state
    });
  });

  describe('Strategy Configuration', () => {
    test('should update strategy configuration', async () => {
      const config: StrategyConfig = {
        id: 'mock-config',
        name: 'Mock Config',
        params: { param1: 'value1' },
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));

      await manager.updateStrategyConfig('mock-config', {
        name: 'Updated Name',
        params: { param2: 'value2' },
      });

      const strategy = manager.getStrategy('mock-config');
      expect(strategy?.getConfig().name).toBe('Updated Name');
      expect(strategy?.getConfig().params?.param1).toBe('value1');
      expect(strategy?.getConfig().params?.param2).toBe('value2');
    });

    test('should handle config update for non-existent strategy', async () => {
      await expect(
        manager.updateStrategyConfig('non-existent', { name: 'New Name' })
      ).rejects.toThrow("Strategy 'non-existent' not found");
    });
  });

  describe('Strategy Status', () => {
    test('should get strategy status', async () => {
      const config: StrategyConfig = {
        id: 'mock-status',
        name: 'Mock Status',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('mock-status');

      const status = manager.getStrategyStatus('mock-status');
      expect(status).toBeDefined();
      expect(status?.id).toBe('mock-status');
      expect(status?.name).toBe('Mock Status');
      expect(status?.isRunning).toBe(true);
      expect(status?.totalSignals).toBe(0);
      expect(status?.totalTrades).toBe(0);
    });

    test('should return undefined for non-existent strategy status', () => {
      const status = manager.getStrategyStatus('non-existent');
      expect(status).toBeUndefined();
    });

    test('should get all strategy statuses', async () => {
      await manager.registerStrategy(
        { id: 'mock-1', name: 'Mock 1' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'mock-2', name: 'Mock 2' },
        (cfg) => new MockStrategy(cfg)
      );

      const statuses = manager.getAllStrategyStatuses();
      expect(statuses.length).toBe(2);
    });
  });

  describe('Event Emission', () => {
    test('should emit strategy:added event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:added', eventHandler);

      await manager.registerStrategy(
        { id: 'mock-event', name: 'Mock Event' },
        (cfg) => new MockStrategy(cfg)
      );

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'strategy:added',
          data: expect.objectContaining({
            strategy: 'mock-event',
          }),
        })
      );
    });

    test('should emit strategy:started event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:started', eventHandler);

      await manager.registerStrategy(
        { id: 'mock-start', name: 'Mock Start' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.startStrategy('mock-start');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'strategy:started',
          data: expect.objectContaining({
            strategy: 'mock-start',
          }),
        })
      );
    });

    test('should emit strategy:signal event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:signal', eventHandler);

      await manager.registerStrategy(
        { id: 'mock-signal', name: 'Mock Signal' },
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.startStrategy('mock-signal');

      const marketData = createMockMarketData();
      await manager.executeTick(marketData);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'strategy:signal',
          data: expect.objectContaining({
            strategy: 'mock-signal',
            signal: expect.objectContaining({
              side: 'buy',
            }),
          }),
        })
      );
    });
  });

  describe('Shutdown', () => {
    test('should shutdown all strategies', async () => {
      await manager.registerStrategy(
        { id: 'mock-1', name: 'Mock 1' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'mock-2', name: 'Mock 2' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.startStrategy('mock-1');
      await manager.startStrategy('mock-2');

      await manager.shutdown();

      expect(manager.getStrategyCount()).toBe(0);
    });

    test('should handle shutdown of empty manager', async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle strategy that throws error during tick', async () => {
      class ErrorStrategy extends Strategy {
        onTick(): OrderSignal | null {
          throw new Error('Strategy error during tick');
        }
      }

      await manager.registerStrategy(
        { id: 'mock-error', name: 'Mock Error' },
        (cfg) => new ErrorStrategy(cfg)
      );
      await manager.startStrategy('mock-error');

      const errorHandler = jest.fn();
      manager.on('strategy:error', errorHandler);

      const marketData = createMockMarketData();
      await expect(manager.executeTick(marketData)).resolves.not.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'strategy:error',
          data: expect.objectContaining({
            strategy: 'mock-error',
            error: 'Strategy error during tick',
          }),
        })
      );
    });

    test('should handle multiple ticks with stateful strategy', async () => {
      class StatefulStrategy extends Strategy {
        private counter = 0;

        onTick(): OrderSignal | null {
          this.counter++;
          if (this.counter >= 3) {
            return this.createSignal('buy', 100, 10);
          }
          return null;
        }
      }

      await manager.registerStrategy(
        { id: 'mock-stateful', name: 'Mock Stateful' },
        (cfg) => new StatefulStrategy(cfg)
      );
      await manager.startStrategy('mock-stateful');

      const marketData = createMockMarketData();

      // First two ticks should not generate signals
      await manager.executeTick(marketData);
      await manager.executeTick(marketData);

      // Third tick should generate signal
      const results = await manager.executeTick(marketData);
      expect(results.get('mock-stateful')).not.toBeNull();
    });
  });
});
