import { expect, test } from '../../support/test';
import { expectNoAxeViolations, signIn, USERS } from '../../support/helpers';

test.describe('permission denied is a state, never a redirect', () => {
  test('a cashier opening users and roles sees words, a lock and the permission needed, on the same URL', async ({
    page,
  }) => {
    await signIn(page, USERS.cashier, '/users');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('You do not have access to this page');
    await expect(alert).toContainText('iam.user.read');
    await expect(page).toHaveURL('/users');
    // The shell stays, so the user can get out.
    await expect(page.getByRole('link', { name: 'Go to the start page' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a storekeeper cannot open the POS, and no scan field appears', async ({ page }) => {
    await signIn(page, USERS.storekeeper, '/pos');
    await expect(page.getByRole('alert')).toContainText('pos.sale.create');
    await expect(page.getByLabel('Barcode')).toHaveCount(0);
    await expect(page).toHaveURL('/pos');
  });

  test('navigation offers only what the user may open, but the address still answers honestly', async ({
    page,
  }) => {
    await signIn(page, USERS.storekeeper);
    await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('dialog').getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Stock' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Users and roles' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Point of sale' })).toHaveCount(0);
  });
});
