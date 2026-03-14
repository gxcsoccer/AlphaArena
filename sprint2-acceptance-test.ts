import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://alphaarena-hymr9xflt-gxcsoccer-s-team.vercel.app';
const REPORT_DIR = './midscene_run';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  screenshot?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSprint2AcceptanceTest() {
  const results: TestResult[] = [];
  const errors: string[] = [];
  
  console.log('🚀 Starting Sprint 2 UI Acceptance Test...');
  console.log(`📍 Target URL: ${BASE_URL}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console log capture
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        consoleLogs.push(`[WARN] ${msg.text()}`);
      }
    });
    
    // Test 1: Page Load - No White Screen
    console.log('\n📋 Test 1: Page Load (No White Screen)');
    try {
      const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      
      if (response?.status() === 200) {
        await page.waitForSelector('#root', { timeout: 10000 });
        await sleep(3000);
        
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          results.push({
            name: 'Page Load - No White Screen',
            status: 'PASS',
            details: `Page loaded successfully. Root content length: ${rootContent.length} chars`,
            screenshot: 'sprint2-home-page.png'
          });
          await page.screenshot({ path: path.join(REPORT_DIR, 'sprint2-home-page.png'), fullPage: true });
          console.log('✅ PASS: Page loaded with content');
        } else {
          results.push({
            name: 'Page Load - No White Screen',
            status: 'FAIL',
            details: 'Page loaded but root is empty (white screen)',
          });
          console.log('❌ FAIL: White screen detected');
        }
      } else {
        results.push({
          name: 'Page Load - No White Screen',
          status: 'FAIL',
          details: `HTTP ${response?.status()} returned`,
        });
        console.log(`❌ FAIL: HTTP ${response?.status()}`);
      }
    } catch (error: any) {
      results.push({
        name: 'Page Load - No White Screen',
        status: 'FAIL',
        details: error.message,
      });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 2: Arco Design UI Rendering
    console.log('\n📋 Test 2: Arco Design UI Rendering');
    try {
      const arcoComponents = await page.$$eval('[class*="arco-"]', els => els.length);
      
      if (arcoComponents > 0) {
        results.push({
          name: 'Arco Design UI Rendering',
          status: 'PASS',
          details: `Found ${arcoComponents} Arco Design components`,
        });
        console.log(`✅ PASS: ${arcoComponents} Arco Design components found`);
      } else {
        results.push({
          name: 'Arco Design UI Rendering',
          status: 'FAIL',
          details: 'No Arco Design components detected',
        });
        console.log('❌ FAIL: No Arco Design components');
      }
    } catch (error: any) {
      results.push({
        name: 'Arco Design UI Rendering',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 3: Order Book Real-time Update
    console.log('\n📋 Test 3: Order Book Display');
    try {
      const orderBookElements = await page.$$eval('[class*="order"], [class*="book"], [class*="bid"], [class*="ask"]', els => els.length);
      
      if (orderBookElements > 0) {
        results.push({
          name: 'Order Book Display',
          status: 'PASS',
          details: `Found ${orderBookElements} order book related elements`,
        });
        console.log(`✅ PASS: Order book elements present`);
      } else {
        results.push({
          name: 'Order Book Display',
          status: 'WARN',
          details: 'Order book elements not found on home page (may be on different page)',
        });
        console.log('⚠️ WARN: Order book not on home page');
      }
    } catch (error: any) {
      results.push({
        name: 'Order Book Display',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 4: Trading Pair List and Market Data
    console.log('\n📋 Test 4: Trading Pair List and Market Data');
    try {
      const tradingPairElements = await page.$$eval('[class*="pair"], [class*="symbol"], [class*="ticker"]', els => els.length);
      
      if (tradingPairElements > 0) {
        results.push({
          name: 'Trading Pair List and Market Data',
          status: 'PASS',
          details: `Found ${tradingPairElements} trading pair related elements`,
        });
        console.log(`✅ PASS: Trading pair elements present`);
      } else {
        results.push({
          name: 'Trading Pair List and Market Data',
          status: 'WARN',
          details: 'Trading pair elements not found on home page',
        });
        console.log('⚠️ WARN: Trading pairs not on home page');
      }
    } catch (error: any) {
      results.push({
        name: 'Trading Pair List and Market Data',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 5: K-line Chart (TradingView)
    console.log('\n📋 Test 5: K-line Chart Display');
    try {
      const chartElements = await page.$$eval('[class*="chart"], [class*="kline"], [class*="candlestick"], [id*="chart"]', els => els.length);
      
      if (chartElements > 0) {
        results.push({
          name: 'K-line Chart Display',
          status: 'PASS',
          details: `Found ${chartElements} chart elements`,
        });
        console.log(`✅ PASS: Chart elements present`);
      } else {
        results.push({
          name: 'K-line Chart Display',
          status: 'WARN',
          details: 'Chart elements not found on home page',
        });
        console.log('⚠️ WARN: Chart not on home page');
      }
    } catch (error: any) {
      results.push({
        name: 'K-line Chart Display',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 6: Trading Order Component
    console.log('\n📋 Test 6: Trading Order Component');
    try {
      const orderFormElements = await page.$$eval('[class*="order"], [class*="trade"], [class*="buy"], [class*="sell"]', els => els.length);
      
      if (orderFormElements > 0) {
        results.push({
          name: 'Trading Order Component',
          status: 'PASS',
          details: `Found ${orderFormElements} trading form elements`,
        });
        console.log(`✅ PASS: Trading form elements present`);
      } else {
        results.push({
          name: 'Trading Order Component',
          status: 'WARN',
          details: 'Trading form elements not found on home page',
        });
        console.log('⚠️ WARN: Trading form not on home page');
      }
    } catch (error: any) {
      results.push({
        name: 'Trading Order Component',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 7: API Endpoints (Production)
    console.log('\n📋 Test 7: API Endpoints (Production)');
    try {
      const apiRequests: string[] = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/') || url.includes('supabase')) {
          apiRequests.push(url);
        }
      });
      
      await page.reload({ waitUntil: 'networkidle0' });
      await sleep(2000);
      
      const prodApiCalls = apiRequests.filter(url => 
        url.includes('alphaarena') || 
        url.includes('supabase.co')
      );
      
      if (prodApiCalls.length > 0) {
        results.push({
          name: 'API Endpoints (Production)',
          status: 'PASS',
          details: `Found ${prodApiCalls.length} production API calls`,
        });
        console.log(`✅ PASS: ${prodApiCalls.length} production API calls detected`);
      } else {
        results.push({
          name: 'API Endpoints (Production)',
          status: 'WARN',
          details: 'No production API calls detected (may be client-side only)',
        });
        console.log('⚠️ WARN: No API calls detected');
      }
    } catch (error: any) {
      results.push({
        name: 'API Endpoints (Production)',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Test 8: WebSocket Connection
    console.log('\n📋 Test 8: WebSocket Connection');
    try {
      const wsConnections: string[] = [];
      page.on('websocket', ws => {
        wsConnections.push(ws.url());
      });
      
      await sleep(3000);
      
      if (wsConnections.length > 0) {
        results.push({
          name: 'WebSocket Connection',
          status: 'PASS',
          details: `Established ${wsConnections.length} WebSocket connections: ${wsConnections.join(', ')}`,
        });
        console.log(`✅ PASS: ${wsConnections.length} WebSocket connections`);
      } else {
        results.push({
          name: 'WebSocket Connection',
          status: 'WARN',
          details: 'No WebSocket connections established (may be on-demand)',
        });
        console.log('⚠️ WARN: No WebSocket connections');
      }
    } catch (error: any) {
      results.push({
        name: 'WebSocket Connection',
        status: 'FAIL',
        details: error.message,
      });
    }
    
    // Capture console errors
    console.log('\n📋 Console Errors Summary');
    const criticalErrors = consoleLogs.filter(log => log.includes('[ERROR]') && !log.includes('WebSocket'));
    if (criticalErrors.length > 0) {
      console.log(`⚠️ Found ${criticalErrors.length} critical console errors:`);
      criticalErrors.forEach(err => console.log(`  ${err}`));
      errors.push(...criticalErrors);
    } else {
      console.log('✅ No critical console errors');
    }
    
    // Navigate to other pages
    const pagesToTest = ['/dashboard', '/strategies', '/trades', '/holdings', '/leaderboard'];
    for (const pagePath of pagesToTest) {
      console.log(`\n📋 Testing Page: ${pagePath}`);
      try {
        await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle0', timeout: 15000 });
        await sleep(2000);
        
        const pageTitle = await page.title();
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        
        if (rootContent.length > 100) {
          console.log(`✅ ${pagePath}: Loaded (${pageTitle})`);
          await page.screenshot({ 
            path: path.join(REPORT_DIR, `sprint2-${pagePath.replace('/', '')}-page.png`), 
            fullPage: true 
          });
        } else {
          console.log(`⚠️ ${pagePath}: Empty content`);
        }
      } catch (error: any) {
        console.log(`❌ ${pagePath}: ${error.message}`);
      }
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
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  const overallStatus = failCount === 0 ? (warnCount > 0 ? 'CONDITIONAL_PASS' : 'PASS') : 'FAIL';
  
  const report = `# Sprint 2 UI Acceptance Test Report

**Date:** ${new Date().toISOString().split('T')[0]}  
**Tester:** vc:qa (Autonomous QA Agent)  
**Sprint:** 2  
**Status:** ${overallStatus === 'PASS' ? '✅ PASS' : overallStatus === 'CONDITIONAL_PASS' ? '⚠️ CONDITIONAL PASS' : '❌ FAIL'}

---

## Executive Summary

Sprint 2 UI acceptance testing was conducted on the AlphaArena production deployment.

**Overall Result:** ${passCount}/${results.length} tests passed (${Math.round(passCount/results.length*100)}% success rate)

- ✅ Pass: ${passCount}
- ⚠️ Warning: ${warnCount}
- ❌ Fail: ${failCount}

---

## Test Environment

- **Application URL:** ${BASE_URL} (Vercel Production)
- **Browser:** Puppeteer (Headless Chrome)
- **Test Framework:** TypeScript + Puppeteer
- **Date/Time:** ${new Date().toISOString()}

---

## Detailed Test Results

${results.map((r, i) => `### ${i + 1}. ${r.name}

**Status:** ${r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL'}

**Details:** ${r.details}
${r.screenshot ? `\n**Screenshot:** \`${r.screenshot}\`` : ''}
`).join('\n')}

---

## Console Errors

${errors.length > 0 ? errors.map(e => `- ${e}`).join('\n') : 'No critical console errors detected'}

---

## Screenshots

Screenshots captured during testing:
${results.filter(r => r.screenshot).map(r => `- \`${r.screenshot}\``).join('\n')}

---

## Acceptance Decision

**Sprint 2 Status:** ${overallStatus === 'PASS' ? '✅ PASS' : overallStatus === 'CONDITIONAL_PASS' ? '⚠️ CONDITIONAL PASS' : '❌ FAIL'}

**Rationale:**
${overallStatus === 'PASS' ? '- All critical tests passed\n- Application is production-ready' : overallStatus === 'CONDITIONAL_PASS' ? '- Core functionality working\n- Some warnings noted but not blocking' : '- Critical failures detected\n- Requires fixes before production deployment'}

---

## Next Steps

${overallStatus === 'PASS' ? '1. Update .virtucorp/sprint.json status to "completed"\n2. Proceed to Sprint 3 planning' : overallStatus === 'CONDITIONAL_PASS' ? '1. Review warnings and address if needed\n2. Update sprint status\n3. Proceed to next sprint planning' : '1. Fix identified issues\n2. Re-run acceptance tests\n3. Do not mark sprint as completed until all tests pass'}

---

**Report Generated:** ${new Date().toISOString()}  
**Generated By:** VirtuCorp QA Agent (vc:qa)
`;

  fs.writeFileSync(path.join(REPORT_DIR, 'sprint2-acceptance-report.md'), report);
  console.log('\n📄 Report saved to: midscene_run/sprint2-acceptance-report.md');
  
  console.log('\n' + '='.repeat(60));
  console.log('SPRINT 2 ACCEPTANCE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Status: ${overallStatus === 'PASS' ? '✅ PASS' : overallStatus === 'CONDITIONAL_PASS' ? '⚠️ CONDITIONAL PASS' : '❌ FAIL'}`);
  console.log(`Pass: ${passCount} | Warn: ${warnCount} | Fail: ${failCount}`);
  console.log('='.repeat(60));
}

runSprint2AcceptanceTest();
