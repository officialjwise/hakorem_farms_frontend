import { defineConfig } from 'vitest/config';

/**
 * `pnpm test:integration` for the storefront: its pages and its checkout against the REAL Prism mock
 * (ADR 0019), never a mocked fetch. The same Prism the console's suite starts (or one already running).
 */
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  define: { 'process.env.HK_API_BASE_URL': JSON.stringify('http://127.0.0.1:4010') },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.integration.test.{ts,tsx}'],
    globalSetup: ['../console/src/test/prism.global-setup.ts'],
    setupFiles: ['./src/test-setup.ts', './src/test-integration-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
