import type { Page } from '@playwright/test';
import { formatMoney } from '../../../packages/ui/src/format/format';
import {
  confirmStepUp,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { PEOPLE, installTillPins } from '../../support/tillPins';
import { expect, test } from '../../support/test';
import { enrolTill, installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * The till's shift at 360 px (F10j, contract 2.5.0; the witness from F10k): a cash drop witnessed by the
 * supervisor who takes the cash entering their PIN on the till, needed while a supervisor is signed in at
 * the branch, or plainly unwitnessed when none is (owner, 2026-11-18; CR-050's read, in 2.17.0); a
 * pay-out's reason and note; a refused drop and a refused open, each left on screen in words; and the whole
 * close: blind count, the API's over or short, and a supervisor's sign-off with a fresh step-up, then the Z
 * report.
 */

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);

async function toShift(page: Page) {
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312' })).toBeVisible();
}

test("with a supervisor signed in, a drop's witness is that supervisor's PIN on the till", async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  installTillPins(api);
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await expect(page.locator('[data-slot="cash-witness-hint"]')).toHaveText(
    `A supervisor is signed in at the branch (${PEOPLE.manager.name}), so the drop needs a witness: the supervisor who takes the cash enters their PIN on this till.`,
  );
  // Naming a supervisor is not a witness: there is no list to choose from, and no PIN, no drop.
  await expect(page.getByRole('combobox', { name: /^Supervisor who takes the cash/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(
    page.getByText('The supervisor who takes the cash enters their PIN first.'),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // A wrong PIN is not a witness either.
  await page.getByLabel(/^PIN/).fill('111111');
  await page.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(page.locator('[data-slot="cash-witness"]')).toHaveCount(0);
  await page.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await page.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(page.locator('[data-slot="cash-witness"]')).toHaveText(
    `Witnessed by ${PEOPLE.manager.name}`,
  );
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText(formatMoney(50000));
  await expect(confirm).toContainText(`Witnessed by ${PEOPLE.manager.name}`);
  await expect(confirm).not.toContainText('Unwitnessed');
  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/cash-movements'),
  );
  await confirm.getByRole('button', { name: 'Record it' }).click();
  const request = await sent;
  expect(request.postDataJSON()).toMatchObject({
    kind: 'CASH_DROP',
    amountPesewas: 50000,
    reasonCode: 'SAFE_DROP',
    witnessId: PEOPLE.manager.id,
    witnessPinVersion: 7,
  });
  // The client id is the idempotency key, so a resend is the same drop.
  const body = request.postDataJSON() as { id: string };
  expect(request.headers()['idempotency-key']).toBe(body.id);
  await expect(page.getByText('Cash drop recorded.')).toBeVisible();
  const moved = page.locator('[data-slot="cash-moved"]');
  await expect(moved.first()).toContainText(`Witnessed by ${PEOPLE.manager.name}`);
  await expect(moved.last()).toContainText('Opening float');
  expect(server.movements).toHaveLength(1);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test("with a supervisor signed in and no supervisor's PIN on the till, the drop is not recorded", async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  const needed = page.locator('[data-slot="cash-witness-needed"]');
  await expect(needed).toContainText('This drop needs a supervisor’s PIN');
  await expect(needed).toContainText(
    `A supervisor is signed in at the branch (${PEOPLE.manager.name})`,
  );
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.movements).toHaveLength(0);
  // A pay-out needs no witness, so the till still records one.
  await page.getByRole('combobox', { name: /^What it is/ }).click();
  await page.getByRole('option', { name: 'Pay-in' }).click();
  await expect(needed).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('with no supervisor signed in, the drop goes ahead and says plainly it is unwitnessed', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal, { witnesses: [] });
  // The till holds the manager's PIN, and still asks for none: nobody is signed in to witness.
  installTillPins(api);
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('300');
  const notice = page.locator('[data-slot="cash-unwitnessed"]');
  await expect(notice).toContainText('This drop is recorded unwitnessed');
  await expect(notice).toContainText('No supervisor is signed in at the branch.');
  await expect(page.getByLabel(/^PIN/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText('Unwitnessed');
  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/cash-movements'),
  );
  await confirm.getByRole('button', { name: 'Record it' }).click();
  expect((await sent).postDataJSON()).not.toHaveProperty('witnessId');
  await expect(page.getByText('Cash drop recorded, unwitnessed.')).toBeVisible();
  const drop = page.locator('[data-slot="cash-moved"]').first();
  await expect(drop).toContainText('Unwitnessed');
  await expect(drop).toContainText('Cash dropped to the safe');
  await expectNoAxeViolations(page);
});

test('a pay-out takes a reason that fits it, and the note that reason needs', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('combobox', { name: /^What it is/ }).click();
  await page.getByRole('option', { name: 'Pay-out' }).click();
  await page.getByRole('textbox', { name: /^Amount/ }).fill('80');
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Choose the reason.')).toBeVisible();
  await page.getByRole('combobox', { name: /^Reason/ }).click();
  // Only the expenses: never the drop's or the pay-in's reason.
  await expect(page.getByRole('option')).toHaveText([
    'Fuel paid from the till',
    'A supplier paid from the till',
    'Another expense paid from the till',
  ]);
  await page.getByRole('option', { name: 'Fuel paid from the till' }).click();
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Write the note.')).toBeVisible();
  await page.getByRole('textbox', { name: /^Note/ }).fill('Generator diesel, 10 litres');
  await page.getByRole('button', { name: 'Record it' }).click();
  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/cash-movements'),
  );
  await page
    .getByRole('dialog', { name: 'Record this Pay-out?' })
    .getByRole('button', { name: 'Record it' })
    .click();
  expect((await sent).postDataJSON()).toMatchObject({
    kind: 'PAY_OUT',
    amountPesewas: 8000,
    reasonCode: 'FUEL_PAYOUT',
    note: 'Generator diesel, 10 litres',
  });
  await expect(page.getByText('Pay-out recorded.')).toBeVisible();
});

test('a drop the server refuses stays on screen in words, with its reference', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal, { witnesses: [] });
  api.refuse('recordCashMovement', 422, 'CASH_MOVEMENT_INVALID', 'Not recorded.');
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await page.getByRole('button', { name: 'Record it' }).click();
  await page
    .getByRole('dialog', { name: 'Record this Cash drop?' })
    .getByRole('button', { name: 'Record it' })
    .click();
  const outcome = page.locator('[data-slot="cash-outcome"]');
  await expect(outcome).toContainText('The Cash drop was not recorded');
  await expect(outcome).toContainText('The cash movement was not recorded.');
  await expect(outcome).toContainText('Reference');
  await expectNoAxeViolations(page);
});

test('a shift the server refuses as it opens stays on the open screen in words', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  api.refuse('openShift', 422, 'SHIFT_ALREADY_OPEN', 'Open elsewhere.');
  await enrolTill(page);
  await page.getByRole('button', { name: 'Open the shift' }).click();
  await page
    .getByRole('dialog', { name: 'Open the shift with this float?' })
    .getByRole('button', { name: 'Open the shift' })
    .click();
  await expect(page.getByText('The shift was not opened')).toBeVisible();
  await expect(page.getByText('A shift is already open here.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open a shift' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('the close: a blind count, the API’s short, then a supervisor signs it off and the Z report is shown', async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await toShift(page);
  await expect(page.getByText('Expected', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: /^Cash counted/ }).fill('8225');
  await page.getByRole('textbox', { name: /^Mobile money counted/ }).fill('4120');
  await page.getByRole('button', { name: 'Declare the count' }).click();
  await page
    .getByRole('dialog', { name: 'Declare this count?' })
    .getByRole('button', { name: 'Declare the count' })
    .click();
  await expect(page.locator('[data-slot="over-short"]')).toHaveText(
    `Short by ${formatMoney(12000)}`,
  );
  await expect(page.getByText('A supervisor who is not you signs this close off.')).toBeVisible();
  // The cashier cannot sign their own count off: there is no button for them.
  await expect(page.getByRole('button', { name: 'Sign the close off' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page
    .getByRole('dialog', { name: 'Sign out of the point of sale?' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await signInWithTotp(page, USERS.manager, '/pos/shift');
  await expect(page.locator('[data-slot="over-short"]')).toHaveText(
    `Short by ${formatMoney(12000)}`,
  );
  await page.getByRole('textbox', { name: /^Sign-off note/ }).fill('Counted twice; GH₵120 short');
  await page.getByRole('button', { name: 'Sign the close off' }).click();
  await page
    .getByRole('dialog', { name: 'Sign this close off?' })
    .getByRole('button', { name: 'Sign the close off' })
    .click();
  await confirmStepUp(page);
  await expect(
    page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312 is closed' }),
  ).toBeVisible();
  await expect(page.getByText(`Signed off by ${PEOPLE.manager.name}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Z report: the closed shift' })).toBeVisible();
  expect(server.signOffs).toEqual([
    { shiftId: expect.any(String), reason: 'Counted twice; GH₵120 short' },
  ]);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test("online mobile money names the till's shift, so the charge counts on its reports (2.6.0)", async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  const opened = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/shifts'));
  await openTillShift(page);
  const shiftId = ((await opened).postDataJSON() as { id: string }).id;
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page
    .getByRole('region', { name: 'This sale' })
    .getByRole('button', { name: 'Take payment' })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('textbox', { name: /^Mobile money amount/ }).fill('200');
  await pay.getByRole('textbox', { name: /^Customer's mobile money number/ }).fill('+233245550142');
  const charge = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/payments/mobile-money'),
  );
  await pay.getByRole('button', { name: 'Send the payment request' }).click();
  expect((await charge).postDataJSON()).toMatchObject({
    amountPesewas: 20000,
    payerPhone: '+233245550142',
    shiftId,
  });
});
