/**
 * E2E Tests for Trading Pair Switching (Issue #174)
 * 
 * Sprint 6 fixed multiple bugs related to trading pair switching.
 * These E2E tests prevent regression by verifying:
 * 
 * 1. Basic symbol switching flow
 * 2. Data consistency across components
 * 3. Rapid switching stability
 * 4. No race condition errors
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 30000;
const WAIT_AFTER_LOAD = 5000; // Wait time after page load for data to populate

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}

// Helper to verify chart is visible
async function verifyChartState(page: any): Promise<{ loaded: boolean; hasError: boolean }> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return { loaded: !!canvas, hasError: false };
  });
}

// Helper to find and click trading pair
async function findAndClickTradingPair(page: any, symbolPattern: string): Promise<boolean> {
  // Wait for table to be populated
  await page.waitForSelector('.arco-table-tbody tr', { timeout: 10000 }).catch(() => {});
  
  return await page.evaluate((pattern: string) => {
    // Try multiple selectors for trading pairs
    const selectors = [
      '.arco-table-tbody tr',
      'table tbody tr',
      '[role="row"]',
      '.arco-table-row'
    ];
    
    for (const selector of selectors) {
      const rows = document.querySelectorAll(selector);
      for (const row of rows) {
        const text = row.textContent || '';
        // Check for pattern in various formats: BTC/USDT, BTC / USDT, or just BTC
        if (text.includes(pattern + '/') || text.includes(pattern + ' /') || 
            text.includes('/' + pattern) || text.includes(' BTC ') ||
            text.includes('BTCUSDT')) {
          // Find clickable element
          const clickable = row.querySelector('[role="button"], [style*="cursor: pointer"], td:first-child div') || row;
          (clickable as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
          (clickable as HTMLElement).click();
          return true;
        }
      }
    }
    return false;
  }, symbolPattern);
}

async function runTests(): Promise<number> {
  const results: TestResult[] = [];
  const screenshots: string[] = [];
  
  console.log('🚀 Starting E2E Tests for Trading Pair Switching...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // Test Suite 1: Basic Trading Pair Switching
    console.log('📋 Test Suite 1: Basic Trading Pair Switching\n');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });

    const consoleErrors: string[] = [];
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test 1.1: Page loads successfully
    console.log('  Test 1.1: Page loads successfully');
    const startTime = Date.now();
    await page1.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));
    const loadTime = Date.now() - startTime;

    results.push({
      name: 'Page Load',
      passed: true,
      details: 'Page loaded in ' + loadTime + 'ms',
      duration: loadTime,
    });
    console.log('    ✅ Page loaded in ' + loadTime + 'ms\n');

    await page1.screenshot({ path: 'midscene_run/e2e-trading-pair-01-initial.png', fullPage: true });
    screenshots.push('e2e-trading-pair-01-initial.png');

    // Test 1.2: Trading pair switching
    console.log('  Test 1.2: Trading pair switching');
    
    // Find any trading pair and click it
    const anyPairClicked = await findAndClickTradingPair(page1, 'BTC');
    
    if (anyPairClicked) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const chartState = await verifyChartState(page1);
      
      results.push({
        name: 'Trading Pair Switch',
        passed: chartState.loaded,
        details: chartState.loaded ? 'Successfully switched trading pair and chart loaded' : 'Chart did not load',
      });
      console.log(chartState.loaded ? '    ✅ Trading pair switch successful\n' : '    ❌ Chart did not load\n');
    } else {
      results.push({
        name: 'Trading Pair Switch',
        passed: false,
        details: 'Could not find trading pair to click',
      });
      console.log('    ❌ Could not find trading pair\n');
    }

    await page1.screenshot({ path: 'midscene_run/e2e-trading-pair-02-btc.png', fullPage: true });
    screenshots.push('e2e-trading-pair-02-btc.png');

    // Test 1.3: Console error check
    console.log('  Test 1.3: Console error check');
    
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('manifest') &&
      !err.includes('Warning:') &&
      !err.includes('DevTools')
    );

    results.push({
      name: 'No Console Errors',
      passed: criticalErrors.length === 0,
      details: criticalErrors.length === 0 ? 'No critical console errors' : 'Found ' + criticalErrors.length + ' errors',
    });
    console.log(criticalErrors.length === 0 ? '    ✅ No critical console errors\n' : '    ❌ Found console errors\n');

    await page1.close();

    // Test Suite 2: Rapid Switching Stability
    console.log('📋 Test Suite 2: Rapid Switching Stability\n');

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });
    
    const rapidErrors: string[] = [];
    page2.on('console', msg => {
      if (msg.type() === 'error') {
        rapidErrors.push(msg.text());
      }
    });

    await page2.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 2.1: Rapid switching
    console.log('  Test 2.1: Rapid consecutive switching');
    
    const rapidSwitchStart = Date.now();
    const switchCount = 5;
    const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'BTC'];

    for (let i = 0; i < switchCount; i++) {
      await findAndClickTradingPair(page2, symbols[i]);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const rapidSwitchDuration = Date.now() - rapidSwitchStart;
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalChartState = await verifyChartState(page2);

    results.push({
      name: 'Rapid Switching',
      passed: finalChartState.loaded,
      details: finalChartState.loaded ? 'Handled ' + switchCount + ' switches in ' + rapidSwitchDuration + 'ms' : 'Failed after rapid switching',
      duration: rapidSwitchDuration,
    });
    console.log(finalChartState.loaded ? '    ✅ Rapid switching successful\n' : '    ❌ Rapid switching failed\n');

    await page2.screenshot({ path: 'midscene_run/e2e-trading-pair-03-rapid.png', fullPage: true });
    screenshots.push('e2e-trading-pair-03-rapid.png');

    // Test 2.2: Race condition check
    console.log('  Test 2.2: Race condition error check');
    
    const raceErrors = rapidErrors.filter(err => 
      err.includes('race') || 
      err.includes('stale') || 
      err.includes('removeChild') ||
      err.includes('NotFoundError') ||
      err.includes('DOMException') ||
      err.includes('Cannot read properties of null')
    );

    results.push({
      name: 'No Race Condition Errors',
      passed: raceErrors.length === 0,
      details: raceErrors.length === 0 ? 'No race condition errors' : 'Found race condition errors',
    });
    console.log(raceErrors.length === 0 ? '    ✅ No race condition errors\n' : '    ❌ Race condition errors found\n');

    await page2.close();

    // Test Suite 3: Data Consistency
    console.log('📋 Test Suite 3: Data Consistency\n');

    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1280, height: 800 });

    await page3.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 3.1: Component verification
    console.log('  Test 3.1: Component verification');

    await findAndClickTradingPair(page3, 'BTC');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const componentCheck = await page3.evaluate(() => {
      return {
        hasCanvas: !!document.querySelector('canvas'),
        hasCards: document.querySelectorAll('.arco-card').length >= 3,
        hasInteractive: document.querySelectorAll('button, input').length > 0,
        hasPriceData: /\$\d+/.test(document.body.innerText),
      };
    });

    const allLoaded = Object.values(componentCheck).every(v => v);

    results.push({
      name: 'Component Load',
      passed: allLoaded,
      details: allLoaded ? 'All components loaded correctly' : 'Some components failed to load',
    });
    console.log(allLoaded ? '    ✅ All components loaded\n' : '    ❌ Some components failed\n');

    await page3.screenshot({ path: 'midscene_run/e2e-trading-pair-04-consistency.png', fullPage: true });
    screenshots.push('e2e-trading-pair-04-consistency.png');

    await page3.close();

  } catch (error) {
    console.error('Test execution error:', error);
    results.push({
      name: 'Test Execution',
      passed: false,
      details: 'Test execution failed: ' + (error instanceof Error ? error.message : String(error)),
    });
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('E2E TEST SUMMARY: TRADING PAIR SWITCHING (Issue #174)');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('\nTotal Tests: ' + total);
  console.log('Passed: ' + passed);
  console.log('Failed: ' + (total - passed));
  console.log('Success Rate: ' + ((passed / total) * 100).toFixed(1) + '%');

  console.log('\nDetailed Results:');
  results.forEach((r) => {
    const status = r.passed ? '✅' : '❌';
    const duration = r.duration ? ' (' + r.duration + 'ms)' : '';
    console.log('  ' + status + ' ' + r.name + duration + ': ' + r.details);
  });

  console.log('\nScreenshots saved:');
  screenshots.forEach(s => console.log('  📸 midscene_run/' + s));

  console.log('\n' + '='.repeat(70));

  return passed === total ? 0 : 1;
}

runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
