import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['sim/**/*.test.ts', 'protocol/**/*.test.ts'],
  },
});
