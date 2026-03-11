/**
 * Market Data Simulator - 市场数据模拟器
 *
 * Generates realistic real-time market data for testing and simulation.
 * Uses random walk with mean reversion to simulate price movements.
 */

import { MarketTick } from './types';
import { EventEmitter } from 'events';

/**
 * Market Data Simulator
 */
export class MarketDataSimulator extends EventEmitter {
  private symbols: string[];
  private prices: Map<string, number>;
  private volatility: number;
  private running: boolean = false;
  private tickInterval: number;
  private tickTimer?: NodeJS.Timeout;
  private tickCount: number = 0;

  constructor(
    symbols: string[],
    initialPrices: Map<string, number>,
    volatility: number = 0.02,
    tickInterval: number = 1000 // 1 second default
  ) {
    super();
    this.symbols = symbols;
    this.prices = new Map(initialPrices);
    this.volatility = volatility;
    this.tickInterval = tickInterval;

    // Validate initial prices
    symbols.forEach((symbol) => {
      if (!this.prices.has(symbol)) {
        this.prices.set(symbol, 100); // Default price
      }
    });
  }

  /**
   * Start the simulator
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.tickCount = 0;

    this.emit('start', {
      timestamp: Date.now(),
      symbols: this.symbols,
    });

    // Start tick loop
    this.tickTimer = setInterval(() => this.tick(), this.tickInterval);
  }

  /**
   * Stop the simulator
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }

    this.emit('stop', {
      timestamp: Date.now(),
      totalTicks: this.tickCount,
    });
  }

  /**
   * Pause the simulator
   */
  pause(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }

    this.emit('pause', {
      timestamp: Date.now(),
    });
  }

  /**
   * Resume the simulator
   */
  resume(): void {
    if (!this.running || this.tickTimer) {
      return;
    }

    this.tickTimer = setInterval(() => this.tick(), this.tickInterval);

    this.emit('resume', {
      timestamp: Date.now(),
    });
  }

  /**
   * Get current price for a symbol
   */
  getPrice(symbol: string): number | undefined {
    return this.prices.get(symbol);
  }

  /**
   * Get all current prices
   */
  getAllPrices(): Map<string, number> {
    return new Map(this.prices);
  }

  /**
   * Get current state
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Generate a single tick for all symbols
   */
  tick(): void {
    if (!this.running) {
      return;
    }

    this.tickCount++;
    const timestamp = Date.now();
    const ticks: MarketTick[] = [];

    // Generate tick for each symbol
    this.symbols.forEach((symbol) => {
      const currentPrice = this.prices.get(symbol) || 100;
      const newPrice = this.simulatePriceMovement(currentPrice);

      // Update price
      this.prices.set(symbol, newPrice);

      // Generate bid/ask spread (0.1% typical)
      const spread = newPrice * 0.001;
      const bid = newPrice - spread / 2;
      const ask = newPrice + spread / 2;

      // Generate random volume (100-10000)
      const volume = Math.floor(Math.random() * 9900) + 100;

      const tick: MarketTick = {
        symbol,
        price: newPrice,
        bid,
        ask,
        volume,
        timestamp,
      };

      ticks.push(tick);

      // Emit individual symbol tick
      this.emit('tick', tick);
      this.emit(`tick:${symbol}`, tick);
    });

    // Emit batch tick event
    this.emit('ticks', ticks);
  }

  /**
   * Simulate price movement using geometric Brownian motion
   * with mean reversion
   */
  private simulatePriceMovement(currentPrice: number): number {
    // Random component (geometric Brownian motion)
    const randomShock = (Math.random() - 0.5) * 2 * this.volatility;

    // Mean reversion component (pull towards initial price)
    const initialPrice = 100;
    const meanReversion = (0.001 * (initialPrice - currentPrice)) / initialPrice;

    // Combine both components
    const change = currentPrice * (randomShock + meanReversion);
    const newPrice = currentPrice + change;

    // Ensure price stays positive and reasonable
    return Math.max(1, Math.min(newPrice, 10000));
  }

  /**
   * Set volatility
   */
  setVolatility(volatility: number): void {
    this.volatility = Math.max(0, Math.min(1, volatility));
  }

  /**
   * Set tick interval
   */
  setTickInterval(interval: number): void {
    this.tickInterval = Math.max(100, interval); // Minimum 100ms

    // Restart timer if running
    if (this.running && this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => this.tick(), this.tickInterval);
    }
  }
}
