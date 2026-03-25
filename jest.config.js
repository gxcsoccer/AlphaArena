module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs'],
  // Memory optimization: limit workers based on available CPU cores
  maxWorkers: process.env.CI ? 2 : '50%',
  // Memory optimization: run tests with limited memory per worker
  workerIdleMemoryLimit: '512MB',
  // Timeout optimization
  testTimeout: 10000,
  slowTestThreshold: 5000,
  // Detect open handles for debugging
  detectOpenHandles: false,
  // Force exit after tests complete
  forceExit: true,
  // Clear mocks between tests to prevent memory leaks
  clearMocks: true,
  restoreMocks: true,
  // Memory-intensive test files that should run in isolation
  // E2E tests use Puppeteer, not Jest - exclude them
  // Vitest-based tests should be run with vitest, not jest - exclude them
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '/tests/ui/',
    // Vitest-based test files (they import from 'vitest')
    'useBacktest\\.test\\.ts$',
    'useNotifications\\.test\\.ts$',
    'usePortfolioRealtime\\.test\\.ts$',
    'useStrategyComparison\\.test\\.ts$',
    'virtual-account\\.dao\\.test\\.ts$',
    'VirtualAccountService\\.test\\.ts$',
    'BacktestCharts\\.test\\.tsx$',
  ],
  // Run memory-heavy tests sequentially to avoid OOM
  maxConcurrency: 5,
  transform: {
    // Only transform TypeScript files
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        jsx: 'react-jsx',
        types: ['jest', '@testing-library/jest-dom'],
        isolatedModules: true,
      },
      // Ignore TypeScript error 1343 for import.meta
      diagnostics: {
        ignoreCodes: [1343]
      },
      // Transform import.meta to a mock object
      astTransformers: {
        before: [
          {
            path: 'ts-jest-mock-import-meta',
            options: {
              metaObjectReplacement: {
                env: {
                  VITE_API_URL: 'http://localhost:3001',
                  VITE_WS_URL: 'ws://localhost:3001',
                  VITE_SUPABASE_URL: 'https://test.supabase.co',
                  VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-testing',
                  MODE: 'test',
                  DEV: false,
                  PROD: false,
                  SSR: false,
                  BASE_URL: '/',
                },
                url: 'http://localhost:3001',
              }
            }
          }
        ]
      }
    }],
  },
  setupFiles: [
    '<rootDir>/tests/__mocks__/importMeta.ts',
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/tests/__mocks__/resizeObserver.ts',
    '<rootDir>/tests/__mocks__/apiSetup.ts',
    '<rootDir>/tests/__mocks__/windowApi.ts',
    '<rootDir>/tests/__mocks__/i18n.ts',
  ],
  moduleNameMapper: {
    // CRITICAL: Mock @testing-library/dom to fix configure/getConfig undefined issue
    // The module uses getters that return undefined in Jest for some reason
    '^@testing-library/dom$': '<rootDir>/tests/__mocks__/testingLibraryDom.ts',
    '^lightweight-charts$': '<rootDir>/tests/__mocks__/lightweight-charts.ts',
    '^recharts$': '<rootDir>/tests/__mocks__/recharts.tsx',
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.ts',
    // Handle .js extensions in imports
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock config for import.meta.env - use a more generic pattern to match all relative imports
    // But be careful not to match @testing-library/dom's config
    '^(\\.\\./)+client/utils/config$': '<rootDir>/tests/__mocks__/config.ts',
    '^src/client/utils/config$': '<rootDir>/tests/__mocks__/config.ts',
    // Mock Supabase client for database tests
    '^src/database/client$': '<rootDir>/tests/__mocks__/supabase.ts',
    // Also mock relative imports from any directory (e.g., '../../database/client')
    '^(\\.\\./)+database/client$': '<rootDir>/tests/__mocks__/supabase.ts',
    // Also mock relative imports from DAO files (e.g., './client' in database directory)
    '^\\./client$': '<rootDir>/tests/__mocks__/supabase.ts',
    '^\\./client\\.js$': '<rootDir>/tests/__mocks__/supabase.ts',
    // Mock signal-related DAOs
    '^src/database/signal-subscriptions.dao$': '<rootDir>/tests/__mocks__/signal-subscriptions.dao.ts',
    '^(\\.\\./)+database/signal-subscriptions.dao$': '<rootDir>/tests/__mocks__/signal-subscriptions.dao.ts',
    '^src/database/signal-push-config.dao$': '<rootDir>/tests/__mocks__/signal-push-config.dao.ts',
    '^(\\.\\./)+database/signal-push-config.dao$': '<rootDir>/tests/__mocks__/signal-push-config.dao.ts',
    // Handle marked ESM module - use UMD build
    '^marked$': '<rootDir>/node_modules/marked/lib/marked.umd.js',
    // Mock CSS files
    '^.+\\.css$': '<rootDir>/tests/__mocks__/styleMock.ts',
    // Mock jsdom to avoid ESM issues
    '^jsdom$': '<rootDir>/tests/__mocks__/jsdom.ts',
    // Mock pdfmake for tests
    '^pdfmake$': '<rootDir>/tests/__mocks__/pdfmake.ts',
  },
  // Transform ESM modules that need to be transpiled
  // Note: Removed @testing-library/dom - keeping it as-is works better
  transformIgnorePatterns: [
    'node_modules/(?!(jsdom|@exodus/bytes|html-encoding-sniffer|whatwg-url|whatwg-encoding|parse5|w3c-xmlserializer|xml-name-validator|saxes|symbol-tree|tough-cookie|data-urls|form-data|domexception|abort-controller|node-fetch|web-streams-polyfill|encoding-sniffer)/)',
  ],
};