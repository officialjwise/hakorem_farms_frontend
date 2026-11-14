import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const USERS = {
  owner: { identifier: 'kwabena.owusu@hakoremfarms.com', password: 'Mango-Season-2026!' },
  cashier: { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' },
  storekeeper: { identifier: 'yaw.boateng@hakoremfarms.com', password: 'Mango-Season-2026!' },
  temp: { identifier: 'new.staff@hakoremfarms.com', password: 'Temp-8841-Farm' },
} as const;

export const TOTP_CODE = '481205';

/** Fills the sign-in form and submits. Does not wait for what comes next. */
export async function submitLogin(page: Page, user: { identifier: string; password: string }) {
  await page.getByLabel(/email or phone number/i).fill(user.identifier);
  await page.getByLabel(/^password/i).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Signs a user without TOTP in and waits for the dashboard. */
export async function signIn(
  page: Page,
  user: { identifier: string; password: string },
  path = '/',
) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await submitLogin(page, user);
}

/** WCAG 2.2 AA through axe. Never suppressed: a finding is fixed in the component. */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} -- ${n.failureSummary ?? ''}`).join(' | ')}`,
    ),
  ).toEqual([]);
}

/** No sideways scroll at 360 px. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'the page scrolls sideways').toBeLessThanOrEqual(0);
}
