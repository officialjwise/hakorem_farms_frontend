import { expect, test } from '../../support/test';
import { signIn, USERS } from '../../support/helpers';

/** Nine and a half minutes: a ten-minute access token would be a minute from expiry. */
const NINE_AND_A_HALF_MINUTES = 9.5 * 60_000;

test.describe('session expiry and silent refresh', () => {
  test('the access token is renewed in the background and the user never notices', async ({
    page,
    api,
  }) => {
    await api.installClock(page, new Date('2026-11-14T08:00:00Z'));
    // The Storekeeper: the seeded Cashier cannot open stock on hand (CR-023).
    await signIn(page, USERS.storekeeper, '/stock');
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    // The browser's cookies, read the way a developer would look in the cookie panel.
    const before = structuredClone(api.jar);

    await api.fastForward(page, NINE_AND_A_HALF_MINUTES);
    // The new access cookie lives roughly ten minutes from the jumped-to time, not from sign-in.
    await expect
      .poll(() => api.jar.at?.expires ?? 0)
      .toBeGreaterThan((before.at?.expires ?? 0) + 8 * 60_000);
    expect(api.jar.at?.value).not.toBe(before.at?.value);
    expect(api.jar.rt?.value).not.toBe(before.rt?.value);

    // Still on the page, still signed in, nothing said.
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // And it keeps going: another half hour of idling.
    for (let i = 0; i < 3; i++) await api.fastForward(page, NINE_AND_A_HALF_MINUTES);
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
  });

  // Out of quarantine (issue #4): ten loaded full suites in a row were green with it included (F6b).
  test('when the server ends the session the screen says so, and signing in again returns to the page', async ({
    page,
    api,
  }) => {
    await api.installClock(page, new Date('2026-11-14T08:00:00Z'));
    await signIn(page, USERS.cashier, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

    // A manager revokes the session: the next refresh answers 401.
    api.server.revokeAllSessions();
    await api.fastForward(page, NINE_AND_A_HALF_MINUTES);

    await expect(page.getByRole('alert')).toContainText('Your session ended');
    await expect(page).toHaveURL('/orders'); // words, not a redirect
    await page.getByRole('link', { name: 'Sign in again' }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await page.getByLabel(/email or phone number/i).fill(USERS.cashier.identifier);
    await page.getByLabel(/^password/i).fill(USERS.cashier.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page).toHaveURL('/orders');
  });

  test('a reload keeps the session, as cookies do', async ({ page }) => {
    await signIn(page, USERS.cashier, '/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });
});
