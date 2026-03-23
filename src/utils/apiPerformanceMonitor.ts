/**
 * API Performance Monitor - API 性能监控
 * 
 * Tracks and reports API performance metrics:
 * - Response times (P50, P95, P99)
 * - Request rates
 * - Error rates
 * - Slow query detection
 * - Cache hit rates
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
}

/**
 * Performance monitor configuration
 */
interface MonitorConfig {
  sampleSize: number;
  slowThresholdMs: number;
  excludePaths: RegExp[];
  includeUserAgent: boolean;
}

/**
 * API Performance Monitor
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

  private constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = {
      sampleSize: config.sampleSize || 10000,
      slowThresholdMs: config.slowThresholdMs || 1000,
      excludePaths: config.excludePaths || [/^\/health/, /^\/docs/, /^\/favicon/],
      includeUserAgent: config.includeUserAgent ?? true,
    };
    this.startTime = Date.now();
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

    // Add to metrics buffer
    this.metrics.push(metric);
    
    // Trim if over sample size
    if (this.metrics.length > this.config.sampleSize) {
      this.metrics = this.metrics.slice(-this.config.sampleSize);
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
    };

    stats.count++;
    stats.totalTime += metric.duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, metric.duration);
    stats.maxTime = Math.max(stats.maxTime, metric.duration);
    stats.lastAccessed = metric.timestamp;

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
    };
  }

  /**
   * Get top slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): Array<{ endpoint: string; avgTime: number; count: number }> {
    const endpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgTime: stats.avgTime,
        count: stats.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return endpoints;
  }

  /**
   * Get most frequently accessed endpoints
   */
  getMostAccessedEndpoints(limit: number = 10): Array<{ endpoint: string; count: number; avgTime: number }> {
    const endpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgTime: stats.avgTime,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return endpoints;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.metrics = [];
    this.endpointStats.clear();
    this.requestCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
    log.info('Performance monitor reset');
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
      slowestEndpoints: monitor.getSlowestEndpoints(10),
      mostAccessedEndpoints: monitor.getMostAccessedEndpoints(10),
      slowRequests: stats.slowRequests.slice(-10),
    },
  });
}

// Export singleton instance
export const apiPerformanceMonitor = APIPerformanceMonitor.getInstance();

export default apiPerformanceMonitor;