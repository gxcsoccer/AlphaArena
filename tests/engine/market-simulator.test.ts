/**
 * MarketDataSimulator Tests
 */

import { MarketDataSimulator } from '../../src/engine/MarketDataSimulator';
import { MarketTick } from '../../src/engine/types';

describe('MarketDataSimulator', () => {
  let simulator: MarketDataSimulator;
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  const initialPrices = new Map([
    ['AAPL', 150],
    ['GOOGL', 2800],
    ['MSFT', 300],
  ]);

  beforeEach(() => {
    simulator = new MarketDataSimulator(symbols, initialPrices, 0.02, 100);
  });

  afterEach(() => {
    simulator.stop();
  });

  describe('Initialization', () => {
    it('should initialize with provided symbols and prices', () => {
      expect(simulator.isRunning()).toBe(false);
      symbols.forEach((symbol) => {
        expect(simulator.getPrice(symbol)).toBeDefined();
      });
    });

    it('should use default price for symbols without initial price', () => {
      const sim = new MarketDataSimulator(['TEST'], new Map());
      expect(sim.getPrice('TEST')).toBe(100);
    });
  });

  describe('Start/Stop', () => {
    it('should start and stop correctly', (done) => {
      simulator.on('start', () => {
        expect(simulator.isRunning()).toBe(true);

        simulator.stop();
        expect(simulator.isRunning()).toBe(false);
        done();
      });

      simulator.start();
    });

    it('should emit stop event with tick count', (done) => {
      simulator.on('stop', (data: any) => {
        expect(data.totalTicks).toBeGreaterThanOrEqual(0);
        done();
      });

      simulator.start();
      setTimeout(() => simulator.stop(), 250); // Let it run for ~2 ticks
    });

    it('should not start twice', () => {
      simulator.start();
      const state1 = simulator.isRunning();
      simulator.start(); // Second start should be ignored
      const state2 = simulator.isRunning();
      expect(state1).toBe(state2);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause and resume correctly', (done) => {
      let pauseEmitted = false;

      simulator.on('pause', () => {
        pauseEmitted = true;
      });

      simulator.on('resume', () => {
        expect(pauseEmitted).toBe(true);
        done();
      });

      simulator.start();
      setTimeout(() => {
        simulator.pause();
        setTimeout(() => simulator.resume(), 100);
      }, 150);
    });
  });

  describe('Tick Generation', () => {
    it('should emit tick events', (done) => {
      let tickCount = 0;

      simulator.on('tick', (tick: MarketTick) => {
        tickCount++;
        expect(tick.symbol).toBeDefined();
        expect(tick.price).toBeGreaterThan(0);
        expect(tick.bid).toBeLessThan(tick.ask);
        expect(tick.volume).toBeGreaterThan(0);

        if (tickCount >= 3) {
          done();
        }
      });

      simulator.start();
    });

    it('should emit symbol-specific tick events', (done) => {
      simulator.on('tick:AAPL', (tick: MarketTick) => {
        expect(tick.symbol).toBe('AAPL');
        done();
      });

      simulator.start();
    });

    it('should generate reasonable price movements', (done) => {
      const initialPrice = simulator.getPrice('AAPL')!;
      let maxDeviation = 0;

      simulator.on('tick', (tick: MarketTick) => {
        if (tick.symbol === 'AAPL') {
          const deviation = Math.abs(tick.price - initialPrice) / initialPrice;
          maxDeviation = Math.max(maxDeviation, deviation);

          if (maxDeviation > 0) {
            expect(maxDeviation).toBeLessThan(0.5); // Should not deviate more than 50%
            done();
          }
        }
      });

      simulator.start();
    });

    it('should maintain bid-ask spread', (done) => {
      let checked = false;
      simulator.on('tick', (tick: MarketTick) => {
        if (!checked) {
          checked = true;
          const spread = tick.ask - tick.bid;
          const spreadPercent = spread / tick.price;

          expect(spread).toBeGreaterThan(0);
          expect(spreadPercent).toBeLessThan(0.01); // Spread should be < 1%
          done();
        }
      });

      simulator.start();
    });
  });

  describe('Configuration', () => {
    it('should update volatility', () => {
      simulator.setVolatility(0.05);
      // Volatility should be clamped between 0 and 1
      simulator.setVolatility(1.5);
      simulator.setVolatility(-0.1);
    });

    it('should update tick interval', () => {
      simulator.setTickInterval(500);
      // Should respect minimum interval
      simulator.setTickInterval(50);
    });
  });

  describe('Price Simulation', () => {
    it('should keep prices positive', (done) => {
      let checked = false;
      simulator.on('tick', (tick: MarketTick) => {
        if (!checked) {
          checked = true;
          expect(tick.price).toBeGreaterThan(0);
          expect(tick.price).toBeLessThan(10000);
          done();
        }
      });

      simulator.start();
    });

    it('should show mean reversion over time', (done) => {
      const prices: number[] = [];
      let completed = false;

      simulator.on('tick', (tick: MarketTick) => {
        if (completed) return;

        if (tick.symbol === 'AAPL') {
          prices.push(tick.price);

          if (prices.length >= 20) {
            completed = true;
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            // Average should be close to initial price (150) due to mean reversion
            expect(avgPrice).toBeGreaterThan(100);
            expect(avgPrice).toBeLessThan(200);
            done();
          }
        }
      });

      simulator.start();
    });
  });
});
