/**
 * Real-time Trading Engine Runner - 实时交易引擎运行器
 *
 * Provides a persistent background process for:
 * - 7x24 hour continuous trading engine operation
 * - Graceful shutdown and restart
 * - Process management and monitoring
 * - Logging and metrics collection
 */

import { TradingEngine } from '../engine/TradingEngine';
import { EngineConfig, EngineState, RiskControlConfig } from '../engine/types';
import { SMAStrategy } from '../strategy/SMAStrategy';
import { RSIStrategy } from '../strategy/RSIStrategy';
import { MACDStrategy } from '../strategy/MACDStrategy';
import { BollingerBandsStrategy } from '../strategy/BollingerBandsStrategy';
import { StochasticStrategy } from '../strategy/StochasticStrategy';
import { ATRStrategy } from '../strategy/ATRStrategy';

/**
 * Real-time Trading Runner Configuration
 */
export interface RunnerConfig {
  /** Engine configuration */
  engine: EngineConfig;
  /** Risk control configuration */
  riskControl: RiskControlConfig;
  /** Initial capital */
  initialCapital: number;
  /** Strategies to run */
  strategies: Array<{
    type: 'SMA' | 'RSI' | 'MACD' | 'Bollinger' | 'Stochastic' | 'ATR';
    params: {
      id: string;
      name: string;
      params: {
        shortPeriod?: number;
        longPeriod?: number;
        period?: number;
        overbought?: number;
        oversold?: number;
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
        stdDevMultiplier?: number;
        squeezeThreshold?: number;
        kPeriod?: number;
        dPeriod?: number;
        smoothPeriod?: number;
        atrMultiplier?: number;
        trendPeriod?: number;
        dynamicPositionSizing?: boolean;
        riskPerTrade?: number;
        tradeQuantity: number;
      };
    };
  }>;
  /** Enable logging */
  enableLogging: boolean;
  /** Log file path (optional) */
  logFile?: string;
}

/**
 * Real-time Trading Runner
 *
 * Manages the lifecycle of the trading engine:
 * - Startup and initialization
 * - Graceful shutdown
 * - Error recovery
 * - Logging
 */
export class RealtimeRunner {
  private config: RunnerConfig;
  private engine?: TradingEngine;
  private running: boolean = false;
  private startTime?: number;
  private shutdownCallback?: () => void;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.setupProcessHandlers();
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    const shutdown = (signal: string) => {
      console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
      this.stop()
        .then(() => {
          console.log(`[${new Date().toISOString()}] Shutdown complete`);
          if (this.shutdownCallback) {
            this.shutdownCallback();
          }
          process.exit(0);
        })
        .catch((error) => {
          console.error(`[${new Date().toISOString()}] Shutdown error:`, error);
          process.exit(1);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
      this.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
      this.stop().finally(() => process.exit(1));
    });
  }

  /**
   * Start the trading engine
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[Runner] Engine is already running');
      return;
    }

    console.log(`[${new Date().toISOString()}] 🚀 Starting Real-time Trading Engine...`);
    console.log(`[${new Date().toISOString()}] Configuration:`);
    console.log(`   Symbols: ${this.config.engine.symbols.join(', ')}`);
    console.log(`   Tick Interval: ${this.config.engine.tickInterval}ms`);
    console.log(`   Initial Capital: $${this.config.initialCapital.toLocaleString()}`);
    console.log(`   Strategies: ${this.config.strategies.length}`);

    try {
      // Initialize engine
      this.engine = new TradingEngine(
        this.config.engine,
        this.config.riskControl,
        this.config.initialCapital
      );

      // Setup event listeners
      this.setupEventListeners();

      // Add strategies
      this.config.strategies.forEach((strategyConfig) => {
        if (strategyConfig.type === 'SMA') {
          const strategy = new SMAStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        } else if (strategyConfig.type === 'RSI') {
          const strategy = new RSIStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        } else if (strategyConfig.type === 'MACD') {
          const strategy = new MACDStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        } else if (strategyConfig.type === 'Bollinger') {
          const strategy = new BollingerBandsStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        } else if (strategyConfig.type === 'Stochastic') {
          const strategy = new StochasticStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        } else if (strategyConfig.type === 'ATR') {
          const strategy = new ATRStrategy({
            id: strategyConfig.params.id,
            name: strategyConfig.params.name,
            params: strategyConfig.params.params as any,
          });
          this.engine!.addStrategy(strategy);
          console.log(`[${new Date().toISOString()}]   ✓ Strategy added: ${strategyConfig.params.id}`);
        }
      });

      // Start engine
      this.engine.start();
      this.running = true;
      this.startTime = Date.now();

      console.log(`[${new Date().toISOString()}] ✅ Trading engine started successfully`);
      console.log(`[${new Date().toISOString()}] 📊 Engine State: ${this.engine.getState()}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to start engine:`, error);
      throw error;
    }
  }

  /**
   * Stop the trading engine
   */
  async stop(): Promise<void> {
    if (!this.running || !this.engine) {
      console.warn('[Runner] Engine is not running');
      return;
    }

    console.log(`[${new Date().toISOString()}] Stopping trading engine...`);

    try {
      // Stop engine
      this.engine.stop();
      this.running = false;

      // Print final statistics
      this.printFinalStats();

      console.log(`[${new Date().toISOString()}] ✅ Trading engine stopped`);

      // Call shutdown callback
      if (this.shutdownCallback) {
        this.shutdownCallback();
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error stopping engine:`, error);
      throw error;
    }
  }

  /**
   * Get current engine state
   */
  getState(): EngineState | undefined {
    return this.engine?.getState();
  }

  /**
   * Get current statistics
   */
  getStats() {
    if (!this.engine) {
      return null;
    }

    const stats = this.engine.getStats();
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      ...stats,
      uptime,
      uptimeFormatted: this.formatUptime(uptime),
    };
  }

  /**
   * Check if runner is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Set shutdown callback
   */
  onShutdown(callback: () => void): void {
    this.shutdownCallback = callback;
  }

  /**
   * Setup engine event listeners
   */
  private setupEventListeners(): void {
    if (!this.engine) return;

    // Generic event listener for all events
    this.engine.on('event', (event) => {
      if (this.config.enableLogging) {
        console.log(`[${new Date().toISOString()}] Event: ${event.type}`, event.data ? JSON.stringify(event.data) : '');
      }
    });

    // Specific event handlers
    this.engine.on('engine:start', (event: any) => {
      console.log(`[${new Date().toISOString()}] 🟢 Engine started`);
      if (event.data?.symbols) {
        console.log(`[${new Date().toISOString()}]    Monitoring: ${event.data.symbols.join(', ')}`);
      }
    });

    this.engine.on('engine:stop', (event: any) => {
      console.log(`[${new Date().toISOString()}] 🔴 Engine stopped`);
      if (event.data?.stats) {
        console.log(`[${new Date().toISOString()}]    Total ticks: ${event.data.stats.totalTicks}`);
      }
    });

    this.engine.on('engine:tick', (event: any) => {
      if (this.config.enableLogging && event.data?.tick && event.data.tick % 10 === 0) {
        console.log(`[${new Date().toISOString()}] ⏱️  Tick ${event.data.tick}`);
      }
    });

    this.engine.on('signal:generated', (event: any) => {
      console.log(`[${new Date().toISOString()}] 📡 Signal generated by ${event.data?.strategy}`);
      if (event.data?.signal) {
        const signal = event.data.signal;
        console.log(
          `   ${signal.side.toUpperCase()} ${signal.quantity} @ ${signal.price.toFixed(2)} - ${signal.reason}`
        );
      }
    });

    this.engine.on('order:submitted', (event: any) => {
      if (this.config.enableLogging) {
        console.log(`[${new Date().toISOString()}] 📝 Order submitted: ${event.data?.order.id}`);
      }
    });

    this.engine.on('trade:executed', (event: any) => {
      console.log(`[${new Date().toISOString()}] 💰 Trade executed`);
      if (event.data?.trade) {
        const trade = event.data.trade;
        console.log(`   ${trade.quantity} @ ${trade.price.toFixed(2)} = $${(trade.price * trade.quantity).toFixed(2)}`);
      }
    });

    this.engine.on('risk:triggered', (event: any) => {
      console.log(`[${new Date().toISOString()}] ⚠️  Risk control triggered`);
      console.log(`   Strategy: ${event.data?.strategy}`);
      console.log(`   Reason: ${event.data?.reason}`);
      console.log(`   Type: ${event.data?.riskType}`);
    });

    this.engine.on('engine:error', (event: any) => {
      console.error(`[${new Date().toISOString()}] ❌ Engine error`);
      console.error(`   Component: ${event.data?.component || event.data?.strategy || 'unknown'}`);
      console.error(`   Error: ${event.data?.error}`);
    });
  }

  /**
   * Print final statistics
   */
  private printFinalStats(): void {
    if (!this.engine) return;

    const stats = this.engine.getStats();
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    console.log('\n' + '='.repeat(60));
    console.log('FINAL STATISTICS');
    console.log('='.repeat(60));
    console.log(`Uptime:        ${this.formatUptime(uptime)}`);
    console.log(`Total Ticks:   ${stats.totalTicks}`);
    console.log(`Total Signals: ${stats.totalSignals}`);
    console.log(`Total Orders:  ${stats.totalOrders}`);
    console.log(`Total Trades:  ${stats.totalTrades}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

    return parts.join(' ') || '0s';
  }
}

/**
 * Create default configuration for real-time runner
 */
export function createDefaultConfig(): RunnerConfig {
  return {
    engine: {
      tickInterval: 1000, // 1 second
      symbols: ['AAPL', 'GOOGL', 'MSFT'],
      initialPrices: new Map([
        ['AAPL', 150],
        ['GOOGL', 2800],
        ['MSFT', 300],
      ]),
      volatility: 0.02,
      enableLogging: true,
    },
    riskControl: {
      maxPositionSize: 1000,
      maxTotalExposure: 1000000,
      stopLossPercent: 0.1,
      maxOrdersPerMinute: 100,
      enabled: true,
    },
    initialCapital: 100000,
    strategies: [
      {
        type: 'SMA',
        params: {
          id: 'sma-aapl',
          name: 'SMA Strategy - AAPL',
          params: {
            shortPeriod: 5,
            longPeriod: 20,
            tradeQuantity: 10,
          },
        },
      },
      {
        type: 'Bollinger',
        params: {
          id: 'bollinger-googl',
          name: 'Bollinger Bands Strategy - GOOGL',
          params: {
            period: 20,
            stdDevMultiplier: 2,
            tradeQuantity: 5,
          },
        },
      },
    ],
    enableLogging: true,
  };
}

/**
 * Main entry point for running the real-time engine
 */
export async function runRealtimeEngine(config?: Partial<RunnerConfig>): Promise<RealtimeRunner> {
  const finalConfig: RunnerConfig = {
    ...createDefaultConfig(),
    ...config,
    engine: {
      ...createDefaultConfig().engine,
      ...(config?.engine || {}),
    },
    riskControl: {
      ...createDefaultConfig().riskControl,
      ...(config?.riskControl || {}),
    },
    strategies: config?.strategies || createDefaultConfig().strategies,
  };

  const runner = new RealtimeRunner(finalConfig);
  await runner.start();

  return runner;
}
