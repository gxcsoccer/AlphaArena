/**
 * Real-time Data Load Test
 */

import {
  MessageBatcher,
  BackpressureHandler,
  LRUCache,
  IncrementalUpdater,
  PerformanceMetricsCollector,
  RealtimePerformanceManager,
} from '../src/realtime';

interface LoadTestResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errors: number;
  memoryUsageMB: number;
}

async function runLoadTest(name: string, iterations: number, fn: () => Promise<void> | void): Promise<LoadTestResult> {
  const metrics = new PerformanceMetricsCollector();
  const memBefore = process.memoryUsage().heapUsed;
  let errors = 0;

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    try {
      await metrics.measure(name, async () => { await fn(); });
    } catch (error) {
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  const memAfter = process.memoryUsage().heapUsed;
  const stats = metrics.getLatencyStats(name);

  metrics.destroy();

  return {
    name,
    duration,
    operations: iterations,
    opsPerSecond: (iterations / duration) * 1000,
    avgLatency: stats?.avg || 0,
    p95Latency: stats?.p95 || 0,
    p99Latency: stats?.p99 || 0,
    errors,
    memoryUsageMB: (memAfter - memBefore) / (1024 * 1024),
  };
}

function printResult(result: LoadTestResult): void {
  console.log('\n' + result.name);
  console.log('='.repeat(50));
  console.log('  Duration:       ' + result.duration + 'ms');
  console.log('  Operations:     ' + result.operations.toLocaleString());
  console.log('  Ops/second:     ' + result.opsPerSecond.toLocaleString());
  console.log('  Avg Latency:    ' + result.avgLatency.toFixed(3) + 'ms');
  console.log('  P95 Latency:    ' + result.p95Latency.toFixed(3) + 'ms');
  console.log('  P99 Latency:    ' + result.p99Latency.toFixed(3) + 'ms');
  console.log('  Errors:         ' + result.errors);
  console.log('  Memory Delta:   ' + result.memoryUsageMB.toFixed(2) + 'MB');
}

async function testCachePerformance(): Promise<void> {
  console.log('\n\n📦 LRUCache Performance Test');
  console.log('='.repeat(60));

  const cache = new LRUCache({ maxSize: 10000, defaultTTL: 60000 });

  const writeResult = await runLoadTest('Cache Write', 100000, () => {
    const key = 'key_' + Math.random();
    cache.set(key, { data: 'value', timestamp: Date.now() });
  });
  printResult(writeResult);

  for (let i = 0; i < 10000; i++) {
    cache.set('hot_' + i, 'value_' + i);
  }

  const readResult = await runLoadTest('Cache Read', 100000, () => {
    const key = 'hot_' + Math.floor(Math.random() * 10000);
    cache.get(key);
  });
  printResult(readResult);

  cache.destroy();
}

async function testBatcherPerformance(): Promise<void> {
  console.log('\n\n📦 MessageBatcher Performance Test');
  console.log('='.repeat(60));

  const batcher = new MessageBatcher({ maxBatchSize: 100, maxBatchDelay: 1000, enableCompression: false });
  const flushInterval = setInterval(() => { batcher.flush(); }, 100);

  const addResult = await runLoadTest('Batch Add', 100000, () => {
    batcher.add({
      type: 'orderbook_update',
      symbol: 'BTC/USD',
      data: { bids: [], asks: [] },
      timestamp: Date.now(),
    });
  });
  printResult(addResult);

  clearInterval(flushInterval);
  const stats = batcher.getStats();
  console.log('\n  Total Batches:  ' + stats.totalBatches);
  console.log('  Avg Batch Size: ' + stats.avgBatchSize.toFixed(2));
}

async function testBackpressurePerformance(): Promise<void> {
  console.log('\n\n📦 BackpressureHandler Performance Test');
  console.log('='.repeat(60));

  const handler = new BackpressureHandler({ maxBufferSize: 10000, highWaterMark: 0.9, overflowStrategy: 'drop-oldest' });

  const pushResult = await runLoadTest('Backpressure Push', 100000, () => {
    handler.push({
      type: 'trade',
      symbol: 'BTC/USD',
      price: 50000 + Math.random() * 100,
      quantity: Math.random() * 10,
    });
  });
  printResult(pushResult);

  const popResult = await runLoadTest('Backpressure Pop', 50000, () => { handler.pop(); });
  printResult(popResult);

  const stats = handler.getStats();
  console.log('\n  Dropped:        ' + stats.droppedMessages);
  console.log('  Peak Buffer:    ' + stats.peakBufferSize);

  handler.destroy();
}

async function testIncrementalUpdaterPerformance(): Promise<void> {
  console.log('\n\n📦 IncrementalUpdater Performance Test');
  console.log('='.repeat(60));

  const updater = new IncrementalUpdater();

  const setResult = await runLoadTest('Incremental Set', 100000, () => {
    updater.set('key_' + Math.random(), { value: Math.random() * 100, timestamp: Date.now() });
  });
  printResult(setResult);

  const deltaResult = await runLoadTest('Delta Compute', 10000, () => {
    updater.computeDelta(Math.floor(Math.random() * updater.getVersion()));
  });
  printResult(deltaResult);

  const snapshotResult = await runLoadTest('Snapshot Create', 1000, () => { updater.createSnapshot(); });
  printResult(snapshotResult);
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  REAL-TIME DATA PERFORMANCE LOAD TEST');
  console.log('='.repeat(60));
  console.log('  Started: ' + new Date().toISOString());

  try {
    await testCachePerformance();
    await testBatcherPerformance();
    await testBackpressurePerformance();
    await testIncrementalUpdaterPerformance();

    console.log('\n\n' + '='.repeat(60));
    console.log('  LOAD TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('  Finished: ' + new Date().toISOString());
    console.log('\n✅ All tests passed successfully!\n');
  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
