/**
 * The `test` every spec imports (ADR 0026). It adds `api`, the fake API for this test's browser context,
 * installed before the page opens: one fake per test, its own cookie jar and sessions.
 */
import { test as base } from '@playwright/test';
import { FakeApi } from './fakeApi';

export const test = base.extend<{ api: FakeApi }>({
  api: [
    async ({ context }, use) => {
      const api = new FakeApi();
      await api.install(context);
      await use(api);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';
