import { expect, test, type Page } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/** The fake's investor (fakeAuthServer.ts, FAKE_INVESTORS). */
const INVESTOR = { identifier: 'esi.bonsu@example.com', password: 'Cocoa-Harvest-2026!' };

async function signInAsInvestor(page: Page, path = '/investor') {
  await page.goto(path);
  await expect(page).toHaveURL(/\/investor\/login/);
  await page.getByLabel(/email or phone number/i).fill(INVESTOR.identifier);
  await page.getByLabel(/^password/i).fill(INVESTOR.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * F12's investor portal (ADR 0058): an investor signs in at `/investor` with `loginInvestor` and reads only
 * their own capital, share, distributions, statement and documents. Their browser calls nothing but the
 * investor operations and the sign-in, and never loads the back office.
 */
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the investor portal, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('an investor signs in and reads their own figures, page by page, at 360 px', async ({
      page,
      api,
    }) => {
      const scripts: string[] = [];
      page.on('request', (request) => {
        if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
      });
      await signInAsInvestor(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Your investment' })).toBeVisible();
      await expect(page.getByText('Signed in as Esi Bonsu')).toBeVisible();
      const tiles = page.getByRole('list', { name: 'Your investment' });
      await expect(tiles).toContainText('Your share');
      await expect(tiles).toContainText('Allocated, not yet paid');
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);

      const nav = page.getByRole('navigation', { name: 'Investor portal' });
      for (const [link, heading] of [
        ['Contributions', 'Your contributions and withdrawals'],
        ['Distributions', 'Your share of each distribution'],
        ['Statement', 'Your capital statement'],
        ['Documents', 'Your documents'],
      ] as const) {
        await nav.getByRole('link', { name: link }).click();
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page.getByRole('table')).toBeVisible();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      }
      await page
        .getByRole('button', { name: 'Get the file: Investment agreement, June 2025' })
        .click();
      await expect(
        page.getByRole('link', { name: 'Open Investment agreement, June 2025' }),
      ).toBeVisible();

      // Only the sign-in and the investor's own operations were called: no operational read at all.
      const called = api.log.filter((entry) => entry.operationId !== null);
      expect(called.length).toBeGreaterThan(0);
      for (const entry of called) expect(entry.path, entry.path).toMatch(/^\/investor\//);
      // The back office's entry script never loaded.
      expect(scripts.some((path) => /\/assets\/main-/.test(path))).toBe(false);
    });
  });
}

test('a staff session in the portal is told so, and an investor in the back office too', async ({
  page,
  browser,
}) => {
  await signInWithTotp(page, USERS.owner, '/');
  await page.goto('/investor');
  await expect(page.getByText('You are signed in as staff')).toBeVisible();
  await expect(page.getByText('Your investment')).toHaveCount(0);
  await expectNoAxeViolations(page);

  // A fresh browser: the investor opens the back office's address.
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const investorPage = await context.newPage();
  const { FakeApi } = await import('../../support/fakeApi');
  const api = new FakeApi();
  await api.install(context);
  await signInAsInvestor(investorPage);
  await expect(
    investorPage.getByRole('heading', { level: 1, name: 'Your investment' }),
  ).toBeVisible();
  await investorPage.goto('/');
  await expect(investorPage.getByText('You are signed in as an investor')).toBeVisible();
  await expect(investorPage.getByRole('navigation')).toHaveCount(0);
  await expectNoAxeViolations(investorPage);
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.close();
});

test('the staff sign-in refuses an investor, and the portal refuses staff', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email or phone number/i).fill(INVESTOR.identifier);
  await page.getByLabel(/^password/i).fill(INVESTOR.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto('/investor/login');
  await page.getByLabel(/email or phone number/i).fill(USERS.cashier.identifier);
  await page.getByLabel(/^password/i).fill(USERS.cashier.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/investor\/login/);
});
