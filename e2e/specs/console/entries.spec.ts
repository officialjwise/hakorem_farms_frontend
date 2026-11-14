import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  USERS,
} from '../../support/helpers';

/**
 * The console is two documents (ADR 0030): index.html for the back office, pos.html for the till. These
 * prove the reason for the split, that a till never downloads the back office, and that a person crosses
 * between the two without noticing more than a page load.
 */
test.describe('two documents: the back office and the till', () => {
  test('the till loads its own document and none of the back office’s code or words', async ({
    page,
  }) => {
    await signIn(page, USERS.cashier, '/pos');
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();

    // A till opened fresh, as at the start of a shift.
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await expect(page).toHaveTitle('HaKorem Farms point of sale');

    expect(
      scripts.some((path) => /^\/assets\/pos-[\w-]+\.js$/.test(path)),
      scripts.join(),
    ).toBe(true);
    // Not the back office's entry chunk (its screens), and not its catalogue namespaces.
    expect(scripts.filter((path) => /^\/assets\/(main|iam|audit)-/.test(path))).toEqual([]);
  });

  test('the back office’s POS button opens the till, “Back office” returns, and Back works', async ({
    page,
  }) => {
    await signIn(page, USERS.cashier, '/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveTitle('HaKorem Farms console');

    await page.getByRole('link', { name: 'Open the point of sale' }).click();
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await expect(page).toHaveURL('/pos');
    await expect(page).toHaveTitle('HaKorem Farms point of sale');
    await expect(page.getByLabel(/^barcode/i)).toBeFocused();

    await page.getByRole('link', { name: 'Back office' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('HaKorem Farms console');

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await expect(page).toHaveURL('/pos');
  });

  test('signing out of the till and in again stays on the till’s document', async ({ page }) => {
    await signIn(page, USERS.cashier, '/pos');
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    // Still the till's document: the sign-in screen is rendered in place, not fetched from the back office.
    await expect(page).toHaveTitle('HaKorem Farms point of sale');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
