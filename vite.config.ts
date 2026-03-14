import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    sourcemap: false, // Disable sourcemaps in production to reduce bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'arco-design': ['@arco-design/web-react'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['lightweight-charts', 'recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 800, // Increase limit after optimization
  },
});
