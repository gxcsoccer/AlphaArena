/**
 * Performance Metrics Collector
 */

import { EventEmitter } from 'events';

export interface LatencyMetric {
  operation: string;
  value: number;
  timestamp: number;
}

export interface ThroughputMetric {
  operation: string;
  count: number;
  timestamp: number;
}

export interface PerformanceStats {
  latency: { avg: number; min: number; max: number; p50: number; p95: number; p99: number };
  throughput: { perSecond: number; perMinute: number; total: number };
  errors: { count: number; rate: number };
  memory: { heapUsed: number; heapTotal: number; external: number; rss: number };
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface PerformanceAlert {
  metric: string;
  threshold: AlertThreshold;
  currentValue: number;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
}

export interface MetricsConfig {
  sampleSize: number;
  sampleInterval: number;
  percentiles: number[];
  thresholds: AlertThreshold[];
}

const DEFAULT_CONFIG: MetricsConfig = {
  sampleSize: 1000,
  sampleInterval: 1000,
  percentiles: [0.5, 0.95, 0.99],
  thresholds: [
    { metric: 'latency_p95', operator: 'gt', value: 100, severity: 'warning' },
    { metric: 'latency_p95', operator: 'gt', value: 500, severity: 'critical' },
    { metric: 'error_rate', operator: 'gt', value: 0.01, severity: 'warning' },
    { metric: 'error_rate', operator: 'gt', value: 0.05, severity: 'critical' },
  ],
};

export class PerformanceMetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private latencies: Map<string, number[]> = new Map();
  private throughput: Map<string, { count: number; timestamps: number[] }> = new Map();
  private errors: Map<string, number> = new Map();
  private totalErrors: number = 0;
  private sampleTimer?: NodeJS.Timeout;
  private lastSampleTime: number = Date.now();

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startSampling();
  }

  public recordLatency(operation: string, valueMs: number): void {
    if (!this.latencies.has(operation)) this.latencies.set(operation, []);
    const samples = this.latencies.get(operation)!;
    samples.push(valueMs);
    if (samples.length > this.config.sampleSize) samples.shift();
    this.checkThresholds(operation, valueMs);
  }

  public async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.recordLatency(operation, performance.now() - start);
      return result;
    } catch (error) {
      this.recordError(operation);
      throw error;
    }
  }

  public measureSync<T>(operation: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      this.recordLatency(operation, performance.now() - start);
      return result;
    } catch (error) {
      this.recordError(operation);
      throw error;
    }
  }

  public recordThroughput(operation: string, count: number = 1): void {
    if (!this.throughput.has(operation)) this.throughput.set(operation, { count: 0, timestamps: [] });
    const metric = this.throughput.get(operation)!;
    metric.count += count;
    metric.timestamps.push(Date.now());
    if (metric.timestamps.length > 1000) metric.timestamps = metric.timestamps.slice(-1000);
  }

  public recordError(operation: string): void {
    this.errors.set(operation, (this.errors.get(operation) || 0) + 1);
    this.totalErrors++;
  }

  public getLatencyStats(operation: string): PerformanceStats['latency'] | null {
    const samples = this.latencies.get(operation);
    if (!samples || samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  public getThroughputStats(operation: string): PerformanceStats['throughput'] | null {
    const metric = this.throughput.get(operation);
    if (!metric) return null;
    const now = Date.now();
    const perSecond = metric.timestamps.filter(t => t > now - 1000).length;
    const perMinute = metric.timestamps.filter(t => t > now - 60000).length;
    return { perSecond, perMinute, total: metric.count };
  }

  public getErrorStats(): PerformanceStats['errors'] {
    const uptime = (Date.now() - this.lastSampleTime) / 1000;
    return { count: this.totalErrors, rate: uptime > 0 ? this.totalErrors / uptime : 0 };
  }

  public getMemoryStats(): PerformanceStats['memory'] {
    const mem = process.memoryUsage();
    return { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external, rss: mem.rss };
  }

  public getAllStats(): Record<string, PerformanceStats> {
    const result: Record<string, PerformanceStats> = {};
    for (const [operation] of this.latencies) {
      result[operation] = {
        latency: this.getLatencyStats(operation) || { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 },
        throughput: this.getThroughputStats(operation) || { perSecond: 0, perMinute: 0, total: 0 },
        errors: this.getErrorStats(),
        memory: this.getMemoryStats(),
      };
    }
    return result;
  }

  public getSummary(): {
    operations: Array<{ name: string; latency: PerformanceStats['latency']; throughput: PerformanceStats['throughput'] }>;
    errors: PerformanceStats['errors'];
    memory: PerformanceStats['memory'];
  } {
    const operations = Array.from(this.latencies.keys()).map(name => ({
      name,
      latency: this.getLatencyStats(name) || { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 },
      throughput: this.getThroughputStats(name) || { perSecond: 0, perMinute: 0, total: 0 },
    }));
    return { operations, errors: this.getErrorStats(), memory: this.getMemoryStats() };
  }

  public addThreshold(threshold: AlertThreshold): void { this.config.thresholds.push(threshold); }

  public clear(): void {
    this.latencies.clear();
    this.throughput.clear();
    this.errors.clear();
    this.totalErrors = 0;
  }

  private startSampling(): void {
    this.sampleTimer = setInterval(() => this.emit('sample', this.getSummary()), this.config.sampleInterval);
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  }

  private checkThresholds(operation: string, value: number): void {
    const stats = this.getLatencyStats(operation);
    if (!stats) return;
    for (const threshold of this.config.thresholds) {
      if (!threshold.metric.startsWith('latency_')) continue;
      const metricValue = this.getMetricValue(threshold.metric, stats);
      if (metricValue === null) continue;
      if (this.evaluateThreshold(metricValue, threshold)) {
        this.emit('alert', { metric: operation + '.' + threshold.metric, threshold, currentValue: metricValue, severity: threshold.severity, timestamp: Date.now() });
      }
    }
  }

  private getMetricValue(metric: string, stats: PerformanceStats['latency']): number | null {
    switch (metric) {
      case 'latency_avg': return stats.avg;
      case 'latency_p50': return stats.p50;
      case 'latency_p95': return stats.p95;
      case 'latency_p99': return stats.p99;
      case 'latency_max': return stats.max;
      case 'latency_min': return stats.min;
      default: return null;
    }
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'lt': return value < threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      default: return false;
    }
  }

  public destroy(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
  }
}

export default PerformanceMetricsCollector;