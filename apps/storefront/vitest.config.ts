import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig has jsx: preserve for Next, so tell the test transform to compile JSX itself.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
