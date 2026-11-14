import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI !== undefined;

/**
 * End to end, in Chromium, at 360 px wide (the floor every screen must work at). The storefront uses port 3100 for tests because 3000 is a common dev port (it was a Docker container here). The console runs from its
 * production build through `vite preview`, so the service worker and the minified bundle are what is tested,
 * and the storefront from `next start`. Build both first: `pnpm test:e2e` does.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 360, height: 740 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'console',
      testMatch: 'console/**/*.spec.ts',
      use: { baseURL: 'http://localhost:4173' },
    },
    {
      name: 'storefront',
      testMatch: 'storefront/**/*.spec.ts',
      use: { baseURL: 'http://localhost:3100' },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec vite preview --port 4173 --strictPort',
      cwd: '../apps/console',
      url: 'http://localhost:4173',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec next start --port 3100',
      cwd: '../apps/storefront',
      url: 'http://localhost:3100',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
