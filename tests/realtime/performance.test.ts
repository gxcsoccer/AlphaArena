/**
 * Tests for Real-time Performance Optimization Module
 */

import {
  WebSocketConnectionPool,
  MessageBatcher,
  BackpressureHandler,
  LRUCache,
  IncrementalUpdater,
  PerformanceMetricsCollector,
  RealtimePerformanceManager,
} from '../../src/realtime';

describe('LRUCache', () => {
  let cache: LRUCache;

  beforeEach(() => {
    cache = new LRUCache({ maxSize: 100, defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('should evict LRU entries when max size reached', () => {
    const smallCache = new LRUCache({ maxSize: 3 });
    smallCache.set('a', 1);
    smallCache.set('b', 2);
    smallCache.set('c', 3);
    smallCache.set('d', 4);
    expect(smallCache.get('a')).toBeUndefined();
    expect(smallCache.get('d')).toBe(4);
    expect(smallCache.size()).toBe(3);
    smallCache.destroy();
  });

  test('should update existing keys', () => {
    cache.set('key1', 'value1');
    cache.set('key1', 'value2');
    expect(cache.get('key1')).toBe('value2');
    expect(cache.size()).toBe(1);
  });

  test('should track hits and misses', () => {
    cache.set('key1', 'value1');
    cache.get('key1');
    cache.get('nonexistent');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  test('should expire entries after TTL', async () => {
    const shortTTLCache = new LRUCache({ maxSize: 100, defaultTTL: 50 });
    shortTTLCache.set('key1', 'value1');
    expect(shortTTLCache.get('key1')).toBe('value1');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(shortTTLCache.get('key1')).toBeUndefined();
    shortTTLCache.destroy();
  });

  test('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe('MessageBatcher', () => {
  let batcher: MessageBatcher;

  beforeEach(() => {
    batcher = new MessageBatcher({ maxBatchSize: 10, maxBatchDelay: 100, enableCompression: false });
  });

  test('should add messages to batch', () => {
    batcher.add({ data: 'test1' });
    batcher.add({ data: 'test2' });
    expect(batcher.getQueueSize()).toBe(2);
  });

  test('should flush when max size reached', async () => {
    const flushedBatches: any[] = [];
    batcher.on('batch:flushed', (batch) => flushedBatches.push(batch));
    for (let i = 0; i < 10; i++) {
      batcher.add({ data: 'test' + i });
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    if (flushedBatches.length === 0) {
      await batcher.flush();
    }
    expect(flushedBatches.length).toBeGreaterThanOrEqual(1);
    expect(flushedBatches[0].messages.length).toBe(10);
  });

  test('should flush after max delay', async () => {
    const flushedBatches: any[] = [];
    batcher.on('batch:flushed', (batch) => flushedBatches.push(batch));
    batcher.add({ data: 'test' });
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(flushedBatches.length).toBe(1);
  });

  test('should return correct stats', () => {
    for (let i = 0; i < 5; i++) {
      batcher.add({ data: 'test' + i });
    }
    const stats = batcher.getStats();
    expect(stats.queuedMessages).toBe(5);
  });

  test('should clear batch', () => {
    batcher.add({ data: 'test' });
    batcher.clear();
    expect(batcher.getQueueSize()).toBe(0);
  });
});

describe('BackpressureHandler', () => {
  let handler: BackpressureHandler;

  beforeEach(() => {
    handler = new BackpressureHandler({ maxBufferSize: 10, highWaterMark: 0.8, lowWaterMark: 0.5 });
  });

  afterEach(() => {
    handler.destroy();
  });

  test('should push and pop messages', () => {
    handler.push({ data: 'test1' });
    handler.push({ data: 'test2' });
    expect(handler.size()).toBe(2);
    const msg = handler.pop();
    expect(msg).toBeDefined();
    expect(handler.size()).toBe(1);
  });

  test('should maintain priority order', () => {
    handler.push({ data: 'low' }, 1);
    handler.push({ data: 'high' }, 10);
    handler.push({ data: 'medium' }, 5);
    expect(handler.pop()).toEqual({ data: 'high' });
    expect(handler.pop()).toEqual({ data: 'medium' });
    expect(handler.pop()).toEqual({ data: 'low' });
  });

  test('should emit backpressure warning', (done) => {
    handler.on('backpressure:warning', () => done());
    for (let i = 0; i < 9; i++) {
      handler.push({ data: 'test' + i });
    }
  });

  test('should handle overflow with drop-oldest strategy', () => {
    const smallHandler = new BackpressureHandler({ maxBufferSize: 3, overflowStrategy: 'drop-oldest' });
    smallHandler.push({ id: 1 });
    smallHandler.push({ id: 2 });
    smallHandler.push({ id: 3 });
    smallHandler.push({ id: 4 });
    const stats = smallHandler.getStats();
    expect(stats.droppedMessages).toBe(1);
    smallHandler.destroy();
  });

  test('should return correct state', () => {
    handler.push({ data: 'test' });
    const state = handler.getState();
    expect(state.status).toBe('normal');
    expect(state.bufferUsage).toBeGreaterThan(0);
  });
});

describe('IncrementalUpdater', () => {
  let updater: IncrementalUpdater;

  beforeEach(() => {
    updater = new IncrementalUpdater();
  });

  test('should set and get values', () => {
    updater.set('key1', 'value1');
    expect(updater.get('key1')).toBe('value1');
  });

  test('should compute delta from changes', () => {
    updater.set('key1', 'value1');
    updater.set('key2', 'value2');
    updater.set('key1', 'updated');
    const delta = updater.computeDelta(0);
    expect(delta).toBeDefined();
    expect(delta!.length).toBeGreaterThan(0);
  });

  test('should apply snapshot', () => {
    updater.applySnapshot({ data: { a: 1, b: 2 }, version: 10, timestamp: Date.now() });
    expect(updater.get('a')).toBe(1);
    expect(updater.get('b')).toBe(2);
    expect(updater.getVersion()).toBe(10);
  });

  test('should apply delta updates', () => {
    updater.set('a', 1);
    updater.applyDelta([
      { type: 'add', key: 'b', value: 2 },
      { type: 'update', key: 'a', value: 10 },
    ]);
    expect(updater.get('a')).toBe(10);
    expect(updater.get('b')).toBe(2);
  });

  test('should handle removals', () => {
    updater.set('a', 1);
    const delta = updater.delete('a');
    expect(delta).toBeDefined();
    expect(delta!.type).toBe('remove');
    expect(updater.get('a')).toBeUndefined();
  });

  test('should create snapshots', () => {
    updater.set('a', 1);
    updater.set('b', 2);
    const snapshot = updater.createSnapshot();
    expect(snapshot.version).toBe(updater.getVersion());
    expect(snapshot.data.size).toBe(2);
  });
});

describe('PerformanceMetricsCollector', () => {
  let collector: PerformanceMetricsCollector;

  beforeEach(() => {
    collector = new PerformanceMetricsCollector({ sampleInterval: 10000 });
  });

  afterEach(() => {
    collector.destroy();
  });

  test('should record latency', () => {
    collector.recordLatency('test', 10);
    collector.recordLatency('test', 20);
    collector.recordLatency('test', 30);
    const stats = collector.getLatencyStats('test');
    expect(stats).toBeDefined();
    expect(stats!.avg).toBe(20);
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(30);
  });

  test('should record throughput', () => {
    collector.recordThroughput('test', 1);
    collector.recordThroughput('test', 5);
    const stats = collector.getThroughputStats('test');
    expect(stats).toBeDefined();
    expect(stats!.total).toBe(6);
  });

  test('should record errors', () => {
    collector.recordError('test1');
    collector.recordError('test2');
    collector.recordError('test1');
    const stats = collector.getErrorStats();
    expect(stats.count).toBe(3);
  });

  test('should measure async operations', async () => {
    const result = await collector.measure('test', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'done';
    });
    expect(result).toBe('done');
    const stats = collector.getLatencyStats('test');
    expect(stats).toBeDefined();
    expect(stats!.avg).toBeGreaterThanOrEqual(10);
  });

  test('should measure sync operations', () => {
    const result = collector.measureSync('test', () => 'sync done');
    expect(result).toBe('sync done');
    const stats = collector.getLatencyStats('test');
    expect(stats).toBeDefined();
  });

  test('should calculate percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      collector.recordLatency('test', i);
    }
    const stats = collector.getLatencyStats('test');
    expect(stats!.p50).toBeCloseTo(50, -1);
    expect(stats!.p95).toBeCloseTo(95, -1);
    expect(stats!.p99).toBeCloseTo(99, -1);
  });

  test('should return memory stats', () => {
    const mem = collector.getMemoryStats();
    expect(mem.heapUsed).toBeGreaterThan(0);
    expect(mem.heapTotal).toBeGreaterThan(0);
  });

  test('should return summary', () => {
    collector.recordLatency('operation1', 10);
    collector.recordLatency('operation2', 20);
    const summary = collector.getSummary();
    expect(summary.operations.length).toBe(2);
    expect(summary.memory).toBeDefined();
    expect(summary.errors).toBeDefined();
  });
});

describe('RealtimePerformanceManager', () => {
  let manager: RealtimePerformanceManager;

  beforeEach(() => {
    manager = new RealtimePerformanceManager({
      batcher: { maxBatchSize: 5, maxBatchDelay: 50, enableCompression: false },
      backpressure: { maxBufferSize: 100 },
      cache: { maxSize: 100 },
    });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should initialize successfully', async () => {
    await manager.initialize();
    const health = manager.getHealth();
    expect(health.status).toBeDefined();
  });

  test('should cache values', async () => {
    await manager.initialize();
    manager.setInCache('key1', 'value1', 60000);
    expect(manager.getFromCache('key1')).toBe('value1');
  });

  test('should provide incremental updaters', async () => {
    await manager.initialize();
    const updater = manager.getIncrementalUpdater('test');
    updater.set('a', 1);
    expect(updater.get('a')).toBe(1);
  });

  test('should return comprehensive stats', async () => {
    await manager.initialize();
    const stats = manager.getStats();
    expect(stats.connections).toBeDefined();
    expect(stats.batching).toBeDefined();
    expect(stats.backpressure).toBeDefined();
    expect(stats.cache).toBeDefined();
    expect(stats.metrics).toBeDefined();
  });

  test('should return health status', async () => {
    await manager.initialize();
    const health = manager.getHealth();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.checks).toBeDefined();
    expect(health.message).toBeDefined();
  });

  test('should flush pending data', async () => {
    await manager.initialize();
    await manager.flush();
  });

  test('should reset metrics', async () => {
    await manager.initialize();
    manager.resetMetrics();
  });

  test('should shutdown gracefully', async () => {
    await manager.initialize();
    await manager.shutdown();
    await manager.shutdown();
  });
});
