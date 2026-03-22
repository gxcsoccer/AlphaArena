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
      '/docs/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api-docs': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug', 'console.warn'],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Swagger UI - isolate this large dependency (1.2MB)
          if (id.includes('swagger-ui-react') || id.includes('swagger-ui') || id.includes('swagger-client')) {
            return 'swagger-ui';
          }
          // Arco Design UI library
          if (id.includes('@arco-design/web-react')) {
            return 'arco-design';
          }
          // React core - stable, rarely changes
          if (id.includes('react-dom') || id === 'react') {
            return 'react-vendor';
          }
          // React router
          if (id.includes('react-router-dom') || id.includes('@remix-run')) {
            return 'react-router';
          }
          // Charts - heavy visualization libraries
          if (id.includes('lightweight-charts')) {
            return 'lightweight-charts';
          }
          if (id.includes('recharts')) {
            return 'recharts';
          }
          // Virtual scrolling
          if (id.includes('react-window')) {
            return 'react-window';
          }
          // Web vitals
          if (id.includes('web-vitals')) {
            return 'web-vitals';
          }
          // PDF generation
          if (id.includes('pdfmake')) {
            return 'pdfmake';
          }
          // D3 vendor (recharts dependencies)
          if (id.includes('d3-') || id.includes('d3/') || id.includes('victory-')) {
            return 'd3-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    target: 'es2020',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@arco-design/web-react'],
    exclude: ['swagger-ui-react'],
  },
});
