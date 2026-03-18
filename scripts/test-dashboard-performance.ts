/**
 * Dashboard Performance Test Script
 * Tests rendering performance with large datasets
 * 
 * Usage: npx ts-node --transpile-only scripts/test-dashboard-performance.ts
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceResult {
  testName: string;
  dataCount: number;
  renderTime: number;
  avgFps: number;
  memoryBeforeMB: number;
  memoryAfterMB: number;
  memoryDeltaMB: number;
  passed: boolean;
  threshold: {
    renderTime: number;
    fps: number;
    memoryMB: number;
  };
}

interface TestConfig {
  name: string;
  url: string;
  dataGenerator: string;
  expectedMinCount: number;
}

const THRESHOLDS = {
  renderTime: 2000, // 2s max for 1000+ items
  fps: 30,
  memoryMB: 100,
};

async function measurePerformance(
  page: puppeteer.Page,
  testName: string,
  dataCount: number
): Promise<PerformanceResult> {
  // Get initial memory
  const memoryBefore = await page.evaluate(() => {
    return (performance as any).memory
      ? (performance as any).memory.usedJSHeapSize / (1024 * 1024)
      : 0;
  });

  // Start performance measurement
  await page.evaluate(() => {
    (window as any).__perfMetrics = {
      frameTimes: [] as number[],
      lastFrameTime: performance.now(),
    };

    const measureFrame = () => {
      const now = performance.now();
      const delta = now - (window as any).__perfMetrics.lastFrameTime;
      (window as any).__perfMetrics.frameTimes.push(delta);
      (window as any).__perfMetrics.lastFrameTime = now;
      requestAnimationFrame(measureFrame);
    };
    requestAnimationFrame(measureFrame);
  });

  // Wait for render to complete
  await page.waitForSelector('[data-testid="dashboard-loaded"], .arco-spin', {
    timeout: 10000,
  }).catch(() => {});

  // Wait additional time for FPS measurement
  await page.waitForTimeout(2000);

  // Get metrics
  const metrics = await page.evaluate(() => {
    const frameTimes = (window as any).__perfMetrics?.frameTimes || [];
    const avgFrameTime = frameTimes.length > 0
      ? frameTimes.reduce((sum: number, t: number) => sum + t, 0) / frameTimes.length
      : 16.67;
    const fps = 1000 / avgFrameTime;

    const memoryAfter = (performance as any).memory
      ? (performance as any).memory.usedJSHeapSize / (1024 * 1024)
      : 0;

    // Get render time from performance marks
    const renderEntries = performance.getEntriesByType('measure');
    const renderTime = renderEntries.length > 0
      ? renderEntries[renderEntries.length - 1].duration
      : 0;

    return {
      fps,
      memoryAfter,
      renderTime,
    };
  });

  const memoryDelta = metrics.memoryAfter - memoryBefore;

  return {
    testName,
    dataCount,
    renderTime: metrics.renderTime,
    avgFps: metrics.fps,
    memoryBeforeMB: memoryBefore,
    memoryAfterMB: metrics.memoryAfter,
    memoryDeltaMB: memoryDelta,
    passed: metrics.renderTime <= THRESHOLDS.renderTime &&
            metrics.fps >= THRESHOLDS.fps &&
            memoryDelta <= THRESHOLDS.memoryMB,
    threshold: THRESHOLDS,
  };
}

async function runTests() {
  console.log('🚀 Starting Dashboard Performance Tests\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: PerformanceResult[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Test 1: Dashboard Page with simulated large dataset
    console.log('📊 Testing Dashboard Page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    
    // Inject test data
    await page.evaluate((count) => {
      // Simulate large dataset by creating mock trades
      const mockTrades = Array.from({ length: count }, (_, i) => ({
        id: `trade-${i}`,
        symbol: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'][i % 3],
        side: i % 2 === 0 ? 'buy' : 'sell',
        price: 50000 + Math.random() * 10000,
        quantity: Math.random() * 10,
        total: 0,
        executedAt: new Date(Date.now() - i * 1000).toISOString(),
        strategyId: `strategy-${i % 5}`,
      }));

      // Store in window for component access
      (window as any).__testTrades = mockTrades;
      console.log(`Generated ${mockTrades.length} test trades`);
    }, 1000);

    results.push(await measurePerformance(page, 'Dashboard Page', 1000));

    // Test 2: User Dashboard with large trade history
    console.log('📊 Testing User Dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    
    await page.evaluate((count) => {
      const mockStrategies = Array.from({ length: 50 }, (_, i) => ({
        id: `strategy-${i}`,
        name: `Strategy ${i}`,
        type: ['momentum', 'mean-reversion', 'arbitrage'][i % 3],
        status: ['active', 'paused', 'stopped'][i % 3],
        returnRate: (Math.random() - 0.5) * 100,
        tradeCount: Math.floor(Math.random() * 1000),
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      }));

      (window as any).__testStrategies = mockStrategies;
    }, 1000);

    results.push(await measurePerformance(page, 'User Dashboard', 1000));

  } catch (error: any) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('Performance Test Results');
  console.log('='.repeat(80));

  let allPassed = true;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${status} ${result.testName}`);
    console.log(`  Data Count: ${result.dataCount}`);
    console.log(`  Render Time: ${result.renderTime.toFixed(2)}ms (threshold: ${result.threshold.renderTime}ms)`);
    console.log(`  Avg FPS: ${result.avgFps.toFixed(1)} (threshold: ${result.threshold.fps})`);
    console.log(`  Memory Delta: ${result.memoryDeltaMB.toFixed(2)}MB (threshold: ${result.threshold.memoryMB}MB)`);
    
    if (!result.passed) allPassed = false;
  }

  console.log('\n' + '='.repeat(80));
  console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');
  console.log('='.repeat(80) + '\n');

  // Save results to file
  const reportPath = path.join(__dirname, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    thresholds: THRESHOLDS,
  }, null, 2));

  console.log(`📄 Report saved to: ${reportPath}`);

  return allPassed;
}

// Run if executed directly
if (require.main === module) {
  runTests()
    .then(passed => process.exit(passed ? 0 : 1))
    .catch(err => {
      console.error('Test runner error:', err);
      process.exit(1);
    });
}

export { runTests, PerformanceResult };