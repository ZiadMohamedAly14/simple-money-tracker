/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  // Use the shared package's TypeScript source, so tests never depend on a stale build.
  moduleNameMapper: {
    '^@money-tracker/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  // mongodb-memory-server can take a while on first run (binary download).
  testTimeout: 30000,
};
