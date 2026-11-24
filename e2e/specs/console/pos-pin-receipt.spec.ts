import { formatMoney } from '../../../packages/ui/src/format/format';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { PEOPLE, installTillPins } from '../../support/tillPins';
import { expect, test, type Page } from '../../support/test';
import { find, installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * F10: the till PIN as 2.17.0 carries it (CR-032; ADR 0047, ADR 0057): lock and open offline, every try
 * told to the server, a locked PIN with no timer that opens again only with a new PIN set on the till, the
 * supervisor's sign-out, the floor on the hash, a supervisor's approval of mobile money offline and a cash
 * drop's witness, each with its PIN version. And the receipt, against CR-033 as requested (ADR 0046): by
 * SMS and link, and on a Bluetooth printer only where the browser has one. At 360 px, production build.
 */

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);
const TOMATOES = 65000; // a crate, the pack's list price

async function lockedTill(page: Page) {
  await page.getByRole('button', { name: 'Lock the till' }).click();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
}

test('the till locks and opens on the cashier’s PIN with the network off; the sale under way is kept', async ({
  page,
  context,
  api,
}) => {
  installTillServer(api, serverTotal);
  const pins = installTillPins(api);
  await openTillShift(page);
  expect(pins.issued).toBeGreaterThan(0);

  await api.setNetwork(context, false);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  const requestsBefore = api.log.length;
  await lockedTill(page);
  // Nothing to scan into and nothing to sell while locked.
  await expect(page.getByRole('searchbox', { name: /^Search by name, SKU or tag/ })).toBeHidden();
  await expect(page.getByRole('region', { name: 'This sale' })).toBeHidden();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  // The first PIN field opens the till; the second is the supervisor's sign-out.
  const pin = page.getByLabel(/^PIN/).first();
  await pin.fill(PEOPLE.manager.pin);
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(
    page.getByText('Wrong PIN. 2 more wrong tries lock Adwoa Darko’s PIN on every till.'),
  ).toBeVisible();
  await pin.fill(PEOPLE.cashier.pin);
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'This sale' }).locator('[data-slot="cart-total"]'),
  ).toHaveText(formatMoney(TOMATOES));
  // The PIN never left the device.
  expect(api.log.length).toBe(requestsBefore);
});

test('three wrong PINs lock the cashier’s PIN with no timer, and only a supervisor’s PIN signs them out', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  const server = installTillPins(api);
  await api.installClock(page, new Date());
  await openTillShift(page);
  await lockedTill(page);
  // No plain sign-out on a locked till (owner, 2026-11-17), and none for a supervisor until the PIN locks.
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Sign out the cashier' })).toHaveCount(0);
  const pin = page.getByLabel(/^PIN$/).first();
  const open = page.getByRole('button', { name: 'Open the till' });
  const after = [
    'Wrong PIN. 2 more wrong tries lock Adwoa Darko’s PIN on every till.',
    'Wrong PIN. 1 more wrong try locks Adwoa Darko’s PIN on every till.',
  ];
  for (const [index, wrong] of ['1111', '2222'].entries()) {
    await pin.fill(wrong);
    await open.click();
    await expect(page.getByText(after[index] ?? '')).toBeVisible();
  }
  await pin.fill('3333');
  await open.click();
  const lockedOut = page.locator('[data-slot="locked-out"]');
  await expect(lockedOut).toContainText('It does not end with time');
  // The PIN can no longer be tried, and every try was told to the server at once: it holds the PIN locked.
  await expect(open).toHaveCount(0);
  await expect
    .poll(() => server.reports.flatMap((r) => r.events).map((e) => [e.outcome, e.purpose]))
    .toEqual([
      ['FAILED', 'UNLOCK'],
      ['FAILED', 'UNLOCK'],
      ['FAILED', 'UNLOCK'],
    ]);
  expect(server.pins.get(PEOPLE.cashier.id)).toMatchObject({ wrongTries: 3, locked: true });
  // Past the five minutes the old timed lockout lasted, the device clock ends nothing; nor does a reload.
  await api.fastForward(page, 10 * 60 * 1000);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
  await expect(page.locator('[data-slot="locked-out"]')).toBeVisible();
  // The server still holds it, until a new PIN is set.
  await page.getByRole('button', { name: 'Check with the server' }).click();
  await expect(
    page.getByText('The server still holds the PIN locked.', { exact: false }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  const signOut = page.getByRole('region', { name: 'Sign out the cashier' });
  await expect(signOut.getByRole('combobox', { name: 'Supervisor' })).toHaveText(
    PEOPLE.manager.name,
  );
  await signOut.getByLabel(/^PIN$/).fill('000000');
  await signOut.getByRole('button', { name: 'Sign Adwoa Darko out' }).click();
  await expect(
    signOut.getByText(/^Wrong PIN\. 2 more wrong tries lock Kwabena Owusu/),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
  await signOut.getByLabel(/^PIN$/).fill(PEOPLE.manager.pin);
  await signOut.getByRole('button', { name: 'Sign Adwoa Darko out' }).click();
  await expect(page).toHaveURL(/\/login/);
  // Recorded with who did it and when, sent while the session was still there, after the tries.
  const signedOut = server.reports.flatMap((r) => r.signOuts ?? []);
  expect(signedOut).toHaveLength(1);
  expect(signedOut[0]).toMatchObject({
    cashierId: PEOPLE.cashier.id,
    supervisorId: PEOPLE.manager.id,
    supervisorPinVersion: 7,
  });
  expect(signedOut[0]?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  // The supervisor's tries were told too, and the cashier's PIN stays locked until they set a new one.
  expect(
    server.reports
      .flatMap((r) => r.events)
      .filter((e) => e.principalId === PEOPLE.manager.id)
      .map((e) => [e.outcome, e.purpose]),
  ).toEqual([
    ['FAILED', 'SIGN_OUT'],
    ['SUCCEEDED', 'SIGN_OUT'],
  ]);
  expect(server.pins.get(PEOPLE.cashier.id)?.locked).toBe(true);
});

test('a locked PIN opens again only with a new one, set on the till: only the check leaves it', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  const server = installTillPins(api);
  const held = server.pins.get(PEOPLE.cashier.id);
  if (held === undefined) throw new Error('no cashier PIN');
  Object.assign(held, { wrongTries: 3, locked: true });
  await openTillShift(page);
  // A locked PIN cannot lock the till: nothing would open it.
  await expect(page.getByRole('button', { name: 'Lock the till' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Change my till PIN' }).click();
  const dialog = page.getByRole('dialog', { name: 'Set my till PIN' });
  await expect(dialog).toContainText('the PIN itself never leaves this till');
  await dialog.getByLabel(/^New PIN/).fill('7350');
  await dialog.getByLabel(/^The same PIN again/).fill('7351');
  await dialog.getByRole('button', { name: 'Set the PIN' }).click();
  await expect(dialog.getByText('The two PINs are not the same. Type it again.')).toBeVisible();
  await dialog.getByLabel(/^The same PIN again/).fill('7350');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await dialog.getByRole('button', { name: 'Set the PIN' }).click();
  await expect(dialog.getByText('Your till PIN is set. It works on this till now.')).toBeVisible();
  expect(server.pinsSet).toHaveLength(1);
  const sent = server.pinsSet[0];
  expect(Object.keys(sent ?? {}).sort()).toEqual(['algorithm', 'iterations', 'pinHash', 'pinSalt']);
  expect(sent).toMatchObject({ algorithm: 'PBKDF2-SHA256', iterations: 600_000 });
  expect(JSON.stringify(sent)).not.toContain('7350');
  expect(server.pins.get(PEOPLE.cashier.id)).toMatchObject({ version: 3, locked: false });
  await dialog.getByRole('button', { name: 'Close' }).first().click();

  await lockedTill(page);
  await page.getByLabel(/^PIN$/).first().fill(PEOPLE.cashier.pin);
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(page.getByText(/^Wrong PIN\./)).toBeVisible();
  await page.getByLabel(/^PIN$/).first().fill('7350');
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeHidden();
});

test('a PIN check weaker than the floor is refused and said so; that cashier cannot lock the till', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  installTillPins(api, { weakCashier: true });
  await openTillShift(page);
  await expect(page.locator('[data-slot="pin-refused"]')).toContainText(
    'The server sent PIN checks this till refuses as weaker than it accepts: Adwoa Darko.',
  );
  await expect(page.getByRole('button', { name: 'Lock the till' })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('the till locks itself after two minutes untouched', async ({ page, api }) => {
  installTillServer(api, serverTotal);
  installTillPins(api);
  await api.installClock(page, new Date());
  await openTillShift(page);
  await api.fastForward(page, 60_000);
  await expect(page.getByRole('heading', { name: 'Find an item' })).toBeVisible();
  await api.fastForward(page, 61_000);
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
});

test('offline mobile money on a supervisor’s PIN: not yet verified on the receipt, the approver sent at sync', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal, { offlineMobileMoney: true });
  installTillPins(api);
  await openTillShift(page);
  await api.setNetwork(context, false);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  const momo = pay.getByRole('group', { name: 'Mobile money without the network' });
  await momo.getByRole('textbox', { name: /^Amount/ }).fill('200');
  await momo
    .getByRole('textbox', { name: /^Customer's mobile money number/ })
    .fill('+233245550142');
  await momo.getByRole('textbox', { name: /^Transaction id/ }).fill('MP261113.1149.C41872');
  await expect(momo.getByRole('combobox', { name: /^Supervisor approving/ })).toContainText(
    PEOPLE.manager.name,
  );
  await momo.getByLabel(/^PIN/).fill('000000');
  await momo.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(
    momo.getByText(/^Wrong PIN\. 2 more wrong tries lock Kwabena Owusu’s PIN/),
  ).toBeVisible();
  await momo.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await momo.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(pay).toContainText('Mobile money, not yet verified, approved by Kwabena Owusu');
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('500');
  await expect(pay.locator('[data-slot="change-due"]')).toHaveText(formatMoney(5000));
  await expectNoAxeViolations(page);
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  await page
    .getByRole('dialog', { name: 'Complete this sale?' })
    .getByRole('button', { name: 'Complete the sale' })
    .click();
  const receipt = page.getByRole('article', { name: /^Receipt P-T1-312-0001/ });
  await expect(receipt.locator('[data-slot="receipt-unverified"]')).toHaveText(
    'Mobile money, not yet verified · Ref. MP261113.1149.C41872',
  );

  await api.setNetwork(context, true);
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('All sent');
  const sale = server.batches[0]?.sales[0];
  expect(sale?.tenders).toEqual([
    {
      paymentMethodId: '019a7a92-c15e-7582-aabb-60fcf9dfd9da',
      amountPesewas: 20000,
      unverifiedMobileMoney: {
        payerPhone: '+233245550142',
        network: 'MTN',
        providerReference: 'MP261113.1149.C41872',
        approvedById: PEOPLE.manager.id,
        approvedByPinVersion: 7,
      },
    },
    {
      paymentMethodId: '019a7a92-a26f-7b9f-90d7-c2c5802e3ba3',
      amountPesewas: 45000,
      tenderedPesewas: 50000,
    },
  ]);
  await page.getByRole('link', { name: 'See sales to send' }).click();
  await expect(page.locator('[data-slot="queue-approvals"]')).toHaveText(
    "Mobile money approved: Kwabena Owusu's PIN (version 7)",
  );
});

test('offline, a supervisor’s PIN approves a price beyond the cashier’s limit, up to their own, and it is reported at sync', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  const pins = installTillPins(api);
  await openTillShift(page);
  await api.setNetwork(context, false);
  await find(page, 'G-0142', /G-0142$/);
  await page.getByRole('button', { name: 'Change Goat G-0142' }).click();
  const line = page.getByRole('dialog', { name: 'Change G-0142' });
  const price = line.getByRole('textbox', { name: /^Agreed price a head/ });
  // GH₵110.00 off G-0142's GH₵650.00: past the cashier's GH₵50.00, and past the supervisor's GH₵100.00.
  await price.fill('540');
  await line.getByRole('combobox', { name: /^Why the price differs/ }).click();
  await page.getByRole('option', { name: 'Regular customer, agreed price' }).click();
  const approval = line.locator('[data-slot="price-approval"]');
  await expect(approval).toContainText(
    'No supervisor on this till may approve a discount of GH₵110.00: change the price to within your limit.',
  );
  // GH₵80.00 off: within the supervisor's own GH₵100.00 a line.
  await price.fill('570');
  await expect(approval).toContainText(
    'A discount of GH₵80.00 on this item is more than you may give.',
  );
  // The cashier is never offered as their own supervisor.
  const who = approval.getByRole('combobox', { name: /^Supervisor approving the price/ });
  await expect(who).toContainText(PEOPLE.manager.name);
  await who.click();
  await expect(page.getByRole('option', { name: PEOPLE.cashier.name })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await approval.getByLabel(/^PIN/).fill('000000');
  await approval.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(
    approval.getByText(/^Wrong PIN\. 2 more wrong tries lock Kwabena Owusu’s PIN/),
  ).toBeVisible();
  await approval.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await approval.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(line.locator('[data-slot="price-approved"]')).toHaveText(
    'Approved by Kwabena Owusu’s PIN: a discount of GH₵80.00 on this item.',
  );
  await expectNoAxeViolations(page);
  await line.getByRole('button', { name: 'Save the item' }).click();
  await expect(line).toBeHidden();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(57000));

  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('570');
  await page.getByRole('button', { name: 'Review the sale' }).click();
  await page.getByRole('button', { name: 'Complete the sale' }).click();

  await api.setNetwork(context, true);
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('All sent');
  expect(server.batches[0]?.sales[0]?.lines[0]).toMatchObject({
    agreedUnitPricePesewas: 57000,
    varianceReasonCode: 'REGULAR_CUSTOMER',
    overrideApproval: { approvedById: PEOPLE.manager.id, approvedByPinVersion: 7 },
  });
  // Both tries were told to the server as approvals, the wrong one too.
  const tries = pins.reports.flatMap((report) => report.events);
  expect(
    tries.filter((e) => e.principalId === PEOPLE.manager.id).map((e) => [e.outcome, e.purpose]),
  ).toEqual([
    ['FAILED', 'APPROVAL'],
    ['SUCCEEDED', 'APPROVAL'],
  ]);
  await page.getByRole('link', { name: 'See sales to send' }).click();
  await expect(page.locator('[data-slot="queue-approvals"]')).toHaveText(
    "Price approved: Kwabena Owusu's PIN (version 7)",
  );
  await expectNoHorizontalScroll(page);
});

test('offline, a cash drop takes its witness’s PIN, and the witness goes with it', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  installTillPins(api);
  await openTillShift(page);
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  // Online the till names a supervisor signed in at the branch (CR-050); offline it takes a PIN.
  await api.setNetwork(context, false);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await expect(page.getByRole('button', { name: 'Record it' })).toBeVisible();
  await page.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await page.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(page.locator('[data-slot="cash-witness"]')).toHaveText('Witnessed by Kwabena Owusu');
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText('Witnessed by Kwabena Owusu');
  await confirm.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Cash drop kept on this till.')).toBeVisible();
  // Back within five minutes, it goes alone to recordCashMovement (2.5.0), witness and all.
  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/cash-movements'),
  );
  await api.setNetwork(context, true);
  expect((await sent).postDataJSON()).toMatchObject({
    kind: 'CASH_DROP',
    amountPesewas: 50000,
    reasonCode: 'SAFE_DROP',
    witnessId: PEOPLE.manager.id,
    witnessPinVersion: 7,
  });
  await expect(page.getByText('Cash drop recorded.')).toBeVisible();
  expect(server.movements).toHaveLength(1);
});

test('the digital receipt: the till makes the link from its own token and sends the token with the sale', async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('650');
  await pay
    .getByRole('textbox', { name: /^Customer's phone for the receipt/ })
    .fill('+233 24 455 0199');
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete this sale?' });
  await expect(confirm).toContainText('Customer’s phone: +233244550199');
  await confirm.getByRole('button', { name: 'Complete the sale' }).click();

  const digital = page.locator('[data-slot="digital-receipt"]');
  // 2.41.0 (CR-033 point 3): the farm sends the link by SMS at sync; the till is not told whether it arrives.
  await expect(digital.locator('[data-slot="sms-status"]')).toHaveText(
    'The server has the sale, so the farm sends the receipt link by SMS to +233244550199. The till is not told whether it arrives.',
  );
  const link = digital.locator('[data-slot="receipt-link"]');
  await expect(link).toHaveText(/^https:\/\/hakoremfarms\.com\/r\/[A-Za-z0-9_-]{22}$/);
  const token = (await link.textContent())?.split('/r/')[1] ?? '';
  // The token is no id: not the sale's UUID, nor shaped like one.
  expect(token).not.toMatch(/^[0-9a-f]{8}-/);
  await expect(digital.locator('[data-slot="receipt-link-state"]')).toHaveText(
    'The server has the sale, so the link works now.',
  );
  const sent = server.batches.flatMap((batch) => batch.sales);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.every((sale) => sale.receiptToken === token)).toBe(true);
  expect(sent[0]?.id).not.toContain(token);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('no Web Bluetooth (Safari on iOS): the till says so in words, and the sale is complete', async ({
  page,
  api,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'bluetooth', {
      get: () => undefined,
      configurable: true,
    });
  });
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('650');
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  await page
    .getByRole('dialog', { name: 'Complete this sale?' })
    .getByRole('button', { name: 'Complete the sale' })
    .click();
  await expect(page.getByRole('heading', { name: 'Sale complete' })).toBeVisible();
  await expect(page.locator('[data-slot="printer-unsupported"]')).toContainText(
    'Safari on iPhone and iPad has no Web Bluetooth',
  );
  await expect(
    page.getByRole('button', { name: /^Connect a receipt printer|^Print on/ }),
  ).toHaveCount(0);
  await expect(page.locator('[data-slot="digital-receipt"]')).toContainText(
    'No phone number was given',
  );
});

test('a Bluetooth printer where there is one: connected on a tap, the 58 mm receipt sent to it', async ({
  page,
  api,
}) => {
  // A printer the browser can reach: the Web Bluetooth calls the till makes, and the bytes it writes.
  await page.addInitScript(() => {
    const written: number[] = [];
    (window as unknown as { printed: number[] }).printed = written;
    const characteristic = {
      properties: { write: true, writeWithoutResponse: false },
      writeValue: async (value: Uint8Array) => {
        written.push(...value);
      },
    };
    const server = {
      connected: true,
      getPrimaryService: async () => ({ getCharacteristics: async () => [characteristic] }),
    };
    Object.defineProperty(Navigator.prototype, 'bluetooth', {
      configurable: true,
      get: () => ({
        getAvailability: async () => true,
        requestDevice: async () => ({
          name: 'MTP-II',
          gatt: { connected: true, connect: async () => server },
        }),
      }),
    });
  });
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('700');
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  await page
    .getByRole('dialog', { name: 'Complete this sale?' })
    .getByRole('button', { name: 'Complete the sale' })
    .click();
  await expect(
    page.getByText('A printer is optional. The sale is complete without one.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Connect a receipt printer' }).click();
  await page.getByRole('button', { name: 'Print on MTP-II' }).click();
  await expect(page.getByText('Printed on MTP-II.')).toBeVisible();
  const printed = await page.evaluate(() =>
    String.fromCharCode(...(window as unknown as { printed: number[] }).printed),
  );
  expect(printed.startsWith('\x1b@')).toBe(true);
  expect(printed).toContain('Sale reference     P-T1-312-0001');
  expect(printed).toContain('Total                 GHS 650.00');
  expect(printed).toContain('Change                 GHS 50.00');
  // The link printed in full; no QR code (owner, 2026-11-17: the TOTP image is the only one).
  expect(printed).toContain('Your receipt online:\nhttps://hakoremfarms.com/r/');
  expect(printed).not.toContain(String.fromCharCode(0x1d));
  await expectNoAxeViolations(page);
});
