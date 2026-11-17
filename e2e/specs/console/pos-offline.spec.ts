import { formatMoney } from '../../../packages/ui/src/format/format';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { expect, test } from '../../support/test';
import {
  expectedHash,
  installTillServer,
  openTillShift,
  find,
  type SentSale,
} from '../../support/till';

/**
 * THE F9 GATE (BUILD_PROMPT F9): a full sale completes with the network off and syncs exactly once on
 * reconnect. At 360 px, in Chromium, against the production build. The sale is a goat by its tag at its
 * list price and a pack of beef weighed at the counter, paid in cash with change. With the network off the
 * till keeps the sale, its counter, its hash and its receipt on the device and sends nothing; when the
 * network returns it sends the sale once, and a second pass sends nothing more.
 */

const GOAT = 85000; // G-0142, the pack's list price a head
const BEEF = 45750; // 15.250 kg at GH₵30.00 a kilogram
const TOTAL = GOAT + BEEF;
const HANDED = 140000;

/** The server's own figure for a sale: what the till charged, line by line, as it re-prices it. */
const serverTotal = (sale: SentSale) =>
  sale.tenders.reduce((sum, tender) => sum + tender.amountPesewas, 0);

test('the F9 gate: a full sale with the network off, synced exactly once on reconnect', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);

  // The network goes. Everything from here to the receipt happens on the device.
  await api.setNetwork(context, false);
  await expect(page.getByText('Offline').first()).toBeVisible();
  const syncsBefore = api.log.filter((e) => e.operationId === 'syncOfflineSales').length;

  // A goat by its tag: the pack's list price, its last weight carried as an estimate.
  await find(page, 'G-0142', /G-0142$/);
  await expect(page.getByText('Added G-0142')).toBeVisible();
  // Beef by the kilogram: its line opens for the weight at once.
  await page.getByRole('button', { name: 'Beef, 15 kg pack' }).click();
  const line = page.getByRole('dialog', { name: 'Change Beef, 15 kg pack' });
  await line.getByRole('textbox', { name: /^Weight \(kg\)/ }).fill('15.250');
  await expect(line).toContainText(`This item comes to ${formatMoney(BEEF)}`);
  await line.getByRole('button', { name: 'Save the item' }).click();
  const cart = page.getByRole('region', { name: 'This sale' });
  await expect(cart.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(TOTAL));

  // Payment: offline, cash only; the change is worked out on the device.
  await cart.getByRole('button', { name: 'Take payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await expect(pay).toContainText('The till is offline: cash only until it reconnects.');
  await pay.getByRole('textbox', { name: /^Cash handed over/ }).fill('1400');
  await expect(pay.locator('[data-slot="change-due"]')).toHaveText(formatMoney(HANDED - TOTAL));
  await pay.getByRole('button', { name: 'Review the sale' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete this sale?' });
  await expect(confirm).toContainText(formatMoney(GOAT));
  await expect(confirm).toContainText(formatMoney(BEEF));
  await expect(confirm).toContainText(formatMoney(HANDED));
  await expect(confirm).toContainText('The till is offline: the sale waits on this till');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Complete the sale' }).click();

  // Done, with the network still off: the change, the provisional reference, and the receipt.
  await expect(page.getByRole('heading', { name: 'Sale complete' })).toBeVisible();
  await expect(page.locator('[data-slot="done-change"]')).toHaveText(formatMoney(HANDED - TOTAL));
  const status = page.locator('[data-slot="done-status"]');
  await expect(status).toContainText('On this till, not sent yet');
  await expect(status).toContainText('Kept on this till as P-T1-312-0001');
  const receipt = page.getByRole('article', { name: 'Receipt P-T1-312-0001' });
  await expect(receipt).toContainText('Follows when the sale is recorded');
  await expect(receipt).toContainText(formatMoney(TOTAL));
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('1 to send');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  // Nothing reached the server while the network was off.
  expect(api.log.filter((e) => e.operationId === 'syncOfflineSales')).toHaveLength(syncsBefore);
  expect(server.batches).toHaveLength(0);

  // The sale survives a reload of the store: it is in IndexedDB, not in memory.
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('hakorem-till');
        open.onsuccess = () => {
          const read = open.result.transaction('queue').objectStore('queue').getAll();
          read.onsuccess = () =>
            resolve((read.result as { kind: string }[]).filter((e) => e.kind === 'SALE').length);
          read.onerror = () => reject(read.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
  expect(stored).toBe(1);

  // The network comes back: the till sends the sale at once, and it lands once.
  await api.setNetwork(context, true);
  await expect(status).toContainText('Official receipt RCP-2026-DDW-T1-006201');
  await expect(status).toContainText('Sent and recorded');
  await expect(receipt).toContainText('RCP-2026-DDW-T1-006201');
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('All sent');

  expect(server.batches).toHaveLength(1);
  const batch = server.batches[0];
  expect(batch?.sales).toHaveLength(1);
  const sale = batch?.sales[0] as SentSale;
  expect(sale).toMatchObject({ deviceCounter: 1, provisionalRef: 'P-T1-312-0001' });
  expect(sale.lines).toEqual([
    {
      productId: '019a7a8d-137d-74bf-b9f8-54cda260cdab',
      stockUnitId: '019a7a8f-5f3a-70a1-a5d9-12ebaa838bc9',
      quantity: '1.000',
      weightKg: '26.400',
      weightSource: 'ESTIMATE',
      agreedUnitPricePesewas: GOAT,
    },
    {
      productId: '019a7a8e-29e4-7dbe-82f7-e4c0e9995d9e',
      quantity: '1.000',
      weightKg: '15.250',
      weightSource: 'MANUAL',
      agreedUnitPricePesewas: 3000,
    },
  ]);
  expect(sale.tenders).toEqual([
    {
      paymentMethodId: '019a7a92-a26f-7b9f-90d7-c2c5802e3ba3',
      amountPesewas: TOTAL,
      tenderedPesewas: HANDED,
    },
  ]);
  // The hash the server recomputes matches: the record is as it was when the receipt was printed.
  expect(sale.payloadHash).toBe(expectedHash(sale));

  // Exactly once: the queue screen says all is sent, "Send now" has nothing to send, and a reload sends
  // nothing more.
  await page.getByRole('link', { name: 'See sales to send' }).click();
  await expect(page.getByText('Everything on this till has been sent.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send now' })).toBeDisabled();
  const record = page.locator('[data-slot="queue-record"]', { hasText: 'Sale P-T1-312-0001' });
  await expect(record).toContainText('Sent and recorded');
  await expect(record).toContainText('receipt RCP-2026-DDW-T1-006201');
  await page.reload();
  await expect(page.getByText('Everything on this till has been sent.')).toBeVisible();
  expect(server.batches).toHaveLength(1);
  expect(server.applied.size).toBe(1);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('an answer lost on the way back: the till resends the same sale, and the server keeps one', async ({
  page,
  context,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await api.setNetwork(context, false);
  await find(page, 'beef', 'Beef, 15 kg pack');
  const line = page.getByRole('dialog', { name: 'Change Beef, 15 kg pack' });
  await line.getByRole('textbox', { name: /^Weight \(kg\)/ }).fill('2.000');
  await line.getByRole('button', { name: 'Save the item' }).click();
  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('60');
  await page.getByRole('button', { name: 'Review the sale' }).click();
  await page.getByRole('button', { name: 'Complete the sale' }).click();
  await expect(page.getByText('Kept on this till as P-T1-312-0001')).toBeVisible();

  // The first sync reaches the server, which applies it, and the answer is lost.
  api.loseNextAnswer('syncOfflineSales');
  await api.setNetwork(context, true);
  await expect(page.getByText('Official receipt RCP-2026-DDW-T1-006201')).toBeVisible({
    timeout: 20_000,
  });

  // Two requests carried the same sale with the same id, counter and hash; the server applied it once.
  expect(server.batches.length).toBeGreaterThanOrEqual(2);
  const sent = server.batches.map((b) =>
    b.sales.map((s) => [s.id, s.deviceCounter, s.payloadHash]),
  );
  expect(new Set(sent.map((s) => JSON.stringify(s))).size).toBe(1);
  expect(server.applied.size).toBe(1);
  await expect(page.getByText('Sent and recorded (already on the server)')).toBeVisible();
});

test('a cashier finds items offline by search, and an animal that is not sellable is refused in words', async ({
  page,
  context,
  api,
}) => {
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await api.setNetwork(context, false);
  const search = page.getByRole('searchbox', { name: /^Search by name, SKU or tag/ });
  await search.fill('G-0163');
  await expect(page.getByText('G-0163 cannot be sold here')).toBeVisible();
  // A barcode is not something the till looks for any more (ADR 0048).
  await search.fill('603470011');
  await expect(page.getByText('Nothing matches “603470011”')).toBeVisible();
  await find(page, 'yam', 'Yam, tuber');
  await expect(page.getByText('Added Yam, tuber')).toBeVisible();
  await expect(page.locator('[data-slot="cart-total"]')).toHaveText(formatMoney(2500));
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('fifty sales with the network off land exactly once each when it returns (SHARED_BRIEF scenario 6)', async ({
  page,
  context,
  api,
}) => {
  test.slow();
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await api.setNetwork(context, false);
  for (let n = 1; n <= 50; n += 1) {
    await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
    await page.getByRole('button', { name: 'Take payment' }).click();
    await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('650');
    await page.getByRole('button', { name: 'Review the sale' }).click();
    await page.getByRole('button', { name: 'Complete the sale' }).click();
    await expect(
      page.getByText(`Kept on this till as P-T1-312-${String(n).padStart(4, '0')}`),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next sale' }).click();
  }
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('50 to send');
  expect(server.batches).toHaveLength(0);

  await api.setNetwork(context, true);
  await expect(page.locator('[data-slot="queue-count"]')).toContainText('All sent', {
    timeout: 20_000,
  });
  const sent = server.batches.flatMap((batch) => batch.sales);
  expect(sent).toHaveLength(50);
  expect(sent.map((sale) => sale.deviceCounter)).toEqual(
    Array.from({ length: 50 }, (_, i) => i + 1),
  );
  expect(new Set(sent.map((sale) => sale.id)).size).toBe(50);
  expect(sent.every((sale) => sale.payloadHash === expectedHash(sale))).toBe(true);
  expect(server.applied.size).toBe(50);
  expect(new Set(server.applied.values()).size).toBe(50);
});
