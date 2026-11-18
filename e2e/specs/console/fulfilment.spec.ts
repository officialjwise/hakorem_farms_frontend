import { formatMoney } from '../../../packages/ui/src/format/format';
import { DRIVER, STOPS } from '../../support/driver';
import {
  CRATE_LINE,
  EGG_LINE,
  EGGS,
  EGG_STORE,
  FULFILMENT_ID,
  ORDER_ID,
  VAN,
  installDispatchServer,
  installOrderServer,
} from '../../support/fulfilment';
import {
  USERS,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
} from '../../support/helpers';
import { expect, test } from '../../support/test';

/**
 * F11 in the back office, at 360 px: an online order of eggs from the list to its pick list; picking in the
 * order's units, with cracked eggs written off and a short line offered to the customer first; the
 * customer's answer; and a run planned for a driver and a van, put in order and started. Every amount on
 * screen is the API's.
 */

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('the order list opens an order in its own units, and a confirmed order starts picking', async ({
  page,
  api,
}) => {
  const sent = installOrderServer(api, 'CONFIRMED');
  await signIn(page, USERS.storekeeper, '/orders');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page.getByText(formatMoney(80100)).first()).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('link', { name: 'SO-2026-KSA-004310' }).first().click();
  await expect(page).toHaveURL(`/orders/${ORDER_ID}/fulfilment`);
  const lines = page.getByRole('region', { name: 'What was ordered and picked' });
  await expect(lines).toContainText('12 crates');
  await expect(lines).toContainText('30 eggs');
  await expect(page.getByText('Cash on delivery')).toBeVisible();
  await expect(page.getByText(formatMoney(1500))).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('combobox', { name: /^Pick from/ }).click();
  await page.getByRole('option', { name: `${EGG_STORE.name} (${EGG_STORE.code})` }).click();
  await page.getByRole('button', { name: 'Start picking' }).click();
  const start = page.getByRole('dialog', { name: 'Start picking this order?' });
  await expect(start).toContainText(EGG_STORE.name);
  await start.getByRole('button', { name: 'Start picking' }).click();
  await expect(page).toHaveURL(`/fulfilments/${FULFILMENT_ID}`);
  expect(sent['createFulfilment']).toEqual([{ pickLocationId: EGG_STORE.id }]);
});

test('picking: short is refused, cracked eggs are written off, a smaller quantity is offered, then picked', async ({
  page,
  api,
}) => {
  const sent = installOrderServer(api, 'PICKING');
  await signIn(page, USERS.storekeeper, `/fulfilments/${FULFILMENT_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: 'PCK-2026-KSA-000412' })).toBeVisible();
  const crates = page.getByRole('textbox', { name: /^How many crates picked/ });
  const eggs = page.getByRole('textbox', { name: /^How many eggs picked/ });
  await expect(page.getByText('Pick exactly 12 crates.')).toBeVisible();
  await expect(page.getByText('Pick exactly 30 eggs.')).toBeVisible();

  // Eleven crates is a short pick: refused until the customer agrees.
  await crates.fill('11');
  await page.getByRole('button', { name: 'Record what was picked' }).click();
  await expect(page.getByText('This is fewer than the line needs.')).toBeVisible();
  expect(sent['recordPicks']).toBeUndefined();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  // Three eggs found cracked: written off from the egg store, counted in eggs, with the reason.
  await page.getByRole('button', { name: 'Record broken or cracked' }).first().click();
  const cracked = page.getByRole('dialog', { name: `Broken or cracked: ${EGGS.name}` });
  await cracked.getByRole('textbox', { name: /^How many eggs/ }).fill('3');
  await cracked.getByRole('button', { name: 'Check' }).click();
  await expect(cracked).toContainText('Write off: 3 eggs');
  await cracked.getByRole('button', { name: 'Write them off' }).click();
  await expect(cracked).toContainText('Written off as ADJ-2026-KSA-000088.');
  await expect(cracked).toContainText('The order still needs the full quantity');
  await cracked.getByRole('button', { name: 'Close' }).click();
  expect(sent['createStockAdjustment']).toEqual([
    {
      locationId: EGG_STORE.id,
      reasonCode: 'BREAKAGE',
      lines: [{ productId: EGGS.id, direction: 'LOSS', qty: '3.000' }],
    },
  ]);

  // No crate is left to replace them: eleven crates are offered to the customer.
  await page.getByRole('button', { name: 'Short? Offer a substitute' }).first().click();
  const offer = page.getByRole('dialog', {
    name: `Offer the customer something else: ${EGGS.name}`,
  });
  await expect(offer).toContainText('The line asks for 12 crates');
  await offer.getByRole('textbox', { name: /^How many crates/ }).fill('11');
  await offer.getByRole('textbox', { name: /^Why/ }).fill('A crate was cracked and none are left.');
  await offer.getByRole('button', { name: 'Offer it to the customer' }).click();
  await expect(offer).toContainText('Offered. The order waits for the customer');
  await offer.getByRole('button', { name: 'Close' }).click();
  expect(sent['proposeSubstitution']).toEqual([
    {
      lineId: CRATE_LINE,
      productId: EGGS.id,
      quantity: '11.000',
      note: 'A crate was cracked and none are left.',
    },
  ]);
  await expect(page.getByText('The order waits for the customer')).toBeVisible();

  // The eggs line is picked in full, in eggs; one client id per pick.
  await crates.fill('');
  await eggs.fill('30');
  await page.getByRole('button', { name: 'Record what was picked' }).click();
  const confirm = page.getByRole('dialog', { name: 'Record these picks?' });
  await expect(confirm).toContainText('30 eggs');
  await confirm.getByRole('button', { name: 'Record what was picked' }).click();
  await expect(page.getByText('Recorded what was picked.')).toBeVisible();
  const picks = (
    sent['recordPicks']?.[0] as { picks: { id: string; orderLineId: string; qty: string }[] }
  ).picks;
  expect(picks.map((p) => [p.orderLineId, p.qty])).toEqual([[EGG_LINE, '30.000']]);
  expect(picks[0]?.id).toMatch(UUID_V7);
});

test('the customer’s answer is recorded with how it was given', async ({ page, api }) => {
  const sent = installOrderServer(api, 'AWAITING_CUSTOMER');
  await signInWithTotp(page, USERS.manager, `/orders/${ORDER_ID}/fulfilment`);
  const card = page.getByRole('heading', { name: "The customer's answer" });
  await expect(card).toBeVisible();
  await page.getByRole('radio', { name: 'A substitute, or less than they ordered' }).click();
  await page.getByRole('radio', { name: 'They agreed', exact: true }).click();
  await page.getByRole('combobox', { name: /^How they answered/ }).click();
  await page.getByRole('option', { name: 'On the phone' }).click();
  await page.getByRole('button', { name: 'Record the answer' }).click();
  const confirm = page.getByRole('dialog', { name: "Record the customer's answer?" });
  await expect(confirm).toContainText(
    'The customer agreed to a substitute, or less than they ordered.',
  );
  await expect(confirm).toContainText(formatMoney(80100));
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Record the answer' }).click();
  await expect(page.getByText('Recorded: the customer agreed.')).toBeVisible();
  expect(sent['recordCustomerConsent']).toEqual([
    { kind: 'SUBSTITUTION', accepted: true, method: 'PHONE' },
  ]);
});

test('dispatch: a run for one driver and one van, put in order and started', async ({
  page,
  api,
}) => {
  const sent = installDispatchServer(api);
  await signInWithTotp(page, USERS.manager, '/deliveries');
  await expect(page.getByRole('heading', { level: 1, name: 'Dispatch' })).toBeVisible();
  const [first, second] = STOPS;
  await page.getByRole('checkbox', { name: `Put ${first?.recipientName} on the run` }).click();
  await page.getByRole('checkbox', { name: `Put ${second?.recipientName} on the run` }).click();
  await page.getByRole('combobox', { name: /^Driver/ }).click();
  await page.getByRole('option', { name: DRIVER.displayName }).click();
  await page.getByRole('combobox', { name: /^Van/ }).click();
  await page.getByRole('option', { name: `${VAN.name} (${VAN.code})` }).click();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Make the run' }).click();
  const make = page.getByRole('dialog', { name: 'Make this run?' });
  await expect(make).toContainText(`${DRIVER.displayName} in ${VAN.name}`);
  await make.getByRole('button', { name: 'Make the run' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `${DRIVER.displayName}'s run` }),
  ).toBeVisible();
  expect(sent['createRoute']).toEqual([
    {
      driverId: DRIVER.id,
      routeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      vehicleLocationId: VAN.id,
      deliveryIds: [first?.id, second?.id],
    },
  ]);

  // Kofi first: moved up, saved with the run's version, then started.
  await page.getByRole('button', { name: `Move ${second?.recipientName} earlier` }).click();
  await expect(page.getByText('The new order is not saved yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Save this order' }).click();
  await page
    .getByRole('dialog', { name: 'Save the new order of stops?' })
    .getByRole('button', { name: 'Save this order' })
    .click();
  await expect(page.getByText('The new order is not saved yet.')).toHaveCount(0);
  expect(sent['reorderRouteStops']).toEqual([{ version: 1, deliveryIds: [second?.id, first?.id] }]);
  await page.getByRole('button', { name: 'Start the run' }).click();
  const start = page.getByRole('dialog', { name: 'Start this run?' });
  await expect(start).toContainText(formatMoney(84600));
  await start.getByRole('button', { name: 'Start the run' }).click();
  await expect(page.getByText('Under way')).toBeVisible();
  expect(sent['startRoute']).toHaveLength(1);
  await expectNoAxeViolations(page);
});
