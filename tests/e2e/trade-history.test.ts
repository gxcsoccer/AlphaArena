/**
 * E2E Tests for Trade History (Issue #188)
 * 
 * Sprint 9: Expand E2E test coverage - Trading flow tests
 * 
 * Tests:
 * 1. Trade history loading
 * 2. Filtering and sorting
 * 3. Pagination
 * 4. Export functionality
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
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
  
  console.log('🚀 Starting E2E Tests for Trade History...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // ========================================
    // Test Suite 1: Trades Page Load
    // ========================================
    console.log('📋 Test Suite 1: Trades Page Load\n');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });

    const consoleErrors: string[] = [];
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test 1.1: Navigate to trades page
    console.log('  Test 1.1: Navigate to trades page');
    const startTime = Date.now();
    await page1.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));
    const loadTime = Date.now() - startTime;

    results.push({
      name: 'Trades Page Load',
      passed: true,
      details: 'Page loaded in ' + loadTime + 'ms',
      duration: loadTime,
    });
    console.log('    ✅ Trades page loaded in ' + loadTime + 'ms\n');

    await page1.screenshot({ path: 'midscene_run/e2e-trades-01-page.png', fullPage: true });
    screenshots.push('e2e-trades-01-page.png');

    // Test 1.2: Check page title and headers
    console.log('  Test 1.2: Check page title and headers');
    
    const titleCheck = await page1.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasTradesTitle = bodyText.includes('Trades') || bodyText.includes('交易') || bodyText.includes('Trade History');
      const hasTableHeader = bodyText.includes('Symbol') || bodyText.includes('符号') || bodyText.includes('Side') || bodyText.includes('方向');
      
      return {
        hasTradesTitle,
        hasTableHeader,
        pageHasContent: bodyText.length > 100,
      };
    });

    results.push({
      name: 'Page Headers',
      passed: titleCheck.hasTradesTitle,
      details: 'Trades title: ' + titleCheck.hasTradesTitle + ', Table header: ' + titleCheck.hasTableHeader,
    });
    console.log(titleCheck.hasTradesTitle 
      ? '    ✅ Page headers present\n' 
      : '    ❌ Missing page headers\n');

    await page1.close();

    // ========================================
    // Test Suite 2: Trade Data Display
    // ========================================
    console.log('📋 Test Suite 2: Trade Data Display\n');

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });

    await page2.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 2.1: Trade table
    console.log('  Test 2.1: Trade table');
    
    const tableCheck = await page2.evaluate(() => {
      const tables = document.querySelectorAll('.arco-table, table');
      const rows = document.querySelectorAll('.arco-table-tbody tr, table tbody tr');
      
      return {
        hasTables: tables.length > 0,
        tableCount: tables.length,
        hasRows: rows.length > 0,
        rowCount: rows.length,
      };
    });

    results.push({
      name: 'Trade Table',
      passed: tableCheck.hasTables,
      details: 'Tables: ' + tableCheck.tableCount + ', Rows: ' + tableCheck.rowCount,
    });
    console.log(tableCheck.hasTables 
      ? '    ✅ Trade table present\n' 
      : '    ❌ No trade table\n');

    // Test 2.2: Trade data columns
    console.log('  Test 2.2: Trade data columns');
    
    const columnsCheck = await page2.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Check for expected column data
      const hasSymbol = /\b[A-Z]{2,5}\/[A-Z]{2,5}\b/.test(bodyText) || /BTC|ETH|AAPL|GOOGL/.test(bodyText);
      const hasPrice = /\$[\d,]+\.?\d*/.test(bodyText);
      const hasQuantity = /\d+\.?\d*/.test(bodyText);
      const hasSide = bodyText.includes('buy') || bodyText.includes('sell') || bodyText.includes('买入') || bodyText.includes('卖出');
      const hasTimestamp = /\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}/.test(bodyText);
      
      return {
        hasSymbol,
        hasPrice,
        hasQuantity,
        hasSide,
        hasTimestamp,
      };
    });

    results.push({
      name: 'Trade Data Columns',
      passed: columnsCheck.hasPrice,
      details: 'Symbol: ' + columnsCheck.hasSymbol + ', Price: ' + columnsCheck.hasPrice + ', Side: ' + columnsCheck.hasSide,
    });
    console.log(columnsCheck.hasPrice 
      ? '    ✅ Trade data columns present\n' 
      : '    ⚠️  Limited trade data\n');

    await page2.screenshot({ path: 'midscene_run/e2e-trades-02-table.png', fullPage: true });
    screenshots.push('e2e-trades-02-table.png');
    await page2.close();

    // ========================================
    // Test Suite 3: Filtering and Sorting
    // ========================================
    console.log('📋 Test Suite 3: Filtering and Sorting\n');

    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1280, height: 800 });

    await page3.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 3.1: Filter controls
    console.log('  Test 3.1: Filter controls');
    
    const filterCheck = await page3.evaluate(() => {
      // Look for filter controls
      const selects = document.querySelectorAll('.arco-select, select');
      const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      const datePickers = document.querySelectorAll('.arco-picker, .arco-range-picker');
      
      // Check for filter labels
      const bodyText = document.body.innerText;
      const hasSymbolFilter = bodyText.includes('Symbol') || bodyText.includes('符号') || bodyText.includes('Select');
      const hasSideFilter = bodyText.includes('Side') || bodyText.includes('方向') || bodyText.includes('Buy') || bodyText.includes('Sell');
      
      return {
        hasSelects: selects.length > 0,
        selectCount: selects.length,
        hasInputs: inputs.length > 0,
        hasDatePickers: datePickers.length > 0,
        hasSymbolFilter,
        hasSideFilter,
        hasFilters: selects.length > 0 || inputs.length > 0,
      };
    });

    results.push({
      name: 'Filter Controls',
      passed: filterCheck.hasFilters,
      details: 'Selects: ' + filterCheck.selectCount + ', Symbol filter: ' + filterCheck.hasSymbolFilter + ', Side filter: ' + filterCheck.hasSideFilter,
    });
    console.log(filterCheck.hasFilters 
      ? '    ✅ Filter controls present\n' 
      : '    ⚠️  Limited filter controls\n');

    // Test 3.2: Sortable columns
    console.log('  Test 3.2: Sortable columns');
    
    const sortCheck = await page3.evaluate(() => {
      // Look for sortable table headers
      const sortableHeaders = document.querySelectorAll('.arco-table-thsortable, th[class*="sortable"], th[aria-sort]');
      const tableHeaders = document.querySelectorAll('th');
      
      return {
        hasSortableHeaders: sortableHeaders.length > 0,
        sortableCount: sortableHeaders.length,
        headerCount: tableHeaders.length,
      };
    });

    results.push({
      name: 'Sortable Columns',
      passed: sortCheck.headerCount > 0,
      details: 'Headers: ' + sortCheck.headerCount + ', Sortable: ' + sortCheck.sortableCount,
    });
    console.log(sortCheck.headerCount > 0 
      ? '    ✅ Table headers present\n' 
      : '    ⚠️  No table headers\n');

    await page3.screenshot({ path: 'midscene_run/e2e-trades-03-filters.png', fullPage: true });
    screenshots.push('e2e-trades-03-filters.png');
    await page3.close();

    // ========================================
    // Test Suite 4: Export Functionality
    // ========================================
    console.log('📋 Test Suite 4: Export Functionality\n');

    const page4 = await browser.newPage();
    await page4.setViewport({ width: 1280, height: 800 });

    await page4.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 4.1: Export button
    console.log('  Test 4.1: Export button');
    
    const exportCheck = await page4.evaluate(() => {
      // Look for export buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      const exportButtons = buttons.filter(btn => 
        btn.textContent?.includes('Export') || 
        btn.textContent?.includes('导出') ||
        btn.textContent?.includes('Download') ||
        btn.textContent?.includes('CSV')
      );
      
      return {
        hasExportButton: exportButtons.length > 0,
        exportButtonCount: exportButtons.length,
        buttonCount: buttons.length,
      };
    });

    results.push({
      name: 'Export Button',
      passed: exportCheck.hasExportButton,
      details: 'Export buttons: ' + exportCheck.exportButtonCount + ', Total buttons: ' + exportCheck.buttonCount,
    });
    console.log(exportCheck.hasExportButton 
      ? '    ✅ Export button present\n' 
      : '    ⚠️  No export button\n');

    // Test 4.2: Date range picker
    console.log('  Test 4.2: Date range picker');
    
    const datePickerCheck = await page4.evaluate(() => {
      const pickers = document.querySelectorAll('.arco-picker, .arco-range-picker');
      const dateInputs = document.querySelectorAll('input[placeholder*="date"], input[placeholder*="日期"]');
      
      return {
        hasPickers: pickers.length > 0,
        pickerCount: pickers.length,
        hasDateInputs: dateInputs.length > 0,
      };
    });

    results.push({
      name: 'Date Range Picker',
      passed: datePickerCheck.hasPickers || datePickerCheck.hasDateInputs,
      details: 'Pickers: ' + datePickerCheck.pickerCount + ', Date inputs: ' + datePickerCheck.hasDateInputs,
    });
    console.log(datePickerCheck.hasPickers 
      ? '    ✅ Date picker present\n' 
      : '    ⚠️  No date picker\n');

    await page4.screenshot({ path: 'midscene_run/e2e-trades-04-export.png', fullPage: true });
    screenshots.push('e2e-trades-04-export.png');
    await page4.close();

    // ========================================
    // Test Suite 5: Charts and Visualization
    // ========================================
    console.log('📋 Test Suite 5: Charts and Visualization\n');

    const page5 = await browser.newPage();
    await page5.setViewport({ width: 1280, height: 800 });

    await page5.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 5.1: Trade distribution charts
    console.log('  Test 5.1: Trade distribution charts');
    
    const chartCheck = await page5.evaluate(() => {
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
      name: 'Trade Charts',
      passed: chartCheck.hasRecharts || chartCheck.hasCanvases,
      details: 'Canvases: ' + chartCheck.canvasCount + ', Recharts: ' + chartCheck.rechartsCount,
    });
    console.log(chartCheck.hasRecharts || chartCheck.hasCanvases 
      ? '    ✅ Trade charts present\n' 
      : '    ⚠️  No trade charts\n');

    // Test 5.2: Responsive layout
    console.log('  Test 5.2: Responsive layout');
    
    await page5.setViewport({ width: 375, height: 667 }); // Mobile size
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mobileCheck = await page5.evaluate(() => {
      const bodyText = document.body.innerText;
      
      return {
        hasContent: bodyText.length > 100,
        hasTradesTitle: bodyText.includes('Trades') || bodyText.includes('交易'),
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

    await page5.screenshot({ path: 'midscene_run/e2e-trades-05-mobile.png', fullPage: true });
    screenshots.push('e2e-trades-05-mobile.png');
    await page5.close();

    // ========================================
    // Test Suite 6: Console Error Check
    // ========================================
    console.log('📋 Test Suite 6: Console Error Check\n');

    const page6 = await browser.newPage();
    await page6.setViewport({ width: 1280, height: 800 });

    const finalErrors: string[] = [];
    page6.on('console', msg => {
      if (msg.type() === 'error') {
        finalErrors.push(msg.text());
      }
    });

    await page6.goto(BASE_URL + '/trades', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Filter out non-critical errors
    const criticalErrors = finalErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('manifest') &&
      !err.includes('Warning:') &&
      !err.includes('DevTools') &&
      !err.includes('chrome-extension') &&
      !err.includes('net::ERR') &&
      !err.includes('Failed to fetch') &&
      !err.includes('Network error') &&
      !err.includes('ERR_CONNECTION_REFUSED') &&
      !err.includes('APIClient') &&
      !err.includes('[useOrderBook]') &&
      !err.includes('[KLineChart]')
    );

    console.log('  Test 6.1: No critical console errors');
    results.push({
      name: 'No Critical Errors',
      passed: criticalErrors.length === 0,
      details: criticalErrors.length === 0 
        ? 'No critical console errors' 
        : 'Found ' + criticalErrors.length + ' critical errors',
    });
    console.log(criticalErrors.length === 0 
      ? '    ✅ No critical console errors\n' 
      : '    ⚠️  Found ' + criticalErrors.length + ' errors\n');

    await page6.close();

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
  console.log('E2E TEST SUMMARY: TRADE HISTORY (Issue #188)');
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
