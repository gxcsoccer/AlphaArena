/**
 * Strategy Manager Coverage Tests
 *
 * Additional tests to improve code coverage for StrategyManager
 */

import { StrategyManager, StrategyManagerConfig } from '../../src/strategy/StrategyManager';
import { Strategy } from '../../src/strategy/Strategy';
import { StrategyConfig, StrategyContext, OrderSignal } from '../../src/strategy/types';
import { OrderBook } from '../../src/orderbook/OrderBook';

/**
 * Mock strategy for testing
 */
class MockStrategy extends Strategy {
  private tickCount: number = 0;
  private signalToGenerate?: 'buy' | 'sell';
  private throwError?: boolean;

  constructor(config: StrategyConfig, signalToGenerate?: 'buy' | 'sell', throwError?: boolean) {
    super(config);
    this.signalToGenerate = signalToGenerate;
    this.throwError = throwError;
  }

  onTick(context: StrategyContext): OrderSignal | null {
    this.tickCount++;
    
    if (this.throwError) {
      throw new Error('Test error in strategy');
    }

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
}

function createMockMarketData(): any {
  const orderBook = new OrderBook();
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

describe('StrategyManager Coverage Tests', () => {
  let manager: StrategyManager;

  beforeEach(() => {
    const config: StrategyManagerConfig = {
      enableCommunication: true,
      enablePersistence: false,
      initialCash: 100000,
      enableLogging: true,
    };
    manager = new StrategyManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Strategy Lifecycle', () => {
    test('should start a registered strategy', async () => {
      const config: StrategyConfig = {
        id: 'lifecycle-1',
        name: 'Lifecycle Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('lifecycle-1');

      const status = manager.getStrategyStatus('lifecycle-1');
      expect(status?.isRunning).toBe(true);
    });

    test('should stop a running strategy', async () => {
      const config: StrategyConfig = {
        id: 'stop-test',
        name: 'Stop Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('stop-test');
      await manager.stopStrategy('stop-test');

      const status = manager.getStrategyStatus('stop-test');
      expect(status?.isRunning).toBe(false);
    });

    test('should pause and resume a strategy', async () => {
      const config: StrategyConfig = {
        id: 'pause-test',
        name: 'Pause Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('pause-test');
      
      await manager.pauseStrategy('pause-test');
      let status = manager.getStrategyStatus('pause-test');
      expect(status?.isRunning).toBe(false);

      await manager.resumeStrategy('pause-test');
      status = manager.getStrategyStatus('pause-test');
      expect(status?.isRunning).toBe(true);
    });

    test('should unregister a strategy', async () => {
      const config: StrategyConfig = {
        id: 'remove-test',
        name: 'Remove Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      expect(manager.getStrategyCount()).toBe(1);

      await manager.unregisterStrategy('remove-test');
      expect(manager.getStrategyCount()).toBe(0);
    });

    test('should throw when starting non-existent strategy', async () => {
      await expect(manager.startStrategy('non-existent')).rejects.toThrow();
    });

    test('should throw when stopping non-existent strategy', async () => {
      await expect(manager.stopStrategy('non-existent')).rejects.toThrow();
    });
  });

  describe('Tick Execution', () => {
    test('should execute tick on running strategies', async () => {
      const config: StrategyConfig = {
        id: 'tick-test',
        name: 'Tick Test',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.startStrategy('tick-test');

      const marketData = createMockMarketData();
      const signals = await manager.executeTick(marketData);

      // executeTick returns a Map
      const signal = signals.get('tick-test');
      expect(signal).toBeDefined();
      expect(signal?.side).toBe('buy');
    });

    test('should not execute tick on stopped strategies', async () => {
      const config: StrategyConfig = {
        id: 'stopped-tick-test',
        name: 'Stopped Tick Test',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      // Don't start the strategy

      const marketData = createMockMarketData();
      const signals = await manager.executeTick(marketData);

      // Stopped strategies should not have signals
      expect(signals.get('stopped-tick-test')).toBeUndefined();
    });

    test('should handle strategy errors during tick', async () => {
      const config: StrategyConfig = {
        id: 'error-tick-test',
        name: 'Error Tick Test',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, undefined, true) // Will throw
      );
      await manager.startStrategy('error-tick-test');

      const marketData = createMockMarketData();
      
      // Should not throw, but handle error
      const signals = await manager.executeTick(marketData);
      expect(signals).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    test('should update strategy configuration', async () => {
      const config: StrategyConfig = {
        id: 'config-test',
        name: 'Config Test',
        params: { threshold: 0.5 },
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      
      const newConfig: Partial<StrategyConfig> = {
        name: 'Updated Config Test',
        params: { threshold: 0.8 },
      };

      await manager.updateStrategyConfig('config-test', newConfig);
      
      const status = manager.getStrategyStatus('config-test');
      expect(status?.name).toBe('Updated Config Test');
    });

    test('should throw when updating non-existent strategy', async () => {
      const config: Partial<StrategyConfig> = {
        name: 'Non-existent',
      };

      await expect(manager.updateStrategyConfig('non-existent', config)).rejects.toThrow();
    });
  });

  describe('Event Emission', () => {
    test('should emit strategy:added event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:added', eventHandler);

      const config: StrategyConfig = {
        id: 'event-added-test',
        name: 'Event Added Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));

      expect(eventHandler).toHaveBeenCalled();
    });

    test('should emit strategy:removed event on unregister', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:removed', eventHandler);

      const config: StrategyConfig = {
        id: 'event-removed-test',
        name: 'Event Removed Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.unregisterStrategy('event-removed-test');

      expect(eventHandler).toHaveBeenCalled();
    });

    test('should emit strategy:started event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:started', eventHandler);

      const config: StrategyConfig = {
        id: 'event-started-test',
        name: 'Event Started Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('event-started-test');

      expect(eventHandler).toHaveBeenCalled();
    });

    test('should emit strategy:stopped event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:stopped', eventHandler);

      const config: StrategyConfig = {
        id: 'event-stopped-test',
        name: 'Event Stopped Test',
      };

      await manager.registerStrategy(config, (cfg) => new MockStrategy(cfg));
      await manager.startStrategy('event-stopped-test');
      await manager.stopStrategy('event-stopped-test');

      expect(eventHandler).toHaveBeenCalled();
    });

    test('should emit strategy:signal event', async () => {
      const eventHandler = jest.fn();
      manager.on('strategy:signal', eventHandler);

      const config: StrategyConfig = {
        id: 'event-signal-test',
        name: 'Event Signal Test',
      };

      await manager.registerStrategy(
        config,
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.startStrategy('event-signal-test');

      const marketData = createMockMarketData();
      await manager.executeTick(marketData);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Status and Statistics', () => {
    test('should get all strategy statuses', async () => {
      await manager.registerStrategy(
        { id: 'status-1', name: 'Status 1' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'status-2', name: 'Status 2' },
        (cfg) => new MockStrategy(cfg)
      );

      await manager.startStrategy('status-1');

      const statuses = manager.getAllStrategyStatuses();
      expect(statuses.length).toBe(2);
      expect(statuses.find(s => s.id === 'status-1')?.isRunning).toBe(true);
      expect(statuses.find(s => s.id === 'status-2')?.isRunning).toBe(false);
    });

    test('should return undefined for non-existent strategy status', () => {
      const status = manager.getStrategyStatus('non-existent');
      expect(status).toBeUndefined();
    });

    test('should track portfolio value in status', async () => {
      await manager.registerStrategy(
        { id: 'portfolio-test', name: 'Portfolio Test' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.startStrategy('portfolio-test');

      const status = manager.getStrategyStatus('portfolio-test');
      expect(status?.portfolioValue).toBe(100000); // Initial cash
      expect(status?.cash).toBe(100000);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown all strategies', async () => {
      await manager.registerStrategy(
        { id: 'shutdown-1', name: 'Shutdown 1' },
        (cfg) => new MockStrategy(cfg)
      );
      await manager.registerStrategy(
        { id: 'shutdown-2', name: 'Shutdown 2' },
        (cfg) => new MockStrategy(cfg)
      );

      await manager.startStrategy('shutdown-1');
      await manager.startStrategy('shutdown-2');

      await manager.shutdown();

      expect(manager.getStrategyCount()).toBe(0);
    });
  });

  describe('Multiple Strategies', () => {
    test('should manage multiple strategies independently', async () => {
      // Register multiple strategies with different signals
      await manager.registerStrategy(
        { id: 'multi-1', name: 'Multi 1' },
        (cfg) => new MockStrategy(cfg, 'buy')
      );
      await manager.registerStrategy(
        { id: 'multi-2', name: 'Multi 2' },
        (cfg) => new MockStrategy(cfg, 'sell')
      );
      await manager.registerStrategy(
        { id: 'multi-3', name: 'Multi 3' },
        (cfg) => new MockStrategy(cfg) // No signal
      );

      await manager.startStrategy('multi-1');
      await manager.startStrategy('multi-2');
      // Don't start multi-3

      const marketData = createMockMarketData();
      const signals = await manager.executeTick(marketData);

      // Only running strategies should generate signals
      expect(signals.get('multi-1')?.side).toBe('buy');
      expect(signals.get('multi-2')?.side).toBe('sell');
    });
  });
});
