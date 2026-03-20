// Mock import.meta.env for Vite compatibility in Jest
if (typeof (global as any).importMeta === 'undefined') {
  (global as any).importMeta = {
    env: {
      VITE_API_URL: 'http://localhost:3001',
      VITE_WS_URL: 'ws://localhost:3001',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      MODE: 'test',
      DEV: false,
      PROD: false,
      SSR: false,
    },
    hot: undefined,
    glob: () => [],
  };
}

// Also set up on the global object for modules that access it differently
if (typeof import.meta === 'undefined') {
  // @ts-ignore
  import.meta = (global as any).importMeta;
}

console.log('[Setup] import.meta.env mock applied');