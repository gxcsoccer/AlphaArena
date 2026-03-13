/**
 * AlphaArena Monitoring Service
 * 
 * Provides comprehensive monitoring capabilities:
 * - Error tracking with context
 * - Performance metrics collection
 * - Health checks
 * - System metrics (memory, CPU, uptime)
 */

import { EventEmitter } from 'events';
import os from 'os';

export interface ErrorContext {
  userId?: string;
  strategyId?: string;
  symbol?: string;
  operation?: string;
  statusCode?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetrics {
  // Response times (ms)
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Request counts
  totalRequests: number;
  requestsPerMinute: number;
  
  // Error rates
  errorRate: number; // percentage
  errorCount: number;
  
  // System metrics
  memoryUsage: number; // bytes
  memoryUsagePercent: number; // percentage
  cpuUsage: number; // percentage
  uptime: number; // seconds
  
  // Business metrics
  activeStrategies: number;
  totalTrades: number;
  orderBookDepth: number;
  
  timestamp: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: number;
  lastError?: {
    message: string;
    timestamp: number;
    severity: string;
  };
  checks: {
    database: boolean;
    realtime: boolean;
    orderBooks: boolean;
  };
  timestamp: number;
}

export class MonitoringService extends EventEmitter {
  private errors: TrackedError[] = [];
  private responseTimes: number[] = [];
  private requestCount: number = 0;
  private errorCount: number = 0;
  private startTime: number;
  private maxErrors: number = 100; // Keep last 100 errors
  private maxResponseTimes: number = 1000; // Keep last 1000 response times
  
  // Alert thresholds
  private thresholds = {
    memoryPercent: 85, // Alert if memory usage > 85%
    errorRatePercent: 5, // Alert if error rate > 5%
    responseTimeP95: 1000, // Alert if p95 response time > 1000ms
    cpuPercent: 80, // Alert if CPU usage > 80%
  };

  constructor() {
    super();
    this.startTime = Date.now();
    
    // Start periodic metrics collection
    this.startMetricsCollection();
  }

  /**
   * Track an error with context
   */
  public trackError(
    error: Error | string,
    context: ErrorContext = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const trackedError: TrackedError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: Date.now(),
      severity,
    };
    
    this.errors.push(trackedError);
    this.errorCount++;
    
    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // Emit error event for alerting (use 'error:tracked' to avoid Node.js unhandled error events)
    this.emit('error:tracked', trackedError);
    
    // Check if alert should be triggered
    this.checkAlertThresholds();
    
    console.error(`[Monitoring] Error tracked: ${errorMessage}`, context);
  }

  /**
   * Record a request's response time
   */
  public recordResponse(responseTimeMs: number): void {
    this.responseTimes.push(responseTimeMs);
    this.requestCount++;
    
    // Trim old response times
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimes);
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(activeStrategies: number = 0, totalTrades: number = 0, orderBookDepth: number = 0): PerformanceMetrics {
    const now = Date.now();
    const uptime = Math.floor((now - this.startTime) / 1000);
    
    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const avgResponseTime = sortedTimes.length > 0
      ? sortedTimes.reduce((sum, t) => sum + t, 0) / sortedTimes.length
      : 0;
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;
    
    // Calculate error rate
    const errorRate = this.requestCount > 0
      ? (this.errorCount / this.requestCount) * 100
      : 0;
    
    // Calculate requests per minute
    const uptimeMinutes = uptime / 60;
    const requestsPerMinute = uptimeMinutes > 0 ? this.requestCount / uptimeMinutes : 0;
    
    // System metrics
    const memoryUsage = process.memoryUsage().heapUsed;
    const totalMemory = os.totalmem();
    const memoryUsagePercent = (memoryUsage / totalMemory) * 100;
    const cpuUsage = this.getCpuUsage();
    
    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
      totalRequests: this.requestCount,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      errorCount: this.errorCount,
      memoryUsage,
      memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      uptime,
      activeStrategies,
      totalTrades,
      orderBookDepth,
      timestamp: now,
    };
  }

  /**
   * Get health status
   */
  public getHealthStatus(
    databaseConnected: boolean = true,
    realtimeConnected: boolean = true,
    orderBooksActive: number = 0
  ): HealthStatus {
    const metrics = this.getMetrics();
    const lastError = this.errors.length > 0 ? this.errors[this.errors.length - 1] : undefined;
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (metrics.memoryUsagePercent > 95 || metrics.cpuUsage > 95 || !databaseConnected) {
      status = 'unhealthy';
    } else if (
      metrics.memoryUsagePercent > this.thresholds.memoryPercent ||
      metrics.cpuUsage > this.thresholds.cpuPercent ||
      metrics.errorRate > this.thresholds.errorRatePercent ||
      !realtimeConnected ||
      orderBooksActive === 0
    ) {
      status = 'degraded';
    }
    
    return {
      status,
      uptime: metrics.uptime,
      memory: {
        used: metrics.memoryUsage,
        total: os.totalmem(),
        percent: metrics.memoryUsagePercent,
      },
      cpu: metrics.cpuUsage,
      lastError: lastError ? {
        message: lastError.message,
        timestamp: lastError.timestamp,
        severity: lastError.severity,
      } : undefined,
      checks: {
        database: databaseConnected,
        realtime: realtimeConnected,
        orderBooks: orderBooksActive > 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(limit: number = 10): TrackedError[] {
    return this.errors.slice(-limit);
  }

  /**
   * Get error count by severity
   */
  public getErrorsBySeverity(): Record<string, number> {
    const counts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    this.errors.forEach(error => {
      counts[error.severity]++;
    });
    
    return counts;
  }

  /**
   * Clear all tracked data (useful for testing)
   */
  public clear(): void {
    this.errors = [];
    this.responseTimes = [];
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    // Emit metrics every minute
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);
    }, 60000);
  }

  /**
   * Check alert thresholds and emit alerts if needed
   */
  private checkAlertThresholds(): void {
    const metrics = this.getMetrics();
    const alerts: string[] = [];
    
    if (metrics.memoryUsagePercent > this.thresholds.memoryPercent) {
      alerts.push(`High memory usage: ${metrics.memoryUsagePercent}%`);
    }
    
    if (metrics.errorRate > this.thresholds.errorRatePercent) {
      alerts.push(`High error rate: ${metrics.errorRate}%`);
    }
    
    if (metrics.p95ResponseTime > this.thresholds.responseTimeP95) {
      alerts.push(`Slow response time (p95): ${metrics.p95ResponseTime}ms`);
    }
    
    if (metrics.cpuUsage > this.thresholds.cpuPercent) {
      alerts.push(`High CPU usage: ${metrics.cpuUsage}%`);
    }
    
    if (alerts.length > 0) {
      this.emit('alert', {
        type: 'threshold_exceeded',
        alerts,
        metrics,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get CPU usage percentage
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    if (cpus.length === 0) return 0;
    
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      const times = cpu.times;
      totalIdle += times.idle;
      totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
    });
    
    // This is a simplified calculation - for more accurate real-time CPU usage,
    // you'd need to sample twice and calculate the difference
    const idlePercent = totalIdle / totalTick;
    return (1 - idlePercent) * 100;
  }
}

// Singleton instance
let monitoringInstance: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance;
}

export default MonitoringService;
