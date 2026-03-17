// Mock for config.ts - handles import.meta.env in Jest
export function validateConfig() {
  return {
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    isConfigured: true,
    missingVars: [],
  };
}

export function logConfigStatus(): void {
  // No-op in tests
}

export function isSupabaseConfigValid(): boolean {
  return true;
}
