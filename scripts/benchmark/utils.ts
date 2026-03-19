/**
 * Benchmark Utility Functions
 * 
 * Shared utilities for performance benchmarking
 */

export interface BenchmarkResult {
  name: string;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  opsPerSecond?: number;
  bytesPerOp?: number;
  metadata?: Record<string, unknown>;
}

export interface BaselineResult {
  name: string;
  ticksPerSecond: number;
  memoryMB: number;
  timestamp: string;
}

export interface ComparisonResult {
  name: string;
  current: number;
  baseline: number;
  changePercent: number;
  improved: boolean;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return ms.toFixed(2) + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
  return (ms / 60000).toFixed(2) + 'min';
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Get current memory usage in bytes
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>,
  _name: string = 'operation'
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Run a benchmark with memory tracking
 */
export async function runBenchmark<T>(
  name: string,
  fn: () => T | Promise<T>,
  options: { warmup?: number; iterations?: number } = {}
): Promise<BenchmarkResult> {
  const { warmup = 0, iterations = 1 } = options;
  
  // Force GC before measurement
  forceGC();
  
  const memoryBefore = getMemoryUsage().heapUsed;
  const start = performance.now();
  
  // Run warmup iterations
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  
  // Run actual iterations
  if (iterations === 1) {
    await fn();
  } else {
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
  }
  
  const duration = performance.now() - start;
  const memoryAfter = getMemoryUsage().heapUsed;
  
  return {
    name,
    duration,
    memoryBefore,
    memoryAfter,
    memoryDelta: memoryAfter - memoryBefore,
    opsPerSecond: iterations > 1 ? (iterations / duration) * 1000 : undefined,
    bytesPerOp: iterations > 1 ? Math.abs(memoryAfter - memoryBefore) / iterations : undefined,
  };
}

/**
 * Calculate statistics from an array of numbers
 */
export function calculateStats(values: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    stdDev,
  };
}

/**
 * Compare current result with baseline
 */
export function compareWithBaseline(
  current: number,
  baseline: number,
  higherIsBetter: boolean = true
): { current: number; baseline: number; changePercent: number; improved: boolean } {
  const changePercent = ((current - baseline) / baseline) * 100;
  const improved = higherIsBetter ? current >= baseline : current <= baseline;
  
  return {
    current,
    baseline,
    changePercent,
    improved,
  };
}

/**
 * Generate a unique ID for benchmark runs
 */
export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `bench-${timestamp}-${random}`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a progress bar string
 */
export function progressBar(current: number, total: number, width: number = 30): string {
  const percent = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + '] ' + percent.toFixed(1) + '%';
}
