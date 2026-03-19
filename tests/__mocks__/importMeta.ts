// Mock for import.meta.env - Vite specific syntax not supported in Jest
// This must be set up before any code that uses import.meta.env

// @ts-ignore - Jest globals
globalThis.importMetaMock = {
  env: {
    VITE_API_URL: 'http://localhost:3001',
    VITE_WS_URL: 'ws://localhost:3001',
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-testing-purposes-only',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
    BASE_URL: '/',
  },
  url: 'http://localhost:3001',
  hot: undefined,
};

// @ts-ignore - set up import.meta on global
if (typeof (globalThis as any).importMeta === 'undefined') {
  (globalThis as any).importMeta = (globalThis as any).importMetaMock;
}