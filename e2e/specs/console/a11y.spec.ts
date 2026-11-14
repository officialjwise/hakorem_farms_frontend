import { test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  submitLogin,
  USERS,
} from '../../support/helpers';

/**
 * axe (WCAG 2.2 AA) on every console route, at 360 px, in both themes. Each route is checked in the state
 * a user meets it in. The stories already cover the components; this covers the composed pages.
 */
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test('public auth screens', async ({ page }) => {
      for (const path of ['/login', '/forgot-password', '/reset-password']) {
        await page.goto(path);
        await page.getByRole('heading', { level: 1 }).waitFor();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      }
    });

    test('login with errors showing', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.getByText('Required').nth(2).waitFor();
      await expectNoAxeViolations(page);
      await submitLogin(page, { identifier: USERS.cashier.identifier, password: 'wrong' });
      await page.getByRole('alert').waitFor();
      await expectNoAxeViolations(page);
    });

    test('TOTP and forced password change', async ({ page }) => {
      await page.goto('/login');
      await submitLogin(page, USERS.manager);
      await page.getByRole('heading', { name: 'Enter your code' }).waitFor();
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);

      await page.goto('/login');
      await submitLogin(page, USERS.temp);
      await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);
    });

    // One test per route, so each has its own time budget (seven in one test ran out of time under load).
    for (const path of ['/', '/stock', '/products', '/orders', '/users', '/audit', '/nowhere']) {
      test(`back office route ${path}, as the cashier (including denied and not found)`, async ({
        page,
      }) => {
        await signIn(page, USERS.cashier);
        await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
        await page.goto(path);
        await page.getByRole('main').or(page.getByRole('alert')).first().waitFor();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }

    test('back office: the open menu', async ({ page }) => {
      await signIn(page, USERS.cashier);
      await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('dialog').waitFor();
      await expectNoAxeViolations(page);
    });

    // One test per F3 screen, so each page load and axe pass has its own budget. Nine in one test ran past
    // the 30 s timeout under a loaded full run.
    const any = '019a7a86-3046-711a-a652-1a7389f79351';
    for (const path of [
      '/users',
      '/users/new',
      `/users/${any}`,
      '/roles',
      `/roles/${any}`,
      '/roles/new',
      '/sessions',
      '/audit',
      `/audit/${any}`,
    ]) {
      test(`F3 screen ${path}, as the owner, with its data from the mock`, async ({ page }) => {
        await signInWithTotp(page, USERS.owner);
        await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
        await page.goto(path);
        await page.getByRole('heading', { level: 1 }).waitFor();
        // Wait for the data, not the placeholder: no loading status left.
        await page
          .getByText(/^Loading /)
          .first()
          .waitFor({ state: 'detached' });
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }

    test('POS: the shell, the open dialog and the offline state', async ({ page, context }) => {
      await signIn(page, USERS.cashier, '/pos');
      await page.getByRole('heading', { name: 'Point of sale' }).waitFor();
      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);
      await context.setOffline(true);
      await page.getByText('Offline').first().waitFor();
      await expectNoAxeViolations(page);
      await context.setOffline(false);
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.getByRole('dialog').waitFor();
      await expectNoAxeViolations(page);
    });
  });
}
