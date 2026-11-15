import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F5b's primary flows. The gate is the first test: someone who has never seen the system opens the
 * dashboard, on a phone (the suite runs at 360 px), and can say what kind of business it is and how it is
 * doing today. Then: one read for the whole dashboard, unavailable figures in words, the branch switcher
 * scoping the reads, a refused branch close in the API's words, labels, the new lists, and the shell's
 * keyboard path.
 */

const ANY = '019a7a86-3046-711a-a652-1a7389f79351';
const KASOA = '019a7ab0-1c3e-7d21-9a40-6b2f8e0c4a11';

for (const scheme of ['light', 'dark'] as const) {
  test(`the F5b gate (${scheme}): the dashboard says what the business is and how today is going`, async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signInWithTotp(page, USERS.owner, '/');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    // What kind of business: in words, and in what sells.
    await expect(page.getByText(/Livestock, meat and produce trading at/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selling best today' })).toContainText('Goat');
    // How today is going: sales against yesterday, stock, money owed, where the cash is.
    await expect(page.getByRole('link', { name: /Stock value/ })).toContainText('78,117.30');
    await expect(page.getByText('Sales today')).toBeVisible();
    await expect(page.getByText(/Yesterday GH/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Where the cash is' })).toContainText(
      '94,410.00',
    );
    // One read for the whole dashboard (owner, 2026-11-15), not one per tile.
    expect(api.log.filter((e) => e.operationId === 'getOwnerDashboard')).toHaveLength(1);
    // A figure with no data source is words, never a number.
    for (const label of ['Purchases today', 'Low stock', 'Animals on hand']) {
      const tile = page.locator('[data-slot="stat-tile"]', { hasText: label });
      await expect(tile).toHaveAttribute('data-state', 'unavailable');
      await expect(tile).toContainText('No data source yet');
      await expect(tile).not.toContainText(/\d/);
    }
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}

test('the header’s branch scopes the dashboard and stock on hand to Kasoa', async ({ page }) => {
  await signInWithTotp(page, USERS.owner, '/');
  await expect(page.getByText('Selling best today')).toBeVisible();
  const scoped = page.waitForRequest(
    (request) =>
      request.url().includes('/dashboard/owner') && request.url().includes(`branchId=${KASOA}`),
  );
  await page.getByRole('combobox', { name: 'Scope every screen to a branch' }).click();
  await page.getByRole('option', { name: 'KAS' }).click();
  await scoped;
  const stock = page.waitForRequest(
    (request) =>
      request.url().includes('/stock/on-hand') && request.url().includes(`branchId=${KASOA}`),
  );
  await page.goto('/stock');
  await stock;
  // The choice is remembered on this device.
  await expect(page.getByRole('combobox', { name: 'Scope every screen to a branch' })).toHaveText(
    'KAS',
  );
});

test('a branch close the server refuses stays in the confirmation, in the server’s words', async ({
  page,
  api,
}) => {
  api.prefer('updateBranch', 'code=422');
  await signInWithTotp(page, USERS.owner, `/branches/${ANY}`);
  await page.getByRole('button', { name: 'Close the branch' }).click();
  const dialog = page.getByRole('dialog', { name: /^Close HaKorem Farms, Dodowa\?/ });
  await expect(dialog.getByRole('row', { name: 'Status Active Closed' })).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Close the branch' }).click();
  await expect(dialog.getByRole('alert')).toContainText('The branch was not closed');
  await expect(dialog.getByRole('alert')).toContainText('veterinary withdrawal period');
  expect(api.log.filter((e) => e.operationId === 'updateBranch')).toHaveLength(1);
});

test('labels: a product and a lot, with barcodes, ready to print', async ({ page }) => {
  await signInWithTotp(page, USERS.owner, '/labels');
  await page.getByRole('button', { name: 'Add a label for Goat' }).click();
  await page.getByRole('button', { name: 'One more label for Goat' }).click();
  await page.getByRole('tab', { name: 'Lots and animals' }).click();
  await page.getByRole('button', { name: /^Add a label for Goat G-0142/ }).click();
  const sheet = page.getByRole('list', { name: 'Label sheet' });
  await expect(sheet.getByRole('img', { name: 'Product barcode: LIV-GOAT' })).toHaveCount(2);
  await expect(sheet.getByRole('img', { name: 'Lot barcode: G-0142' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Print 3 labels' })).toBeEnabled();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('receiving a transfer shows how many fewer arrived while you type', async ({ page, api }) => {
  api.rewrite('getStockTransfer', (body) => {
    const transfer = body as { lines: Record<string, unknown>[] };
    return {
      ...transfer,
      status: 'DISPATCHED',
      receivedAt: null,
      receivedBy: null,
      lines: transfer.lines.map((l) => ({
        ...l,
        qtyReceived: null,
        varianceQty: null,
        varianceReasonCode: null,
      })),
    };
  });
  await signIn(page, USERS.storekeeper, `/stock-transfers/${ANY}`);
  const form = page.getByRole('form', { name: 'What arrived, line by line' });
  const arrived = form.getByLabel(/^Goat meat, 15 kg pack: quantity that arrived/);
  await arrived.fill('29.750');
  // 30.150 kg sent (the contract example), 29.750 typed: the gap, exact to the gram, as input feedback.
  await expect(form.getByText('0.400 Kilogram fewer than sent')).toBeVisible();
  await arrived.fill('31');
  await expect(form.getByText(/more than sent$/)).toBeVisible();
  await expectNoAxeViolations(page);
});

for (const [path, heading] of [
  ['/lots', 'Lots and expiry'],
  ['/movements', 'Stock movements'],
  ['/suppliers', 'Suppliers'],
  ['/registers', 'Cash registers'],
  ['/branches', 'Branches and locations'],
] as const) {
  test(`${path} reads in words, axe clean, at 360 px`, async ({ page }) => {
    await signInWithTotp(page, USERS.owner, path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}

test.describe('the shell at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the sidebar folds a group by keyboard, narrows to icons, and Ctrl K reaches search', async ({
    page,
  }) => {
    await signInWithTotp(page, USERS.owner, '/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const stockGroup = nav.getByRole('button', { name: 'Stock' });
    await stockGroup.focus();
    await page.keyboard.press('Enter');
    await expect(stockGroup).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Stock on hand' })).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(nav.getByRole('link', { name: 'Stock on hand' })).toBeVisible();
    await nav.getByRole('button', { name: 'Narrow the menu to icons' }).click();
    await expect(nav.getByRole('link', { name: 'Stock on hand' })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('searchbox', { name: /Search products/ })).toBeFocused();
    await page.keyboard.type('goat');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/products\?q=goat/);
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the current page is marked by more than colour, and the cashier sees only their groups', async ({
    page,
  }) => {
    await signIn(page, USERS.cashier);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('button', { name: 'Catalogue' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Business' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText('The dashboard is for the owner');
  });
});
