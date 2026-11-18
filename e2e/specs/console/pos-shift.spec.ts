import type { Page } from '@playwright/test';
import { formatMoney } from '../../../packages/ui/src/format/format';
import {
  confirmStepUp,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { PEOPLE } from '../../support/requested';
import { expect, test } from '../../support/test';
import { enrolTill, installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * F10j, the till's shift on contract 2.5.0 at 360 px: a cash drop witnessed by a supervisor signed in at the
 * branch, or plainly unwitnessed when none is (owner, 2026-11-17; CR-050 as requested); a pay-out's reason
 * and note; a refused drop and a refused open, each left on screen in words; and the whole close: blind
 * count, the API's over or short, and a supervisor's sign-off with a fresh step-up, then the Z report.
 */

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);

async function toShift(page: Page) {
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312' })).toBeVisible();
}

test('a cash drop names a supervisor signed in at the branch as its witness', async ({
  page,
  api,
}) => {
  const server = installTillServer(api, serverTotal);
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Choose the supervisor who takes the cash.')).toBeVisible();
  await page.getByRole('combobox', { name: /^Supervisor who takes the cash/ }).click();
  await page.getByRole('option', { name: PEOPLE.manager.name }).click();
  await page.getByRole('button', { name: 'Record it' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record this Cash drop?' });
  await expect(confirm).toContainText(formatMoney(50000));
  await expect(confirm).toContainText(`Witnessed by ${PEOPLE.manager.name}`);
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

test('with no supervisor signed in, the drop goes ahead and says plainly it is unwitnessed', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal, { witnesses: [] });
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('300');
  const notice = page.locator('[data-slot="cash-unwitnessed"]');
  await expect(notice).toContainText('This drop is recorded unwitnessed');
  await expect(notice).toContainText('No supervisor is signed in at the branch.');
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
  installTillServer(api, serverTotal);
  api.refuse('recordCashMovement', 422, 'CASH_MOVEMENT_INVALID', 'Not recorded.');
  await openTillShift(page);
  await toShift(page);
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  await page.getByRole('combobox', { name: /^Supervisor who takes the cash/ }).click();
  await page.getByRole('option', { name: PEOPLE.manager.name }).click();
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
