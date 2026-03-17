/**
 * Benchmark Reporter
 * 
 * Generates performance comparison reports and regression detection
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  formatBytes,
  formatDuration,
  formatNumber,
  BaselineResult,
  compareWithBaseline,
} from './utils';

// Baseline file path
const BASELINE_FILE = path.join(__dirname, '.benchmark-baselines.json');

interface Baselines {
  backtest: Record<string, BaselineResult>;
  api: Record<string, { latencyMs: number; throughput: number; timestamp: string }>;
  realtime: {
    throughput: number;
    latencyMs: number;
    timestamp: string;
  };
  lastUpdated: string;
}

export interface BenchmarkReport {
  timestamp: string;
  backtest?: any[];
  api?: any[];
  realtime?: any;
  regressions: RegressionAlert[];
  improvements: string[];
}

export interface RegressionAlert {
  category: string;
  metric: string;
  baseline: number;
  current: number;
  changePercent: number;
  severity: 'warning' | 'critical';
}

/**
 * Load baselines from file
 */
export function loadBaselines(): Baselines {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      const content = fs.readFileSync(BASELINE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to load baselines:', error);
  }
  
  // Return default baselines
  return {
    backtest: {
      'sma': { name: 'sma', ticksPerSecond: 90000, memoryMB: 40, timestamp: new Date().toISOString() },
      'rsi': { name: 'rsi', ticksPerSecond: 85000, memoryMB: 45, timestamp: new Date().toISOString() },
      'macd': { name: 'macd', ticksPerSecond: 80000, memoryMB: 50, timestamp: new Date().toISOString() },
    },
    api: {
      'health': { latencyMs: 5, throughput: 1000, timestamp: new Date().toISOString() },
    },
    realtime: {
      throughput: 1000,
      latencyMs: 2,
      timestamp: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save baselines to file
 */
export function saveBaselines(baselines: Baselines): void {
  baselines.lastUpdated = new Date().toISOString();
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 2));
  console.log(`✅ Baselines saved to ${BASELINE_FILE}`);
}

/**
 * Detect regressions by comparing with baselines
 */
export function detectRegressions(
  backtestResults?: any[],
  apiResults?: any[],
  realtimeResult?: any
): RegressionAlert[] {
  const regressions: RegressionAlert[] = [];
  const baselines = loadBaselines();
  
  // Check backtest regressions
  if (backtestResults) {
    for (const result of backtestResults) {
      const baseline = baselines.backtest[result.config?.strategy];
      if (baseline && result.ticksPerSecond) {
        const comparison = compareWithBaseline(result.ticksPerSecond, baseline.ticksPerSecond);
        if (comparison.changePercent < -10) {
          regressions.push({
            category: 'Backtest',
            metric: `${result.config.strategy.toUpperCase()} ticks/sec`,
            baseline: baseline.ticksPerSecond,
            current: result.ticksPerSecond,
            changePercent: comparison.changePercent,
            severity: comparison.changePercent < -20 ? 'critical' : 'warning',
          });
        }
      }
    }
  }
  
  // Check API regressions
  if (apiResults) {
    for (const result of apiResults) {
      const baseline = baselines.api[result.endpoint?.toLowerCase()];
      if (baseline && result.latency?.median) {
        const latencyDiff = ((result.latency.median - baseline.latencyMs) / baseline.latencyMs) * 100;
        if (latencyDiff > 50) {
          regressions.push({
            category: 'API',
            metric: `${result.endpoint} latency`,
            baseline: baseline.latencyMs,
            current: result.latency.median,
            changePercent: latencyDiff,
            severity: latencyDiff > 100 ? 'critical' : 'warning',
          });
        }
      }
    }
  }
  
  // Check realtime regressions
  if (realtimeResult) {
    const throughputDiff = ((realtimeResult.messageThroughput - baselines.realtime.throughput) / baselines.realtime.throughput) * 100;
    if (throughputDiff < -20) {
      regressions.push({
        category: 'Realtime',
        metric: 'Message throughput',
        baseline: baselines.realtime.throughput,
        current: realtimeResult.messageThroughput,
        changePercent: throughputDiff,
        severity: throughputDiff < -40 ? 'critical' : 'warning',
      });
    }
  }
  
  return regressions;
}

/**
 * Generate a comprehensive benchmark report
 */
export function generateReport(
  backtestResults?: any[],
  apiResults?: any[],
  realtimeResult?: any
): BenchmarkReport {
  const regressions = detectRegressions(backtestResults, apiResults, realtimeResult);
  
  const improvements: string[] = [];
  
  // Find improvements
  if (backtestResults) {
    for (const result of backtestResults) {
      if (result.comparison && result.comparison.ticksPerSecond?.changePercent > 5) {
        improvements.push(
          `Backtest ${result.config.strategy.toUpperCase()}: +${result.comparison.ticksPerSecond.changePercent.toFixed(1)}% ticks/sec`
        );
      }
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    backtest: backtestResults,
    api: apiResults,
    realtime: realtimeResult,
    regressions,
    improvements,
  };
}

/**
 * Print report summary to console
 */
export function printReportSummary(report: BenchmarkReport): void {
  console.log('\n' + '='.repeat(70));
  console.log('  BENCHMARK REPORT SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n  Timestamp: ${report.timestamp}`);
  console.log('');
  
  if (report.regressions.length > 0) {
    console.log('  ⚠️  REGRESSIONS DETECTED:');
    console.log('');
    for (const regression of report.regressions) {
      const icon = regression.severity === 'critical' ? '🔴' : '🟡';
      console.log(`    ${icon} ${regression.category} - ${regression.metric}`);
      console.log(`       Baseline: ${formatNumber(regression.baseline)}`);
      console.log(`       Current:  ${formatNumber(regression.current)}`);
      console.log(`       Change:   ${regression.changePercent.toFixed(1)}%`);
      console.log('');
    }
  } else {
    console.log('  ✅ No regressions detected');
    console.log('');
  }
  
  if (report.improvements.length > 0) {
    console.log('  🚀 IMPROVEMENTS:');
    console.log('');
    for (const improvement of report.improvements) {
      console.log(`    ✓ ${improvement}`);
    }
    console.log('');
  }
  
  console.log('='.repeat(70));
}

/**
 * Generate markdown report for GitHub
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [
    '# Performance Benchmark Report',
    '',
    `**Generated:** ${report.timestamp}`,
    '',
  ];
  
  if (report.regressions.length > 0) {
    lines.push('## ⚠️ Regressions Detected', '');
    lines.push('| Category | Metric | Baseline | Current | Change | Severity |');
    lines.push('|----------|--------|----------|---------|--------|----------|');
    
    for (const r of report.regressions) {
      const severity = r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning';
      lines.push(
        `| ${r.category} | ${r.metric} | ${formatNumber(r.baseline)} | ${formatNumber(r.current)} | ${r.changePercent.toFixed(1)}% | ${severity} |`
      );
    }
    lines.push('');
  } else {
    lines.push('## ✅ No Regressions Detected', '');
  }
  
  if (report.improvements.length > 0) {
    lines.push('## 🚀 Improvements', '');
    for (const improvement of report.improvements) {
      lines.push(`- ${improvement}`);
    }
    lines.push('');
  }
  
  // Add backtest results table
  if (report.backtest && report.backtest.length > 0) {
    lines.push('## Backtest Results', '');
    lines.push('| Strategy | Ticks/sec | Memory | Duration | vs Baseline |');
    lines.push('|----------|----------|--------|----------|--------------|');
    
    for (const result of report.backtest) {
      const strategy = result.config?.strategy?.toUpperCase() || 'Unknown';
      const ticks = formatNumber(Math.round(result.ticksPerSecond || 0));
      const memory = formatBytes(Math.abs(result.memoryDeltaMB || 0) * 1024 * 1024);
      const duration = formatDuration(result.durationMs || 0);
      const vsBaseline = result.comparison?.ticksPerSecond
        ? `${result.comparison.ticksPerSecond.changePercent >= 0 ? '+' : ''}${result.comparison.ticksPerSecond.changePercent.toFixed(1)}%`
        : 'N/A';
      
      lines.push(`| ${strategy} | ${ticks} | ${memory} | ${duration} | ${vsBaseline} |`);
    }
    lines.push('');
  }
  
  // Add API results table
  if (report.api && report.api.length > 0) {
    lines.push('## API Results', '');
    lines.push('| Endpoint | Median | P95 | P99 | Throughput |');
    lines.push('|----------|--------|-----|-----|------------|');
    
    for (const result of report.api) {
      const median = formatDuration(result.latency?.median || 0);
      const p95 = formatDuration(result.latency?.p95 || 0);
      const p99 = formatDuration(result.latency?.p99 || 0);
      const throughput = `${formatNumber(Math.round(result.throughput || 0))} req/s`;
      
      lines.push(`| ${result.endpoint || 'Unknown'} | ${median} | ${p95} | ${p99} | ${throughput} |`);
    }
    lines.push('');
  }
  
  // Add realtime results
  if (report.realtime) {
    lines.push('## Real-time Results', '');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Throughput | ${formatNumber(Math.round(report.realtime.messageThroughput || 0))} msg/s |`);
    lines.push(`| Avg Latency | ${formatDuration(report.realtime.averageLatency || 0)} |`);
    lines.push(`| P95 Latency | ${formatDuration(report.realtime.p95Latency || 0)} |`);
    lines.push(`| Order Book Latency | ${formatDuration(report.realtime.orderBookUpdateLatency || 0)} |`);
    lines.push(`| Strategy Latency | ${formatDuration(report.realtime.strategySignalLatency || 0)} |`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Update baselines with current results
 */
export function updateBaselines(
  backtestResults?: any[],
  apiResults?: any[],
  realtimeResult?: any
): void {
  const baselines = loadBaselines();
  
  if (backtestResults) {
    for (const result of backtestResults) {
      if (result.config?.strategy && result.ticksPerSecond) {
        baselines.backtest[result.config.strategy] = {
          name: result.config.strategy,
          ticksPerSecond: result.ticksPerSecond,
          memoryMB: Math.abs(result.memoryDeltaMB || 0),
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
  
  if (apiResults) {
    for (const result of apiResults) {
      if (result.endpoint && result.latency?.median) {
        baselines.api[result.endpoint.toLowerCase()] = {
          latencyMs: result.latency.median,
          throughput: result.throughput || 0,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }
  
  if (realtimeResult) {
    baselines.realtime = {
      throughput: realtimeResult.messageThroughthroughput || 0,
      latencyMs: realtimeResult.medianLatency || 0,
      timestamp: new Date().toISOString(),
    };
  }
  
  saveBaselines(baselines);
}

// CLI entry point
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'update') {
    console.log('\n📋 Updating baselines requires running all benchmarks first.');
    console.log('   Run: npm run benchmark:all -- --update-baselines');
  } else {
    const baselines = loadBaselines();
    console.log('\n📋 Current Baselines:');
    console.log(JSON.stringify(baselines, null, 2));
  }
}
