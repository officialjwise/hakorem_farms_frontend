import { expect, test, type Page } from '@playwright/test';
import { signIn, USERS } from '../../support/helpers';

/** The stub's simulated cookie jar, read the way a developer would look in the cookie panel. */
async function jar(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('hk-stub:cookies') ?? '{}') as {
        at?: { value: string; expires: number };
        rt?: { value: string };
      },
  );
}

test.describe('session expiry and silent refresh', () => {
  test('the access token is renewed in the background and the user never notices', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-14T08:00:00Z') });
    await signIn(page, USERS.cashier, '/stock');
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    const before = await jar(page);

    // Nine and a half minutes later the ten-minute access token would have been a minute from expiry.
    await page.clock.fastForward('09:30');
    // The new access cookie lives roughly ten minutes from the jumped-to time, not from sign-in.
    await expect
      .poll(async () => (await jar(page)).at?.expires ?? 0)
      .toBeGreaterThan((before.at?.expires ?? 0) + 8 * 60_000);
    const after = await jar(page);
    expect(after.at?.value).not.toBe(before.at?.value);
    expect(after.rt?.value).not.toBe(before.rt?.value);

    // Still on the page, still signed in, nothing said.
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // And it keeps going: another half hour of idling.
    for (let i = 0; i < 3; i++) await page.clock.fastForward('09:30');
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
  });

  test('when the server ends the session the screen says so, and signing in again returns to the page', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-14T08:00:00Z') });
    await signIn(page, USERS.cashier, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

    // A manager revokes the session: the next refresh answers 401.
    await page.evaluate(() => {
      const server = JSON.parse(localStorage.getItem('hk-stub:server') ?? '{}') as {
        sessions: Record<string, { revoked: boolean }>;
      };
      for (const session of Object.values(server.sessions)) session.revoked = true;
      localStorage.setItem('hk-stub:server', JSON.stringify(server));
    });
    await page.clock.fastForward('09:30');

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
