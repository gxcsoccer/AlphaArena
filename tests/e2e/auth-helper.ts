/**
 * E2E Test Authentication Helper
 * 
 * Mocks authentication state for E2E tests by injecting tokens into localStorage.
 * This allows tests to access authenticated-only features like Dashboard, Trades, etc.
 */

// Test user data (mock user for E2E tests)
export const TEST_USER = {
  id: 'test-user-e2e',
  email: 'e2e-test@example.com',
  username: 'e2e_tester',
  email_verified: true,
  role: 'user',
  created_at: new Date().toISOString(),
};

// Mock tokens (these don't need to be real, just present for UI state)
export const TEST_ACCESS_TOKEN = 'e2e-test-access-token-mock-' + Date.now();
export const TEST_REFRESH_TOKEN = 'e2e-test-refresh-token-mock-' + Date.now();

// Storage keys (must match useAuth.tsx)
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';
const SKIP_REFRESH_KEY = 'e2e_skip_token_refresh'; // Flag to skip token validation

/**
 * Script to inject into page before navigation
 * This sets up the authentication state in localStorage
 */
export const AUTH_INJECTION_SCRIPT = `
  (function() {
    const testUser = ${JSON.stringify(TEST_USER)};
    const accessToken = '${TEST_ACCESS_TOKEN}';
    const refreshToken = '${TEST_REFRESH_TOKEN}';
    
    localStorage.setItem('${ACCESS_TOKEN_KEY}', accessToken);
    localStorage.setItem('${REFRESH_TOKEN_KEY}', refreshToken);
    localStorage.setItem('${USER_KEY}', JSON.stringify(testUser));
    localStorage.setItem('${SKIP_REFRESH_KEY}', 'true');
    
    console.log('[E2E Auth] Mock authentication injected');
    console.log('[E2E Auth] User:', testUser.email);
  })();
`;

/**
 * Script to clear authentication state
 */
export const CLEAR_AUTH_SCRIPT = `
  (function() {
    localStorage.removeItem('${ACCESS_TOKEN_KEY}');
    localStorage.removeItem('${REFRESH_TOKEN_KEY}');
    localStorage.removeItem('${USER_KEY}');
    localStorage.removeItem('${SKIP_REFRESH_KEY}');
    console.log('[E2E Auth] Authentication cleared');
  })();
`;

/**
 * Helper to check if page has authentication state
 */
export const AUTH_CHECK_SCRIPT = `
  (function() {
    return {
      hasAccessToken: !!localStorage.getItem('${ACCESS_TOKEN_KEY}'),
      hasRefreshToken: !!localStorage.getItem('${REFRESH_TOKEN_KEY}'),
      hasUser: !!localStorage.getItem('${USER_KEY}'),
      skipRefresh: !!localStorage.getItem('${SKIP_REFRESH_KEY}'),
      user: JSON.parse(localStorage.getItem('${USER_KEY}') || 'null')
    };
  })();
`;

/**
 * Setup authentication for a Puppeteer page
 * Call this before navigating to authenticated pages
 */
export async function setupAuth(page: any): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    const testUser = {
      id: 'test-user-e2e',
      email: 'e2e-test@example.com',
      username: 'e2e_tester',
      email_verified: true,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    const accessToken = 'e2e-test-access-token-mock-' + Date.now();
    const refreshToken = 'e2e-test-refresh-token-mock-' + Date.now();
    
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(testUser));
    localStorage.setItem('e2e_skip_token_refresh', 'true');
  });
}

/**
 * Clear authentication from a Puppeteer page
 */
export async function clearAuth(page: any): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('e2e_skip_token_refresh');
  });
}

/**
 * Verify authentication state on page
 */
export async function verifyAuth(page: any): Promise<{
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasUser: boolean;
  skipRefresh: boolean;
  user: any;
}> {
  return await page.evaluate(() => {
    return {
      hasAccessToken: !!localStorage.getItem('auth_access_token'),
      hasRefreshToken: !!localStorage.getItem('auth_refresh_token'),
      hasUser: !!localStorage.getItem('auth_user'),
      skipRefresh: !!localStorage.getItem('e2e_skip_token_refresh'),
      user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
    };
  });
}

/**
 * Create a new page with authentication already set up
 */
export async function newAuthenticatedPage(browser: any): Promise<any> {
  const page = await browser.newPage();
  await setupAuth(page);
  return page;
}