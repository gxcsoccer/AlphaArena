import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { imagetools } from 'vite-imagetools';
import { createStyleImportPlugin } from 'vite-plugin-style-import';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Style import plugin for Arco Design - enables tree-shaking of component styles
    createStyleImportPlugin({
      libs: [
        {
          libraryName: '@arco-design/web-react',
          esModule: true,
          // Keep PascalCase for Arco Design component directories
          libraryNameChangeCase: (name) => name,
          resolveStyle: (name) => {
            // Arco Design uses PascalCase for component directories
            // e.g., Button -> Button/style/css.js
            return `@arco-design/web-react/es/${name}/style/css.js`;
          },
        },
      ],
    }),
    // Image optimization plugin - generates WebP/AVIF formats automatically
    imagetools({
      defaultDirectives: (url) => {
        // Only process images in the assets/images folder
        if (url.searchParams.has('original')) {
          return {};
        }
        
        // Generate WebP format by default for better compression
        return {
          format: 'webp',
          quality: '80',
        };
      },
    }),
    // PWA plugin - Issue #628: PWA 支持与离线能力
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: false, // We use public/manifest.json directly
      workbox: {
        // Cache static assets (JS, CSS, images)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
        // Runtime caching for API calls
        runtimeCaching: [
          {
            // Cache API responses with network-first strategy
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache market data with stale-while-revalidate
            urlPattern: /^https?:\/\/.*\/api\/(market|ticker|klines).*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'market-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
          {
            // Cache fonts from Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Cache font files from Google Fonts
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Offline fallback page
        offlineGoogleAnalytics: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // Disable in development for faster builds
      },
    }),
  ],
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
        // Asset file naming with hash for cache busting
        assetFileNames: (assetInfo) => {
          // Images get special treatment for caching
          if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          // Fonts
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          // CSS
          if (/\.css$/i.test(assetInfo.name || '')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          // Other assets
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: (id) => {
          // Swagger UI - isolate this large dependency (1.2MB)
          if (id.includes('swagger-ui-react') || id.includes('swagger-ui') || id.includes('swagger-client')) {
            return 'swagger-ui';
          }
          // Arco Design UI library - split into smaller chunks for better caching
          if (id.includes('@arco-design/web-react')) {
            // Split icons into separate chunk (they're large but stable)
            if (id.includes('@arco-design/web-react/icon')) {
              return 'arco-icons';
            }
            // Split locale data
            if (id.includes('@arco-design/web-react/es/locale')) {
              return 'arco-locale';
            }
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
            return 'web-vendors';
          }
          // PDF generation
          if (id.includes('pdfmake')) {
            return 'pdfmake';
          }
          // D3 vendor (recharts dependencies)
          if (id.includes('d3-') || id.includes('d3/') || id.includes('victory-')) {
            return 'd3-vendor';
          }
          // Driver.js for onboarding tours
          if (id.includes('driver.js')) {
            return 'driver-js';
          }
          // Marked for markdown parsing
          if (id.includes('marked')) {
            return 'marked';
          }
          // Workbox for PWA
          if (id.includes('workbox-')) {
            return 'workbox';
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