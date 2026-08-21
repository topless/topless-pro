import { defineConfig } from 'vitest/config';

// Pure Node tests for the editorial scripts; the SQL they produce is executed for real
// in the workerd suite (test/import.test.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.mjs'],
  },
});
