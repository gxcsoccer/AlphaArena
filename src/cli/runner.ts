/**
 * CLI Runner - 命令行运行器
 * 
 * 提供命令行接口用于：
 * - 运行回测 (backtest)
 * - 实时交易模拟 (run/realtime)
 * - 查看统计信息 (stats)
 */

import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig, BacktestResult } from '../backtest/types';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * CLI command types
 */
export type CLICommand = 'backtest' | 'run' | 'stats' | 'help';

/**
 * CLI arguments interface
 */
export interface CLIArgs {
  command: CLICommand;
  strategy?: string;
  capital?: number;
  symbol?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  shortPeriod?: number;
  longPeriod?: number;
  tradeQuantity?: number;
  output?: string;
  format?: 'json' | 'csv';
  help?: boolean;
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CLIArgs {
  const parsed: CLIArgs = {
    command: 'help',
    strategy: 'sma',
    capital: 100000,
    symbol: 'AAPL',
    duration: 30, // days
    shortPeriod: 5,
    longPeriod: 20,
    tradeQuantity: 10,
    format: 'json'
  };

  if (args.length === 0) {
    return parsed;
  }

  // Check if first argument is a flag (starts with -)
  let startIndex = 0;
  if (args[0].startsWith('-')) {
    // First argument is a flag, not a command
    startIndex = 0;
  } else {
    // First argument might be a command
    const command = args[0] as CLICommand;
    if (['backtest', 'run', 'stats', 'help'].includes(command)) {
      parsed.command = command;
      startIndex = 1;
    }
  }

  // Parse flags
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--strategy':
      case '-s':
        parsed.strategy = nextArg;
        i++;
        break;
      case '--capital':
      case '-c':
        parsed.capital = parseFloat(nextArg);
        i++;
        break;
      case '--symbol':
      case '-S':
        parsed.symbol = nextArg;
        i++;
        break;
      case '--duration':
      case '-d':
        parsed.duration = parseInt(nextArg);
        i++;
        break;
      case '--short-period':
        parsed.shortPeriod = parseInt(nextArg);
        i++;
        break;
      case '--long-period':
        parsed.longPeriod = parseInt(nextArg);
        i++;
        break;
      case '--quantity':
      case '-q':
        parsed.tradeQuantity = parseInt(nextArg);
        i++;
        break;
      case '--output':
      case '-o':
        parsed.output = nextArg;
        i++;
        break;
      case '--format':
      case '-f':
        parsed.format = nextArg as 'json' | 'csv';
        i++;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
    }
  }

  return parsed;
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
AlphaArena - Algorithmic Trading Platform

Usage: alpha-arena <command> [options]

Commands:
  backtest    Run backtest simulation
  run         Run real-time trading simulation
  stats       Show statistics from previous run
  help        Show this help message

Options:
  -s, --strategy <name>     Strategy name (default: sma)
  -c, --capital <amount>    Initial capital (default: 100000)
  -S, --symbol <symbol>     Stock symbol (default: AAPL)
  -d, --duration <days>     Backtest duration in days (default: 30)
  --short-period <days>     Short SMA period (default: 5)
  --long-period <days>      Long SMA period (default: 20)
  -q, --quantity <amount>   Trade quantity per signal (default: 10)
  -o, --output <file>       Output file path
  -f, --format <format>     Output format: json, csv (default: json)
  -h, --help                Show this help message

Examples:
  alpha-arena backtest --strategy sma --capital 100000 --symbol AAPL --duration 30
  alpha-arena backtest -s sma -c 50000 -S GOOGL -d 60 --output results.json
  alpha-arena run --strategy sma --capital 100000 --symbol MSFT
  alpha-arena help
`);
}

/**
 * Print backtest results
 */
export function printResults(result: BacktestResult): void {
  const { stats, config } = result;
  
  console.log('\n' + '='.repeat(60));
  console.log('BACKTEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n📊 Configuration:');
  console.log(`   Strategy:     ${config.strategy}`);
  console.log(`   Symbol:       ${config.symbol}`);
  console.log(`   Capital:      $${config.capital.toLocaleString()}`);
  const durationDays = (config.endTime - config.startTime) / (1000 * 60 * 60 * 24);
  console.log(`   Duration:     ${durationDays.toFixed(1)} days`);
  
  console.log('\n💰 Performance:');
  console.log(`   Initial:      $${stats.initialCapital.toLocaleString()}`);
  console.log(`   Final:        $${stats.finalCapital.toLocaleString()}`);
  console.log(`   Total P&L:    $${stats.totalPnL.toLocaleString()}`);
  console.log(`   Total Return: ${stats.totalReturn.toFixed(2)}%`);
  console.log(`   Ann. Return:  ${stats.annualizedReturn.toFixed(2)}%`);
  
  console.log('\n📈 Risk Metrics:');
  console.log(`   Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`);
  console.log(`   Max Drawdown: ${stats.maxDrawdown.toFixed(2)}%`);
  
  console.log('\n📝 Trade Statistics:');
  console.log(`   Total Trades: ${stats.totalTrades}`);
  console.log(`   Winning:      ${stats.winningTrades} (${stats.winRate.toFixed(1)}%)`);
  console.log(`   Losing:       ${stats.losingTrades}`);
  console.log(`   Avg Win:      $${stats.avgWin.toFixed(2)}`);
  console.log(`   Avg Loss:     $${stats.avgLoss.toFixed(2)}`);
  console.log(`   Profit Factor: ${stats.profitFactor.toFixed(2)}`);
  
  console.log('\n⏱️  Execution:');
  console.log(`   Duration:     ${result.duration}ms`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Run backtest command
 */
export function runBacktest(args: CLIArgs): BacktestResult | null {
  console.log(`\n🚀 Starting backtest...`);
  console.log(`   Strategy: ${args.strategy}`);
  console.log(`   Symbol: ${args.symbol}`);
  console.log(`   Capital: $${args.capital?.toLocaleString()}`);
  console.log(`   Duration: ${args.duration} days\n`);
  
  const durationDays = args.duration ?? 30;
  const endTime = Date.now();
  const startTime = endTime - durationDays * 24 * 60 * 60 * 1000;
  
  const config: BacktestConfig = {
    capital: args.capital ?? 100000,
    symbol: args.symbol ?? 'AAPL',
    startTime,
    endTime,
    strategy: args.strategy ?? 'sma',
    strategyParams: {
      shortPeriod: args.shortPeriod ?? 5,
      longPeriod: args.longPeriod ?? 20,
      tradeQuantity: args.tradeQuantity ?? 10
    }
  };
  
  try {
    const engine = new BacktestEngine(config);
    const result = engine.run();
    
    // Print results
    printResults(result);
    
    // Export if output file specified
    if (args.output) {
      exportResults(result, args.output, args.format ?? 'json');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Backtest failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Run real-time simulation
 */
export function runRealtime(args: CLIArgs): void {
  console.log(`\n🔴 Starting real-time simulation...`);
  console.log(`   Strategy: ${args.strategy}`);
  console.log(`   Symbol: ${args.symbol}`);
  console.log(`   Capital: $${args.capital?.toLocaleString()}`);
  console.log(`   Press Ctrl+C to stop\n`);
  
  // For now, just run a short backtest as simulation
  // In production, this would connect to live data
  const testArgs = { ...args, command: 'backtest' as CLICommand, duration: 1 };
  runBacktest(testArgs);
  
  console.log('ℹ️  Real-time mode is currently in beta. Running short simulation instead.');
}

/**
 * Export results to file
 */
export function exportResults(result: BacktestResult, outputPath: string, format: 'json' | 'csv'): void {
  try {
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    let content: string;
    if (format === 'csv') {
      // Create CSV from snapshots
      content = 'timestamp,cash,totalValue,unrealizedPnL\n';
      for (const snapshot of result.snapshots) {
        content += `${snapshot.timestamp},${snapshot.cash},${snapshot.totalValue},${snapshot.unrealizedPnL}\n`;
      }
    } else {
      content = JSON.stringify(result, null, 2);
    }
    
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`✅ Results exported to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Failed to export results:', error instanceof Error ? error.message : error);
  }
}

/**
 * Main CLI runner function
 */
export function run(args: string[]): void {
  const parsedArgs = parseArgs(args);
  
  if (parsedArgs.help || parsedArgs.command === 'help') {
    printHelp();
    return;
  }
  
  switch (parsedArgs.command) {
    case 'backtest':
      runBacktest(parsedArgs);
      break;
    case 'run':
      runRealtime(parsedArgs);
      break;
    case 'stats':
      console.log('ℹ️  Stats command not yet implemented. Run a backtest first.');
      break;
    default:
      printHelp();
  }
}
