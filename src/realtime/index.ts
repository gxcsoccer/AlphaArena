/**
 * Real-time Performance Optimization Module
 */

export { WebSocketConnectionPool } from './WebSocketConnectionPool';
export type { ConnectionPoolConfig, PooledConnection, ConnectionPoolStats } from './WebSocketConnectionPool';

export { MessageBatcher } from './MessageBatcher';
export type { BatcherConfig, Batch, BatcherStats } from './MessageBatcher';

export { BackpressureHandler } from './BackpressureHandler';
export type { BackpressureConfig, BackpressureState, BackpressureStats, OverflowStrategy } from './BackpressureHandler';

export { LRUCache } from './LRUCache';
export type { CacheConfig, CacheEntry, CacheStats } from './LRUCache';

export { IncrementalUpdater } from './IncrementalUpdater';
export type { IncrementalConfig, DeltaUpdate, Snapshot } from './IncrementalUpdater';

export { PerformanceMetricsCollector } from './PerformanceMetrics';
export type { MetricsConfig, PerformanceStats, AlertThreshold, PerformanceAlert } from './PerformanceMetrics';

export { RealtimePerformanceManager } from './RealtimePerformanceManager';
export type { RealtimeConfig, RealtimeStats } from './RealtimePerformanceManager';

export { RealtimePerformanceManager as default } from './RealtimePerformanceManager';
