/**
 * E2E Tests for Holdings Display (Issue #188)
 * 
 * Sprint 9: Expand E2E test coverage - Trading flow tests
 * 
 * Tests:
 * 1. Holdings list loading
 * 2. Position data display
 * 3. P&L calculations
 * 4. Data updates
 */

import puppeteer from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:3000') + '?lang=en-US';
const TIMEOUT = 30000;
const WAIT_AFTER_LOAD = 5000;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}

async function runTests(): Promise<number> {
  const results: TestResult[] = [];
  const screenshots: string[] = [];
  
  console.log('🚀 Starting E2E Tests for Holdings Display...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // ========================================
    // Test Suite 1: Holdings Page Load
    // ========================================
    console.log('📋 Test Suite 1: Holdings Page Load\n');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });

    const consoleErrors: string[] = [];
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test 1.1: Navigate to holdings page
    console.log('  Test 1.1: Navigate to holdings page');
    const startTime = Date.now();
    await page1.goto(BASE_URL + '/holdings', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));
    const loadTime = Date.now() - startTime;

    results.push({
      name: 'Holdings Page Load',
      passed: true,
      details: 'Page loaded in ' + loadTime + 'ms',
      duration: loadTime,
    });
    console.log('    ✅ Holdings page loaded in ' + loadTime + 'ms\n');

    await page1.screenshot({ path: 'midscene_run/e2e-holdings-01-page.png', fullPage: true });
    screenshots.push('e2e-holdings-01-page.png');

    // Test 1.2: Check page title and headers
    console.log('  Test 1.2: Check page title and headers');
    
    const titleCheck = await page1.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasHoldingsTitle = bodyText.includes('Holdings') || bodyText.includes('持仓');
      const hasValueHeader = bodyText.includes('Value') || bodyText.includes('价值') || bodyText.includes('Total Value');
      const hasPositionHeader = bodyText.includes('Position') || bodyText.includes('持仓') || bodyText.includes('Current Positions');
      
      return {
        hasHoldingsTitle,
        hasValueHeader,
        hasPositionHeader,
        pageHasContent: bodyText.length > 100,
      };
    });

    results.push({
      name: 'Page Headers',
      passed: titleCheck.hasHoldingsTitle,
      details: 'Holdings title: ' + titleCheck.hasHoldingsTitle + ', Value header: ' + titleCheck.hasValueHeader,
    });
    console.log(titleCheck.hasHoldingsTitle 
      ? '    ✅ Page headers present\n' 
      : '    ❌ Missing page headers\n');

    await page1.close();

    // ========================================
    // Test Suite 2: Position Data Display
    // ========================================
    console.log('📋 Test Suite 2: Position Data Display\n');

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });

    await page2.goto(BASE_URL + '/holdings', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 2.1: Position table or list
    console.log('  Test 2.1: Position table or list');
    
    const tableCheck = await page2.evaluate(() => {
      const tables = document.querySelectorAll('.arco-table, table');
      const cards = document.querySelectorAll('.arco-card');
      const statistics = document.querySelectorAll('.arco-statistic');
      
      return {
        hasTables: tables.length > 0,
        tableCount: tables.length,
        hasCards: cards.length > 0,
        cardCount: cards.length,
        hasStatistics: statistics.length > 0,
        statisticCount: statistics.length,
      };
    });

    results.push({
      name: 'Position Display Elements',
      passed: tableCheck.hasTables || tableCheck.hasCards,
      details: 'Tables: ' + tableCheck.tableCount + ', Cards: ' + tableCheck.cardCount + ', Statistics: ' + tableCheck.statisticCount,
    });
    console.log(tableCheck.hasTables || tableCheck.hasCards 
      ? '    ✅ Position display elements present\n' 
      : '    ❌ No position display elements\n');

    // Test 2.2: Symbol and quantity display
    console.log('  Test 2.2: Symbol and quantity display');
    
    const dataCheck = await page2.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Check for symbol patterns (e.g., BTC, ETH, AAPL)
      const symbolPattern = /\b[A-Z]{2,5}\b/g;
      const symbols = bodyText.match(symbolPattern) || [];
      
      // Check for quantity patterns (numbers)
      const quantityPattern = /\d+\.?\d*/g;
      const quantities = bodyText.match(quantityPattern) || [];
      
      // Check for currency values
      const currencyPattern = /\$[\d,]+\.?\d*/g;
      const currencies = bodyText.match(currencyPattern) || [];
      
      return {
        hasSymbols: symbols.length > 0,
        symbolCount: symbols.length,
        hasQuantities: quantities.length > 0,
        quantityCount: quantities.length,
        hasCurrencyValues: currencies.length > 0,
        currencyCount: currencies.length,
      };
    });

    results.push({
      name: 'Position Data Present',
      passed: dataCheck.hasCurrencyValues,
      details: 'Symbols: ' + dataCheck.symbolCount + ', Quantities: ' + dataCheck.quantityCount + ', Currency: ' + dataCheck.currencyCount,
    });
    console.log(dataCheck.hasCurrencyValues 
      ? '    ✅ Position data displayed\n' 
      : '    ⚠️  Limited position data\n');

    await page2.screenshot({ path: 'midscene_run/e2e-holdings-02-data.png', fullPage: true });
    screenshots.push('e2e-holdings-02-data.png');
    await page2.close();

    // ========================================
    // Test Suite 3: P&L Display
    // ========================================
    console.log('📋 Test Suite 3: P&L Display\n');

    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1280, height: 800 });

    await page3.goto(BASE_URL + '/holdings', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 3.1: P&L indicators
    console.log('  Test 3.1: P&L indicators');
    
    const pnlCheck = await page3.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Check for P&L related text
      const hasPnLText = bodyText.includes('P&L') || bodyText.includes('PnL') || 
                         bodyText.includes('盈亏') || bodyText.includes('收益');
      const hasROI = bodyText.includes('ROI') || bodyText.includes('收益率') || bodyText.includes('Return');
      
      // Check for color indicators (profit/loss)
      const greenElements = document.querySelectorAll('[style*="rgb(0, 180"], [style*="#00b42a"], [class*="green"], [class*="success"]');
      const redElements = document.querySelectorAll('[style*="rgb(245, 63"], [style*="#f53f3f"], [class*="red"], [class*="danger"]');
      
      // Check for percentage displays
      const percentPattern = /-?\d+\.?\d*%/g;
      const percentages = bodyText.match(percentPattern) || [];
      
      return {
        hasPnLText,
        hasROI,
        hasColorIndicators: greenElements.length > 0 || redElements.length > 0,
        greenCount: greenElements.length,
        redCount: redElements.length,
        hasPercentages: percentages.length > 0,
        percentageCount: percentages.length,
      };
    });

    results.push({
      name: 'P&L Indicators',
      passed: pnlCheck.hasPnLText || pnlCheck.hasROI || pnlCheck.hasColorIndicators,
      details: 'P&L text: ' + pnlCheck.hasPnLText + ', ROI: ' + pnlCheck.hasROI + ', Colors: ' + pnlCheck.hasColorIndicators,
    });
    console.log(pnlCheck.hasPnLText || pnlCheck.hasROI 
      ? '    ✅ P&L indicators present\n' 
      : '    ⚠️  Limited P&L indicators\n');

    // Test 3.2: Total value calculation
    console.log('  Test 3.2: Total value calculation');
    
    const totalCheck = await page3.evaluate(() => {
      const statistics = document.querySelectorAll('.arco-statistic');
      
      // Look for total value display
      let hasTotalValue = false;
      let totalValueText = '';
      
      statistics.forEach(stat => {
        const label = stat.querySelector('.arco-statistic-title, .arco-statistic-label');
        if (label?.textContent?.includes('Total') || label?.textContent?.includes('总')) {
          hasTotalValue = true;
          totalValueText = stat.textContent || '';
        }
      });
      
      return {
        hasStatistics: statistics.length > 0,
        statisticCount: statistics.length,
        hasTotalValue,
        totalValueText,
      };
    });

    results.push({
      name: 'Total Value Display',
      passed: totalCheck.hasStatistics,
      details: 'Statistics: ' + totalCheck.statisticCount + ', Has total: ' + totalCheck.hasTotalValue,
    });
    console.log(totalCheck.hasStatistics 
      ? '    ✅ Total value display present\n' 
      : '    ⚠️  No total value display\n');

    await page3.screenshot({ path: 'midscene_run/e2e-holdings-03-pnl.png', fullPage: true });
    screenshots.push('e2e-holdings-03-pnl.png');
    await page3.close();

    // ========================================
    // Test Suite 4: Data Updates
    // ========================================
    console.log('📋 Test Suite 4: Data Updates\n');

    const page4 = await browser.newPage();
    await page4.setViewport({ width: 1280, height: 800 });

    await page4.goto(BASE_URL + '/holdings', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 4.1: Strategy selector
    console.log('  Test 4.1: Strategy selector');
    
    const strategyCheck = await page4.evaluate(() => {
      // Look for strategy selector
      const selects = document.querySelectorAll('.arco-select, select');
      const radioGroups = document.querySelectorAll('.arco-radio-group');
      
      // Check for strategy-related labels
      const strategyLabels = Array.from(document.querySelectorAll('label, .arco-typography')).filter(
        el => el.textContent?.includes('策略') || el.textContent?.includes('Strategy')
      );
      
      return {
        hasSelectors: selects.length > 0 || radioGroups.length > 0,
        selectorCount: selects.length + radioGroups.length,
        hasStrategyLabels: strategyLabels.length > 0,
      };
    });

    results.push({
      name: 'Strategy Selector',
      passed: strategyCheck.hasSelectors || strategyCheck.hasStrategyLabels,
      details: 'Selectors: ' + strategyCheck.selectorCount + ', Strategy labels: ' + strategyCheck.hasStrategyLabels,
    });
    console.log(strategyCheck.hasSelectors 
      ? '    ✅ Strategy selector present\n' 
      : '    ⚠️  No strategy selector\n');

    // Test 4.2: Time range selector
    console.log('  Test 4.2: Time range selector');
    
    const timeRangeCheck = await page4.evaluate(() => {
      // Look for time range controls
      const radioGroups = document.querySelectorAll('.arco-radio-group');
      const datePickers = document.querySelectorAll('.arco-picker, .arco-range-picker');
      
      // Check for time range labels
      const timeLabels = Array.from(document.querySelectorAll('label, .arco-typography')).filter(
        el => el.textContent?.includes('1d') || el.textContent?.includes('1w') || 
              el.textContent?.includes('1m') || el.textContent?.includes('时间') ||
              el.textContent?.includes('all')
      );
      
      return {
        hasRadioGroups: radioGroups.length > 0,
        hasDatePickers: datePickers.length > 0,
        hasTimeLabels: timeLabels.length > 0,
      };
    });

    results.push({
      name: 'Time Range Selector',
      passed: timeRangeCheck.hasRadioGroups || timeRangeCheck.hasDatePickers || timeRangeCheck.hasTimeLabels,
      details: 'Radio groups: ' + timeRangeCheck.hasRadioGroups + ', Date pickers: ' + timeRangeCheck.hasDatePickers,
    });
    console.log(timeRangeCheck.hasRadioGroups || timeRangeCheck.hasTimeLabels 
      ? '    ✅ Time range selector present\n' 
      : '    ⚠️  No time range selector\n');

    await page4.screenshot({ path: 'midscene_run/e2e-holdings-04-controls.png', fullPage: true });
    screenshots.push('e2e-holdings-04-controls.png');
    await page4.close();

    // ========================================
    // Test Suite 5: Charts and Visualization
    // ========================================
    console.log('📋 Test Suite 5: Charts and Visualization\n');

    const page5 = await browser.newPage();
    await page5.setViewport({ width: 1280, height: 800 });

    await page5.goto(BASE_URL + '/holdings', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 5.1: Chart elements
    console.log('  Test 5.1: Chart elements');
    
    const chartCheck = await page5.evaluate(() => {
      // Look for chart containers
      const canvases = document.querySelectorAll('canvas');
      const rechartsContainers = document.querySelectorAll('.recharts-wrapper, [class*="recharts"]');
      const charts = document.querySelectorAll('[class*="chart"], [class*="Chart"]');
      
      return {
        hasCanvases: canvases.length > 0,
        canvasCount: canvases.length,
        hasRecharts: rechartsContainers.length > 0,
        rechartsCount: rechartsContainers.length,
        hasCharts: charts.length > 0,
      };
    });

    results.push({
      name: 'Chart Elements',
      passed: chartCheck.hasCanvases || chartCheck.hasRecharts,
      details: 'Canvases: ' + chartCheck.canvasCount + ', Recharts: ' + chartCheck.rechartsCount,
    });
    console.log(chartCheck.hasCanvases || chartCheck.hasRecharts 
      ? '    ✅ Charts present\n' 
      : '    ⚠️  No charts found\n');

    // Test 5.2: Responsive layout
    console.log('  Test 5.2: Responsive layout');
    
    await page5.setViewport({ width: 375, height: 667 }); // Mobile size
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mobileCheck = await page5.evaluate(() => {
      const bodyText = document.body.innerText;
      
      return {
        hasContent: bodyText.length > 100,
        hasHoldingsTitle: bodyText.includes('Holdings') || bodyText.includes('持仓'),
      };
    });

    results.push({
      name: 'Responsive Layout',
      passed: mobileCheck.hasContent,
      details: 'Mobile view has content: ' + mobileCheck.hasContent,
    });
    console.log(mobileCheck.hasContent 
      ? '    ✅ Mobile layout works\n' 
      : '    ⚠️  Mobile layout issues\n');

    await page5.screenshot({ path: 'midscene_run/e2e-holdings-05-mobile.png', fullPage: true });
    screenshots.push('e2e-holdings-05-mobile.png');
    await page5.close();

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

  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(70));
  console.log('E2E TEST SUMMARY: HOLDINGS DISPLAY (Issue #188)');
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
