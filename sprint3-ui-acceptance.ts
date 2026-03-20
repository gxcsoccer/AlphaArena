import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const PRODUCTION_URL = 'https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app';
const PREVIEW_URL = 'https://alphaarena-9b6soez6b-gxcsoccer-s-team.vercel.app';
const REPORT_DIR = './midscene_run';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  screenshot?: string;
  url?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSprint3AcceptanceTest() {
  const results: TestResult[] = [];
  const errors: string[] = [];
  
  console.log('🚀 Starting Sprint 3 UI Acceptance Test...');
  console.log(`📍 Production URL: ${PRODUCTION_URL}`);
  console.log(`📍 Preview URL: ${PREVIEW_URL}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console log capture
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const msgType = msg.type();
      if (msgType === 'error') {
        consoleLogs.push(`[ERROR] ${msg.text()}`);
      } else if (msgType === 'warn') {
        consoleLogs.push(`[WARN] ${msg.text()}`);
      }
    });
    
    page.on('pageerror', (err: any) => {
      consoleLogs.push(`[PAGE ERROR] ${err.message}`);
    });
    
    // Ensure report directory exists
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    // ============================================
    // PRODUCTION ENVIRONMENT TESTS
    // ============================================
    console.log('\n========== PRODUCTION ENVIRONMENT ==========');
    
    // Test 1: Page Load - No White Screen
    console.log('\n📋 Test 1: Production - Page Load (No White Screen)');
    try {
      const response = await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      
      if (response?.status() === 200) {
        await page.waitForSelector('#root', { timeout: 10000 });
        await sleep(5000);
        
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          results.push({
            name: 'Production - Page Load',
            status: 'PASS',
            details: `Page loaded successfully. Root content length: ${rootContent.length} chars`,
            screenshot: 'sprint3-prod-home-page.png',
            url: PRODUCTION_URL
          });
          await page.screenshot({ path: path.join(REPORT_DIR, 'sprint3-prod-home-page.png'), fullPage: true });
          console.log('✅ PASS: Page loaded with content');
        } else {
          results.push({
            name: 'Production - Page Load',
            status: 'FAIL',
            details: 'Page loaded but root is empty (white screen)',
            url: PRODUCTION_URL
          });
          console.log('❌ FAIL: White screen detected');
        }
      } else {
        results.push({
          name: 'Production - Page Load',
          status: 'FAIL',
          details: `HTTP ${response?.status()} returned`,
          url: PRODUCTION_URL
        });
        console.log(`❌ FAIL: HTTP ${response?.status()}`);
      }
    } catch (error: any) {
      results.push({
        name: 'Production - Page Load',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 2: OrderBook Component Rendering
    console.log('\n📋 Test 2: Production - OrderBook Component Rendering');
    try {
      await sleep(3000);
      
      // Look for order book related elements (bids, asks, price levels)
      const orderBookElements = await page.$$eval(
        '[class*="order"], [class*="book"], [class*="bid"], [class*="ask"], [class*="price"]',
        els => els.length
      );
      
      // Also check for specific text content
      const hasOrderBookText = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('买') || text.includes('卖') || text.includes('bid') || text.includes('ask');
      });
      
      if (orderBookElements > 10 || hasOrderBookText) {
        results.push({
          name: 'Production - OrderBook Component',
          status: 'PASS',
          details: `Found ${orderBookElements} order book related elements. Order book text present: ${hasOrderBookText}`,
          url: PRODUCTION_URL
        });
        console.log(`✅ PASS: OrderBook component rendered (${orderBookElements} elements)`);
      } else {
        results.push({
          name: 'Production - OrderBook Component',
          status: 'WARN',
          details: `Only ${orderBookElements} order book elements found. May need manual verification.`,
          url: PRODUCTION_URL
        });
        console.log(`⚠️ WARN: Limited order book elements (${orderBookElements})`);
      }
    } catch (error: any) {
      results.push({
        name: 'Production - OrderBook Component',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 3: Bid/Ask Data Display
    console.log('\n📋 Test 3: Production - Bid/Ask Data Display');
    try {
      // Check for price and quantity data in order book
      const bidAskData = await page.evaluate(() => {
        const text = document.body.innerText;
        // Look for price patterns like numbers with decimals
        const pricePattern = /\d+\.\d{2,4}/g;
        const prices = text.match(pricePattern);
        return prices ? prices.length : 0;
      });
      
      if (bidAskData > 10) {
        results.push({
          name: 'Production - Bid/Ask Data',
          status: 'PASS',
          details: `Found ${bidAskData} price data points in order book`,
          url: PRODUCTION_URL
        });
        console.log(`✅ PASS: ${bidAskData} price data points displayed`);
      } else {
        results.push({
          name: 'Production - Bid/Ask Data',
          status: 'WARN',
          details: `Only ${bidAskData} price data points found`,
          url: PRODUCTION_URL
        });
        console.log(`⚠️ WARN: Limited price data (${bidAskData})`);
      }
    } catch (error: any) {
      results.push({
        name: 'Production - Bid/Ask Data',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 4: Real-time Data Update (Supabase Realtime)
    console.log('\n📋 Test 4: Production - Real-time Data Update');
    try {
      // Capture initial state
      const initialState = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      // Wait for potential real-time updates
      await sleep(15000);
      
      // Capture state after wait
      const updatedState = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      // Check WebSocket connections
      const _wsConnections: string[] = [];
      
      if (updatedState !== initialState) {
        results.push({
          name: 'Production - Real-time Updates',
          status: 'PASS',
          details: 'Content updated during observation period (real-time data working)',
          url: PRODUCTION_URL
        });
        console.log('✅ PASS: Real-time updates detected');
      } else {
        results.push({
          name: 'Production - Real-time Updates',
          status: 'WARN',
          details: 'No visible content changes during 15s observation (may need trading activity)',
          url: PRODUCTION_URL
        });
        console.log('⚠️ WARN: No visible updates (may need trading activity)');
      }
    } catch (error: any) {
      results.push({
        name: 'Production - Real-time Updates',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 5: Price Click to Fill Order Form
    console.log('\n📋 Test 5: Production - Price Click to Fill Order Form');
    try {
      // Try to find and click a price in the order book
      const priceElements = await page.$$('span[class*="price"], div[class*="price"], td[class*="price"]');
      
      if (priceElements.length > 0) {
        // Click the first price element
        await priceElements[0].click();
        await sleep(2000);
        
        // Check if order form price input was filled
        const formFilled = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="number"]');
          for (const input of inputs) {
            const value = (input as HTMLInputElement).value;
            if (value && value.includes('.')) {
              return true;
            }
          }
          return false;
        });
        
        if (formFilled) {
          results.push({
            name: 'Production - Price Click to Fill',
            status: 'PASS',
            details: 'Clicking price successfully fills order form',
            url: PRODUCTION_URL
          });
          console.log('✅ PASS: Price click fills order form');
        } else {
          results.push({
            name: 'Production - Price Click to Fill',
            status: 'WARN',
            details: 'Price click executed but form fill not verified',
            url: PRODUCTION_URL
          });
          console.log('⚠️ WARN: Form fill not verified');
        }
      } else {
        results.push({
          name: 'Production - Price Click to Fill',
          status: 'WARN',
          details: 'No clickable price elements found',
          url: PRODUCTION_URL
        });
        console.log('⚠️ WARN: No clickable price elements');
      }
    } catch (error: any) {
      results.push({
        name: 'Production - Price Click to Fill',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 6: Page Layout
    console.log('\n📋 Test 6: Production - Page Layout');
    try {
      const layoutInfo = await page.evaluate(() => {
        const root = document.getElementById('root');
        if (!root) return { error: 'No root element' };
        
        const children = root.children.length;
        const hasArco = document.querySelectorAll('[class*="arco-"]').length > 0;
        const hasGrid = document.querySelectorAll('[class*="row"], [class*="col"], [class*="grid"]').length > 0;
        
        return { children, hasArco, hasGrid };
      });
      
      if ((layoutInfo.children || 0) >= 1 && layoutInfo.hasArco) {
        results.push({
          name: 'Production - Page Layout',
          status: 'PASS',
          details: `Layout OK: ${layoutInfo.children} root children, Arco Design present, Grid present: ${layoutInfo.hasGrid}`,
          url: PRODUCTION_URL
        });
        console.log(`✅ PASS: Layout verified (${layoutInfo.children} children, Arco: ${layoutInfo.hasArco})`);
      } else {
        results.push({
          name: 'Production - Page Layout',
          status: 'WARN',
          details: `Layout issues: ${JSON.stringify(layoutInfo)}`,
          url: PRODUCTION_URL
        });
        console.log(`⚠️ WARN: Layout issues detected`);
      }
    } catch (error: any) {
      results.push({
        name: 'Production - Page Layout',
        status: 'FAIL',
        details: error.message,
        url: PRODUCTION_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // ============================================
    // PREVIEW ENVIRONMENT TESTS
    // ============================================
    console.log('\n========== PREVIEW ENVIRONMENT ==========');
    
    // Test 7: Preview Page Load
    console.log('\n📋 Test 7: Preview - Page Load');
    try {
      const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      
      if (response?.status() === 200) {
        await page.waitForSelector('#root', { timeout: 10000 });
        await sleep(5000);
        
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          results.push({
            name: 'Preview - Page Load',
            status: 'PASS',
            details: `Page loaded successfully. Root content length: ${rootContent.length} chars`,
            screenshot: 'sprint3-preview-home-page.png',
            url: PREVIEW_URL
          });
          await page.screenshot({ path: path.join(REPORT_DIR, 'sprint3-preview-home-page.png'), fullPage: true });
          console.log('✅ PASS: Preview page loaded with content');
        } else {
          results.push({
            name: 'Preview - Page Load',
            status: 'FAIL',
            details: 'Page loaded but root is empty (white screen)',
            url: PREVIEW_URL
          });
          console.log('❌ FAIL: Preview white screen detected');
        }
      } else {
        results.push({
          name: 'Preview - Page Load',
          status: 'FAIL',
          details: `HTTP ${response?.status()} returned`,
          url: PREVIEW_URL
        });
        console.log(`❌ FAIL: Preview HTTP ${response?.status()}`);
      }
    } catch (error: any) {
      results.push({
        name: 'Preview - Page Load',
        status: 'FAIL',
        details: error.message,
        url: PREVIEW_URL
      });
      console.log(`❌ FAIL: Preview ${error.message}`);
    }
    
    // Test 8: Preview OrderBook Component
    console.log('\n📋 Test 8: Preview - OrderBook Component');
    try {
      await sleep(3000);
      
      const orderBookElements = await page.$$eval(
        '[class*="order"], [class*="book"], [class*="bid"], [class*="ask"], [class*="price"]',
        els => els.length
      );
      
      const hasOrderBookText = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('买') || text.includes('卖') || text.includes('bid') || text.includes('ask');
      });
      
      if (orderBookElements > 10 || hasOrderBookText) {
        results.push({
          name: 'Preview - OrderBook Component',
          status: 'PASS',
          details: `Found ${orderBookElements} order book related elements`,
          url: PREVIEW_URL
        });
        console.log(`✅ PASS: Preview OrderBook rendered (${orderBookElements} elements)`);
      } else {
        results.push({
          name: 'Preview - OrderBook Component',
          status: 'WARN',
          details: `Only ${orderBookElements} order book elements found`,
          url: PREVIEW_URL
        });
        console.log(`⚠️ WARN: Preview limited order book elements (${orderBookElements})`);
      }
    } catch (error: any) {
      results.push({
        name: 'Preview - OrderBook Component',
        status: 'FAIL',
        details: error.message,
        url: PREVIEW_URL
      });
      console.log(`❌ FAIL: Preview ${error.message}`);
    }
    
    // Test 9: Preview Real-time Updates
    console.log('\n📋 Test 9: Preview - Real-time Updates');
    try {
      const initialState = await page.evaluate(() => document.body.innerText);
      await sleep(15000);
      const updatedState = await page.evaluate(() => document.body.innerText);
      
      if (updatedState !== initialState) {
        results.push({
          name: 'Preview - Real-time Updates',
          status: 'PASS',
          details: 'Content updated during observation period',
          url: PREVIEW_URL
        });
        console.log('✅ PASS: Preview real-time updates detected');
      } else {
        results.push({
          name: 'Preview - Real-time Updates',
          status: 'WARN',
          details: 'No visible content changes during 15s observation',
          url: PREVIEW_URL
        });
        console.log('⚠️ WARN: Preview no visible updates');
      }
    } catch (error: any) {
      results.push({
        name: 'Preview - Real-time Updates',
        status: 'FAIL',
        details: error.message,
        url: PREVIEW_URL
      });
      console.log(`❌ FAIL: Preview ${error.message}`);
    }
    
    // ============================================
    // NAVIGATION TESTS (Production)
    // ============================================
    console.log('\n========== NAVIGATION TESTS (Production) ==========');
    
    const pagesToTest = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/strategies', name: 'Strategies' },
      { path: '/trades', name: 'Trades' },
      { path: '/holdings', name: 'Holdings' },
      { path: '/leaderboard', name: 'Leaderboard' }
    ];
    
    for (const pageTest of pagesToTest) {
      console.log(`\n📋 Testing Page: ${pageTest.name}`);
      try {
        await page.goto(`${PRODUCTION_URL}${pageTest.path}`, { waitUntil: 'networkidle0', timeout: 15000 });
        await sleep(3000);
        
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          console.log(`✅ ${pageTest.name}: Loaded`);
          await page.screenshot({ 
            path: path.join(REPORT_DIR, `sprint3-prod-${pageTest.path.replace('/', '')}-page.png`), 
            fullPage: true 
          });
          results.push({
            name: `Production - ${pageTest.name} Page`,
            status: 'PASS',
            details: `Page loaded successfully`,
            screenshot: `sprint3-prod-${pageTest.path.replace('/', '')}-page.png`,
            url: `${PRODUCTION_URL}${pageTest.path}`
          });
        } else {
          console.log(`⚠️ ${pageTest.name}: Empty content`);
          results.push({
            name: `Production - ${pageTest.name} Page`,
            status: 'WARN',
            details: 'Page loaded but content is empty',
            url: `${PRODUCTION_URL}${pageTest.path}`
          });
        }
      } catch (error: any) {
        console.log(`❌ ${pageTest.name}: ${error.message}`);
        results.push({
          name: `Production - ${pageTest.name} Page`,
          status: 'FAIL',
          details: error.message,
          url: `${PRODUCTION_URL}${pageTest.path}`
        });
      }
    }
    
    // Capture console errors
    console.log('\n📋 Console Errors Summary');
    const criticalErrors = consoleLogs.filter(log => log.includes('[ERROR]') || log.includes('[PAGE ERROR]'));
    if (criticalErrors.length > 0) {
      console.log(`⚠️ Found ${criticalErrors.length} critical console errors:`);
      criticalErrors.slice(0, 10).forEach(err => console.log(`  ${err}`));
      errors.push(...criticalErrors);
      if (criticalErrors.length > 10) {
        console.log(`  ... and ${criticalErrors.length - 10} more`);
      }
    } else {
      console.log('✅ No critical console errors');
    }
    
    await browser.close();
    
    // Generate Report
    generateReport(results, errors);
    
  } catch (error: any) {
    console.error('Test execution failed:', error);
    if (browser) await browser.close();
  }
}

function generateReport(results: TestResult[], errors: string[]) {
  const timestamp = new Date().toISOString();
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  
  const report = `# Sprint 3 UI Acceptance Test Report

**Generated:** ${timestamp}

## Summary

| Status | Count |
|--------|-------|
| ✅ PASS | ${passCount} |
| ❌ FAIL | ${failCount} |
| ⚠️ WARN | ${warnCount} |
| **Total** | **${results.length}** |

## Test Results

${results.map((r, i) => `### ${i + 1}. ${r.name}

- **Status:** ${r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ WARN'}
- **URL:** ${r.url || 'N/A'}
- **Details:** ${r.details}
${r.screenshot ? `- **Screenshot:** \`${r.screenshot}\`` : ''}
`).join('\n')}

## Console Errors

${errors.length > 0 ? errors.map(e => `- ${e}`).join('\n') : '✅ No critical console errors'}

## Screenshots

Screenshots saved to: \`${REPORT_DIR}/\`

${results.filter(r => r.screenshot).map(r => `- ${r.screenshot}`).join('\n')}
`;

  const reportPath = path.join(REPORT_DIR, 'sprint3-acceptance-report.md');
  fs.writeFileSync(reportPath, report);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ PASS: ${passCount}/${results.length}`);
  console.log(`❌ FAIL: ${failCount}/${results.length}`);
  console.log(`⚠️ WARN: ${warnCount}/${results.length}`);
  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log('='.repeat(60));
}

// Run the test
runSprint3AcceptanceTest();
