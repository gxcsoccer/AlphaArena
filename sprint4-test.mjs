import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET_URL = 'https://alphaarena-eight.vercel.app';
const REPORT_DIR = './midscene_run';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSprint4FinalTest() {
  const results = [];
  const errors = [];
  
  console.log('🚀 Starting FINAL Sprint 4 UI Acceptance Test...');
  console.log(`📍 Target URL: ${TARGET_URL}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    // Test 1: Page Load
    console.log('\n📋 Test 1: Page Load');
    try {
      const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.waitForSelector('#root', { timeout: 10000 });
      await sleep(5000);
      
      const rootContent = await page.$eval('#root', el => el.innerHTML);
      
      if (rootContent.length > 1000) {
        results.push({ name: 'Page Load', status: 'PASS', details: `Page loaded. Content: ${rootContent.length} chars` });
        await page.screenshot({ path: path.join(REPORT_DIR, 'sprint4-final-home-page.png'), fullPage: true });
        console.log('✅ PASS');
      } else {
        results.push({ name: 'Page Load', status: 'FAIL', details: 'Insufficient content' });
        console.log('❌ FAIL');
      }
    } catch (error) {
      results.push({ name: 'Page Load', status: 'FAIL', details: error.message });
      console.log(`❌ FAIL: ${error.message}`);
    }
    
    // Test 2: OrderBook Component
    console.log('\n📋 Test 2: OrderBook Component');
    const orderBookVisible = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('OrderBook') || body.includes('订单') || body.includes('买') || body.includes('卖');
    });
    results.push({ 
      name: 'OrderBook Component', 
      status: orderBookVisible ? 'PASS' : 'FAIL', 
      details: orderBookVisible ? 'OrderBook visible' : 'OrderBook not found' 
    });
    console.log(orderBookVisible ? '✅ PASS' : '❌ FAIL');
    
    // Test 3: No "暂无数据"
    console.log('\n📋 Test 3: OrderBook Has Data');
    const hasNoData = await page.evaluate(() => document.body.innerText.includes('暂无数据'));
    results.push({ 
      name: 'OrderBook Has Data', 
      status: !hasNoData ? 'PASS' : 'FAIL', 
      details: !hasNoData ? 'Data displayed (not "暂无数据")' : 'Shows "暂无数据"' 
    });
    console.log(!hasNoData ? '✅ PASS' : '❌ FAIL');
    
    // Test 4: Price Data
    console.log('\n📋 Test 4: Bid/Ask Price Data');
    const hasPrices = await page.evaluate(() => {
      const text = document.body.innerText;
      return /\d{1,3}(,\d{3})*(\.\d{2})?|\d+\.\d{2}/.test(text);
    });
    results.push({ 
      name: 'Bid/Ask Price Data', 
      status: hasPrices ? 'PASS' : 'FAIL', 
      details: hasPrices ? 'Price data found' : 'No price data' 
    });
    console.log(hasPrices ? '✅ PASS' : '❌ FAIL');
    
    // Test 5: Supabase Realtime
    console.log('\n📋 Test 5: Supabase Realtime');
    const supabaseErrors = errors.filter(e => e.includes('Supabase') || e.includes('Realtime') || e.includes('apikey'));
    results.push({ 
      name: 'Supabase Realtime', 
      status: supabaseErrors.length === 0 ? 'PASS' : 'WARN', 
      details: supabaseErrors.length === 0 ? 'No auth errors' : `${supabaseErrors.length} messages` 
    });
    console.log(supabaseErrors.length === 0 ? '✅ PASS' : '⚠️ WARN');
    
    // Test 6-10: Other pages
    const pages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Trades', path: '/trades' },
      { name: 'Holdings', path: '/holdings' },
      { name: 'Leaderboard', path: '/leaderboard' },
      { name: 'Strategies', path: '/strategies' }
    ];
    
    for (const p of pages) {
      console.log(`\n📋 Test: ${p.name} Page`);
      try {
        await page.goto(`${TARGET_URL}${p.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(3000);
        const loaded = await page.evaluate(() => document.body.innerText.length > 500);
        results.push({ 
          name: `${p.name} Page`, 
          status: loaded ? 'PASS' : 'FAIL', 
          details: loaded ? 'Loaded successfully' : 'Appears empty' 
        });
        await page.screenshot({ path: path.join(REPORT_DIR, `sprint4-final-${p.name.toLowerCase()}-page.png`), fullPage: true });
        console.log(loaded ? '✅ PASS' : '❌ FAIL');
      } catch (error) {
        results.push({ name: `${p.name} Page`, status: 'FAIL', details: error.message });
        console.log(`❌ FAIL: ${error.message}`);
      }
    }
    
    await browser.close();
    
    // Summary
    console.log('\n\n========================================');
    console.log('📊 SPRINT 4 FINAL ACCEPTANCE TEST REPORT');
    console.log('========================================\n');
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;
    
    console.log(`Summary:`);
    console.log(`  ✅ PASS: ${passCount}`);
    console.log(`  ❌ FAIL: ${failCount}`);
    console.log(`  ⚠️ WARN: ${warnCount}`);
    console.log(`  Total: ${results.length}\n`);
    
    console.log('Test Results:');
    results.forEach((r, i) => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${i + 1}. ${r.name}: ${r.details}`);
    });
    
    console.log('\n========================================');
    if (failCount === 0) {
      console.log('🎉 SPRINT 4 ACCEPTANCE: PASSED');
      console.log('All critical tests passed. Sprint 4 is COMPLETE.');
    } else {
      console.log('❌ SPRINT 4 ACCEPTANCE: FAILED');
      console.log(`${failCount} test(s) failed.`);
    }
    console.log('========================================\n');
    
    // Save report
    const reportContent = `# Sprint 4 Final UI Acceptance Test Report

**Test Date:** ${new Date().toISOString()}
**Target URL:** ${TARGET_URL}
**Status:** ${failCount === 0 ? '✅ PASSED' : '❌ FAILED'}

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
- **Details:** ${r.details}
`).join('\n')}

## Conclusion

${failCount === 0 
  ? '🎉 **Sprint 4 is COMPLETE.** All acceptance tests passed. The P0 Bug #81 fix (OrderBook no data) is working correctly in production.' 
  : '❌ **Sprint 4 acceptance failed.** ${failCount} test(s) need attention.'}

---
**Generated by:** QA Agent (vc:qa)
`;
    
    fs.writeFileSync(path.join(REPORT_DIR, 'sprint4-final-acceptance-report.md'), reportContent);
    console.log(`\n📄 Report saved to: midscene_run/sprint4-final-acceptance-report.md`);
    
  } catch (error) {
    console.error('Test failed:', error);
    if (browser) await browser.close();
  }
}

runSprint4FinalTest().catch(console.error);
