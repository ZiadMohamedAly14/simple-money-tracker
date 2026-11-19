/**
 * Node-only Jest for the app's plain TypeScript logic (API client, later the
 * sync engine for Seam B). Screens are not unit-tested in the MVP.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Expo's tsconfig targets Metro (module: preserve); Jest needs CommonJS.
        tsconfig: { rootDir: '.', module: 'commonjs', moduleResolution: 'node10', ignoreDeprecations: '6.0', jsx: 'react-jsx' },
      },
    ],
  },
  moduleNameMapper: {
    '^@money-tracker/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
