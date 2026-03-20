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
      }
    }],
  },
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/tests/__mocks__/resizeObserver.ts',
    '<rootDir>/tests/__mocks__/apiSetup.ts',
    '<rootDir>/tests/__mocks__/fix-testing-library.ts',
  ],
  moduleNameMapper: {
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
  transformIgnorePatterns: [
    'node_modules/(?!(jsdom|@exodus/bytes|html-encoding-sniffer|whatwg-url|whatwg-encoding|parse5|w3c-xmlserializer|xml-name-validator|saxes|symbol-tree|tough-cookie|data-urls|form-data|domexception|abort-controller|node-fetch|web-streams-polyfill|encoding-sniffer|@testing-library/dom)/)',
  ],
};