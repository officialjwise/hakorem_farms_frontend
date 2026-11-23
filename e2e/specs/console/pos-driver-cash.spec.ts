import type { Page } from '@playwright/test';
import type { components } from '@hakorem/api-client';
import { LIST_DRIVER_CASH_HOLDERS } from '../../../apps/console/src/requested/driverCashHolders';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { expect, test } from '../../support/test';
import { installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * A driver's cash from deliveries handed in at the till's shift at 360 px (2.31.0, CR-057,
 * `handInDriverCash`): the cashier chooses the driver (CR-063, requested: the contract lists no drivers for
 * the till), counts the cash blind, confirms the exact amount, and the server's answer stays on screen with
 * what was expected and the short in words. A refusal stays in words with its reference.
 */

type HandIn = components['schemas']['DriverCashReconciliation'];
type Body = components['schemas']['DriverCashHandInCreate'];

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);
const DRIVER = { id: '019a7a87-46ad-7a19-bf51-aa66d1302344', displayName: 'Kwesi Appiah' };

/** The drivers holding cash, until the first hand-in empties the list, as the server would. */
function installHolders(api: Parameters<typeof installTillServer>[0]) {
  let handedIn = false;
  api.respondRequested(LIST_DRIVER_CASH_HOLDERS, () => ({
    data: handedIn ? [] : [{ driver: DRIVER, collections: 2 }],
  }));
  const bodies: { path: string; body: Body }[] = [];
  return {
    bodies,
    answer: (request: unknown, path: string): HandIn => {
      const body = request as Body;
      bodies.push({ path, body });
      handedIn = true;
      const expected = 154000;
      const variance = Math.abs(expected - body.declaredPesewas);
      return {
        id: '019a7b0b-3a29-7863-bd9b-8f09e83407e7',
        status: 'POSTED',
        driver: DRIVER,
        reconciliationDate: '2026-11-13',
        shiftId: path.split('/')[2] ?? '',
        tillPaymentId: '019a7b0b-3a40-7d11-8c22-5e6f7a8b9c01',
        expectedPesewas: expected,
        declaredPesewas: body.declaredPesewas,
        variancePesewas: variance,
        varianceDirection:
          body.declaredPesewas < expected
            ? 'SHORT'
            : body.declaredPesewas > expected
              ? 'OVER'
              : 'EXACT',
        receivedBy: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', displayName: 'Adwoa Darko' },
        note: body.note ?? null,
        collections: [
          {
            deliveryNo: 'DLN-2026-DDW-000193',
            recipientName: 'Asantewaa Chop Bar',
            amountPesewas: 24000,
            capturedAt: '2026-11-13T11:52:00Z',
          },
          {
            deliveryNo: 'DLN-2026-DDW-000197',
            recipientName: 'Osu Fresh Mart',
            amountPesewas: 130000,
            capturedAt: '2026-11-13T14:05:00Z',
          },
        ],
        currency: 'GHS',
        branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
        version: 1,
      } as HandIn;
    },
  };
}

async function toShift(page: Page) {
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312' })).toBeVisible();
}

test("a driver's cash is counted blind into the shift, and the short stays on screen in words", async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  const holders = installHolders(api);
  api.respond('handInDriverCash', holders.answer, 201);
  await openTillShift(page);
  await toShift(page);

  const part = page.locator('[data-slot="driver-cash"]');
  await expect(
    part.getByRole('heading', { name: 'A driver’s cash from deliveries' }),
  ).toBeVisible();
  // Blind: nothing expected is shown before the count.
  await expect(part).not.toContainText('GH₵1,540.00');
  await part.getByRole('button', { name: 'Review the hand-in' }).click();
  await expect(part).toContainText('Choose the driver handing the cash in.');
  await expect(part).toContainText('Enter what you counted, or 0.');

  await part.getByRole('combobox', { name: /^Driver/ }).click();
  await page.getByRole('option', { name: 'Kwesi Appiah, 2 deliveries' }).click();
  await part.getByRole('textbox', { name: /^Cash counted/ }).fill('1440');
  await part.getByRole('textbox', { name: /^Note/ }).fill('Says the chop bar paid GHS 140.00');
  await part.getByRole('button', { name: 'Review the hand-in' }).click();

  const confirm = page.getByRole('dialog', { name: 'Hand in this driver’s cash?' });
  await expect(confirm).toContainText(
    'Every collection Kwesi Appiah holds at this branch is handed in now, once.',
  );
  await expect(confirm).toContainText('GH₵1,440.00');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Hand in the cash' }).click();

  const done = part.locator('[data-slot="driver-cash-done"]');
  await expect(done).toContainText('Handed in: Kwesi Appiah’s cash from deliveries');
  await expect(done).toContainText('Collected on deliveryGH₵1,540.00');
  await expect(done).toContainText('Cash counted (GH₵)GH₵1,440.00');
  await expect(done).toContainText('Short byGH₵100.00');
  await expect(done).toContainText('The count is short of what the driver collected');
  await done.getByText('2 deliveries handed in').click();
  await expect(done).toContainText('DLN-2026-DDW-000193, Asantewaa Chop Bar');
  // The list is read again: the driver holds nothing now.
  await expect(part.locator('[data-slot="driver-cash-none"]')).toHaveText(
    'No driver holds cash from deliveries at this branch.',
  );

  expect(holders.bodies).toHaveLength(1);
  expect(holders.bodies[0]?.path).toMatch(/^\/shifts\/[0-9a-f-]{36}\/driver-cash-hand-ins$/);
  expect(holders.bodies[0]?.body).toEqual({
    driverId: DRIVER.id,
    declaredPesewas: 144000,
    note: 'Says the chop bar paid GHS 140.00',
  });
  const listed = api.log.filter((e) => e.operationId === 'listShiftDriverCashHolders');
  expect(listed.every((e) => e.outcome === 'requested')).toBe(true);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a refused hand-in stays on screen in words, with its reference', async ({ page, api }) => {
  installTillServer(api, serverTotal);
  installHolders(api);
  api.refuse('handInDriverCash', 422, 'DRIVER_CASH_INVALID', 'Nothing held.');
  await openTillShift(page);
  await toShift(page);
  const part = page.locator('[data-slot="driver-cash"]');
  await part.getByRole('combobox', { name: /^Driver/ }).click();
  await page.getByRole('option', { name: 'Kwesi Appiah, 2 deliveries' }).click();
  await part.getByRole('textbox', { name: /^Cash counted/ }).fill('0');
  await part.getByRole('button', { name: 'Review the hand-in' }).click();
  const confirm = page.getByRole('dialog', { name: 'Hand in this driver’s cash?' });
  await confirm.getByRole('button', { name: 'Hand in the cash' }).click();
  await expect(confirm).toContainText('The driver’s cash was not handed in');
  await page.keyboard.press('Escape');
  await expect(part).toContainText('The driver’s cash was not handed in');
  await expect(part).toContainText('The driver’s cash was not handed in.');
  await expect(part).toContainText('Reference');
  await expect(part.locator('[data-slot="driver-cash-done"]')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('offline, the till says the hand-in waits for the network', async ({ page, api, context }) => {
  installTillServer(api, serverTotal);
  installHolders(api);
  await openTillShift(page);
  await toShift(page);
  await expect(page.locator('[data-slot="driver-cash"] [role="combobox"]')).toBeVisible();
  await api.setNetwork(context, false);
  await expect(page.locator('[data-slot="driver-cash"]')).toContainText(
    'The till is offline. A driver’s cash is handed in only while the till reaches the server.',
  );
  await expectNoHorizontalScroll(page);
});
