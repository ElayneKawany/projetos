/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // JWT_SECRET necessário para importar lib/auth.ts (lib/config/env.ts faz fail-fast)
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/db/**',
    '!lib/repositories/**',
  ],
  coverageThreshold: {
    global: { lines: 60 },
  },
}
