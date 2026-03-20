// Mock import.meta.env for Vite compatibility in Jest
// This must be set up before any code that uses import.meta.env

// Create the mock import.meta object
const importMetaMock = {
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
  glob: () => [],
};

// Set up on globalThis for maximum compatibility
if (typeof (globalThis as any).importMeta === 'undefined') {
  (globalThis as any).importMeta = importMetaMock;
  (globalThis as any).importMetaMock = importMetaMock;
}

// Also set up on the global object for modules that access it differently
if (typeof (global as any).importMeta === 'undefined') {
  (global as any).importMeta = importMetaMock;
}

console.log('[Setup] import.meta.env mock applied');