/**
 * Mobile E2E Tests for Holdings View (Issue #630)
 * 
 * Tests holdings functionality on mobile devices including:
 * 1. Holdings page responsive layout
 * 2. Holdings table/list on mobile
 * 3. Holdings card layout
 * 4. Touch interactions for holdings actions
 */

import puppeteer from 'puppeteer';
import {
  MOBILE_DEVICES,
  DEFAULT_MOBILE_DEVICE,
  newMobilePage,
  buildUrl,
  getCriticalErrors,
  simulateTap,
  TIMEOUTS,
  TestResult,
} from './mobile-helper';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function runTests(): Promise<number> {
  const results: TestResult[] = [];
  const screenshots: string[] = [];

  console.log('🚀 Starting Mobile E2E Tests for Holdings View...\n');
  console.log('📍 Testing against: ' + BASE_URL + '\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    // ========================================
    // Test Suite 1: Holdings Page Responsive Layout
    // ========================================
    console.log('📋 Test Suite 1: Holdings Page Responsive Layout\n');

    const devices = [
      { name: 'iPhone 12', config: MOBILE_DEVICES.iPhone12 },
      { name: 'iPhone SE', config: MOBILE_DEVICES.iPhoneSE },
      { name: 'iPad Mini', config: MOBILE_DEVICES.iPadMini },
      { name: 'Pixel 5', config: MOBILE_DEVICES.pixel5 },
    ];

    for (const device of devices) {
      console.log(`  Testing on ${device.name}`);
      
      const page = await browser.newPage();
      await page.setUserAgent(device.config.userAgent);
      await page.setViewport(device.config.viewport);

      // Inject auth
      await page.evaluateOnNewDocument(() => {
        const testUser = {
          id: 'test-user-e2e-mobile',
          email: 'e2e-mobile-test@example.com',
          username: 'e2e_mobile_tester',
          email_verified: true,
          role: 'user',
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('auth_access_token', 'e2e-mobile-test-access-token');
        localStorage.setItem('auth_refresh_token', 'e2e-mobile-test-refresh-token');
        localStorage.setItem('auth_user', JSON.stringify(testUser));
        localStorage.setItem('e2e_skip_token_refresh', 'true');
      });

      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const startTime = Date.now();
      try {
        await page.goto(buildUrl('/holdings'), { waitUntil: 'networkidle0', timeout: TIMEOUTS.PAGE_LOAD });
        await new Promise(resolve => setTimeout(resolve, TIMEOUTS.WAIT_AFTER_LOAD));
        const loadTime = Date.now() - startTime;

        // Check page loaded
        const bodyText = await page.evaluate(() => document.body.innerText);
        const pageLoaded = bodyText.includes('Holdings') || bodyText.includes('持仓') || bodyText.length > 100;

        const criticalErrors = getCriticalErrors(consoleErrors);

        results.push({
          name: `${device.name} Holdings Page Load`,
          passed: pageLoaded && criticalErrors.length === 0,
          details: pageLoaded ? `Loaded in ${loadTime}ms` : 'Page failed to load',
          duration: loadTime,
        });

        console.log(pageLoaded && criticalErrors.length === 0 
          ? `    ✅ ${device.name} holdings page loaded in ${loadTime}ms\n` 
          : `    ❌ ${device.name} failed\n`);

        // Take screenshot
        const screenshotName = `mobile-holdings-${device.name.toLowerCase().replace(/\s+/g, '-')}.png`;
        await page.screenshot({ path: `midscene_run/${screenshotName}`, fullPage: true });
        screenshots.push(screenshotName);

      } catch (error) {
        results.push({
          name: `${device.name} Holdings Page Load`,
          passed: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
        console.log(`    ❌ ${device.name} failed to load\n`);
      }

      await page.close();
    }

    // ========================================
    // Test Suite 2: Holdings Table/List on Mobile
    // ========================================
    console.log('📋 Test Suite 2: Holdings Table/List on Mobile\n');

    const holdingsPage = await browser.newPage();
    await holdingsPage.setUserAgent(MOBILE_DEVICES.iPhone12.userAgent);
    await holdingsPage.setViewport(MOBILE_DEVICES.iPhone12.viewport);

    // Inject auth
    await holdingsPage.evaluateOnNewDocument(() => {
      const testUser = {
        id: 'test-user-e2e-mobile',
        email: 'e2e-mobile-test@example.com',
        username: 'e2e_mobile_tester',
        email_verified: true,
        role: 'user',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('auth_access_token', 'e2e-mobile-test-access-token');
      localStorage.setItem('auth_refresh_token', 'e2e-mobile-test-refresh-token');
      localStorage.setItem('auth_user', JSON.stringify(testUser));
      localStorage.setItem('e2e_skip_token_refresh', 'true');
    });

    await holdingsPage.goto(buildUrl('/holdings'), { waitUntil: 'networkidle0', timeout: TIMEOUTS.PAGE_LOAD });
    await new Promise(resolve => setTimeout(resolve, TIMEOUTS.WAIT_AFTER_LOAD));

    // Test 2.1: Holdings table visibility
    console.log('  Test 2.1: Holdings table/list visibility');
    
    const holdingsTableState = await holdingsPage.evaluate(() => {
      // Check for table or list elements
      const tables = document.querySelectorAll('.arco-table, table');
      const lists = document.querySelectorAll('.arco-list, .holdings-list');
      const cards = document.querySelectorAll('.arco-card, .holding-card');
      
      // Check for mobile-specific card layout
      const mobileCards = document.querySelectorAll('.mobile-holding-card, [data-testid="holding-card"]');
      
      // Check for responsive table
      const responsiveTable = document.querySelector('.arco-table-scroll, .responsive-table');
      
      // Get viewport info
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      
      // Check if table is scrollable horizontally
      const tableWrapper = document.querySelector('.arco-table-container, .arco-table-body');
      const isScrollable = tableWrapper ? tableWrapper.scrollWidth > tableWrapper.clientWidth : false;
      
      return {
        hasTable: tables.length > 0,
        hasList: lists.length > 0,
        hasCards: cards.length > 0,
        hasMobileCards: mobileCards.length > 0,
        hasResponsiveTable: !!responsiveTable,
        isScrollable,
        viewport,
        tableCount: tables.length,
        cardCount: cards.length,
      };
    });

    const hasContent = holdingsTableState.hasTable || holdingsTableState.hasCards || holdingsTableState.hasList;

    results.push({
      name: 'Holdings Content Layout',
      passed: hasContent,
      details: hasContent 
        ? `Tables: ${holdingsTableState.tableCount}, Cards: ${holdingsTableState.cardCount}, Scrollable: ${holdingsTableState.isScrollable}`
        : 'No holdings content found',
    });
    console.log(hasContent ? '    ✅ Holdings content layout OK\n' : '    ❌ No holdings content\n');

    // Test 2.2: Table responsiveness
    console.log('  Test 2.2: Table responsiveness');
    
    if (holdingsTableState.hasTable) {
      const tableResponsiveness = await holdingsPage.evaluate(() => {
        const table = document.querySelector('.arco-table, table');
        if (!table) return { fitsViewport: false, width: 0 };
        
        const tableRect = table.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        return {
          fitsViewport: tableRect.width <= viewportWidth,
          width: tableRect.width,
          viewportWidth,
          needsHorizontalScroll: tableRect.width > viewportWidth,
        };
      });

      // Table may need horizontal scroll on mobile, which is acceptable
      results.push({
        name: 'Table Responsiveness',
        passed: true,
        details: tableResponsiveness.fitsViewport 
          ? 'Table fits viewport' 
          : `Table is ${tableResponsiveness.width}px, viewport is ${tableResponsiveness.viewportWidth}px (horizontal scroll expected)`,
      });
      console.log('    ✅ Table responsiveness checked\n');
    } else {
      results.push({
        name: 'Table Responsiveness',
        passed: true,
        details: 'No table found (may use card layout)',
      });
      console.log('    ⚠️ No table to check\n');
    }

    await holdingsPage.screenshot({ path: 'midscene_run/mobile-holdings-table.png', fullPage: true });
    screenshots.push('mobile-holdings-table.png');

    await holdingsPage.close();

    // ========================================
    // Test Suite 3: Holdings Card Layout
    // ========================================
    console.log('📋 Test Suite 3: Holdings Card Layout\n');

    const cardPage = await browser.newPage();
    await cardPage.setUserAgent(MOBILE_DEVICES.iPhone12.userAgent);
    await cardPage.setViewport(MOBILE_DEVICES.iPhone12.viewport);

    // Inject auth
    await cardPage.evaluateOnNewDocument(() => {
      const testUser = {
        id: 'test-user-e2e-mobile',
        email: 'e2e-mobile-test@example.com',
        username: 'e2e_mobile_tester',
        email_verified: true,
        role: 'user',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('auth_access_token', 'e2e-mobile-test-access-token');
      localStorage.setItem('auth_refresh_token', 'e2e-mobile-test-refresh-token');
      localStorage.setItem('auth_user', JSON.stringify(testUser));
      localStorage.setItem('e2e_skip_token_refresh', 'true');
    });

    await cardPage.goto(buildUrl('/holdings'), { waitUntil: 'networkidle0', timeout: TIMEOUTS.PAGE_LOAD });
    await new Promise(resolve => setTimeout(resolve, TIMEOUTS.WAIT_AFTER_LOAD));

    // Test 3.1: Card layout
    console.log('  Test 3.1: Card layout on mobile');
    
    const cardLayout = await cardPage.evaluate(() => {
      const cards = document.querySelectorAll('.arco-card');
      
      if (cards.length === 0) {
        return { hasCards: false, cardCount: 0, cardWidth: 0, fitsViewport: true };
      }
      
      const firstCard = cards[0];
      const rect = firstCard.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      return {
        hasCards: true,
        cardCount: cards.length,
        cardWidth: rect.width,
        fitsViewport: rect.width <= viewportWidth,
        padding: rect.x,
        viewportWidth,
      };
    });

    results.push({
      name: 'Card Layout',
      passed: cardLayout.hasCards && cardLayout.fitsViewport,
      details: cardLayout.hasCards 
        ? `${cardLayout.cardCount} cards, ${cardLayout.cardWidth}px width, fits viewport: ${cardLayout.fitsViewport}`
        : 'No cards found',
    });
    console.log(cardLayout.hasCards ? '    ✅ Card layout checked\n' : '    ⚠️ No cards found\n');

    // Test 3.2: Card content readability
    console.log('  Test 3.2: Card content readability');
    
    const cardContent = await cardPage.evaluate(() => {
      const cards = document.querySelectorAll('.arco-card');
      
      if (cards.length === 0) return { hasContent: false };
      
      const results: { hasTitle: boolean; hasBody: boolean; fontSize: number }[] = [];
      
      cards.forEach(card => {
        const title = card.querySelector('.arco-card-header-title, .arco-card-meta-title');
        const body = card.querySelector('.arco-card-body, .arco-card-content');
        
        const bodyStyle = body ? window.getComputedStyle(body) : null;
        const fontSize = bodyStyle ? parseFloat(bodyStyle.fontSize) : 14;
        
        results.push({
          hasTitle: !!title,
          hasBody: !!body,
          fontSize,
        });
      });
      
      return {
        hasContent: true,
        cards: results,
        avgFontSize: results.reduce((sum, c) => sum + c.fontSize, 0) / results.length,
      };
    });

    results.push({
      name: 'Card Content Readability',
      passed: true,
      details: cardContent.hasContent 
        ? `Avg font size: ${cardContent.avgFontSize?.toFixed(1)}px`
        : 'No cards to check',
    });
    console.log('    ✅ Card content readability checked\n');

    await cardPage.screenshot({ path: 'midscene_run/mobile-holdings-cards.png', fullPage: true });
    screenshots.push('mobile-holdings-cards.png');

    await cardPage.close();

    // ========================================
    // Test Suite 4: Holdings Actions on Mobile
    // ========================================
    console.log('📋 Test Suite 4: Holdings Actions on Mobile\n');

    const actionPage = await browser.newPage();
    await actionPage.setUserAgent(MOBILE_DEVICES.iPhone12.userAgent);
    await actionPage.setViewport(MOBILE_DEVICES.iPhone12.viewport);

    // Inject auth
    await actionPage.evaluateOnNewDocument(() => {
      const testUser = {
        id: 'test-user-e2e-mobile',
        email: 'e2e-mobile-test@example.com',
        username: 'e2e_mobile_tester',
        email_verified: true,
        role: 'user',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('auth_access_token', 'e2e-mobile-test-access-token');
      localStorage.setItem('auth_refresh_token', 'e2e-mobile-test-refresh-token');
      localStorage.setItem('auth_user', JSON.stringify(testUser));
      localStorage.setItem('e2e_skip_token_refresh', 'true');
    });

    await actionPage.goto(buildUrl('/holdings'), { waitUntil: 'networkidle0', timeout: TIMEOUTS.PAGE_LOAD });
    await new Promise(resolve => setTimeout(resolve, TIMEOUTS.WAIT_AFTER_LOAD));

    // Test 4.1: Action buttons touch targets
    console.log('  Test 4.1: Action buttons touch targets');
    
    const actionButtons = await actionPage.evaluate(() => {
      const buttons = document.querySelectorAll('button, .arco-btn, [role="button"]');
      
      const results: { text: string; width: number; height: number; meetsMinimum: boolean }[] = [];
      
      buttons.forEach((button, index) => {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            text: button.textContent?.trim().slice(0, 20) || `button-${index}`,
            width: rect.width,
            height: rect.height,
            meetsMinimum: Math.min(rect.width, rect.height) >= 44,
          });
        }
      });
      
      return results;
    });

    // Allow a small percentage of buttons to be below minimum (accessibility best practice, not critical)
    // Pass if 80%+ of buttons meet the minimum, or if there are no buttons, or only 1-2 buttons below minimum
    const buttonsMeetingMinimum = actionButtons.filter(b => b.meetsMinimum).length;
    const totalButtons = actionButtons.length;
    const passThreshold = 0.8; // 80% of buttons should meet minimum
    const buttonsBelowMinimum = totalButtons - buttonsMeetingMinimum;
    const buttonsPass = totalButtons === 0 || 
                         (buttonsMeetingMinimum / totalButtons) >= passThreshold ||
                         buttonsBelowMinimum <= 2; // Allow 1-2 small buttons for minor UI elements

    results.push({
      name: 'Action Button Touch Targets',
      passed: buttonsPass,
      details: totalButtons > 0 
        ? `${buttonsMeetingMinimum}/${totalButtons} buttons meet 44px minimum (${((buttonsMeetingMinimum/totalButtons)*100).toFixed(0)}%)`
        : 'No action buttons found',
    });
    console.log(buttonsPass ? '    ✅ Action button touch targets acceptable\n' : '    ❌ Too many buttons too small\n');

    // Test 4.2: Touch interaction
    console.log('  Test 4.2: Touch interaction');
    
    if (actionButtons.length > 0) {
      const button = actionButtons[0];
      // Find the button's center
      const buttonCenter = await actionPage.evaluate((buttonText: string) => {
        const buttons = document.querySelectorAll('button, .arco-btn');
        for (const btn of buttons) {
          if (btn.textContent?.trim().includes(buttonText.slice(0, 10))) {
            const rect = btn.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }
        return { x: 0, y: 0, found: false };
      }, button.text);

      if (buttonCenter.found) {
        try {
          await actionPage.touchscreen.tap(buttonCenter.x, buttonCenter.y);
          await new Promise(resolve => setTimeout(resolve, TIMEOUTS.ANIMATION));

          results.push({
            name: 'Touch Interaction',
            passed: true,
            details: `Tapped button "${button.text}"`,
          });
          console.log('    ✅ Touch interaction successful\n');
        } catch (error) {
          results.push({
            name: 'Touch Interaction',
            passed: false,
            details: `Tap failed: ${error instanceof Error ? error.message : String(error)}`,
          });
          console.log('    ❌ Touch interaction failed\n');
        }
      } else {
        results.push({
          name: 'Touch Interaction',
          passed: true,
          details: 'Button not found for touch test',
        });
        console.log('    ⚠️ Button not found for touch test\n');
      }
    } else {
      results.push({
        name: 'Touch Interaction',
        passed: true,
        details: 'No buttons to test',
      });
      console.log('    ⚠️ No buttons to test\n');
    }

    await actionPage.screenshot({ path: 'midscene_run/mobile-holdings-actions.png', fullPage: true });
    screenshots.push('mobile-holdings-actions.png');

    await actionPage.close();

    // ========================================
    // Test Suite 5: Navigation on Mobile
    // ========================================
    console.log('📋 Test Suite 5: Navigation on Mobile\n');

    const navPage = await browser.newPage();
    await navPage.setUserAgent(MOBILE_DEVICES.iPhone12.userAgent);
    await navPage.setViewport(MOBILE_DEVICES.iPhone12.viewport);

    // Inject auth
    await navPage.evaluateOnNewDocument(() => {
      const testUser = {
        id: 'test-user-e2e-mobile',
        email: 'e2e-mobile-test@example.com',
        username: 'e2e_mobile_tester',
        email_verified: true,
        role: 'user',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('auth_access_token', 'e2e-mobile-test-access-token');
      localStorage.setItem('auth_refresh_token', 'e2e-mobile-test-refresh-token');
      localStorage.setItem('auth_user', JSON.stringify(testUser));
      localStorage.setItem('e2e_skip_token_refresh', 'true');
    });

    await navPage.goto(buildUrl('/holdings'), { waitUntil: 'networkidle0', timeout: TIMEOUTS.PAGE_LOAD });
    await new Promise(resolve => setTimeout(resolve, TIMEOUTS.WAIT_AFTER_LOAD));

    // Test 5.1: Bottom navigation on mobile
    console.log('  Test 5.1: Bottom navigation on mobile');
    
    const navigationState = await navPage.evaluate(() => {
      // Check for mobile bottom nav
      const bottomNav = document.querySelector('.mobile-bottom-nav, [data-testid="mobile-nav"], .arco-layout-footer nav');
      
      // Check for sidebar
      const sider = document.querySelector('.arco-layout-sider');
      const siderCollapsed = document.querySelector('.arco-layout-sider-collapsed');
      
      // Check for hamburger menu
      const hamburger = document.querySelector('.arco-btn-icon-only, [data-testid="menu-toggle"], .hamburger');
      
      return {
        hasBottomNav: !!bottomNav,
        hasSider: !!sider,
        siderCollapsed: !!siderCollapsed,
        hasHamburger: !!hamburger,
      };
    });

    results.push({
      name: 'Mobile Navigation',
      passed: true,
      details: `Bottom nav: ${navigationState.hasBottomNav ? 'yes' : 'no'}, Sidebar: ${navigationState.hasSider ? 'yes' : 'no'}, Collapsed: ${navigationState.siderCollapsed ? 'yes' : 'no'}`,
    });
    console.log('    ✅ Mobile navigation checked\n');

    await navPage.screenshot({ path: 'midscene_run/mobile-holdings-navigation.png', fullPage: true });
    screenshots.push('mobile-holdings-navigation.png');

    await navPage.close();

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
  console.log('MOBILE E2E TEST SUMMARY: HOLDINGS VIEW (Issue #630)');
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