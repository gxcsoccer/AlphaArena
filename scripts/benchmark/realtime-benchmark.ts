/**
 * Real-time Data Processing Benchmark
 * 
 * Measures performance of WebSocket message handling, order book updates,
 * and strategy signal processing latency.
 */

import {
  formatBytes,
  formatDuration,
  formatNumber,
  calculateStats,
  sleep,
} from './utils';

export interface RealtimeBenchmarkConfig {
  duration: number; // Total test duration in ms
  messageInterval: number; // Interval between messages in ms
  batchSize: number; // Messages per batch
  warmupDuration: number; // Warmup duration in ms
}

interface MessageLatency {
  sent: number;
  received: number;
  processed: number;
}

export interface RealtimeBenchmarkResult {
  config: RealtimeBenchmarkConfig;
  messageThroughput: number; // Messages per second
  averageLatency: number; // Average end-to-end latency in ms
  medianLatency: number;
  p95Latency: number;
  p99Latency: number;
  orderBookUpdateLatency: number;
  strategySignalLatency: number;
  memoryDeltaMB: number;
  totalMessages: number;
  droppedMessages: number;
}

/**
 * Simulate WebSocket message latency measurement
 */
async function simulateMessageLatency(
  config: RealtimeBenchmarkConfig
): Promise<MessageLatency[]> {
  const latencies: MessageLatency[] = [];
  const startTime = Date.now();
  
  // Simulate message processing with varying latencies
  while (Date.now() - startTime < config.duration) {
    const sent = performance.now();
    
    // Simulate network latency (1-5ms)
    await sleep(Math.random() * 4 + 1);
    
    const received = performance.now();
    
    // Simulate processing time (0.1-2ms for typical order book update)
    await sleep(Math.random() * 1.9 + 0.1);
    
    const processed = performance.now();
    
    latencies.push({
      sent,
      received,
      processed,
    });
    
    // Respect message interval
    await sleep(config.messageInterval);
  }
  
  return latencies;
}

/**
 * Simulate order book update performance
 */
async function simulateOrderBookUpdates(
  iterations: number
): Promise<{ updateTime: number; depth: number }[]> {
  const results: { updateTime: number; depth: number }[] = [];
  
  // Simple in-memory order book simulation
  const bids: Map<number, number> = new Map();
  const asks: Map<number, number> = new Map();
  
  const basePrice = 50000;
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    // Simulate random price levels
    const price = basePrice + (Math.random() - 0.5) * 100;
    const size = Math.random() * 10;
    const side = Math.random() > 0.5 ? 'bid' : 'ask';
    
    if (side === 'bid') {
      bids.set(price, size);
    } else {
      asks.set(price, size);
    }
    
    // Maintain max depth of 100 levels
    if (bids.size > 100) {
      const lowestBid = Math.min(...Array.from(bids.keys()));
      bids.delete(lowestBid);
    }
    if (asks.size > 100) {
      const highestAsk = Math.max(...Array.from(asks.keys()));
      asks.delete(highestAsk);
    }
    
    const updateTime = performance.now() - startTime;
    
    results.push({
      updateTime,
      depth: bids.size + asks.size,
    });
  }
  
  return results;
}

/**
 * Simulate strategy signal processing
 */
async function simulateStrategyProcessing(
  iterations: number
): Promise<{ calculationTime: number; signalType: string }[]> {
  const results: { calculationTime: number; signalType: string }[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    // Simulate RSI calculation (14-period)
    const period = 14;
    const prices: number[] = [];
    for (let j = 0; j < period * 2; j++) {
      prices.push(50000 + (Math.random() - 0.5) * 1000);
    }
    
    // Calculate RSI
    let gains = 0;
    let losses = 0;
    for (let j = 1; j < period; j++) {
      const change = prices[j] - prices[j - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    
    // Determine signal
    const signalType = rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'hold';
    
    const calculationTime = performance.now() - startTime;
    
    results.push({
      calculationTime,
      signalType,
    });
  }
  
  return results;
}

/**
 * Run complete realtime benchmark
 */
export async function runRealtimeBenchmark(
  config: Partial<RealtimeBenchmarkConfig> = {}
): Promise<RealtimeBenchmarkResult> {
  const fullConfig: RealtimeBenchmarkConfig = {
    duration: config.duration || 5000,
    messageInterval: config.messageInterval || 10,
    batchSize: config.batchSize || 100,
    warmupDuration: config.warmupDuration || 1000,
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('  REAL-TIME DATA BENCHMARK');
  console.log('='.repeat(60));
  console.log(`\n  Duration: ${fullConfig.duration}ms`);
  console.log(`  Message Interval: ${fullConfig.messageInterval}ms`);
  console.log('');
  
  // Warmup
  console.log('  Warming up...');
  await simulateMessageLatency({ ...fullConfig, duration: fullConfig.warmupDuration });
  
  // Memory before
  const memoryBefore = process.memoryUsage().heapUsed;
  
  // Message latency test
  console.log('  Testing message latency...');
  const messageLatencies = await simulateMessageLatency(fullConfig);
  
  // Order book update test
  console.log('  Testing order book updates...');
  const orderBookResults = await simulateOrderBookUpdates(10000);
  
  // Strategy processing test
  console.log('  Testing strategy signal processing...');
  const strategyResults = await simulateStrategyProcessing(10000);
  
  // Memory after
  const memoryAfter = process.memoryUsage().heapUsed;
  
  // Calculate statistics
  const latencies = messageLatencies.map(l => l.processed - l.sent);
  const latencyStats = calculateStats(latencies);
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p99Index = Math.floor(sortedLatencies.length * 0.99);
  
  const orderBookTimes = orderBookResults.map(r => r.updateTime);
  const strategyTimes = strategyResults.map(r => r.calculationTime);
  
  const result: RealtimeBenchmarkResult = {
    config: fullConfig,
    messageThroughput: (messageLatencies.length / fullConfig.duration) * 1000,
    averageLatency: latencyStats.mean,
    medianLatency: latencyStats.median,
    p95Latency: sortedLatencies[p95Index] || 0,
    p99Latency: sortedLatencies[p99Index] || 0,
    orderBookUpdateLatency: calculateStats(orderBookTimes).median,
    strategySignalLatency: calculateStats(strategyTimes).median,
    memoryDeltaMB: (memoryAfter - memoryBefore) / (1024 * 1024),
    totalMessages: messageLatencies.length,
    droppedMessages: 0, // Simulated, no drops
  };
  
  return result;
}

/**
 * Print realtime benchmark results
 */
export function printRealtimeResults(result: RealtimeBenchmarkResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('  REAL-TIME BENCHMARK RESULTS');
  console.log('='.repeat(60));
  console.log('');
  
  console.log('Message Processing:');
  console.log(`  Total Messages:    ${formatNumber(result.totalMessages)}`);
  console.log(`  Throughput:        ${formatNumber(Math.round(result.messageThroughput))} msg/s`);
  console.log('');
  
  console.log('Latency:');
  console.log(`  Average:           ${formatDuration(result.averageLatency)}`);
  console.log(`  Median:            ${formatDuration(result.medianLatency)}`);
  console.log(`  P95:               ${formatDuration(result.p95Latency)}`);
  console.log(`  P99:               ${formatDuration(result.p99Latency)}`);
  console.log('');
  
  console.log('Component Latency:');
  console.log(`  Order Book Update: ${formatDuration(result.orderBookUpdateLatency)}`);
  console.log(`  Strategy Signal:   ${formatDuration(result.strategySignalLatency)}`);
  console.log('');
  
  console.log('Memory:');
  console.log(`  Delta:             ${formatBytes(Math.abs(result.memoryDeltaMB) * 1024 * 1024)}`);
  console.log('');
  
  console.log('='.repeat(60));
}

/**
 * Generate CI report for realtime benchmarks
 */
export function generateRealtimeReport(result: RealtimeBenchmarkResult): string {
  const lines: string[] = [
    '# Real-time Benchmark Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Message Processing',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Throughput | ${formatNumber(Math.round(result.messageThroughput))} msg/s |`,
    `| Avg Latency | ${formatDuration(result.averageLatency)} |`,
    `| P95 Latency | ${formatDuration(result.p95Latency)} |`,
    `| P99 Latency | ${formatDuration(result.p99Latency)} |`,
    '',
    '## Component Latency',
    '',
    `| Component | Median Latency |`,
    `|-----------|----------------|`,
    `| Order Book Update | ${formatDuration(result.orderBookUpdateLatency)} |`,
    `| Strategy Signal | ${formatDuration(result.strategySignalLatency)} |`,
  ];
  
  return lines.join('\n');
}

// CLI entry point
if (require.main === module) {
  const duration = parseInt(process.argv[2]) || 5000;
  
  console.log(`\n🚀 Running realtime benchmarks for ${duration}ms...\n`);
  
  runRealtimeBenchmark({ duration })
    .then(result => {
      printRealtimeResults(result);
      console.log('\n--- CI Report ---\n');
      console.log(generateRealtimeReport(result));
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
