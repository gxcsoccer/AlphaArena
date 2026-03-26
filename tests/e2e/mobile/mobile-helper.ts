/**
 * Mobile E2E Test Helper
 * 
 * Provides device emulation configurations and helpers for mobile E2E testing.
 * Uses Puppeteer's device descriptors for accurate mobile device simulation.
 */

import puppeteer from 'puppeteer';
import { setupAuth, TEST_USER, TEST_ACCESS_TOKEN, TEST_REFRESH_TOKEN } from '../auth-helper';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// Helper to build URL with lang parameter
export const buildUrl = (path: string): string => {
  const separator = path.includes('?') ? '&' : '?';
  return BASE_URL + path + separator + 'lang=en-US';
};

// Mobile device configurations
// Using Puppeteer's known devices plus custom configurations
export const MOBILE_DEVICES = {
  // iPhone devices
  iPhone12: {
    name: 'iPhone 12',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  iPhone12Pro: {
    name: 'iPhone 12 Pro',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  iPhoneSE: {
    name: 'iPhone SE',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  iPhone14ProMax: {
    name: 'iPhone 14 Pro Max',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  
  // iPad devices
  iPadPro: {
    name: 'iPad Pro',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  iPadMini: {
    name: 'iPad Mini',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  
  // Android devices
  pixel5: {
    name: 'Pixel 5',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  galaxyS21: {
    name: 'Galaxy S21',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Mobile Safari/537.36',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  galaxyFold: {
    name: 'Galaxy Fold',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-F916B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Mobile Safari/537.36',
    viewport: { width: 280, height: 653 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
};

// Default device for quick tests
export const DEFAULT_MOBILE_DEVICE = MOBILE_DEVICES.iPhone12;

// Touch gesture simulation helpers
export interface TouchPoint {
  x: number;
  y: number;
}

/**
 * Simulates a tap on the page
 */
export async function simulateTap(page: any, x: number, y: number): Promise<void> {
  await page.touchscreen.tap(x, y);
}

/**
 * Simulates a swipe gesture
 */
export async function simulateSwipe(
  page: any,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  duration: number = 300
): Promise<void> {
  const steps = 10;
  const stepDuration = duration / steps;
  
  await page.touchscreen.tap(startX, startY);
  
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    
    await page.touchscreen.tap(currentX, currentY);
    await new Promise(resolve => setTimeout(resolve, stepDuration));
  }
}

/**
 * Simulates a pinch zoom gesture
 */
export async function simulatePinchZoom(
  page: any,
  centerX: number,
  centerY: number,
  startDistance: number,
  endDistance: number,
  duration: number = 300
): Promise<void> {
  const steps = 10;
  const stepDuration = duration / steps;
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const currentDistance = startDistance + (endDistance - startDistance) * progress;
    
    // Calculate two finger positions
    const finger1X = centerX - currentDistance / 2;
    const finger2X = centerX + currentDistance / 2;
    
    // Touch with two fingers
    await page.touchscreen.tap(finger1X, centerY);
    await page.touchscreen.tap(finger2X, centerY);
    await new Promise(resolve => setTimeout(resolve, stepDuration));
  }
}

/**
 * Creates a new mobile page with authentication
 */
export async function newMobilePage(
  browser: any,
  device: typeof DEFAULT_MOBILE_DEVICE = DEFAULT_MOBILE_DEVICE
): Promise<any> {
  const page = await browser.newPage();
  
  // Set up device emulation
  await page.setUserAgent(device.userAgent);
  await page.setViewport(device.viewport);
  
  // Emulate mobile device features
  await page.emulate({
    viewport: device.viewport,
    userAgent: device.userAgent,
  });
  
  // Inject authentication before navigation
  await page.evaluateOnNewDocument(() => {
    const testUser = {
      id: 'test-user-e2e-mobile',
      email: 'e2e-mobile-test@example.com',
      username: 'e2e_mobile_tester',
      email_verified: true,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    const accessToken = 'e2e-mobile-test-access-token-mock-' + Date.now();
    const refreshToken = 'e2e-mobile-test-refresh-token-mock-' + Date.now();
    
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(testUser));
    localStorage.setItem('e2e_skip_token_refresh', 'true');
  });
  
  return page;
}

/**
 * Creates a new page with authentication for desktop (comparison testing)
 */
export async function newDesktopPage(browser: any): Promise<any> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.evaluateOnNewDocument(() => {
    const testUser = {
      id: 'test-user-e2e-desktop',
      email: 'e2e-desktop-test@example.com',
      username: 'e2e_desktop_tester',
      email_verified: true,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    const accessToken = 'e2e-desktop-test-access-token-mock-' + Date.now();
    const refreshToken = 'e2e-desktop-test-refresh-token-mock-' + Date.now();
    
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(testUser));
    localStorage.setItem('e2e_skip_token_refresh', 'true');
  });
  
  return page;
}

/**
 * Scrolls the page by a specified amount
 */
export async function scrollPage(page: any, x: number, y: number): Promise<void> {
  await page.evaluate((scrollX: number, scrollY: number) => {
    window.scrollBy(scrollX, scrollY);
  }, x, y);
}

/**
 * Gets the current scroll position
 */
export async function getScrollPosition(page: any): Promise<{ x: number; y: number }> {
  return await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
}

/**
 * Waits for element to be visible in viewport
 */
export async function waitForElementInViewport(
  page: any,
  selector: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.waitForFunction(
      (sel: string) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
      },
      { timeout },
      selector
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if mobile layout is active
 */
export async function isMobileLayout(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    // Check if mobile-specific elements are visible
    const mobileNav = document.querySelector('[data-testid="mobile-nav"], .mobile-bottom-nav, .arco-layout-sider-collapsed');
    const viewport = window.innerWidth;
    return viewport <= 768 || !!mobileNav;
  });
}

/**
 * Checks if touch is supported
 */
export async function isTouchSupported(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });
}

/**
 * Gets element bounds
 */
export async function getElementBounds(
  page: any,
  selector: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return await page.evaluate((sel: string) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }, selector);
}

/**
 * Helper to dismiss any mobile modals or overlays
 */
export async function dismissMobileOverlays(page: any): Promise<void> {
  await page.evaluate(() => {
    // Click on any overlay backgrounds
    const overlays = document.querySelectorAll('.arco-modal-mask, .arco-drawer-mask');
    overlays.forEach((overlay: Element) => {
      (overlay as HTMLElement).click();
    });
    
    // Press escape to close any open modals
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  
  await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Test timeout constants
 */
export const TIMEOUTS = {
  PAGE_LOAD: 30000,
  WAIT_AFTER_LOAD: 5000,
  INTERACTION: 1000,
  ANIMATION: 300,
  CHART_RENDER: 3000,
};

/**
 * Helper to get critical errors from console messages
 */
export function getCriticalErrors(consoleErrors: string[]): string[] {
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
    !err.includes('[KLineChart]') &&
    !err.includes('[Leaderboard]') &&
    !err.includes('[Holdings]') &&
    !err.includes('[RealtimeClient]') &&
    !err.includes('ChunkLoadError') &&
    !err.includes('Loading chunk') &&
    !err.includes('Unhandled Promise Rejection') &&
    !err.includes('Failed to load resource') &&
    !err.includes('status of 500') &&
    !err.includes('<path> attribute d:')
  );
}

export interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}