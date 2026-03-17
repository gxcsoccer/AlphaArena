/**
 * Real-time Performance Manager
 */

import { EventEmitter } from 'events';
import { WebSocketConnectionPool, ConnectionPoolConfig } from './WebSocketConnectionPool';
import { MessageBatcher, BatcherConfig } from './MessageBatcher';
import { BackpressureHandler, BackpressureConfig } from './BackpressureHandler';
import { LRUCache, CacheConfig } from './LRUCache';
import { IncrementalUpdater, IncrementalConfig } from './IncrementalUpdater';
import { PerformanceMetricsCollector, MetricsConfig } from './PerformanceMetrics';

export interface RealtimeConfig {
  connectionPool?: Partial<ConnectionPoolConfig>;
  batcher?: Partial<BatcherConfig>;
  backpressure?: Partial<BackpressureConfig>;
  cache?: Partial<CacheConfig>;
  incremental?: Partial<IncrementalConfig>;
  metrics?: Partial<MetricsConfig>;
  enableOptimizations: boolean;
}

export interface RealtimeStats {
  connections: { total: number; active: number; messagesProcessed: number; avgLatency: number };
  batching: { totalBatches: number; avgBatchSize: number; compressionRatio: number };
  backpressure: { status: string; bufferUsage: number; messagesDropped: number };
  cache: { size: number; hitRate: number; memoryUsage: number };
  metrics: { avgLatency: number; throughput: number; errorRate: number };
}

const DEFAULT_CONFIG: RealtimeConfig = { enableOptimizations: true };

export class RealtimePerformanceManager extends EventEmitter {
  private config: RealtimeConfig;
  private connectionPool?: WebSocketConnectionPool;
  private batcher?: MessageBatcher;
  private backpressure?: BackpressureHandler;
  private cache?: LRUCache;
  private incrementalUpdaters: Map<string, IncrementalUpdater> = new Map();
  private metricsCollector: PerformanceMetricsCollector;
  private isInitialized: boolean = false;

  constructor(config: Partial<RealtimeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metricsCollector = new PerformanceMetricsCollector(config.metrics);
    this.metricsCollector.on('alert', (alert) => this.emit('alert', alert));
  }

  public async initialize(wsUrl?: string): Promise<void> {
    if (this.isInitialized) return;

    if (wsUrl) {
      this.connectionPool = new WebSocketConnectionPool(wsUrl, this.config.connectionPool);
      await this.connectionPool.initialize();
      this.connectionPool.on('message', (msg) => this.handleIncomingMessage(msg));
      this.connectionPool.on('connection:error', (err) => {
        this.metricsCollector.recordError('connection');
        this.emit('connection:error', err);
      });
    }

    this.batcher = new MessageBatcher(this.config.batcher);
    this.batcher.on('batch:flushed', (batch) => {
      this.metricsCollector.recordThroughput('batch', batch.messages.length);
      this.emit('batch:flushed', batch);
    });

    this.backpressure = new BackpressureHandler(this.config.backpressure);
    this.backpressure.on('backpressure:warning', (state) => this.emit('backpressure:warning', state));
    this.backpressure.on('backpressure:critical', (state) => this.emit('backpressure:critical', state));

    this.cache = new LRUCache(this.config.cache);
    this.isInitialized = true;
    this.emit('initialized');
  }

  public async send(data: any, options?: { priority?: number; bypassBatch?: boolean }): Promise<void> {
    if (!this.isInitialized) throw new Error('Manager not initialized');
    const startTime = performance.now();

    try {
      if (this.backpressure) {
        const pushed = this.backpressure.push(data, options?.priority);
        if (!pushed) {
          this.metricsCollector.recordError('send');
          throw new Error('Backpressure: message dropped');
        }
        const message = this.backpressure.pop();
        if (message) data = message;
      }

      if (this.batcher && !options?.bypassBatch) {
        this.batcher.add(data);
        if (this.batcher.getQueueSize() >= (this.config.batcher?.maxBatchSize || 100)) {
          const batch = await this.batcher.flush();
          if (batch && this.connectionPool) await this.connectionPool.send(batch.messages);
        }
      } else if (this.connectionPool) {
        await this.connectionPool.send(data);
      }

      this.metricsCollector.recordLatency('send', performance.now() - startTime);
      this.metricsCollector.recordThroughput('send');
    } catch (error) {
      this.metricsCollector.recordError('send');
      throw error;
    }
  }

  private handleIncomingMessage(msg: { connectionId: string; data: any }): void {
    const startTime = performance.now();
    try {
      if (this.cache && msg.data.key) this.cache.set(msg.data.key, msg.data);
      this.emit('message', msg.data);
      this.metricsCollector.recordLatency('receive', performance.now() - startTime);
      this.metricsCollector.recordThroughput('receive');
    } catch (error) {
      this.metricsCollector.recordError('receive');
      this.emit('error', error);
    }
  }

  public getIncrementalUpdater(name: string): IncrementalUpdater {
    if (!this.incrementalUpdaters.has(name)) {
      const updater = new IncrementalUpdater(this.config.incremental);
      updater.on('delta:applied', (info) => this.metricsCollector.recordThroughput('incremental.' + name, info.changes));
      this.incrementalUpdaters.set(name, updater);
    }
    return this.incrementalUpdaters.get(name)!;
  }

  public getFromCache(key: string): any | undefined {
    if (!this.cache) return undefined;
    const result = this.cache.get(key);
    if (result !== undefined) this.metricsCollector.recordThroughput('cache.hit');
    else this.metricsCollector.recordThroughput('cache.miss');
    return result;
  }

  public setInCache(key: string, value: any, ttl?: number): void {
    if (this.cache) this.cache.set(key, value, ttl);
  }

  public getStats(): RealtimeStats {
    const poolStats = this.connectionPool?.getStats();
    const batcherStats = this.batcher?.getStats();
    const backpressureState = this.backpressure?.getState();
    const cacheStats = this.cache?.getStats();
    const metricsSummary = this.metricsCollector.getSummary();

    return {
      connections: { total: poolStats?.totalConnections || 0, active: poolStats?.activeConnections || 0, messagesProcessed: poolStats?.messagesProcessed || 0, avgLatency: poolStats?.avgLatency || 0 },
      batching: { totalBatches: batcherStats?.totalBatches || 0, avgBatchSize: batcherStats?.avgBatchSize || 0, compressionRatio: batcherStats?.compressionRatio || 1 },
      backpressure: { status: backpressureState?.status || 'normal', bufferUsage: backpressureState?.bufferUsage || 0, messagesDropped: backpressureState?.messagesDropped || 0 },
      cache: { size: cacheStats?.size || 0, hitRate: cacheStats?.hitRate || 0, memoryUsage: cacheStats?.memoryUsage || 0 },
      metrics: { avgLatency: metricsSummary.operations[0]?.latency.avg || 0, throughput: metricsSummary.operations[0]?.throughput.perSecond || 0, errorRate: metricsSummary.errors.rate },
    };
  }

  public getMetricsCollector(): PerformanceMetricsCollector { return this.metricsCollector; }

  public getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; checks: Record<string, boolean>; message: string } {
    const stats = this.getStats();
    const checks: Record<string, boolean> = {
      connections: stats.connections.active > 0,
      backpressure: stats.backpressure.status !== 'critical',
      cache: stats.cache.hitRate > 0.5,
      latency: stats.metrics.avgLatency < 100,
    };

    const allHealthy = Object.values(checks).every(v => v);
    const anyDegraded = stats.backpressure.status === 'warning' || stats.metrics.avgLatency > 50;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (allHealthy && !anyDegraded) { status = 'healthy'; message = 'All systems operational'; }
    else if (checks.connections && checks.backpressure) { status = 'degraded'; message = 'Performance degraded but operational'; }
    else { status = 'unhealthy'; message = 'Critical issues detected'; }

    return { status, checks, message };
  }

  public async flush(): Promise<void> { if (this.batcher) await this.batcher.flush(); }
  public resetMetrics(): void { this.metricsCollector.clear(); }

  public async shutdown(): Promise<void> {
    await this.flush();
    if (this.connectionPool) await this.connectionPool.shutdown();
    if (this.backpressure) this.backpressure.destroy();
    if (this.cache) this.cache.destroy();
    this.metricsCollector.destroy();
    this.incrementalUpdaters.forEach(updater => updater.clear());
    this.incrementalUpdaters.clear();
    this.isInitialized = false;
    this.emit('shutdown');
  }
}

export default RealtimePerformanceManager;