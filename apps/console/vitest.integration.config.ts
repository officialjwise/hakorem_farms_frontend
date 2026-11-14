import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * `pnpm test:integration`: screens and the data layer against the REAL Prism mock (ADR 0019), never a
 * mocked fetch. The API base URL is the mock's, set here through the one variable (HK_API_BASE_URL).
 */
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.HK_API_BASE_URL': JSON.stringify('http://127.0.0.1:4010') },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.integration.test.{ts,tsx}'],
    globalSetup: ['./src/test/prism.global-setup.ts'],
    setupFiles: ['./src/test/integration-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
