import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    fileParallelism: false, // Run test files sequentially to avoid DB conflicts
    sequence: {
      concurrent: false,
    },
  },
});
