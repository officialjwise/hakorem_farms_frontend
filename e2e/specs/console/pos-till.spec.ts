import { formatMoney } from '../../../packages/ui/src/format/format';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  USERS,
} from '../../support/helpers';
import { expect, test } from '../../support/test';
import { installTillServer, openTillShift, find, type SentSale } from '../../support/till';

/**
 * F9's other till flows at 360 px: hold and recall offline and online, a price agreed below the list price
 * with its reason and limits, a cash drop on the queue, the blind close, a return against a receipt, and
 * the wrong roles. axe and no sideways scroll on every till route.
 */

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);

test('a sale held offline stays on this till and comes back at the pack price', async ({
  page,
  context,
  api,
}) => {
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await api.setNetwork(context, false);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page.getByRole('button', { name: 'Hold this sale' }).click();
  const hold = page.getByRole('dialog', { name: 'Hold this sale?' });
  await expect(hold).toContainText('The till is offline: the sale is kept on this till only.');
  await hold.getByRole('textbox', { name: /^Name it/ }).fill('Auntie Esi');
  await hold.getByRole('button', { name: 'Hold this sale' }).click();
  await expect(page.getByText('The sale is held.')).toBeVisible();
  await expect(page.getByText('No items yet')).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'holdSale')).toHaveLength(0);

  await page.getByRole('button', { name: 'Bring back a held sale' }).click();
  const recall = page.getByRole('dialog', { name: 'Bring back a held sale' });
  await recall.getByRole('button', { name: /^Auntie Esi: 1 items/ }).click();
  await expect(page.getByText("The held sale is back, at today's prices.")).toBeVisible();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(65000));
});

test('each goat sells at its own band, and one the pack cannot price says why (CR-052)', async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('button', { name: 'Goat', exact: true }).click();
  const choose = page.getByRole('dialog', { name: /Goat/ });
  // Each animal at its own price, from its own weight: never one price for "a goat".
  await expect(choose.getByRole('button', { name: /^G-0142/ })).toContainText(formatMoney(65000));
  await expect(choose.getByRole('button', { name: /^G-0157/ })).toContainText(formatMoney(120000));
  const unweighed = choose.getByRole('button', { name: /^G-0190/ });
  await expect(unweighed).toContainText('No price: it needs a grade or a weight first');
  await expect(unweighed).toBeDisabled();
  // Not for sale now: not offered at all.
  await expect(choose.getByRole('button', { name: /^G-0163/ })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await choose.getByRole('button', { name: /^G-0157/ }).click();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(120000));
  // Found by its tag, the unpriced goat says why, and nothing goes on the sale.
  await find(page, 'G-0190', /^Goat G-0190/);
  await expect(page.getByText('G-0190 has no price on this till')).toBeVisible();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(120000));

  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('1200');
  await page.getByRole('button', { name: 'Review the sale' }).click();
  await page.getByRole('button', { name: 'Complete the sale' }).click();
  await expect(page.getByText(/Official receipt RCP-/)).toBeVisible();
  expect(server.batches[0]?.sales[0]?.lines[0]).toMatchObject({
    stockUnitId: '019a7a8f-7e29-7a85-bfbd-b12324342a01',
    agreedUnitPricePesewas: 120000,
    weightKg: '31.800',
  });
  await expectNoHorizontalScroll(page);
});

test('online, a held sale goes to the register with its lines', async ({ page, api }) => {
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await find(page, 'G-0157', /G-0157$/);
  const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/held-sales'));
  await page.getByRole('button', { name: 'Hold this sale' }).click();
  await page
    .getByRole('dialog', { name: 'Hold this sale?' })
    .getByRole('button', { name: 'Hold this sale' })
    .click();
  const body = (await sent).postDataJSON() as {
    id: string;
    payload: { lines: { stockUnitIdentifier: string }[] };
  };
  expect(body.payload.lines.map((l) => l.stockUnitIdentifier)).toEqual(['G-0157']);
  await expect(page.getByText('The sale is held.')).toBeVisible();
});

test('an agreed price needs a reason and stays inside the cashier limits', async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await find(page, 'G-0142', /G-0142$/);
  await page.getByRole('button', { name: 'Change Goat G-0142' }).click();
  const line = page.getByRole('dialog', { name: 'Change G-0142' });
  const price = line.getByRole('textbox', { name: /^Agreed price a head/ });
  // G-0142's own band lists GH₵650.00 (CR-052). GH₵60.01 off is more than the GH₵50.00 a line the pack
  // allows.
  await price.fill('589.99');
  await line.getByRole('combobox', { name: /^Why the price differs/ }).click();
  await page.getByRole('option', { name: 'Regular customer, agreed price' }).click();
  await line.getByRole('button', { name: 'Save the item' }).click();
  await expect(line.getByText('That discount is more than you may give on one item')).toBeVisible();
  await expect(line).toContainText(
    'You may give up to GH₵50.00 off an item and GH₵200.00 on a shift.',
  );
  await price.fill('600');
  await line.getByRole('button', { name: 'Save the item' }).click();
  await expect(line).toBeHidden();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(60000));

  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('600');
  await page.getByRole('button', { name: 'Review the sale' }).click();
  await page.getByRole('button', { name: 'Complete the sale' }).click();
  await expect(page.getByText(/Official receipt RCP-/)).toBeVisible();
  expect(server.batches[0]?.sales[0]?.lines[0]).toMatchObject({
    agreedUnitPricePesewas: 60000,
    varianceReasonCode: 'REGULAR_CUSTOMER',
  });
});

test('a cash drop made offline is kept, sent on reconnecting, and is unwitnessed; the close waits for it', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312' })).toBeVisible();

  await api.setNetwork(context, false);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  // A drop's one reason is chosen for the cashier; offline with no PIN on the till, nobody can witness it.
  await expect(page.locator('[data-slot="cash-unwitnessed"]')).toContainText(
    'The till is offline and holds no supervisor’s PIN',
  );
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText('Cash dropped to the safe');
  await expect(confirm).toContainText('Unwitnessed');
  await confirm.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Cash drop kept on this till.')).toBeVisible();
  await expect(page.getByText('Closing a shift needs the server. Connect the till.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Declare the count' })).toBeDisabled();
  await expectNoAxeViolations(page);

  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/cash-movements'),
  );
  await api.setNetwork(context, true);
  const body = (await sent).postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({ kind: 'CASH_DROP', amountPesewas: 50000, reasonCode: 'SAFE_DROP' });
  expect(body).not.toHaveProperty('witnessId');
  await expect(page.getByText('Cash drop recorded, unwitnessed.')).toBeVisible();
  const moved = page.locator('[data-slot="cash-moved"]');
  await expect(moved.first()).toContainText('Cash drop');
  await expect(moved.first()).toContainText('Unwitnessed');
  await expect(page.getByRole('button', { name: 'Declare the count' })).toBeEnabled();
  expect(server.batches).toHaveLength(0);
});

test('the close is blind: the count is declared before the expected figures are shown', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(
    page.getByText('What the till expected is shown only after you declare.'),
  ).toBeVisible();
  await expect(page.getByText('Expected', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: /^Cash counted/ }).fill('8225');
  await page.getByRole('textbox', { name: /^Mobile money counted/ }).fill('4120');
  await page.getByRole('button', { name: 'Declare the count' }).click();
  const confirm = page.getByRole('dialog', { name: 'Declare this count?' });
  await expect(confirm).toContainText(formatMoney(822500));
  const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/close'));
  await confirm.getByRole('button', { name: 'Declare the count' }).click();
  const body = (await sent).postDataJSON() as {
    declared: { declaredPesewas: number }[];
    lastDeviceCounter: number;
  };
  expect(body.declared.map((d) => d.declaredPesewas)).toEqual([822500, 412000]);
  expect(body.lastDeviceCounter).toBe(0);
  // Now, and only now, the API's expected figures and the short in words.
  await expect(
    page.getByRole('heading', { name: 'The count against what was expected' }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="over-short"]')).toHaveText(
    `Short by ${formatMoney(12000)}`,
  );
  await expect(page.getByText('A supervisor who is not you signs this close off.')).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a return against a receipt: the API works out the refund, and above the limit it waits', async ({
  page,
  api,
}) => {
  api.rewrite('listReasonCodes', () => ({
    data: [
      {
        code: 'CHANGED_MIND',
        domain: 'RETURN',
        description: 'Customer changed their mind',
        requiresNote: false,
        lossAccountGroup: null,
      },
    ],
    page: { nextCursor: null, limit: 100, hasMore: false },
  }));
  api.prefer('submitReturn', 'code=202');
  await signIn(page, USERS.cashier, '/pos/returns');
  await page.getByRole('textbox', { name: /^Receipt number/ }).fill('RCP-2026-DDW-T1-018834');
  await page.getByRole('button', { name: 'Find the receipt' }).click();
  await expect(
    page.getByRole('heading', { name: /Against receipt RCP-2026-DDW-T1-018834/ }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: /^Returning of Eggs/ }).fill('1');
  await page.getByRole('combobox', { name: /^Reason/ }).click();
  await page.getByRole('option', { name: 'Customer changed their mind' }).click();
  await page.getByRole('button', { name: 'Review the return' }).click();
  const confirm = page.getByRole('dialog', { name: 'Take this return?' });
  await expect(confirm).toContainText('Eggs, big, crate of 30: 1 crate, Back to stock');
  const created = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/returns'));
  await confirm.getByRole('button', { name: 'Take the return' }).click();
  expect((await created).postDataJSON()).toMatchObject({
    orderId: '019a7aac-216c-721a-8753-2a7ecd11a35c',
    kind: 'RETURN',
    reasonCode: 'CHANGED_MIND',
    refundDestination: 'CASH',
    lines: [
      { orderLineId: '019a7aef-eb2b-7d93-92cc-e21079f25aee', qty: '1.000', disposition: 'RESTOCK' },
    ],
  });
  await expect(page.getByText('The return waits for approval')).toBeVisible();
  await expect(page.getByText('Nothing is refunded and no stock moves until then.')).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('wrong roles see permission denied in words: a storekeeper at the till, a cashier at setup', async ({
  page,
  browser,
}) => {
  await signIn(page, USERS.cashier, '/pos/setup');
  await expect(
    page.getByText(/do not have access|does not include the permission/i).first(),
  ).toBeVisible();
  await expect(page.getByText('pos.device.enrol')).toBeVisible();

  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    baseURL: test.info().project.use.baseURL,
  });
  const { FakeApi } = await import('../../support/fakeApi');
  const other = new FakeApi();
  await other.install(context);
  const storekeeper = await context.newPage();
  await signIn(storekeeper, USERS.storekeeper, '/pos');
  await expect(storekeeper.getByText('pos.sale.create')).toBeVisible();
  await context.close();
});

for (const [path, ready] of [
  ['/pos', 'Find an item'],
  ['/pos/shift', 'What the till expected is shown only after you declare.'],
  ['/pos/queue', 'Shift opened'],
  ['/pos/setup', 'This device is a till'],
  ['/pos/returns', 'Receipt number'],
] as const) {
  test(`${path} at 360 px: axe clean, no sideways scroll`, async ({ page, api }) => {
    installTillServer(api, serverTotal);
    await openTillShift(page);
    if (path === '/pos/setup') {
      // Setup is the manager's; the cashier is denied it (above). The manager reads the enrolled till.
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
      const { signInWithTotp } = await import('../../support/helpers');
      await signInWithTotp(page, USERS.manager, path);
    } else {
      await page.goto(path);
    }
    await expect(page.getByText(ready).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
