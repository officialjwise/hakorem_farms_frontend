import { formatMoney } from '../../../packages/ui/src/format/format';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { PEOPLE, installTillPins } from '../../support/requested';
import { expect, test, type Page } from '../../support/test';
import { installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * F10, against CR-032 and CR-033 as requested (ADR 0046): the till PIN (lock and open offline, the
 * lockout, a supervisor's approval of mobile money offline, a cash drop's witness) and the receipt (by SMS
 * and link, and on a Bluetooth printer only where the browser has one). At 360 px, production build.
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

  const pin = page.getByLabel(/^PIN/);
  await pin.fill(PEOPLE.manager.pin);
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(
    page.getByText('Wrong PIN. 2 more wrong tries lock Adwoa Darko out on this till.'),
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

test('three wrong PINs lock the cashier out, and even the right one waits for the time', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  installTillPins(api);
  await openTillShift(page);
  await lockedTill(page);
  const pin = page.getByLabel(/^PIN/);
  const open = page.getByRole('button', { name: 'Open the till' });
  const after = [
    'Wrong PIN. 2 more wrong tries lock Adwoa Darko out on this till.',
    'Wrong PIN. 1 more wrong try locks Adwoa Darko out on this till.',
  ];
  for (const [index, wrong] of ['1111', '2222'].entries()) {
    await pin.fill(wrong);
    await open.click();
    await expect(page.getByText(after[index] ?? '')).toBeVisible();
  }
  await pin.fill('3333');
  await open.click();
  await expect(page.getByText(/^Adwoa Darko is locked out on this till until /)).toBeVisible();
  await pin.fill(PEOPLE.cashier.pin);
  await page.getByRole('button', { name: 'Open the till' }).click();
  await expect(page.getByText(/^Adwoa Darko is locked out on this till until /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
  // A reload keeps it locked: the lock and the lockout are on the device.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'This till is locked' })).toBeVisible();
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
    momo.getByText(/^Wrong PIN\. 2 more wrong tries lock Kwabena Owusu out/),
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

test('a cash drop takes its witness’s PIN, and the witness goes with it', async ({ page, api }) => {
  const server = installTillServer(api, serverTotal);
  installTillPins(api);
  await openTillShift(page);
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await expect(page.getByRole('button', { name: 'Record it' })).toBeVisible();
  await page.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await page.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(page.locator('[data-slot="cash-witness"]')).toHaveText('Witnessed by Kwabena Owusu');
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText('Witnessed by Kwabena Owusu');
  const sent = page.waitForRequest((r) => r.url().endsWith('/pos/sync'));
  await confirm.getByRole('button', { name: 'Record it' }).click();
  const batch = (await sent).postDataJSON() as { cashMovements: Record<string, unknown>[] };
  expect(batch.cashMovements).toEqual([
    expect.objectContaining({
      kind: 'CASH_DROP',
      amountPesewas: 50000,
      witnessId: PEOPLE.manager.id,
    }),
  ]);
  await expect.poll(() => server.batches.length).toBe(1);
});

test('the digital receipt: the SMS goes to the phone given, and the link is made on the till', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
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
  await expect(confirm).toContainText('Receipt by SMS to +233244550199');
  await confirm.getByRole('button', { name: 'Complete the sale' }).click();

  const digital = page.locator('[data-slot="digital-receipt"]');
  await expect(digital.locator('[data-slot="sms-status"]')).toHaveText(
    'Sent by SMS to +233244550199.',
  );
  const link = digital.locator('[data-slot="receipt-link"]');
  await expect(link).toHaveText(/^https:\/\/hakoremfarms\.com\/r\/[0-9a-f-]{36}$/);
  const sale = (await link.textContent())?.split('/r/')[1];
  const sent = api.log.filter((e) => e.operationId === 'syncOfflineSales');
  expect(sent.length).toBeGreaterThan(0);
  expect(sale).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
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
