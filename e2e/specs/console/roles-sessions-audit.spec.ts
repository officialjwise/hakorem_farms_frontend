import { expect, test } from '../../support/test';
import {
  confirmStepUp,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/** Primary flows for roles (FR-IAM-008, 022), sessions (FR-IAM-014, 015) and the audit log (FR-AUD). */
test.describe('roles', () => {
  test('the owner changes a role’s permissions, confirms with a code, and it is saved', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/roles');
    await expect(page.getByRole('heading', { name: 'Roles', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Cashier' }).click();
    await expect(page.getByRole('heading', { name: 'Cashier', level: 1 })).toBeVisible();
    const permissions = page.getByRole('group', { name: /^permissions/i });
    const sale = permissions.getByRole('checkbox', { name: 'Make a counter sale' });
    await expect(sale).toBeChecked();
    await expectNoHorizontalScroll(page);
    await sale.uncheck();
    await page.getByRole('button', { name: 'Save role' }).click();
    await confirmStepUp(page);
    await expect(page.getByRole('status').filter({ hasText: 'Role saved' })).toBeVisible();
    const updates = api.log.filter((entry) => entry.operationId === 'updateRole');
    expect(updates.map((entry) => entry.outcome)).toEqual(['step-up-403', 'prism']);
  });
});

test.describe('sessions', () => {
  test('the owner signs another device out, giving a reason', async ({ page, api }) => {
    await signInWithTotp(page, USERS.owner, '/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions', level: 1 })).toBeVisible();
    await expect(page.getByText('This device').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Revoke the session on Office laptop' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign this device out?' });
    await expect(dialog).toContainText('Kwabena Owusu on Office laptop');
    await dialog.getByLabel(/^reason/i).fill('Laptop reported stolen');
    await dialog.getByRole('button', { name: 'Sign the device out' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Session revoked' })).toBeVisible();
    expect(api.log.some((e) => e.operationId === 'revokeSession' && e.outcome === 'prism')).toBe(
      true,
    );
  });
});

test.describe('audit log', () => {
  test('the owner reads the tamper check and one event, before and after, at 360 px', async ({
    page,
  }) => {
    await signInWithTotp(page, USERS.owner, '/audit');
    await expect(page.getByRole('heading', { name: 'Audit log', level: 1 })).toBeVisible();
    await expect(page.getByText('Intact', { exact: true })).toBeVisible();
    await expect(page.getByText('The chain verified with no gap and no change.')).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', { name: 'Open the event of 2026-11-13 08:03' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Price overridden');
    await expect(page.getByRole('region', { name: 'What changed' })).toBeVisible();
    // The request reference by its last eight characters, grouped, copied in full (ADR 0051).
    await expect(page.getByText('ad58 f7ac')).toBeVisible();
    await expect(page.getByText('019a7a9b-9385-775f-bc98-7ecead58f7ac')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
