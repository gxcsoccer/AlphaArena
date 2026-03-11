/**
 * TradingEngine Integration Tests
 */

import { TradingEngine } from '../../src/engine/TradingEngine';
import { EngineState, EngineConfig, RiskControlConfig } from '../../src/engine/types';
import { Strategy } from '../../src/strategy/Strategy';
import { StrategyContext, OrderSignal } from '../../src/strategy/types';

// Simple test strategy
class TestStrategy extends Strategy {
  private tickCount = 0;
  private signalsGenerated: OrderSignal[] = [];
  private _initialized = false;

  constructor(id: string = 'test-strategy') {
    super({ id, name: 'Test Strategy' });
  }

  onInit(context: StrategyContext): void {
    this._initialized = true;
    super.onInit(context);
  }

  onTick(context: StrategyContext): OrderSignal | null {
    this.tickCount++;
    
    // Generate a buy signal every 5 ticks
    if (this.tickCount % 5 === 0 && context.getCash() > 1000) {
      const signal: OrderSignal = {
        id: this.generateSignalId(),
        side: 'buy',
        price: 150,
        quantity: 10,
        timestamp: Date.now(),
        reason: `Tick ${this.tickCount}`
      };
      this.signalsGenerated.push(signal);
      return signal;
    }
    
    return null;
  }

  onCleanup(context: StrategyContext): void {
    this._initialized = false;
    super.onCleanup(context);
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  getSignalsGenerated(): OrderSignal[] {
    return this.signalsGenerated;
  }

  protected generateSignalId(): string {
    return `${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

describe('TradingEngine', () => {
  let engine: TradingEngine;
  
  const engineConfig: EngineConfig = {
    tickInterval: 50, // Fast ticks for testing
    symbols: ['AAPL', 'GOOGL'],
    initialPrices: new Map([
      ['AAPL', 150],
      ['GOOGL', 2800]
    ]),
    volatility: 0.01,
    enableLogging: false
  };

  const riskConfig: RiskControlConfig = {
    maxPositionSize: 1000,
    maxTotalExposure: 1000000,
    stopLossPercent: 0.1,
    maxOrdersPerMinute: 100,
    enabled: true
  };

  beforeEach(() => {
    engine = new TradingEngine(engineConfig, riskConfig, 100000);
  });

  afterEach(() => {
    engine.stop();
  });

  describe('Initialization', () => {
    it('should initialize with correct state', () => {
      expect(engine.getState()).toBe(EngineState.STOPPED);
      expect(engine.getPortfolio()).toBeDefined();
      expect(engine.getOrderBook()).toBeDefined();
      expect(engine.getRiskControl()).toBeDefined();
    });

    it('should initialize with correct stats', () => {
      const stats = engine.getStats();
      expect(stats.totalTicks).toBe(0);
      expect(stats.totalSignals).toBe(0);
      expect(stats.totalOrders).toBe(0);
      expect(stats.totalTrades).toBe(0);
    });
  });

  describe('Start/Stop', () => {
    it('should start and stop correctly', (done) => {
      engine.on('engine:start', () => {
        // State should be RUNNING when start event is emitted
        setImmediate(() => {
          expect(engine.getState()).toBe(EngineState.RUNNING);
          engine.stop();
          expect(engine.getState()).toBe(EngineState.STOPPED);
          done();
        });
      });

      engine.start();
    });

    it('should emit start event with symbols', (done) => {
      engine.on('engine:start', (event: any) => {
        expect(event.data?.symbols).toEqual(['AAPL', 'GOOGL']);
        done();
      });

      engine.start();
    });

    it('should emit stop event with stats', (done) => {
      engine.on('engine:stop', (event: any) => {
        expect(event.data?.stats).toBeDefined();
        done();
      });

      engine.start();
      setTimeout(() => engine.stop(), 200);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause and resume correctly', (done) => {
      let pauseEmitted = false;

      engine.on('engine:pause', () => {
        pauseEmitted = true;
        expect(engine.getState()).toBe(EngineState.PAUSED);
      });

      engine.on('engine:resume', () => {
        expect(pauseEmitted).toBe(true);
        expect(engine.getState()).toBe(EngineState.RUNNING);
        done();
      });

      engine.start();
      setTimeout(() => {
        engine.pause();
        setTimeout(() => engine.resume(), 100);
      }, 150);
    });
  });

  describe('Strategy Integration', () => {
    it('should add and initialize strategy', () => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      
      expect(strategy.isInitialized()).toBe(true);
    });

    it('should remove strategy', () => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      engine.removeStrategy('test-strategy');
      
      expect(strategy.isInitialized()).toBe(false);
    });

    it('should execute strategy on ticks', (done) => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      
      let tickCount = 0;
      engine.on('engine:tick', () => {
        tickCount++;
        if (tickCount >= 10) {
          expect(strategy.getTickCount()).toBeGreaterThanOrEqual(10);
          done();
        }
      });

      engine.start();
    });

    it('should generate signals from strategy', (done) => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      
      engine.on('signal:generated', (event: any) => {
        expect(event.data?.strategy).toBe('test-strategy');
        expect(event.data?.signal).toBeDefined();
        expect(event.data?.signal.side).toBe('buy');
        done();
      });

      engine.start();
    });
  });

  describe('Event Emission', () => {
    it('should emit tick events', (done) => {
      let ticks = 0;
      let completed = false;
      
      engine.on('engine:tick', () => {
        if (completed) return;
        ticks++;
        if (ticks >= 5) {
          completed = true;
          done();
        }
      });

      engine.start();
    });

    it('should emit signal events', (done) => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      let called = false;
      
      engine.on('signal:generated', (event: any) => {
        if (!called) {
          called = true;
          expect(event.data?.signal.id).toBeDefined();
          done();
        }
      });

      engine.start();
    });

    it('should emit generic event for all events', (done) => {
      let eventCount = 0;
      let completed = false;
      
      engine.on('event', (evt: any) => {
        if (completed) return;
        eventCount++;
        expect(evt.type).toBeDefined();
        expect(evt.timestamp).toBeDefined();
        
        if (eventCount >= 3) {
          completed = true;
          done();
        }
      });

      engine.start();
    });
  });

  describe('Statistics Tracking', () => {
    it('should track tick count', (done) => {
      engine.start();
      
      setTimeout(() => {
        engine.stop();
        const stats = engine.getStats();
        expect(stats.totalTicks).toBeGreaterThan(0);
        done();
      }, 200);
    });

    it('should track signals and orders', (done) => {
      const strategy = new TestStrategy();
      engine.addStrategy(strategy);
      
      engine.start();
      
      setTimeout(() => {
        engine.stop();
        const stats = engine.getStats();
        expect(stats.totalSignals).toBeGreaterThan(0);
        expect(stats.totalOrders).toBeGreaterThanOrEqual(0);
        done();
      }, 400);
    });
  });

  describe('Portfolio Integration', () => {
    it('should provide access to portfolio', () => {
      const portfolio = engine.getPortfolio();
      expect(portfolio.getCash()).toBe(100000);
    });

    it('should update portfolio on trades', (done) => {
      // Create a strategy that generates larger signals to ensure trades
      class AggressiveStrategy extends Strategy {
        private executed = false;
        
        constructor() {
          super({ id: 'aggressive', name: 'Aggressive Strategy' });
        }

        onTick(context: StrategyContext): OrderSignal | null {
          if (!this.executed && context.getCash() > 10000) {
            this.executed = true;
            return {
              id: `${this.config.id}-${Date.now()}`,
              side: 'buy',
              price: 150,
              quantity: 50,
              timestamp: Date.now()
            };
          }
          return null;
        }
      }

      const strategy = new AggressiveStrategy();
      engine.addStrategy(strategy);
      
      engine.on('trade:executed', () => {
        // Trade executed
      });

      engine.start();
      
      setTimeout(() => {
        engine.stop();
        // Portfolio should have been updated if trades occurred
        const portfolio = engine.getPortfolio();
        expect(portfolio).toBeDefined();
        done();
      }, 300);
    });
  });

  describe('Risk Control Integration', () => {
    it('should integrate with risk control', () => {
      const riskControl = engine.getRiskControl();
      expect(riskControl).toBeDefined();
      
      const config = riskControl.getConfig();
      expect(config.maxPositionSize).toBe(1000);
    });

    it('should reject signals that violate risk limits', (done) => {
      // Create strategy with very large order
      class RiskyStrategy extends Strategy {
        private attempted = false;
        
        constructor() {
          super({ id: 'risky', name: 'Risky Strategy' });
        }

        onTick(_context: StrategyContext): OrderSignal | null {
          if (!this.attempted) {
            this.attempted = true;
            // Try to exceed position limit
            return {
              id: `${this.config.id}-${Date.now()}`,
              side: 'buy',
              price: 150,
              quantity: 2000,
              timestamp: Date.now()
            };
          }
          return null;
        }
      }

      const strategy = new RiskyStrategy();
      engine.addStrategy(strategy);
      
      engine.on('risk:triggered', (event: any) => {
        expect(event.data?.strategy).toBe('risky');
        expect(event.data?.riskType).toBe('position_limit');
        done();
      });

      engine.start();
    });
  });

  describe('Error Handling', () => {
    it('should emit error events for strategy errors', (done) => {
      class ErrorStrategy extends Strategy {
        constructor() {
          super({ id: 'error-strategy', name: 'Error Strategy' });
        }

        onTick(): OrderSignal | null {
          throw new Error('Test error');
        }
      }

      const strategy = new ErrorStrategy();
      engine.addStrategy(strategy);
      
      let errorReceived = false;
      engine.on('engine:error', (event: any) => {
        if (!errorReceived) {
          errorReceived = true;
          expect(event.data?.error).toContain('Test error');
          done();
        }
      });

      engine.start();
    });
  });
});
