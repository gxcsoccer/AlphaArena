module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx'],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
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
  ],
  moduleNameMapper: {
    '^lightweight-charts$': '<rootDir>/tests/__mocks__/lightweight-charts.ts',
  },
};
