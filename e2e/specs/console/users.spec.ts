import { expect, test } from '../../support/test';
import {
  confirmStepUp,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * Primary flows for staff accounts (FR-IAM-001, 011, 022), as the owner, at 360 px, through the real auth
 * client and the fake auth server, with every other read and write answered by Prism (ADR 0026). Step-up
 * is the fake's: the first write that needs it asks for a code, and the repeat goes through.
 */
test.describe('users', () => {
  test('the owner creates a user, confirms with a code, and sees the temporary password once', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/users');
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Akua Mensah' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', { name: 'New user' }).click();
    await expect(page.getByRole('heading', { name: 'New user', level: 1 })).toBeVisible();
    await page.getByLabel(/^full name/i).fill('Esi Boateng');
    await page.getByLabel(/^email/i).fill('esi.boateng@hakoremfarms.com');
    await page.getByRole('combobox', { name: /^role/i }).click();
    await page.getByRole('option', { name: 'Cashier' }).click();
    await page.getByRole('combobox', { name: /^branch/i }).click();
    await page.getByRole('option', { name: 'HaKorem Farms, Dodowa (DDW)' }).click();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Create user' }).click();

    // The server asks for a fresh code (step-up), the write is repeated once, and Prism creates the user.
    await confirmStepUp(page);
    await expect(page.getByRole('heading', { name: 'Temporary password' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Adwoa Darko' })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    const creates = api.log.filter((entry) => entry.operationId === 'createUser');
    expect(creates.map((entry) => entry.outcome)).toEqual(['step-up-403', 'prism']);
  });

  test('a half-filled form asks before it is left, and staying keeps the typing', async ({
    page,
  }) => {
    await signInWithTotp(page, USERS.owner, '/users/new');
    await page.getByLabel(/^full name/i).fill('Esi Boateng');
    await page.getByRole('link', { name: 'Users', exact: true }).first().click();
    const ask = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: 'Stay on this page' }).click();
    await expect(page).toHaveURL('/users/new');
    await expect(page.getByLabel(/^full name/i)).toHaveValue('Esi Boateng');
    await page.getByRole('link', { name: 'Users', exact: true }).first().click();
    await page.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL('/users');
  });

  test('the owner adds a role at a branch, then revokes one, with one step-up for both', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/users/019a7a86-3046-711a-a652-1a7389f79351');
    await expect(page.getByRole('heading', { name: 'Akua Mensah', level: 1 })).toBeVisible();
    const grants = page.getByRole('region', { name: 'Roles at branches' });
    await expect(grants.getByText('Owner').first()).toBeVisible();

    await page.getByRole('button', { name: 'Add a role' }).click();
    const add = page.getByRole('dialog', { name: 'Add a role' });
    // The keyboard path: open the list, type ahead to the role, choose it with Enter.
    await add.getByRole('combobox', { name: /^role/i }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Store');
    await expect(page.getByRole('option', { name: 'Storekeeper' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(add.getByRole('combobox', { name: /^role/i })).toHaveText('Storekeeper');
    await add.getByRole('combobox', { name: /^branch/i }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('HaKorem');
    // As for the role: Enter only once type-ahead has focused the branch, or under load it chooses nothing.
    await expect(page.getByRole('option', { name: 'HaKorem Farms, Dodowa (DDW)' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(add.getByRole('combobox', { name: /^branch/i })).toHaveText(
      'HaKorem Farms, Dodowa (DDW)',
    );
    await add.getByRole('button', { name: 'Add role' }).click();
    await confirmStepUp(page);
    await expect(page.getByRole('status').filter({ hasText: 'Role added' })).toBeVisible();

    // Within five minutes the session is still stepped up: revoking needs no second code.
    await page.getByRole('button', { name: 'Revoke Manager at HaKorem Farms, Dodowa' }).click();
    const revoke = page.getByRole('dialog', { name: 'Revoke this role?' });
    await revoke.getByLabel(/^reason/i).fill('Moved to the Kumasi branch');
    await expectNoAxeViolations(page);
    await revoke.getByRole('button', { name: 'Revoke role' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Role revoked' })).toBeVisible();
    const outcomes = api.log
      .filter((entry) => entry.operationId === 'createGrant' || entry.operationId === 'revokeGrant')
      .map((entry) => `${entry.operationId} ${entry.outcome}`);
    expect(outcomes).toEqual(['createGrant step-up-403', 'createGrant prism', 'revokeGrant prism']);
  });
});
