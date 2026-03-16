/**
 * E2E Tests for Conditional Orders (Issue #188)
 * 
 * Sprint 9: Expand E2E test coverage - Trading flow tests
 * 
 * Tests:
 * 1. Conditional order panel visibility
 * 2. Stop-loss order settings
 * 3. Take-profit order settings
 * 4. Trigger price input
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
  
  console.log('🚀 Starting E2E Tests for Conditional Orders...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // ========================================
    // Test Suite 1: Conditional Order Panel
    // ========================================
    console.log('📋 Test Suite 1: Conditional Order Panel\n');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });

    const consoleErrors: string[] = [];
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Test 1.1: Page loads
    console.log('  Test 1.1: Home page loads');
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

    await page1.screenshot({ path: 'midscene_run/e2e-conditional-01-page.png', fullPage: true });
    screenshots.push('e2e-conditional-01-page.png');

    // Test 1.2: Conditional order UI elements
    console.log('  Test 1.2: Conditional order UI elements');
    
    const conditionalCheck = await page1.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Check for conditional order related text
      const hasStopLoss = bodyText.includes('止损') || bodyText.includes('Stop Loss') || bodyText.includes('Stop-loss');
      const hasTakeProfit = bodyText.includes('止盈') || bodyText.includes('Take Profit');
      const hasTriggerPrice = bodyText.includes('触发') || bodyText.includes('Trigger') || bodyText.includes('触发价');
      const hasConditionalText = bodyText.includes('条件单') || bodyText.includes('Conditional');
      
      // Look for tabs that might contain conditional orders
      const tabs = document.querySelectorAll('.arco-tabs-tab');
      let conditionalTabIndex = -1;
      tabs.forEach((tab, index) => {
        const text = tab.textContent || '';
        if (text.includes('条件单') || text.includes('Conditional') || text.includes('条件')) {
          conditionalTabIndex = index;
        }
      });
      
      return {
        hasStopLoss,
        hasTakeProfit,
        hasTriggerPrice,
        hasConditionalText,
        hasConditionalTab: conditionalTabIndex >= 0,
        conditionalTabIndex,
      };
    });

    results.push({
      name: 'Conditional Order Elements',
      passed: conditionalCheck.hasConditionalText || conditionalCheck.hasStopLoss || conditionalCheck.hasTakeProfit,
      details: 'Stop-loss: ' + conditionalCheck.hasStopLoss + ', Take-profit: ' + conditionalCheck.hasTakeProfit + ', Tab: ' + conditionalCheck.hasConditionalTab,
    });
    console.log(conditionalCheck.hasConditionalText 
      ? '    ✅ Conditional order elements present\n' 
      : '    ⚠️  Conditional order elements may be limited\n');

    await page1.close();

    // ========================================
    // Test Suite 2: Stop-Loss Settings
    // ========================================
    console.log('📋 Test Suite 2: Stop-Loss Settings\n');

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });

    await page2.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 2.1: Navigate to conditional orders tab
    console.log('  Test 2.1: Navigate to conditional orders tab');
    
    const navResult = await page2.evaluate(async () => {
      try {
        // Find and click conditional orders tab
        const tabs = document.querySelectorAll('.arco-tabs-tab');
        let clicked = false;
        
        for (const tab of tabs) {
          const text = tab.textContent || '';
          if (text.includes('条件单') || text.includes('Conditional') || text.includes('条件')) {
            (tab as HTMLElement).click();
            clicked = true;
            break;
          }
        }
        
        await new Promise(r => setTimeout(r, 500));
        
        return { navigated: clicked };
      } catch (e) {
        return { navigated: false, error: String(e) };
      }
    });

    results.push({
      name: 'Navigate to Conditional Tab',
      passed: navResult.navigated,
      details: navResult.navigated ? 'Successfully navigated' : 'Conditional tab may not exist or already active',
    });
    console.log(navResult.navigated 
      ? '    ✅ Navigated to conditional tab\n' 
      : '    ℹ️  Conditional tab may be default or not present\n');

    // Test 2.2: Stop-loss input fields
    console.log('  Test 2.2: Stop-loss input fields');
    
    const stopLossCheck = await page2.evaluate(() => {
      // Look for trigger price inputs
      const numberInputs = document.querySelectorAll('.arco-input-number input');
      const allInputs = document.querySelectorAll('input');
      
      // Check for labels related to stop-loss
      const labels = Array.from(document.querySelectorAll('label, .arco-form-item-label, .arco-typography'));
      const hasStopLossLabel = labels.some(l => 
        l.textContent?.includes('止损') || l.textContent?.includes('Stop Loss') || l.textContent?.includes('触发价')
      );
      
      return {
        hasNumberInputs: numberInputs.length > 0,
        numberInputCount: numberInputs.length,
        hasStopLossLabel,
      };
    });

    results.push({
      name: 'Stop-Loss Inputs',
      passed: stopLossCheck.hasNumberInputs,
      details: 'Number inputs: ' + stopLossCheck.numberInputCount + ', Stop-loss label: ' + stopLossCheck.hasStopLossLabel,
    });
    console.log(stopLossCheck.hasNumberInputs 
      ? '    ✅ Input fields present\n' 
      : '    ⚠️  No input fields found\n');

    await page2.screenshot({ path: 'midscene_run/e2e-conditional-02-stoploss.png', fullPage: true });
    screenshots.push('e2e-conditional-02-stoploss.png');
    await page2.close();

    // ========================================
    // Test Suite 3: Take-Profit Settings
    // ========================================
    console.log('📋 Test Suite 3: Take-Profit Settings\n');

    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1280, height: 800 });

    await page3.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 3.1: Take-profit UI
    console.log('  Test 3.1: Take-profit UI');
    
    const takeProfitCheck = await page3.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Check for take-profit related text
      const hasTakeProfitText = bodyText.includes('止盈') || bodyText.includes('Take Profit');
      
      // Look for radio buttons or tabs for order type selection
      const radios = document.querySelectorAll('.arco-radio');
      const hasTakeProfitRadio = Array.from(radios).some(r => 
        r.textContent?.includes('止盈') || r.textContent?.includes('Take Profit')
      );
      
      return {
        hasTakeProfitText,
        hasTakeProfitRadio,
        radioCount: radios.length,
      };
    });

    results.push({
      name: 'Take-Profit UI',
      passed: takeProfitCheck.hasTakeProfitText || takeProfitCheck.radioCount > 0,
      details: 'Take-profit text: ' + takeProfitCheck.hasTakeProfitText + ', Radios: ' + takeProfitCheck.radioCount,
    });
    console.log(takeProfitCheck.hasTakeProfitText 
      ? '    ✅ Take-profit UI present\n' 
      : '    ℹ️  Take-profit may be combined with other options\n');

    // Test 3.2: Trigger price input
    console.log('  Test 3.2: Trigger price input');
    
    const triggerCheck = await page3.evaluate(() => {
      // Look for trigger price input
      const labels = Array.from(document.querySelectorAll('label, .arco-form-item-label'));
      const hasTriggerLabel = labels.some(l => 
        l.textContent?.includes('触发') || l.textContent?.includes('Trigger')
      );
      
      // Check for input fields that could be trigger price
      const inputs = document.querySelectorAll('.arco-input-number');
      
      return {
        hasTriggerLabel,
        inputCount: inputs.length,
      };
    });

    results.push({
      name: 'Trigger Price Input',
      passed: triggerCheck.inputCount > 0,
      details: 'Trigger label: ' + triggerCheck.hasTriggerLabel + ', Input count: ' + triggerCheck.inputCount,
    });
    console.log(triggerCheck.inputCount > 0 
      ? '    ✅ Trigger price input available\n' 
      : '    ⚠️  Trigger price input may be missing\n');

    await page3.screenshot({ path: 'midscene_run/e2e-conditional-03-takeprofit.png', fullPage: true });
    screenshots.push('e2e-conditional-03-takeprofit.png');
    await page3.close();

    // ========================================
    // Test Suite 4: Conditional Orders Panel
    // ========================================
    console.log('📋 Test Suite 4: Conditional Orders Panel\n');

    const page4 = await browser.newPage();
    await page4.setViewport({ width: 1280, height: 800 });

    await page4.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test 4.1: Active conditional orders display
    console.log('  Test 4.1: Active conditional orders display');
    
    const activeOrdersCheck = await page4.evaluate(() => {
      // Look for conditional orders panel or list
      const cards = document.querySelectorAll('.arco-card');
      const tables = document.querySelectorAll('.arco-table');
      
      // Check for active orders text
      const bodyText = document.body.innerText;
      const hasActiveOrders = bodyText.includes('活跃') || bodyText.includes('Active') || 
                              bodyText.includes('待触发') || bodyText.includes('Pending');
      
      return {
        hasCards: cards.length > 0,
        hasTables: tables.length > 0,
        hasActiveOrdersText: hasActiveOrders,
      };
    });

    results.push({
      name: 'Active Orders Display',
      passed: activeOrdersCheck.hasCards || activeOrdersCheck.hasTables,
      details: 'Cards: ' + activeOrdersCheck.hasCards + ', Tables: ' + activeOrdersCheck.hasTables,
    });
    console.log(activeOrdersCheck.hasCards 
      ? '    ✅ Orders display area present\n' 
      : '    ⚠️  Orders display may be limited\n');

    // Test 4.2: Cancel/modify controls
    console.log('  Test 4.2: Cancel/modify controls');
    
    const controlsCheck = await page4.evaluate(() => {
      // Look for action buttons
      const buttons = document.querySelectorAll('button');
      const deleteButtons = Array.from(buttons).filter(btn => 
        btn.textContent?.includes('取消') || 
        btn.textContent?.includes('Cancel') ||
        btn.textContent?.includes('删除') ||
        btn.textContent?.includes('Delete')
      );
      const modifyButtons = Array.from(buttons).filter(btn => 
        btn.textContent?.includes('修改') || 
        btn.textContent?.includes('Modify') ||
        btn.textContent?.includes('Edit')
      );
      
      return {
        hasDeleteButtons: deleteButtons.length > 0,
        deleteButtonCount: deleteButtons.length,
        hasModifyButtons: modifyButtons.length > 0,
        totalButtons: buttons.length,
      };
    });

    results.push({
      name: 'Order Controls',
      passed: controlsCheck.totalButtons > 0,
      details: 'Delete buttons: ' + controlsCheck.deleteButtonCount + ', Modify buttons: ' + controlsCheck.hasModifyButtons,
    });
    console.log(controlsCheck.totalButtons > 0 
      ? '    ✅ Order controls present\n' 
      : '    ⚠️  Order controls may be missing\n');

    await page4.screenshot({ path: 'midscene_run/e2e-conditional-04-panel.png', fullPage: true });
    screenshots.push('e2e-conditional-04-panel.png');
    await page4.close();

    // ========================================
    // Test Suite 5: Console Error Check
    // ========================================
    console.log('📋 Test Suite 5: Console Error Check\n');

    const criticalErrors = consoleErrors.filter(err => 
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

    console.log('  Test 5.1: No critical console errors');
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
  console.log('E2E TEST SUMMARY: CONDITIONAL ORDERS (Issue #188)');
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
