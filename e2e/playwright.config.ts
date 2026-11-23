import { defineConfig, devices } from '@playwright/test';
import { CONSOLE_URL, INVESTOR_URL } from './support/hosts';

const CI = process.env.CI !== undefined;

/**
 * End to end, in Chromium, at 360 px wide (the floor every screen must work at). The storefront uses port 3100 for tests because 3000 is a common dev port (it was a Docker container here). The console runs from its
 * production build through `vite preview`, so the service worker and the minified bundle are what is tested,
 * the investor portal from its own build (ADR 0058), and the storefront from `next start`. Build all three
 * first: `pnpm test:e2e` does, with the console's and the portal's HK_API_BASE_URL set to /mock (ADR 0026).
 *
 * The screenshot specs are not part of this run: no screenshots until F13 (CLAUDE.md). They run only from
 * `playwright.screenshots.config.ts`, through `pnpm screenshots`. The 360 px checks every spec makes (no
 * sideways scroll, axe) stay here.
 */
export const SCREENSHOT_SPECS = '**/*screenshots.spec.ts';

export default defineConfig({
  testDir: './specs',
  testIgnore: SCREENSHOT_SPECS,
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
      use: { baseURL: CONSOLE_URL },
    },
    {
      // The investor portal, its own build on its own host (ADR 0058).
      name: 'investor',
      testMatch: 'investor/**/*.spec.ts',
      use: { baseURL: INVESTOR_URL },
    },
    {
      name: 'storefront',
      testMatch: 'storefront/**/*.spec.ts',
      use: { baseURL: 'http://localhost:3100' },
    },
  ],
  webServer: [
    {
      // The Prism mock (ADR 0019). The console build talks to /mock, which vite preview forwards here
      // (ADR 0025); the fake API answers auth and decides 401 and 403 before that (ADR 0026).
      command: 'pnpm dev:mock',
      cwd: '..',
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: !CI,
      timeout: 90_000,
    },
    {
      // The storefront's API (ADR 0054): quotes by their link from fixtures keyed by token, everything else
      // passed to Prism. The storefront's e2e build talks to it (HK_API_BASE_URL=http://127.0.0.1:4011).
      command: 'node support/shopApi.ts',
      url: 'http://127.0.0.1:4011/health',
      reuseExistingServer: !CI,
      timeout: 90_000,
    },
    {
      command: 'pnpm exec vite preview --port 4173 --strictPort',
      cwd: '../apps/console',
      url: CONSOLE_URL,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      // The investor portal's own build (`pnpm build:investor`), on a host name of its own.
      command:
        'pnpm exec vite preview --config vite.investor.config.ts --host 127.0.0.1 --port 4174 --strictPort',
      cwd: '../apps/console',
      url: INVESTOR_URL,
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
