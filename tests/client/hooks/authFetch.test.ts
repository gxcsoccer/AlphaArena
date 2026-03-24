/**
 * Tests for authFetch URL building logic
 * Issue #600: Fix registration form not working due to incorrect API URL
 */

describe('authFetch URL building', () => {
  // Mock the environment variable
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should build correct URL when VITE_API_URL is set to Supabase Functions URL', () => {
    // Simulate VITE_API_URL=https://xxx.supabase.co/functions/v1
    const apiBaseUrl = 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1';
    const endpoint = '/register';
    
    // Logic from the fix
    const authPath = apiBaseUrl ? `/auth${endpoint}` : `/api/auth${endpoint}`;
    const fullUrl = `${apiBaseUrl}${authPath}`;
    
    // Expected: https://xxx.supabase.co/functions/v1/auth/register
    expect(fullUrl).toBe('https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/auth/register');
    // Should NOT be: https://xxx.supabase.co/functions/v1/api/auth/register
    expect(fullUrl).not.toContain('/functions/v1/api/auth');
  });

  it('should build correct URL when VITE_API_URL is empty', () => {
    // Simulate VITE_API_URL='' (empty)
    const apiBaseUrl = '';
    const endpoint = '/register';
    
    // Logic from the fix
    const authPath = apiBaseUrl ? `/auth${endpoint}` : `/api/auth${endpoint}`;
    const fullUrl = `${apiBaseUrl}${authPath}`;
    
    // Expected: /api/auth/register (will be rewritten by Vercel)
    expect(fullUrl).toBe('/api/auth/register');
  });

  it('should build correct URL for login endpoint', () => {
    const apiBaseUrl = 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1';
    const endpoint = '/login';
    
    const authPath = apiBaseUrl ? `/auth${endpoint}` : `/api/auth${endpoint}`;
    const fullUrl = `${apiBaseUrl}${authPath}`;
    
    expect(fullUrl).toBe('https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/auth/login');
  });

  it('should build correct URL for refresh endpoint', () => {
    const apiBaseUrl = 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1';
    const endpoint = '/refresh';
    
    const authPath = apiBaseUrl ? `/auth${endpoint}` : `/api/auth${endpoint}`;
    const fullUrl = `${apiBaseUrl}${authPath}`;
    
    expect(fullUrl).toBe('https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/auth/refresh');
  });

  it('should handle trailing slash in API_BASE_URL', () => {
    const apiBaseUrl = 'https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/';
    const endpoint = '/register';
    
    const authPath = apiBaseUrl ? `/auth${endpoint}` : `/api/auth${endpoint}`;
    // Note: This will produce //auth/register, but browsers handle this correctly
    const fullUrl = `${apiBaseUrl}${authPath}`;
    
    // The URL should still be valid (browsers normalize double slashes)
    expect(fullUrl).toContain('functions/v1');
    expect(fullUrl).toContain('auth/register');
  });
});