#!/usr/bin/env node

/**
 * Real-time Trading Engine CLI - 实时交易引擎命令行
 *
 * Usage:
 *   alpha-arena realtime [options]
 *
 * Options:
 *   --symbols <symbols>     Comma-separated symbols (default: AAPL,GOOGL,MSFT)
 *   --capital <amount>      Initial capital (default: 100000)
 *   --tick-interval <ms>    Tick interval in milliseconds (default: 1000)
 *   --volatility <0-1>      Price volatility (default: 0.02)
 *   --logging               Enable detailed logging
 *   --no-logging            Disable logging (default: enabled)
 *   --help                  Show this help message
 *
 * Examples:
 *   alpha-arena realtime
 *   alpha-arena realtime --symbols AAPL,GOOGL --capital 50000
 *   alpha-arena realtime --tick-interval 500 --logging
 */

import { RealtimeRunner, createDefaultConfig, RunnerConfig } from './realtime-runner';
import { EngineConfig } from '../engine/types';

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): Partial<RunnerConfig> {
  const config: Partial<RunnerConfig> = {
    strategies: createDefaultConfig().strategies,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--symbols':
      case '-s':
        if (nextArg) {
          const symbols = nextArg.split(',').map((s) => s.trim());
          const engineConfig: Partial<EngineConfig> = {
            ...config.engine,
            symbols,
            initialPrices: new Map(
              symbols.map((symbol, index) => [symbol, 100 + index * 50])
            ),
          };
          // Ensure required fields are set
          if (!engineConfig.tickInterval) engineConfig.tickInterval = 1000;
          if (!engineConfig.volatility) engineConfig.volatility = 0.02;
          if (engineConfig.enableLogging === undefined) engineConfig.enableLogging = true;
          
          config.engine = engineConfig as EngineConfig;
          
          // Update strategies to match symbols
          config.strategies = symbols.map((symbol, index) => ({
            type: 'SMA' as const,
            params: {
              id: `sma-${symbol.toLowerCase()}`,
              name: `SMA Strategy - ${symbol}`,
              params: {
                shortPeriod: 5,
                longPeriod: 20,
                tradeQuantity: 10 - index * 2,
              },
            },
          }));
          i++;
        }
        break;

      case '--capital':
      case '-c':
        if (nextArg) {
          config.initialCapital = parseFloat(nextArg);
          i++;
        }
        break;

      case '--tick-interval':
      case '-t':
        if (nextArg) {
          const tickInterval = parseInt(nextArg);
          const baseEngine: EngineConfig = config.engine || {
            tickInterval: 1000,
            symbols: [],
            initialPrices: new Map(),
            volatility: 0.02,
            enableLogging: true,
          };
          config.engine = {
            tickInterval,
            symbols: baseEngine.symbols || createDefaultConfig().engine.symbols,
            initialPrices: baseEngine.initialPrices || createDefaultConfig().engine.initialPrices,
            volatility: baseEngine.volatility || createDefaultConfig().engine.volatility,
            enableLogging: baseEngine.enableLogging ?? createDefaultConfig().engine.enableLogging,
          };
          i++;
        }
        break;

      case '--volatility':
      case '-v':
        if (nextArg) {
          const volatility = parseFloat(nextArg);
          const baseEngine: EngineConfig = config.engine || {
            tickInterval: 1000,
            symbols: [],
            initialPrices: new Map(),
            volatility: 0.02,
            enableLogging: true,
          };
          config.engine = {
            tickInterval: baseEngine.tickInterval || createDefaultConfig().engine.tickInterval,
            symbols: baseEngine.symbols || createDefaultConfig().engine.symbols,
            initialPrices: baseEngine.initialPrices || createDefaultConfig().engine.initialPrices,
            volatility,
            enableLogging: baseEngine.enableLogging ?? createDefaultConfig().engine.enableLogging,
          };
          i++;
        }
        break;

      case '--logging':
        config.enableLogging = true;
        break;

      case '--no-logging':
        config.enableLogging = false;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);

      default:
        if (arg.startsWith('-')) {
          console.warn(`Unknown option: ${arg}`);
        }
    }

    i++;
  }

  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
AlphaArena - Real-time Trading Engine

Usage: alpha-arena realtime [options]

Options:
  -s, --symbols <symbols>     Comma-separated symbols (default: AAPL,GOOGL,MSFT)
  -c, --capital <amount>      Initial capital (default: 100000)
  -t, --tick-interval <ms>    Tick interval in milliseconds (default: 1000)
  -v, --volatility <0-1>      Price volatility (default: 0.02)
  --logging                   Enable detailed logging
  --no-logging                Disable logging
  -h, --help                  Show this help message

Examples:
  alpha-arena realtime
  alpha-arena realtime --symbols AAPL,GOOGL --capital 50000
  alpha-arena realtime --tick-interval 500 --logging
  alpha-arena realtime -s MSFT,TSLA -c 100000 -t 2000

Press Ctrl+C to stop the engine
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const config = parseArgs(args);

  console.log('\n' + '='.repeat(60));
  console.log('AlphaArena - Real-time Trading Engine');
  console.log('='.repeat(60));
  console.log('\nStarting engine...\n');

  try {
    const finalConfig: RunnerConfig = {
      ...createDefaultConfig(),
      ...config,
      engine: {
        ...createDefaultConfig().engine,
        ...(config.engine || {}),
      },
      riskControl: {
        ...createDefaultConfig().riskControl,
        ...(config.riskControl || {}),
      },
      strategies: config.strategies || createDefaultConfig().strategies,
    };

    const runner = new RealtimeRunner(finalConfig);
    await runner.start();

    // Keep process alive
    console.log('\n✅ Engine is running. Press Ctrl+C to stop.\n');

    // Print stats every minute
    const statsInterval = setInterval(() => {
      const stats = runner.getStats();
      if (stats && runner.isRunning()) {
        console.log(
          `[${new Date().toISOString()}] 📊 Stats: ${stats.totalTicks} ticks, ${stats.totalSignals} signals, ${stats.totalOrders} orders, ${stats.totalTrades} trades (Uptime: ${stats.uptimeFormatted})`
        );
      }
    }, 60000);

    runner.onShutdown(() => {
      clearInterval(statsInterval);
    });
  } catch (error) {
    console.error('\n❌ Failed to start engine:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
