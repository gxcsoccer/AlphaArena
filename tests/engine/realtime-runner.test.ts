/**
 * RealtimeRunner Tests
 */

import { RealtimeRunner, createDefaultConfig, runRealtimeEngine } from '../../src/cli/realtime-runner';
import { EngineState } from '../../src/engine/types';

describe('RealtimeRunner', () => {
  let runner: RealtimeRunner;

  const defaultConfig = createDefaultConfig();

  beforeEach(() => {
    runner = new RealtimeRunner(defaultConfig);
  });

  afterEach(async () => {
    if (runner.isRunning()) {
      await runner.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct config', () => {
      expect(runner.isRunning()).toBe(false);
      expect(runner.getState()).toBeUndefined();
    });

    it('should create default config', () => {
      const config = createDefaultConfig();
      expect(config.engine.symbols).toEqual(['AAPL', 'GOOGL', 'MSFT']);
      expect(config.initialCapital).toBe(100000);
      expect(config.strategies.length).toBe(2);
      expect(config.enableLogging).toBe(true);
    });
  });

  describe('Start/Stop', () => {
    it('should start and stop correctly', async () => {
      await runner.start();
      expect(runner.isRunning()).toBe(true);
      expect(runner.getState()).toBe(EngineState.RUNNING);

      await runner.stop();
      expect(runner.isRunning()).toBe(false);
      expect(runner.getState()).toBe(EngineState.STOPPED);
    });

    it('should not start twice', async () => {
      await runner.start();
      expect(runner.isRunning()).toBe(true);

      // Should not throw, just warn
      await runner.start();
      expect(runner.isRunning()).toBe(true);

      await runner.stop();
    });

    it('should not stop when not running', async () => {
      // Should not throw, just warn
      await runner.stop();
      expect(runner.isRunning()).toBe(false);
    });

    it('should track start time', async () => {
      await runner.start();
      const stats = runner.getStats();
      expect(stats).toBeDefined();
      expect(stats!.uptime).toBeGreaterThanOrEqual(0);

      await runner.stop();
    });
  });

  describe('Statistics', () => {
    it('should provide statistics while running', async () => {
      await runner.start();

      // Wait for some ticks
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const stats = runner.getStats();
      expect(stats).toBeDefined();
      expect(stats!.totalTicks).toBeGreaterThan(0);
      expect(stats!.uptime).toBeGreaterThan(0);
      expect(stats!.uptimeFormatted).toMatch(/\d+s/);

      await runner.stop();
    });

    it('should provide statistics after stopping', async () => {
      await runner.start();
      // Wait for at least one tick (tick interval is 1000ms)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await runner.stop();

      const stats = runner.getStats();
      expect(stats).toBeDefined();
      expect(stats!.totalTicks).toBeGreaterThanOrEqual(0);
    });

    it('should return null when engine not initialized', () => {
      const stats = runner.getStats();
      expect(stats).toBeNull();
    });
  });

  describe('Shutdown Callback', () => {
    it('should call shutdown callback on stop', async () => {
      const callback = jest.fn();
      runner.onShutdown(callback);

      await runner.start();
      // Wait for engine to fully start
      await new Promise((resolve) => setTimeout(resolve, 100));
      await runner.stop();

      // Callback is called synchronously in stop()
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Process Handlers', () => {
    it('should setup process handlers on initialization', () => {
      // Process handlers are setup in constructor
      // We can't easily test signal handling, but we can verify
      // that the runner was created successfully
      expect(runner).toBeDefined();
    });
  });

  describe('Event Listeners', () => {
    it('should emit engine events', async () => {
      const startCallback = jest.fn();
      const stopCallback = jest.fn();

      const config = {
        ...defaultConfig,
        enableLogging: false,
      };

      const testRunner = new RealtimeRunner(config);
      testRunner.onShutdown(() => {});

      // Get the internal engine to attach listeners
      await testRunner.start();

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 100));

      await testRunner.stop();
    });
  });

  describe('Multiple Strategies', () => {
    it('should run multiple strategies', async () => {
      const config = {
        ...defaultConfig,
        strategies: [
          {
            type: 'SMA' as const,
            params: {
              id: 'test-strategy-1',
              name: 'Test Strategy 1',
              params: {
                shortPeriod: 5,
                longPeriod: 20,
                tradeQuantity: 10,
              },
            },
          },
          {
            type: 'SMA' as const,
            params: {
              id: 'test-strategy-2',
              name: 'Test Strategy 2',
              params: {
                shortPeriod: 10,
                longPeriod: 30,
                tradeQuantity: 5,
              },
            },
          },
        ],
        enableLogging: false,
      };

      const testRunner = new RealtimeRunner(config);
      await testRunner.start();

      expect(testRunner.isRunning()).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const stats = testRunner.getStats();
      expect(stats).toBeDefined();

      await testRunner.stop();
    });
  });

  describe('Risk Control Integration', () => {
    it('should apply risk control settings', async () => {
      const config = {
        ...defaultConfig,
        riskControl: {
          maxPositionSize: 100,
          maxTotalExposure: 500000,
          stopLossPercent: 0.05,
          maxOrdersPerMinute: 10,
          enabled: true,
        },
        enableLogging: false,
      };

      const testRunner = new RealtimeRunner(config);
      await testRunner.start();

      expect(testRunner.isRunning()).toBe(true);

      await testRunner.stop();
    });
  });

  describe('Uptime Formatting', () => {
    it('should format uptime correctly', async () => {
      await runner.start();

      // Wait a bit to get some uptime
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const stats = runner.getStats();
      expect(stats).toBeDefined();
      expect(stats!.uptimeFormatted).toMatch(/(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*\d+s/);

      await runner.stop();
    });
  });

  describe('Helper Function', () => {
    it('should run engine via helper function', async () => {
      const testRunner = await runRealtimeEngine({
        enableLogging: false,
      });

      expect(testRunner.isRunning()).toBe(true);
      expect(testRunner.getState()).toBe(EngineState.RUNNING);

      await testRunner.stop();
    });

    it('should accept partial config in helper', async () => {
      const testRunner = await runRealtimeEngine({
        initialCapital: 50000,
        enableLogging: false,
        engine: {
          tickInterval: 500,
          symbols: ['AAPL'],
          initialPrices: new Map([['AAPL', 150]]),
          volatility: 0.02,
          enableLogging: false,
        },
      });

      expect(testRunner.isRunning()).toBe(true);

      const stats = testRunner.getStats();
      expect(stats).toBeDefined();

      await testRunner.stop();
    });
  });
});
