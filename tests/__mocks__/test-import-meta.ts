// Test file to verify import.meta.env is working
console.log('[Test] import.meta.env:', (globalThis as any).importMeta?.env);
console.log('[Test] import.meta.env.VITE_API_URL:', (globalThis as any).importMeta?.env?.VITE_API_URL);

// Try to use import.meta.env directly
try {
  // This simulates how client code might access it
  const apiUrl = (globalThis as any).importMeta?.env?.VITE_API_URL;
  if (apiUrl === 'http://localhost:3001') {
    console.log('[Test] import.meta.env working correctly!');
  } else {
    console.error('[Test] import.meta.env value mismatch:', apiUrl);
  }
} catch (e) {
  console.error('[Test] import.meta.env error:', e);
}
