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
      // A request the page sent as the test ended (a list's next page, say) may still be in the fake's
      // hands: its route.fetch then fails with "Test ended" outside any test, and the worker's next test
      // does not run. Drop the routes and ignore what is in flight.
      await context.unrouteAll({ behavior: 'ignoreErrors' });
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';
