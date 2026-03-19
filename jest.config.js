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
  testPathIgnorePatterns: [
    '/node_modules/',
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
    // Mock config for import.meta.env
    '^../utils/config$': '<rootDir>/tests/__mocks__/config.ts',
    '^../../client/utils/config$': '<rootDir>/tests/__mocks__/config.ts',
    '^./config$': '<rootDir>/tests/__mocks__/config.ts',
    // Handle marked ESM module - use UMD build
    '^marked$': '<rootDir>/node_modules/marked/lib/marked.umd.js',
  },
  // Don't transform any node_modules - let them use their native format
  transformIgnorePatterns: ['node_modules/'],
};