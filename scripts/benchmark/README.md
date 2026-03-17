# Performance Benchmark Scripts

This directory contains automated performance benchmark scripts for tracking system performance changes.

## Overview

The benchmark suite measures:

1. **Backtest Engine Performance**
   - Ticks processed per second
   - Memory usage during backtests
   - Strategy calculation times

2. **API Response Times**
   - Endpoint latency (median, P95, P99)
   - Request throughput
   - Concurrent request handling

3. **Real-time Data Processing**
   - WebSocket message latency
   - Order book update latency
   - Strategy signal generation latency

## Quick Start

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark suites
npm run benchmark:backtest
npm run benchmark:api
npm run benchmark:realtime

# Run with custom parameters
npm run benchmark -- --data-points 100000 --iterations 200

# Update baselines after performance improvements
npm run benchmark:update
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--all` | Run all benchmarks | false |
| `--backtest` | Run backtest benchmarks only | false |
| `--api` | Run API benchmarks only | false |
| `--realtime` | Run realtime benchmarks only | false |
| `--update-baselines` | Update baseline files after run | false |
| `--data-points <n>` | Number of data points for backtest | 100000 |
| `--iterations <n>` | Number of iterations for API tests | 100 |
| `--duration <ms>` | Duration for realtime tests | 5000 |
| `--base-url <url>` | Base URL for API tests | http://localhost:3000 |
| `-o, --output <file>` | Output file for markdown report | - |

## Output Example

```
=== Backtest Benchmark ===
Strategy: RSI | Ticks/sec: 97,234 | Memory: 45MB | Time: 1.2s
Strategy: MACD | Ticks/sec: 89,123 | Memory: 52MB | Time: 1.5s
Strategy: Stochastic | Ticks/sec: 85,456 | Memory: 48MB | Time: 1.6s

=== Comparison with Baseline ===
RSI: +2.3% (baseline: 95,000)
MACD: -1.2% (baseline: 90,200)
```

## CI Integration

Benchmarks run automatically on:
- Push to main branch
- Pull requests

Results are stored and tracked over time using the GitHub benchmark action.

### Regression Detection

The benchmark suite detects regressions when:
- Backtest performance drops >10% from baseline
- API latency increases >50% from baseline
- Real-time throughput drops >20% from baseline

## Files

```
scripts/benchmark/
├── backtest-benchmark.ts    # Backtest performance testing
├── api-benchmark.ts         # API endpoint benchmarking
├── realtime-benchmark.ts    # Real-time data processing benchmarks
├── reporter.ts              # Report generation and regression detection
├── utils.ts                 # Shared utility functions
├── run.ts                   # Main CLI entry point
├── index.ts                 # Module exports
└── README.md                # This file
```

## Baselines

Baselines are stored in `.benchmark-baselines.json`. To update baselines after intentional performance improvements:

```bash
npm run benchmark -- --update-baselines
```

## Adding New Benchmarks

1. Create a new benchmark file (e.g., `my-benchmark.ts`)
2. Export a `run*` function that returns results
3. Add to `run.ts` main runner
4. Update baselines in `reporter.ts`

## Best Practices

1. **Warmup**: Always include warmup runs to JIT-optimize code
2. **Multiple iterations**: Run 3+ iterations and use median
3. **Memory tracking**: Force GC before measurements
4. **Environment**: Run on consistent hardware for comparison
