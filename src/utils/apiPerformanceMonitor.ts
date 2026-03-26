/**
 * API Performance Monitor - API 性能监控
 * 
 * Tracks and reports API performance metrics:
 * - Response times (P50, P95, P99)
 * - Request rates
 * - Error rates
 * - Slow query detection
 * - Cache hit rates
 * 
 * Issue #663: Added memory limits and batch insert optimization
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { createLogger } from './logger';

const log = createLogger('APIPerformanceMonitor');

/**
 * Request metrics
 */
interface RequestMetric {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  cacheHit?: boolean;
  userId?: string;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  cacheHitRate: number;
  slowRequests: RequestMetric[];
  endpointStats: Map<string, EndpointStats>;
  memoryUsage: {
    metricsCount: number;
    maxMetrics: number;
    usagePercent: number;
  };
}

/**
 * Per-endpoint statistics
 */
interface EndpointStats {
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  lastAccessed: number;
  recentLatencies: number[]; // Keep last 100 latencies for accurate percentiles
}

/**
 * Performance monitor configuration
 */
interface MonitorConfig {
  sampleSize: number;           // Max metrics to keep in memory
  slowThresholdMs: number;      // Threshold for slow request warning
  excludePaths: RegExp[];       // Paths to exclude from monitoring
  includeUserAgent: boolean;    // Include user agent in logs
  enableBatchInsert: boolean;   // Enable batch insert to database
  batchInsertInterval: number;  // Interval for batch insert (ms)
  batchInsertSize: number;      // Max batch size before forced insert
  cleanupInterval: number;      // Interval for cleanup (ms)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MonitorConfig = {
  sampleSize: 10000,
  slowThresholdMs: 1000,
  excludePaths: [/^\/health/, /^\/docs/, /^\/favicon/, /^\/metrics/],
  includeUserAgent: true,
  enableBatchInsert: true,
  batchInsertInterval: 30000, // 30 seconds
  batchInsertSize: 100,
  cleanupInterval: 60000, // 1 minute
};

/**
 * API Performance Monitor
 * 
 * Singleton class that tracks API performance metrics with memory limits
 * and optional batch insert to database.
 */
export class APIPerformanceMonitor extends EventEmitter {
  private static instance: APIPerformanceMonitor;
  private metrics: RequestMetric[] = [];
  private endpointStats: Map<string, EndpointStats> = new Map();
  private config: MonitorConfig;
  private startTime: number;
  private requestCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private batchInsertTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private pendingBatch: RequestMetric[] = [];
  private isShuttingDown: boolean = false;

  private constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    
    // Start batch insert timer if enabled
    if (this.config.enableBatchInsert) {
      this.startBatchInsertTimer();
      this.startCleanupTimer();
    }

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MonitorConfig>): APIPerformanceMonitor {
    if (!APIPerformanceMonitor.instance) {
      APIPerformanceMonitor.instance = new APIPerformanceMonitor(config);
    }
    return APIPerformanceMonitor.instance;
  }

  /**
   * Record a request metric
   */
  recordMetric(metric: RequestMetric): void {
    // Skip excluded paths
    if (this.config.excludePaths.some(pattern => pattern.test(metric.path))) {
      return;
    }

    this.requestCount++;
    
    // Track cache stats
    if (metric.cacheHit !== undefined) {
      if (metric.cacheHit) {
        this.cacheHits++;
      } else {
        this.cacheMisses++;
      }
    }

    // Add to metrics buffer with memory limit
    this.metrics.push(metric);
    
    // Trim if over sample size (FIFO)
    if (this.metrics.length > this.config.sampleSize) {
      const removeCount = this.metrics.length - this.config.sampleSize;
      this.metrics = this.metrics.slice(removeCount);
      log.debug(`Trimmed ${removeCount} old metrics to stay within limit`);
    }

    // Update endpoint stats
    this.updateEndpointStats(metric);

    // Check for slow requests
    if (metric.duration > this.config.slowThresholdMs) {
      log.warn(`Slow request detected: ${metric.method} ${metric.path} took ${metric.duration}ms`);
      this.emit('slow-request', metric);
    }

    // Check for errors
    if (metric.statusCode >= 400) {
      this.emit('error', metric);
    }

    // Add to pending batch for database insert
    if (this.config.enableBatchInsert) {
      this.pendingBatch.push(metric);
      
      // Force batch insert if batch is full
      if (this.pendingBatch.length >= this.config.batchInsertSize) {
        this.flushBatch();
      }
    }
  }

  /**
   * Update per-endpoint statistics
   */
  private updateEndpointStats(metric: RequestMetric): void {
    const key = `${metric.method} ${metric.path}`;
    const stats = this.endpointStats.get(key) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0,
      lastAccessed: 0,
      recentLatencies: [],
    };

    stats.count++;
    stats.totalTime += metric.duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, metric.duration);
    stats.maxTime = Math.max(stats.maxTime, metric.duration);
    stats.lastAccessed = metric.timestamp;

    // Keep last 100 latencies for accurate percentiles
    stats.recentLatencies.push(metric.duration);
    if (stats.recentLatencies.length > 100) {
      stats.recentLatencies = stats.recentLatencies.slice(-100);
    }

    if (metric.statusCode >= 400) {
      stats.errorCount++;
    }

    this.endpointStats.set(key, stats);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const durations = this.metrics.map(m => m.duration);
    const successfulMetrics = this.metrics.filter(m => m.statusCode < 400);
    const failedMetrics = this.metrics.filter(m => m.statusCode >= 400);

    // Calculate requests per second
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const requestsPerSecond = this.requestCount / elapsedSeconds;

    // Calculate cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.cacheHits / totalCacheRequests 
      : 0;

    // Get slow requests
    const slowRequests = this.metrics
      .filter(m => m.duration > this.config.slowThresholdMs)
      .slice(-50);

    // Calculate memory usage
    const memoryUsage = {
      metricsCount: this.metrics.length,
      maxMetrics: this.config.sampleSize,
      usagePercent: (this.metrics.length / this.config.sampleSize) * 100,
    };

    return {
      totalRequests: this.requestCount,
      successfulRequests: successfulMetrics.length,
      failedRequests: failedMetrics.length,
      averageResponseTime: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      p50ResponseTime: this.calculatePercentile(durations, 50),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      requestsPerSecond,
      errorRate: this.requestCount > 0 
        ? failedMetrics.length / this.metrics.length 
        : 0,
      cacheHitRate,
      slowRequests,
      endpointStats: new Map(this.endpointStats),
      memoryUsage,
    };
  }

  /**
   * Get top slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): Array<{ endpoint: string; avgTime: number; count: number; p95Time: number }> {
    const endpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgTime: stats.avgTime,
        count: stats.count,
        p95Time: this.calculatePercentile(stats.recentLatencies, 95),
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return endpoints;
  }

  /**
   * Get most frequently accessed endpoints
   */
  getMostAccessedEndpoints(limit: number = 10): Array<{ endpoint: string; count: number; avgTime: number; errorRate: number }> {
    const endpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgTime: stats.avgTime,
        errorRate: stats.count > 0 ? stats.errorCount / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return endpoints;
  }

  /**
   * Get endpoints with highest error rates
   */
  getHighestErrorEndpoints(limit: number = 10): Array<{ endpoint: string; errorRate: number; errorCount: number; count: number }> {
    const endpoints = Array.from(this.endpointStats.entries())
      .filter(([_, stats]) => stats.errorCount > 0)
      .map(([endpoint, stats]) => ({
        endpoint,
        errorRate: stats.count > 0 ? stats.errorCount / stats.count : 0,
        errorCount: stats.errorCount,
        count: stats.count,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);

    return endpoints;
  }

  /**
   * Start batch insert timer
   */
  private startBatchInsertTimer(): void {
    this.batchInsertTimer = setInterval(() => {
      this.flushBatch();
    }, this.config.batchInsertInterval);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, this.config.cleanupInterval);
  }

  /**
   * Flush pending batch to database
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];

    try {
      // Import dynamically to avoid circular dependency
      const { getSupabaseAdminClient } = await import('../database/client');
      const client = getSupabaseAdminClient();

      // Aggregate metrics by endpoint for batch insert
      const aggregatedMetrics = this.aggregateMetricsForBatch(batch);

      if (aggregatedMetrics.length > 0) {
        const { error } = await client
          .from('api_performance_metrics')
          .insert(aggregatedMetrics);

        if (error) {
          // Table might not exist, log warning but don't fail
          if (error.code !== '42P01') {
            log.warn('Failed to insert performance metrics batch:', error.message);
          }
        } else {
          log.debug(`Inserted ${aggregatedMetrics.length} aggregated performance metrics`);
        }
      }
    } catch (err) {
      log.warn('Failed to flush performance metrics batch:', err);
      // Re-add to pending batch for retry (with limit)
      if (this.pendingBatch.length < this.config.batchInsertSize * 2) {
        this.pendingBatch.unshift(...batch.slice(0, this.config.batchInsertSize));
      }
    }
  }

  /**
   * Aggregate metrics for batch insert
   */
  private aggregateMetricsForBatch(metrics: RequestMetric[]): Array<Record<string, any>> {
    const now = new Date().toISOString();
    const minute = now.substring(0, 16); // Round to minute

    // Group by endpoint
    const grouped = new Map<string, { count: number; totalTime: number; errors: number; latencies: number[] }>();

    for (const m of metrics) {
      const key = `${m.method} ${m.path}`;
      const entry = grouped.get(key) || { count: 0, totalTime: 0, errors: 0, latencies: [] };
      entry.count++;
      entry.totalTime += m.duration;
      entry.latencies.push(m.duration);
      if (m.statusCode >= 400) entry.errors++;
      grouped.set(key, entry);
    }

    // Convert to insert format
    return Array.from(grouped.entries()).map(([endpoint, data]) => {
      const [method, ...pathParts] = endpoint.split(' ');
      return {
        endpoint,
        method,
        path: pathParts.join(' '),
        request_count: data.count,
        avg_response_time: data.totalTime / data.count,
        min_response_time: Math.min(...data.latencies),
        max_response_time: Math.max(...data.latencies),
        p95_response_time: this.calculatePercentile(data.latencies, 95),
        error_count: data.errors,
        recorded_at: minute,
        created_at: now,
      };
    });
  }

  /**
   * Cleanup old data
   */
  private cleanupOldData(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const cutoff = Date.now() - maxAge;

    // Remove old endpoint stats that haven't been accessed
    for (const [key, stats] of this.endpointStats.entries()) {
      if (stats.lastAccessed < cutoff) {
        this.endpointStats.delete(key);
      }
    }

    log.debug(`Cleanup completed, ${this.endpointStats.size} endpoints tracked`);
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.metrics = [];
    this.endpointStats.clear();
    this.pendingBatch = [];
    this.requestCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
    log.info('Performance monitor reset');
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    log.info('Shutting down performance monitor...');

    // Stop timers
    if (this.batchInsertTimer) {
      clearInterval(this.batchInsertTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Flush remaining batch
    await this.flushBatch();

    log.info('Performance monitor shutdown complete');
  }
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitorMiddleware() {
  const monitor = APIPerformanceMonitor.getInstance();

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Track response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const cacheHit = res.getHeader('X-Cache') === 'HIT';
      
      monitor.recordMetric({
        timestamp: startTime,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        cacheHit,
        userId: (req as any).user?.id,
      });

      // Add timing header
      res.setHeader('X-Response-Time', `${duration}ms`);
    });

    next();
  };
}

/**
 * Performance stats endpoint handler
 */
export function performanceStatsHandler(req: Request, res: Response): void {
  const monitor = APIPerformanceMonitor.getInstance();
  const stats = monitor.getStats();
  
  res.json({
    success: true,
    data: {
      summary: {
        totalRequests: stats.totalRequests,
        averageResponseTime: Math.round(stats.averageResponseTime * 100) / 100,
        p50ResponseTime: Math.round(stats.p50ResponseTime * 100) / 100,
        p95ResponseTime: Math.round(stats.p95ResponseTime * 100) / 100,
        p99ResponseTime: Math.round(stats.p99ResponseTime * 100) / 100,
        requestsPerSecond: Math.round(stats.requestsPerSecond * 100) / 100,
        errorRate: Math.round(stats.errorRate * 10000) / 100 + '%',
        cacheHitRate: Math.round(stats.cacheHitRate * 10000) / 100 + '%',
      },
      memory: stats.memoryUsage,
      slowestEndpoints: monitor.getSlowestEndpoints(10),
      mostAccessedEndpoints: monitor.getMostAccessedEndpoints(10),
      highestErrorEndpoints: monitor.getHighestErrorEndpoints(10),
      slowRequests: stats.slowRequests.slice(-10),
    },
  });
}

// Export singleton instance
export const apiPerformanceMonitor = APIPerformanceMonitor.getInstance();

export default apiPerformanceMonitor;