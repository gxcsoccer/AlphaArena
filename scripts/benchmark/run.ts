#!/usr/bin/env node
/**
 * Benchmark Runner
 * 
 * Main entry point for running performance benchmarks
 * 
 * Usage:
 *   npm run benchmark              # Run all benchmarks
 *   npm run benchmark:backtest     # Run backtest benchmarks only
 *   npm run benchmark:api          # Run API benchmarks only
 *   npm run benchmark:realtime     # Run realtime benchmarks only
 *   npm run benchmark -- --update  # Update baselines after run
 */

import * as fs from 'fs';
import {
  runAllStrategyBenchmarks,
  printBacktestResults,
  type BacktestBenchmarkResult,
} from './backtest-benchmark';
import {
  runAPIBenchmarks,
  printAPIResults,
  type APIBenchmarkResult,
} from './api-benchmark';
import {
  runRealtimeBenchmark,
  printRealtimeResults,
  type RealtimeBenchmarkResult,
} from './realtime-benchmark';
import {
  generateReport,
  generateMarkdownReport,
  printReportSummary,
  updateBaselines,
} from './reporter';

interface BenchmarkOptions {
  backtest: boolean;
  api: boolean;
  realtime: boolean;
  updateBaselines: boolean;
  dataPoints: number;
  iterations: number;
  duration: number;
  baseUrl: string;
  output: string;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);
  
  const options: BenchmarkOptions = {
    backtest: false,
    api: false,
    realtime: false,
    updateBaselines: false,
    dataPoints: 100000,
    iterations: 100,
    duration: 5000,
    baseUrl: 'http://localhost:3000',
    output: '',
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--backtest':
        options.backtest = true;
        break;
      case '--api':
        options.api = true;
        break;
      case '--realtime':
        options.realtime = true;
        break;
      case '--all':
        options.backtest = true;
        options.api = true;
        options.realtime = true;
        break;
      case '--update-baselines':
        options.updateBaselines = true;
        break;
      case '--data-points':
        options.dataPoints = parseInt(args[++i]) || 100000;
        break;
      case '--iterations':
        options.iterations = parseInt(args[++i]) || 100;
        break;
      case '--duration':
        options.duration = parseInt(args[++i]) || 5000;
        break;
      case '--base-url':
        options.baseUrl = args[++i] || 'http://localhost:3000';
        break;
      case '-o':
      case '--output':
        options.output = args[++i] || '';
        break;
    }
  }
  
  // If no specific benchmark selected, run all
  if (!options.backtest && !options.api && !options.realtime) {
    options.backtest = true;
    options.api = false; // API requires running server
    options.realtime = true;
  }
  
  return options;
}

async function runBenchmarks(options: BenchmarkOptions): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  ALPHARENA PERFORMANCE BENCHMARK SUITE');
  console.log('='.repeat(70));
  console.log(`\n  Started: ${new Date().toISOString()}`);
  
  let backtestResults: BacktestBenchmarkResult[] | undefined;
  let apiResults: APIBenchmarkResult[] | undefined;
  let realtimeResult: RealtimeBenchmarkResult | undefined;
  
  // Run backtest benchmarks
  if (options.backtest) {
    console.log('\n📊 Running Backtest Benchmarks...');
    try {
      backtestResults = runAllStrategyBenchmarks(options.dataPoints);
      printBacktestResults(backtestResults);
    } catch (error: unknown) {
      console.error('❌ Backtest benchmark failed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Run API benchmarks
  if (options.api) {
    console.log('\n📡 Running API Benchmarks...');
    try {
      apiResults = await runAPIBenchmarks({
        baseUrl: options.baseUrl,
        iterations: options.iterations,
      });
      printAPIResults(apiResults);
    } catch (error: unknown) {
      console.error('❌ API benchmark failed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Run realtime benchmarks
  if (options.realtime) {
    console.log('\n⚡ Running Realtime Benchmarks...');
    try {
      realtimeResult = await runRealtimeBenchmark({
        duration: options.duration,
      });
      printRealtimeResults(realtimeResult);
    } catch (error: unknown) {
      console.error('❌ Realtime benchmark failed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  // Generate comprehensive report
  const report = generateReport(backtestResults, apiResults, realtimeResult);
  printReportSummary(report);
  
  // Generate markdown report
  const markdown = generateMarkdownReport(report);
  
  // Output to file or console
  if (options.output) {
    fs.writeFileSync(options.output, markdown);
    console.log(`\n📄 Report saved to: ${options.output}`);
  } else {
    console.log('\n--- Markdown Report ---\n');
    console.log(markdown);
  }
  
  // Update baselines if requested
  if (options.updateBaselines) {
    console.log('\n📝 Updating baselines...');
    updateBaselines(backtestResults, apiResults, realtimeResult);
  }
  
  // Exit with error if regressions detected
  if (report.regressions.some(r => r.severity === 'critical')) {
    console.log('\n❌ Critical regressions detected!');
    process.exit(1);
  }
  
  console.log('\n✅ Benchmark suite completed successfully!');
}

// Main entry point
const options = parseArgs();
runBenchmarks(options).catch(error => {
  console.error('Benchmark suite failed:', error);
  process.exit(1);
});
