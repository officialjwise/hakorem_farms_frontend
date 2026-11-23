import { expect, test, type Page } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  submitLogin,
  TOTP_CODE,
  USERS,
} from '../../support/helpers';
import { CONSOLE_URL, INVESTOR_URL } from '../../support/hosts';

/** An address on one host, with or without a query: `at(INVESTOR_URL, '/login')`. */
const at = (origin: string, path: string) =>
  new RegExp(`^${origin.replace(/[.]/g, '\\.')}${path}(\\?.*)?$`);

/** The fake's investor (fakeAuthServer.ts, FAKE_INVESTORS). */
const INVESTOR = { identifier: 'esi.bonsu@example.com', password: 'Cocoa-Harvest-2026!' };

/** Signs the investor in on the portal's own host, from `path` there. */
async function signInAsInvestor(page: Page, path = '/') {
  await page.goto(path);
  await expect(page).toHaveURL(at(INVESTOR_URL, '/login'));
  await submitLogin(page, INVESTOR);
  await expect(page.getByRole('heading', { level: 1, name: 'Your investment' })).toBeVisible();
}

/** Signs the owner in on the console's host, a different host from the portal's. */
async function signInOnTheConsole(page: Page) {
  await page.goto(`${CONSOLE_URL}/login`);
  await submitLogin(page, USERS.owner);
  await page.getByLabel(/^code/i).fill(TOTP_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(`${CONSOLE_URL}/`);
  await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
}

/**
 * The investor portal (ADR 0058, the owner on 2026-11-23): its own build, served on its own host with its
 * own host-only session cookie, never under the console's address. An investor signs in at `/login` there
 * with `loginInvestor` and reads only their own capital, share, distributions, statement and documents.
 * Their browser calls nothing but the investor operations and the sign-in, and loads nothing from the
 * console's host.
 */
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the investor portal, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('an investor signs in and reads their own figures, page by page, at 360 px', async ({
      page,
      api,
    }) => {
      const requested: URL[] = [];
      page.on('request', (request) => requested.push(new URL(request.url())));
      await signInAsInvestor(page);
      await expect(page.getByText('Signed in as Esi Bonsu')).toBeVisible();
      const tiles = page.getByRole('list', { name: 'Your investment' });
      await expect(tiles).toContainText('Your share');
      await expect(tiles).toContainText('Allocated, not yet paid');
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);

      const nav = page.getByRole('navigation', { name: 'Investor portal' });
      for (const [link, heading, path] of [
        ['Contributions', 'Your contributions and withdrawals', '/capital'],
        ['Distributions', 'Your share of each distribution', '/distributions'],
        ['Statement', 'Your capital statement', '/statement'],
        ['Documents', 'Your documents', '/documents'],
      ] as const) {
        await nav.getByRole('link', { name: link }).click();
        await expect(page).toHaveURL(`${INVESTOR_URL}${path}`);
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
      // Everything the browser fetched came from the portal's own host; none of it is the console's.
      const portalHost = new URL(INVESTOR_URL).host;
      for (const url of requested) expect(url.host, url.href).toBe(portalHost);
      const scripts = requested.map((url) => url.pathname).filter((path) => path.endsWith('.js'));
      expect(scripts.some((path) => /\/assets\/(main|pos)-/.test(path))).toBe(false);
      // The portal registers no service worker: the console's is the till's and the back office's.
      expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations())).toHaveLength(0);
    });
  });
}

test('each host answers only its own document', async ({ request }) => {
  const title = async (url: string) => {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
    return /<title>([^<]*)<\/title>/.exec(await response.text())?.[1];
  };
  for (const path of ['/', '/login', '/capital', '/documents', '/pos', '/users']) {
    expect(await title(`${INVESTOR_URL}${path}`), path).toBe('HaKorem Farms investor portal');
  }
  // The console's address never serves the portal, at `/investor` or at its file's name.
  for (const path of ['/investor', '/investor/login', '/investor.html']) {
    expect(await title(`${CONSOLE_URL}${path}`), path).toBe('HaKorem Farms console');
  }
});

test('a session is its own host’s: neither sign-in reaches the other host', async ({ page }) => {
  // Staff signed in on the console: the portal's host has no session, and asks an investor to sign in.
  await signInOnTheConsole(page);
  await page.goto(`${INVESTOR_URL}/`);
  await expect(page).toHaveURL(at(INVESTOR_URL, '/login'));
  await expect(page.getByText('You are signed in as staff')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expectNoAxeViolations(page);

  // The investor signs in on the portal: the console still holds only the owner's session.
  await submitLogin(page, INVESTOR);
  await expect(page.getByRole('heading', { level: 1, name: 'Your investment' })).toBeVisible();
  await page.goto(`${CONSOLE_URL}/`);
  await expect(page).toHaveURL(`${CONSOLE_URL}/`);
  await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
  await expect(page.getByText('You are signed in as an investor')).toHaveCount(0);

  // And the portal still holds the investor's.
  await page.goto(`${INVESTOR_URL}/`);
  await expect(page.getByText('Signed in as Esi Bonsu')).toBeVisible();
});

test('an investor opening the console meets the staff sign-in, which refuses them', async ({
  page,
}) => {
  await signInAsInvestor(page);
  await page.goto(`${CONSOLE_URL}/`);
  await expect(page).toHaveURL(at(CONSOLE_URL, '/login'));
  await submitLogin(page, INVESTOR);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(at(CONSOLE_URL, '/login'));
  await expectNoAxeViolations(page);
});

test('the portal’s sign-in refuses staff', async ({ page }) => {
  await page.goto('/login');
  await submitLogin(page, USERS.cashier);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(at(INVESTOR_URL, '/login'));
  await expectNoAxeViolations(page);
});
