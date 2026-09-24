import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    hookTimeout: 40000,
    testTimeout: 40000,
    fileParallelism: false,
  },
});
