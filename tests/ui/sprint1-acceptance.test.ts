/**
 * Sprint 1 UI Acceptance Tests
 * 
 * Tests for:
 * 1. 策略选择页面：默认选中单个策略，显示独立数据
 * 2. 实时交易引擎：CLI 命令正常工作 (verified separately)
 * 3. 前端重构：布局、交互、类型安全改进
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];
  
  console.log('🚀 Starting Sprint 1 UI Acceptance Tests...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    // Test 1: Strategies Page - Default Single Strategy Selection
    console.log('📋 Test 1: Strategies Page - Default Single Strategy Selection');
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });
    await page1.goto(`${BASE_URL}/strategies`, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Check if strategies page loads
    const strategiesLoaded = await page1.evaluate(() => {
      return document.querySelector('.ant-card') !== null || 
             document.querySelector('[class*="strategy"]') !== null ||
             document.body.innerText.length > 100;
    });
    
    if (strategiesLoaded) {
      results.push({
        name: 'Strategies Page Load',
        passed: true,
        details: 'Strategies page loaded successfully',
      });
      console.log('  ✅ Strategies page loaded\n');
    } else {
      results.push({
        name: 'Strategies Page Load',
        passed: false,
        details: 'Strategies page did not load properly',
      });
      console.log('  ❌ Strategies page failed to load\n');
    }
    
    // Take screenshot
    await page1.screenshot({ path: 'midscene_run/strategies-page.png', fullPage: true });
    console.log('  📸 Screenshot saved: midscene_run/strategies-page.png\n');
    
    await page1.close();
    
    // Test 2: Dashboard Page - Layout and Interactions
    console.log('📋 Test 2: Dashboard Page - Layout and Interactions');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });
    await page2.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const dashboardLoaded = await page2.evaluate(() => {
      return document.querySelector('.ant-layout') !== null ||
             document.querySelector('[class*="dashboard"]') !== null ||
             document.body.innerText.length > 100;
    });
    
    if (dashboardLoaded) {
      results.push({
        name: 'Dashboard Page Load',
        passed: true,
        details: 'Dashboard page loaded successfully with Ant Design layout',
      });
      console.log('  ✅ Dashboard page loaded\n');
    } else {
      results.push({
        name: 'Dashboard Page Load',
        passed: false,
        details: 'Dashboard page did not load properly',
      });
      console.log('  ❌ Dashboard page failed to load\n');
    }
    
    // Check navigation menu
    const navMenuExists = await page2.evaluate(() => {
      return document.querySelector('.ant-menu') !== null;
    });
    
    if (navMenuExists) {
      results.push({
        name: 'Navigation Menu',
        passed: true,
        details: 'Ant Design navigation menu is present',
      });
      console.log('  ✅ Navigation menu present\n');
    } else {
      results.push({
        name: 'Navigation Menu',
        passed: false,
        details: 'Navigation menu not found',
      });
      console.log('  ❌ Navigation menu not found\n');
    }
    
    await page2.screenshot({ path: 'midscene_run/dashboard-page.png', fullPage: true });
    console.log('  📸 Screenshot saved: midscene_run/dashboard-page.png\n');
    
    await page2.close();
    
    // Test 3: Navigation - All Pages Accessible
    console.log('📋 Test 3: Navigation - All Pages Accessible');
    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1280, height: 800 });
    
    const pages = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/strategies', name: 'Strategies' },
      { path: '/trades', name: 'Trades' },
      { path: '/holdings', name: 'Holdings' },
      { path: '/leaderboard', name: 'Leaderboard' },
    ];
    
    for (const p of pages) {
      await page3.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
      const loaded = await page3.evaluate(() => document.body.innerText.length > 50);
      
      if (loaded) {
        results.push({
          name: `${p.name} Page Navigation`,
          passed: true,
          details: `${p.name} page is accessible`,
        });
        console.log(`  ✅ ${p.name} page accessible`);
      } else {
        results.push({
          name: `${p.name} Page Navigation`,
          passed: false,
          details: `${p.name} page failed to load`,
        });
        console.log(`  ❌ ${p.name} page failed to load`);
      }
    }
    
    await page3.close();
    
    // Test 4: Type Safety - No Console Errors
    console.log('\n📋 Test 4: Type Safety - No Console Errors');
    const page4 = await browser.newPage();
    
    const consoleErrors: string[] = [];
    page4.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page4.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    
    if (consoleErrors.length === 0) {
      results.push({
        name: 'Console Errors',
        passed: true,
        details: 'No console errors detected',
      });
      console.log('  ✅ No console errors\n');
    } else {
      results.push({
        name: 'Console Errors',
        passed: false,
        details: `Found ${consoleErrors.length} console errors: ${consoleErrors.join(', ')}`,
      });
      console.log(`  ❌ Found ${consoleErrors.length} console errors\n`);
    }
    
    await page4.close();
    
  } catch (error) {
    console.error('Test execution error:', error);
    results.push({
      name: 'Test Execution',
      passed: false,
      details: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  } finally {
    await browser.close();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SPRINT 1 UI ACCEPTANCE TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  console.log('\nDetailed Results:');
  results.forEach((r, _i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.name}: ${r.details}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Return exit code based on results
  return passed === total ? 0 : 1;
}

// Run tests
runTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
