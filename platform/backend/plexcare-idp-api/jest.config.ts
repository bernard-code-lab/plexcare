import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/', '/test/contract/'],
  // Integration tests use Testcontainers (MySQL containers per suite). Running
  // them in parallel exhausts Docker/network. We default to serial — set
  // JEST_WORKERS to override locally for unit-only fast runs.
  maxWorkers: process.env.JEST_WORKERS ? Number(process.env.JEST_WORKERS) : 1,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: [],
};

export default config;
