/**
 * E2E Tests for Page Navigation and Core Flows (Issue #183)
 * 
 * Sprint 8: Expand E2E test coverage
 * 
 * Tests:
 * 1. All core pages load successfully
 * 2. URL-based navigation works
 * 3. Core UI elements are present
 * 4. No JavaScript errors on pages
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 30000;
const WAIT_AFTER_LOAD = 3000; // Wait time after page load

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}

// Pages to test - use actual content from pages
const PAGES = [
  { path: '/', name: 'Home', expectedContent: ['AlphaArena', '交易对', 'BTC/USD'] },
  { path: '/dashboard', name: 'Dashboard', expectedContent: ['Dashboard', 'Total Strategies', 'Total Trades'] },
  { path: '/strategies', name: 'Strategies', expectedContent: ['Strategies', 'Strategy Management'] },
  { path: '/trades', name: 'Trades', expectedContent: ['Trades', 'Trade History'] },
  { path: '/holdings', name: 'Holdings', expectedContent: ['Holdings', 'Total Value', 'Current Positions'] },
  { path: '/leaderboard', name: 'Leaderboard', expectedContent: ['Leaderboard', 'ROI', 'Rank'] },
];

// Helper to check for console errors
function getCriticalErrors(consoleErrors: string[]): string[] {
  return consoleErrors.filter(err => 
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
}

async function runTests(): Promise<number> {
  const results: TestResult[] = [];
  const screenshots: string[] = [];
  
  console.log('🚀 Starting E2E Tests for Page Navigation and Core Flows...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // ========================================
    // Test Suite 1: Core Page Loading
    // ========================================
    console.log('📋 Test Suite 1: Core Page Loading\n');

    for (const pageInfo of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      console.log('  Test 1.' + (PAGES.indexOf(pageInfo) + 1) + ': ' + pageInfo.name + ' page loads');
      
      const startTime = Date.now();
      try {
        await page.goto(BASE_URL + pageInfo.path, { waitUntil: 'networkidle0', timeout: TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));
        const loadTime = Date.now() - startTime;

        // Verify page content exists
        const bodyText = await page.evaluate(() => document.body.innerText);
        const foundContent = pageInfo.expectedContent.filter(content => bodyText.includes(content));
        const missingContent = pageInfo.expectedContent.filter(content => !bodyText.includes(content));

        // Check for critical JS errors (not network errors)
        const criticalErrors = getCriticalErrors(consoleErrors);

        // Page is considered loaded if at least one expected content is found and no critical JS errors
        const passed = foundContent.length > 0 && criticalErrors.length === 0;
        
        results.push({
          name: pageInfo.name + ' Page Load',
          passed,
          details: passed 
            ? 'Loaded in ' + loadTime + 'ms, found: ' + foundContent.join(', ')
            : (missingContent.length > 0 ? 'Missing: ' + missingContent.join(', ') : 'JS errors: ' + criticalErrors.length),
          duration: loadTime,
        });

        console.log(passed 
          ? '    ✅ ' + pageInfo.name + ' loaded in ' + loadTime + 'ms\n' 
          : '    ❌ ' + pageInfo.name + ' failed\n');

        // Take screenshot
        const screenshotName = 'e2e-nav-' + pageInfo.name.toLowerCase() + '.png';
        await page.screenshot({ path: 'midscene_run/' + screenshotName, fullPage: true });
        screenshots.push(screenshotName);

      } catch (error) {
        results.push({
          name: pageInfo.name + ' Page Load',
          passed: false,
          details: 'Failed to load: ' + (error instanceof Error ? error.message : String(error)),
        });
        console.log('    ❌ ' + pageInfo.name + ' failed to load\n');
      }

      await page.close();
    }

    // ========================================
    // Test Suite 2: URL Navigation
    // ========================================
    console.log('📋 Test Suite 2: URL Navigation\n');

    const navPage = await browser.newPage();
    await navPage.setViewport({ width: 1280, height: 800 });

    const navErrors: string[] = [];
    navPage.on('console', msg => {
      if (msg.type() === 'error') {
        navErrors.push(msg.text());
      }
    });

    // Test direct URL navigation
    const navigationTests = [
      { from: '/', to: '/dashboard', name: 'Home → Dashboard' },
      { from: '/dashboard', to: '/trades', name: 'Dashboard → Trades' },
      { from: '/trades', to: '/holdings', name: 'Trades → Holdings' },
      { from: '/holdings', to: '/leaderboard', name: 'Holdings → Leaderboard' },
      { from: '/leaderboard', to: '/', name: 'Leaderboard → Home' },
    ];

    for (const navTest of navigationTests) {
      console.log('  Test 2.' + (navigationTests.indexOf(navTest) + 1) + ': ' + navTest.name);
      
      const startTime = Date.now();
      
      try {
        await navPage.goto(BASE_URL + navTest.to, { waitUntil: 'networkidle0', timeout: TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const currentUrl = navPage.url();
        const expectedUrl = BASE_URL + navTest.to;
        const onCorrectPage = currentUrl === expectedUrl || currentUrl.startsWith(expectedUrl);
        
        results.push({
          name: 'Navigate ' + navTest.name,
          passed: onCorrectPage,
          details: onCorrectPage ? 'Navigation successful' : 'URL is ' + currentUrl,
          duration: Date.now() - startTime,
        });
        
        console.log(onCorrectPage ? '    ✅ Navigation successful\n' : '    ❌ Navigation failed\n');
      } catch (error) {
        results.push({
          name: 'Navigate ' + navTest.name,
          passed: false,
          details: 'Error: ' + (error instanceof Error ? error.message : String(error)),
        });
        console.log('    ❌ Navigation error\n');
      }
    }

    await navPage.screenshot({ path: 'midscene_run/e2e-nav-flow.png', fullPage: true });
    screenshots.push('e2e-nav-flow.png');
    await navPage.close();

    // ========================================
    // Test Suite 3: Page Elements
    // ========================================
    console.log('📋 Test Suite 3: Core UI Elements\n');

    const uiPage = await browser.newPage();
    await uiPage.setViewport({ width: 1280, height: 800 });

    await uiPage.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_LOAD));

    // Test for essential UI elements
    console.log('  Test 3.1: Header and branding');
    const headerCheck = await uiPage.evaluate(() => {
      const h1 = document.querySelector('h1, h2');
      const logo = document.body.innerText.includes('AlphaArena');
      return {
        hasTitle: !!h1,
        hasBranding: logo,
      };
    });

    results.push({
      name: 'Header and Branding',
      passed: headerCheck.hasBranding,
      details: headerCheck.hasBranding ? 'Branding present' : 'No branding found',
    });
    console.log(headerCheck.hasBranding ? '    ✅ Branding present\n' : '    ❌ No branding\n');

    // Test for sidebar
    console.log('  Test 3.2: Sidebar layout');
    const sidebarCheck = await uiPage.evaluate(() => {
      const sider = document.querySelector('.arco-layout-sider');
      const menu = document.querySelector('.arco-menu');
      return {
        hasSidebar: !!sider,
        hasMenu: !!menu,
        sidebarWidth: (sider as HTMLElement)?.offsetWidth || 0,
      };
    });

    results.push({
      name: 'Sidebar Layout',
      passed: sidebarCheck.hasSidebar,
      details: sidebarCheck.hasSidebar 
        ? 'Sidebar width: ' + sidebarCheck.sidebarWidth + 'px' 
        : 'No sidebar found',
    });
    console.log(sidebarCheck.hasSidebar ? '    ✅ Sidebar present\n' : '    ❌ No sidebar\n');

    // Test for main content area
    console.log('  Test 3.3: Main content area');
    const contentCheck = await uiPage.evaluate(() => {
      const content = document.querySelector('.arco-layout-content, main, .content');
      const cards = document.querySelectorAll('.arco-card').length;
      const tables = document.querySelectorAll('.arco-table, table').length;
      return {
        hasContent: !!content,
        cards: cards,
        tables: tables,
      };
    });

    results.push({
      name: 'Main Content Area',
      passed: contentCheck.hasContent,
      details: contentCheck.hasContent 
        ? 'Cards: ' + contentCheck.cards + ', Tables: ' + contentCheck.tables
        : 'No content area',
    });
    console.log(contentCheck.hasContent ? '    ✅ Content area present\n' : '    ❌ No content\n');

    await uiPage.screenshot({ path: 'midscene_run/e2e-ui-elements.png', fullPage: true });
    screenshots.push('e2e-ui-elements.png');
    await uiPage.close();

    // ========================================
    // Test Suite 4: Error Handling
    // ========================================
    console.log('📋 Test Suite 4: Error Handling\n');

    const errorPage = await browser.newPage();
    await errorPage.setViewport({ width: 1280, height: 800 });

    // Test invalid route
    console.log('  Test 4.1: Invalid route handling');
    try {
      await errorPage.goto(BASE_URL + '/nonexistent-page-xyz', { waitUntil: 'networkidle0', timeout: TIMEOUT });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check that app didn't crash
      const bodyText = await errorPage.evaluate(() => document.body.innerText);
      const appLoaded = bodyText.includes('AlphaArena') || bodyText.length > 100;

      results.push({
        name: 'Invalid Route Handling',
        passed: appLoaded,
        details: appLoaded ? 'App handled invalid route gracefully' : 'App may have crashed',
      });
      console.log(appLoaded ? '    ✅ Invalid route handled\n' : '    ❌ App crashed\n');
    } catch (error) {
      results.push({
        name: 'Invalid Route Handling',
        passed: false,
        details: 'Error: ' + (error instanceof Error ? error.message : String(error)),
      });
      console.log('    ❌ Error loading invalid route\n');
    }

    await errorPage.screenshot({ path: 'midscene_run/e2e-error-handling.png', fullPage: true });
    screenshots.push('e2e-error-handling.png');
    await errorPage.close();

    // ========================================
    // Test Suite 5: Performance
    // ========================================
    console.log('📋 Test Suite 5: Performance\n');

    const perfPage = await browser.newPage();
    await perfPage.setViewport({ width: 1280, height: 800 });

    console.log('  Test 5.1: Page load time');
    const perfStart = Date.now();
    await perfPage.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    const perfLoadTime = Date.now() - perfStart;

    results.push({
      name: 'Page Load Performance',
      passed: perfLoadTime < 10000, // Should load within 10 seconds
      details: 'Loaded in ' + perfLoadTime + 'ms',
      duration: perfLoadTime,
    });
    console.log(perfLoadTime < 10000 
      ? '    ✅ Page loaded in ' + perfLoadTime + 'ms\n' 
      : '    ❌ Slow load: ' + perfLoadTime + 'ms\n');

    await perfPage.close();

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
  console.log('E2E TEST SUMMARY: PAGE NAVIGATION AND CORE FLOWS (Issue #183)');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('\nTotal Tests: ' + total);
  console.log('Passed: ' + passed);
  console.log('Failed: ' + (total - passed));
  console.log('Success Rate: ' + ((passed / total) * 100).toFixed(1) + '%');

  console.log('\nDetailed Results:');
  results.forEach((r, i) => {
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
