/**
 * API Endpoint Benchmark
 * 
 * Measures API response times and throughput
 */

import {
  formatDuration,
  formatNumber,
  calculateStats,
} from './utils';

export interface APIEndpointConfig {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface APIBenchmarkResult {
  endpoint: string;
  method: string;
  iterations: number;
  successCount: number;
  errorCount: number;
  latency: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests per second
  totalDuration: number;
  averageResponseSize: number;
}

export interface APIBenchmarkConfig {
  baseUrl: string;
  endpoints: APIEndpointConfig[];
  iterations: number;
  concurrency: number;
  warmupIterations: number;
  timeout: number;
}

// Default API endpoints to benchmark
const DEFAULT_ENDPOINTS: APIEndpointConfig[] = [
  { name: 'Health Check', method: 'GET', path: '/api/health' },
  { name: 'Market Data', method: 'GET', path: '/api/market/BTC-USDT' },
  { name: 'Order Book', method: 'GET', path: '/api/orderbook/BTC-USDT' },
  { name: 'Order History', method: 'GET', path: '/api/orders' },
  { name: 'Portfolio', method: 'GET', path: '/api/portfolio' },
];

/**
 * Make a single HTTP request and measure response time
 */
async function measureRequest(
  baseUrl: string,
  config: APIEndpointConfig,
  timeout: number
): Promise<{ duration: number; status: number; size: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${baseUrl}${config.path}`, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });
    
    const duration = performance.now() - startTime;
    const text = await response.text();
    clearTimeout(timeoutId);
    
    return {
      duration,
      status: response.status,
      size: text.length,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      duration: performance.now() - startTime,
      status: 0,
      size: 0,
      error: error.message,
    };
  }
}

/**
 * Run benchmark for a single endpoint
 */
async function runEndpointBenchmark(
  baseUrl: string,
  endpoint: APIEndpointConfig,
  config: APIBenchmarkConfig
): Promise<APIBenchmarkResult> {
  console.log(`\n  📡 Benchmarking: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  
  // Warmup
  console.log(`     Warmup: ${config.warmupIterations} requests...`);
  for (let i = 0; i < config.warmupIterations; i++) {
    await measureRequest(baseUrl, endpoint, config.timeout);
  }
  
  // Actual benchmark
  console.log(`     Running ${config.iterations} iterations with concurrency ${config.concurrency}...`);
  const latencies: number[] = [];
  const sizes: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  const totalStartTime = performance.now();
  
  // Run with concurrency
  for (let i = 0; i < config.iterations; i += config.concurrency) {
    const batch = Math.min(config.concurrency, config.iterations - i);
    const promises: Promise<{ duration: number; status: number; size: number; error?: string }>[] = [];
    
    for (let j = 0; j < batch; j++) {
      promises.push(measureRequest(baseUrl, endpoint, config.timeout));
    }
    
    const results = await Promise.all(promises);
    
    for (const result of results) {
      latencies.push(result.duration);
      sizes.push(result.size);
      
      if (result.error || result.status >= 400) {
        errorCount++;
      } else {
        successCount++;
      }
    }
    
    // Show progress
    const progress = ((i + batch) / config.iterations) * 100;
    process.stdout.write(`\r     Progress: ${progress.toFixed(0)}%`);
  }
  
  const totalDuration = performance.now() - totalStartTime;
  console.log('\r     Progress: 100%');
  
  // Calculate statistics
  const stats = calculateStats(latencies);
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p99Index = Math.floor(sortedLatencies.length * 0.99);
  
  return {
    endpoint: endpoint.name,
    method: endpoint.method,
    iterations: config.iterations,
    successCount,
    errorCount,
    latency: {
      mean: stats.mean,
      median: stats.median,
      min: stats.min,
      max: stats.max,
      stdDev: stats.stdDev,
      p95: sortedLatencies[p95Index] || 0,
      p99: sortedLatencies[p99Index] || 0,
    },
    throughput: (config.iterations / totalDuration) * 1000,
    totalDuration,
    averageResponseSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
  };
}

/**
 * Run all API benchmarks
 */
export async function runAPIBenchmarks(
  config: Partial<APIBenchmarkConfig> = {}
): Promise<APIBenchmarkResult[]> {
  const fullConfig: APIBenchmarkConfig = {
    baseUrl: config.baseUrl || 'http://localhost:3000',
    endpoints: config.endpoints || DEFAULT_ENDPOINTS,
    iterations: config.iterations || 100,
    concurrency: config.concurrency || 10,
    warmupIterations: config.warmupIterations || 5,
    timeout: config.timeout || 30000,
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('  API ENDPOINT BENCHMARK');
  console.log('='.repeat(60));
  console.log(`\n  Base URL: ${fullConfig.baseUrl}`);
  console.log(`  Iterations: ${fullConfig.iterations}`);
  console.log(`  Concurrency: ${fullConfig.concurrency}`);
  console.log('');
  
  const results: APIBenchmarkResult[] = [];
  
  for (const endpoint of fullConfig.endpoints) {
    try {
      const result = await runEndpointBenchmark(fullConfig.baseUrl, endpoint, fullConfig);
      results.push(result);
    } catch (error: any) {
      console.error(`  ❌ Error benchmarking ${endpoint.name}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Print API benchmark results
 */
export function printAPIResults(results: APIBenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('  API BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log('');
  
  console.log(
    'Endpoint'.padEnd(25) +
    'Success'.padEnd(10) +
    'Median'.padEnd(12) +
    'P95'.padEnd(12) +
    'P99'.padEnd(12) +
    'Throughput'
  );
  console.log('-'.repeat(80));
  
  for (const result of results) {
    const endpoint = result.endpoint.padEnd(25);
    const success = `${result.successCount}/${result.iterations}`.padEnd(10);
    const median = formatDuration(result.latency.median).padEnd(12);
    const p95 = formatDuration(result.latency.p95).padEnd(12);
    const p99 = formatDuration(result.latency.p99).padEnd(12);
    const throughput = `${formatNumber(Math.round(result.throughput))} req/s`;
    
    console.log(endpoint + success + median + p95 + p99 + throughput);
  }
  
  console.log('');
  console.log('='.repeat(80));
}

/**
 * Generate CI report for API benchmarks
 */
export function generateAPIReport(results: APIBenchmarkResult[]): string {
  const lines: string[] = [
    '# API Benchmark Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Results',
    '',
    '| Endpoint | Success | Median | P95 | P99 | Throughput |',
    '|----------|---------|--------|-----|-----|------------|',
  ];
  
  for (const result of results) {
    const success = `${result.successCount}/${result.iterations}`;
    const median = formatDuration(result.latency.median);
    const p95 = formatDuration(result.latency.p95);
    const p99 = formatDuration(result.latency.p99);
    const throughput = `${formatNumber(Math.round(result.throughput))} req/s`;
    
    lines.push(`| ${result.endpoint} | ${success} | ${median} | ${p95} | ${p99} | ${throughput} |`);
  }
  
  return lines.join('\n');
}

// CLI entry point
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const iterations = parseInt(process.argv[3]) || 100;
  
  console.log(`\n🚀 Running API benchmarks against ${baseUrl}...\n`);
  
  runAPIBenchmarks({
    baseUrl,
    iterations,
    concurrency: 10,
    warmupIterations: 5,
    timeout: 30000,
  })
    .then(results => {
      printAPIResults(results);
      console.log('\n--- CI Report ---\n');
      console.log(generateAPIReport(results));
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
