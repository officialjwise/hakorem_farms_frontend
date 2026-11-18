import { defineConfig } from '@playwright/test';
import base, { SCREENSHOT_SPECS } from './playwright.config';

/**
 * The screenshot specs alone (tag `@screenshots`), for F13's one full set at 360 and 1280 px for the owner's
 * review. No session before F13 runs this (CLAUDE.md). The same browsers, servers and fake API as the e2e
 * run, one worker so the shots are taken in order.
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: SCREENSHOT_SPECS,
  workers: 1,
  projects: base.projects?.map((project) => ({
    ...project,
    testMatch: `${project.name}/${SCREENSHOT_SPECS}`,
  })),
});
