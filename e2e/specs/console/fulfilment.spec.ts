import { formatMoney } from '../../../packages/ui/src/format/format';
import { DRIVER, STOPS } from '../../support/driver';
import {
  CRATE_LINE,
  EGG_LINE,
  EGGS,
  EGG_STORE,
  ELEVEN_CRATES,
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
 * order's units, with cracked eggs written off and a short pick proposed to the customer first (2.25.0);
 * the Storekeeper reading the order through the store's view, with no money on screen (2.29.0); the
 * customer's answer; and a run planned for a driver and a van, put in order and started. Every amount on
 * screen is the API's.
 */

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('the order list opens an order in its own units, and a confirmed order starts picking', async ({
  page,
  api,
}) => {
  const sent = installOrderServer(api, 'CONFIRMED');
  // The Manager reads orders with their money; the Storekeeper, as seeded, does not (2.29.0).
  await signInWithTotp(page, USERS.manager, '/orders');
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

test('picking: short is refused, cracked eggs are written off, a short pick is proposed, then picked', async ({
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

  // The same eggs are no substitute: fewer of them is a short pick, said before anything is sent.
  await page.getByRole('button', { name: 'Offer a substitute' }).first().click();
  const offer = page.getByRole('dialog', {
    name: `Offer the customer something else: ${EGGS.name}`,
  });
  await expect(offer).toContainText('The line asks for 12 crates');
  await offer.getByRole('combobox', { name: /^Instead, offer/ }).fill('Eggs');
  await page.getByRole('option', { name: `${EGGS.name} (${EGGS.sku})` }).click();
  await expect(offer).toContainText(
    'That is the same product. To send fewer of it, propose a short pick instead.',
  );
  await offer.getByRole('button', { name: 'Offer it to the customer' }).click();
  expect(sent['proposeSubstitution']).toBeUndefined();
  await page.keyboard.press('Escape');
  await expect(offer).toHaveCount(0);

  // No crate is left to replace them: eleven of the twelve crates are proposed to the customer.
  await page.getByRole('button', { name: 'Propose a short pick to the customer' }).first().click();
  const short = page.getByRole('dialog', { name: `Propose a short pick: ${EGGS.name}` });
  await expect(short).toContainText('Ordered12 crates');
  const canSend = short.getByRole('textbox', { name: /^How many crates can be sent/ });
  await canSend.fill('12');
  await short.getByRole('textbox', { name: /^Why/ }).fill('A crate was cracked and none are left.');
  await short.getByRole('button', { name: 'Check' }).click();
  await expect(short).toContainText('That is not fewer than the 12 crates ordered.');
  await canSend.fill('11');
  await short.getByRole('button', { name: 'Check' }).click();
  await expect(short).toContainText('Can be sent:11 crates');
  await expect(short).toContainText('Short by:1 crate');
  await expect(short).toContainText('Nothing is packed or sent until they answer');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await short.getByRole('button', { name: 'Propose it to the customer' }).click();
  await expect(short).toContainText("Proposed. The order waits for the customer's answer");
  // The Storekeeper cannot open the order's page, so it is told who records the answer.
  await expect(short).toContainText('Someone who may update orders records their answer.');
  await short.getByRole('button', { name: 'Close' }).click();
  expect(sent['proposeShortPick']).toEqual([
    { lineId: CRATE_LINE, quantity: '11.000', note: 'A crate was cracked and none are left.' },
  ]);
  // The store's view says what was asked, as the whole order does (2.52.0, CR-064), with no money.
  await expect(
    page.getByText(`The order waits for the customer to agree to 11 crates of ${EGGS.name}.`),
  ).toBeVisible();
  await expect(page.getByText('Nothing is packed or sent until they answer.')).toBeVisible();
  // One question at a time: nothing more is proposed while the order waits.
  await expect(
    page.getByRole('button', { name: 'Propose a short pick to the customer' }),
  ).toHaveCount(0);

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

test('the Storekeeper reads the order it picks through the store’s view, with no money on screen', async ({
  page,
  api,
}) => {
  installOrderServer(api, 'PICKING');
  await signIn(page, USERS.storekeeper, `/fulfilments/${FULFILMENT_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: 'PCK-2026-KSA-000412' })).toBeVisible();
  // What was ordered and picked so far, in the order's units, from the store's view.
  const lines = page.getByRole('listitem').filter({ hasText: 'How many crates picked' });
  await expect(lines).toContainText('Ordered12 crates');
  await expect(lines).toContainText('Picked so far0 crates');
  await expect(page.getByRole('textbox', { name: /^Packages/ })).toBeVisible();
  // Not a price, a total or a balance anywhere, and the order is no link to a page it cannot open.
  await expect(page.getByRole('main')).not.toContainText('GH₵');
  await expect(page.getByText('Order SO-2026-KSA-004310')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Order SO-2026-KSA-004310' })).toHaveCount(0);
  const reads = api.log.filter((e) => e.operationId === 'getOrderFulfilmentView');
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every((e) => e.outcome === 'prism')).toBe(true);
  expect(api.log.some((e) => e.operationId === 'getOrder')).toBe(false);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a refused short pick stays on screen in words, with its reference', async ({ page, api }) => {
  installOrderServer(api, 'PICKING');
  api.refuse('proposeShortPick', 422, 'FULFILMENT_INVALID', 'Refused.', [
    { field: '/quantity', code: 'INEXACT_QUANTITY', message: 'Not exact in the base unit.' },
  ]);
  await signIn(page, USERS.storekeeper, `/fulfilments/${FULFILMENT_ID}`);
  await page.getByRole('button', { name: 'Propose a short pick to the customer' }).first().click();
  const short = page.getByRole('dialog', { name: `Propose a short pick: ${EGGS.name}` });
  await short.getByRole('textbox', { name: /^How many crates can be sent/ }).fill('10.333');
  await short.getByRole('textbox', { name: /^Why/ }).fill('Some eggs were cracked.');
  await short.getByRole('button', { name: 'Check' }).click();
  await short.getByRole('button', { name: 'Propose it to the customer' }).click();
  const alert = short.getByRole('alert');
  await expect(alert).toContainText('The short pick was not proposed');
  await expect(alert).toContainText(
    "The pick list cannot be changed that way. That quantity does not convert exactly into the product's base unit.",
  );
  await expect(alert).toContainText('35ea bc69');
  await expectNoAxeViolations(page);
  // Closed, the refusal stays on the line in words, and the order waits for nobody.
  await page.keyboard.press('Escape');
  await expect(short).toHaveCount(0);
  const failed = page.getByRole('alert').filter({ hasText: 'The short pick was not proposed' });
  await expect(failed).toContainText('That quantity does not convert exactly');
  await expect(failed).toContainText('35ea bc69');
  await expect(page.getByText('The order waits for the customer')).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('someone who reads the whole order sees what the customer was asked', async ({
  page,
  api,
}) => {
  installOrderServer(api, 'AWAITING_CUSTOMER', ELEVEN_CRATES);
  await signInWithTotp(page, USERS.manager, `/fulfilments/${FULFILMENT_ID}`);
  await expect(
    page.getByText(
      'The order waits for the customer to agree to 11 crates of Eggs, big. Nothing is packed or sent until they answer.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Record their answer on the order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record it packed' })).toBeDisabled();
  expect(api.log.some((e) => e.operationId === 'getOrderFulfilmentView')).toBe(false);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
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
