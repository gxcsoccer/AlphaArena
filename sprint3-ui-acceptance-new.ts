import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://alphaarena-eight.vercel.app';
const REPORT_DIR = './midscene_run';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  screenshot?: string;
  url?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runUITest() {
  const results: TestResult[] = [];
  const errors: string[] = [];
  
  console.log('🚀 Starting UI Acceptance Test for PR #66...');
  console.log(`📍 Target URL: ${TARGET_URL}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
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
    
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    // Test 1: Page Load - No White Screen
    console.log('\n📋 Test 1: Page Load (No White Screen)');
    try {
      const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      
      if (response?.status() === 200) {
        await page.waitForSelector('#root', { timeout: 10000 });
        await sleep(5000);
        
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          results.push({
            name: 'Page Load',
            status: 'PASS',
            details: `Page loaded successfully. Root content length: ${rootContent.length} chars`,
            screenshot: 'pr66-home-page.png',
            url: TARGET_URL
          });
          await page.screenshot({ path: path.join(REPORT_DIR, 'pr66-home-page.png'), fullPage: true });
          console.log('✅ PASS: Page loaded with content');
        } else {
          results.push({
            name: 'Page Load',
            status: 'FAIL',
            details: 'Page loaded but root is empty (white screen)',
            url: TARGET_URL
          });
          console.log('❌ FAIL: White screen detected');
        }
      } else {
        results.push({
          name: 'Page Load',
          status: 'FAIL',
          details: `HTTP ${response?.status()} returned`,
          url: TARGET_URL
        });
        console.log(`❌ FAIL: HTTP ${response?.status()}`);
      }
    } catch (error: any) {
      results.push({
        name: 'Page Load',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 2: OrderBook Component Rendering - No ErrorBoundary
    console.log('\n📋 Test 2: OrderBook Component Rendering (No ErrorBoundary)');
    try {
      await sleep(3000);
      
      // Check for ErrorBoundary error messages
      const hasErrorBoundary = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('ErrorBoundary') || text.includes('Something went wrong') || text.includes('Error:');
      });
      
      // Look for order book related elements
      const orderBookElements = await page.$$eval(
        '[class*="order"], [class*="book"], [class*="bid"], [class*="ask"], [class*="price"]',
        els => els.length
      );
      
      const hasOrderBookText = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('买') || text.includes('卖') || text.includes('bid') || text.includes('ask');
      });
      
      if (hasErrorBoundary) {
        results.push({
          name: 'OrderBook Component - No ErrorBoundary',
          status: 'FAIL',
          details: 'ErrorBoundary error detected on page',
          url: TARGET_URL
        });
        console.log('❌ FAIL: ErrorBoundary error detected');
      } else if (orderBookElements > 10 || hasOrderBookText) {
        results.push({
          name: 'OrderBook Component - No ErrorBoundary',
          status: 'PASS',
          details: `OrderBook rendered normally. Found ${orderBookElements} elements. Order book text present: ${hasOrderBookText}`,
          url: TARGET_URL
        });
        console.log(`✅ PASS: OrderBook component rendered normally (${orderBookElements} elements)`);
      } else {
        results.push({
          name: 'OrderBook Component - No ErrorBoundary',
          status: 'WARN',
          details: `No ErrorBoundary error, but only ${orderBookElements} order book elements found`,
          url: TARGET_URL
        });
        console.log(`⚠️ WARN: Limited order book elements (${orderBookElements})`);
      }
    } catch (error: any) {
      results.push({
        name: 'OrderBook Component - No ErrorBoundary',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 3: Bid/Ask Data Display
    console.log('\n📋 Test 3: Bid/Ask Data Display');
    try {
      const bidAskData = await page.evaluate(() => {
        const text = document.body.innerText;
        const pricePattern = /\d+\.\d{2,4}/g;
        const prices = text.match(pricePattern);
        return prices ? prices.length : 0;
      });
      
      if (bidAskData > 10) {
        results.push({
          name: 'Bid/Ask Data Display',
          status: 'PASS',
          details: `Found ${bidAskData} price data points in order book`,
          url: TARGET_URL
        });
        console.log(`✅ PASS: ${bidAskData} price data points displayed`);
      } else {
        results.push({
          name: 'Bid/Ask Data Display',
          status: 'WARN',
          details: `Only ${bidAskData} price data points found`,
          url: TARGET_URL
        });
        console.log(`⚠️ WARN: Limited price data (${bidAskData})`);
      }
    } catch (error: any) {
      results.push({
        name: 'Bid/Ask Data Display',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 4: Real-time Data Update (Supabase Realtime)
    console.log('\n📋 Test 4: Real-time Data Update (Supabase Realtime)');
    try {
      const initialState = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      await sleep(15000);
      
      const updatedState = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      const wsErrors = consoleLogs.filter(log => log.includes('WebSocket') || log.includes('Realtime'));
      
      if (updatedState !== initialState) {
        results.push({
          name: 'Real-time Data Update',
          status: 'PASS',
          details: 'Content updated during observation period (real-time data working)',
          url: TARGET_URL
        });
        console.log('✅ PASS: Real-time updates detected');
      } else if (wsErrors.length > 0) {
        results.push({
          name: 'Real-time Data Update',
          status: 'WARN',
          details: `No visible updates, but WebSocket errors detected: ${wsErrors.length} errors`,
          url: TARGET_URL
        });
        console.log(`⚠️ WARN: WebSocket errors detected (${wsErrors.length})`);
      } else {
        results.push({
          name: 'Real-time Data Update',
          status: 'WARN',
          details: 'No visible content changes during 15s observation (may need trading activity)',
          url: TARGET_URL
        });
        console.log('⚠️ WARN: No visible updates (may need trading activity)');
      }
    } catch (error: any) {
      results.push({
        name: 'Real-time Data Update',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 5: Price Click to Fill Order Form
    console.log('\n📋 Test 5: Price Click to Fill Order Form');
    try {
      const priceElements = await page.$$('span[class*="price"], div[class*="price"], td[class*="price"]');
      
      if (priceElements.length > 0) {
        await priceElements[0].click();
        await sleep(2000);
        
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
            name: 'Price Click to Fill Order Form',
            status: 'PASS',
            details: 'Clicking price successfully fills order form',
            url: TARGET_URL
          });
          console.log('✅ PASS: Price click fills order form');
        } else {
          results.push({
            name: 'Price Click to Fill Order Form',
            status: 'WARN',
            details: 'Price click executed but form fill not verified',
            url: TARGET_URL
          });
          console.log('⚠️ WARN: Form fill not verified');
        }
      } else {
        results.push({
          name: 'Price Click to Fill Order Form',
          status: 'WARN',
          details: 'No clickable price elements found',
          url: TARGET_URL
        });
        console.log('⚠️ WARN: No clickable price elements');
      }
    } catch (error: any) {
      results.push({
        name: 'Price Click to Fill Order Form',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 6: Page Layout
    console.log('\n📋 Test 6: Page Layout');
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
          name: 'Page Layout',
          status: 'PASS',
          details: `Layout OK: ${layoutInfo.children} root children, Arco Design present, Grid present: ${layoutInfo.hasGrid}`,
          url: TARGET_URL
        });
        console.log(`✅ PASS: Layout verified (${layoutInfo.children} children, Arco: ${layoutInfo.hasArco})`);
      } else {
        results.push({
          name: 'Page Layout',
          status: 'WARN',
          details: `Layout issues: ${JSON.stringify(layoutInfo)}`,
          url: TARGET_URL
        });
        console.log(`⚠️ WARN: Layout issues detected`);
      }
    } catch (error: any) {
      results.push({
        name: 'Page Layout',
        status: 'FAIL',
        details: error.message,
        url: TARGET_URL
      });
      console.log(`❌ FAIL: ${error.message}`);
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
  
  const report = `# PR #66 UI Acceptance Test Report

**Generated:** ${timestamp}
**Target URL:** ${TARGET_URL}

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

  const reportPath = path.join(REPORT_DIR, 'pr66-acceptance-report.md');
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

runUITest();
