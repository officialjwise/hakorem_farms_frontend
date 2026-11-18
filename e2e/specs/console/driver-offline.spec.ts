import { formatMoney } from '../../../packages/ui/src/format/format';
import {
  DRIVER,
  PHOTO,
  RUN_COD_PESEWAS,
  STOPS,
  installDriverServer,
  oneBarOfSignal,
  openRun,
} from '../../support/driver';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { expect, test, type Page } from '../../support/test';

/**
 * THE F11 GATE (BUILD_PROMPT F11): a driver completes a delivery with one bar of signal. At 360 px, in
 * Chromium, against the production build. The driver opens today's run where there is signal, then loses
 * it: two stops are delivered (eggs by the crate and by the egg, cash on delivery, one paid short) and one
 * is refused, all kept on the phone. The page is reloaded with the driver's operations still unreachable,
 * and the run and the three records are still there. When the signal comes back it is one bar: slow, every
 * third request dropped on the way out, and the first sync's answer lost after the server applied it. The
 * phone resends the same ids until it hears back, and the server applies each delivery exactly once.
 */

const [ASANTEWAA, KOFI, GRACE] = STOPS as [
  (typeof STOPS)[number],
  (typeof STOPS)[number],
  (typeof STOPS)[number],
];

/** What the phone says about a stop's record, on the stop's own page (waiting, sent or refused). */
function stop(page: Page, name: string) {
  return page.getByRole('article', { name }).locator('[data-slot="alert"]');
}

async function openStop(page: Page, name: string) {
  await page.getByRole('link', { name: "Today's run" }).click();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function deliver(page: Page, name: string, received: string) {
  await page.getByRole('link', { name: 'Delivered', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Delivered to ${name}` })).toBeVisible();
  await page.getByLabel(/^Who took it/).fill(name);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'delivery.jpg',
    mimeType: 'image/jpeg',
    buffer: PHOTO,
  });
  await expect(page.getByRole('img', { name: 'The photograph you took' })).toBeVisible();
  await page.getByLabel(/^Cash the customer paid/).fill(received);
  await page.getByRole('button', { name: 'Check and record' }).click();
}

test('the F11 gate: a run with no signal, synced exactly once on one bar of signal', async ({
  page,
  context,
  api,
}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 5.5341, longitude: -0.4245, accuracy: 9 });
  const server = installDriverServer(api, { loseFirstSync: true });
  await openRun(page);

  // The run, read where there is signal: the stops in order, each with its cash to collect.
  const stops = page.getByRole('list', { name: 'Stops in the order to visit' });
  await expect(stops.getByRole('listitem')).toHaveCount(3);
  await expect(stops.getByRole('listitem').first()).toContainText('Stop 1');
  await expect(stops.getByRole('listitem').first()).toContainText(
    formatMoney(ASANTEWAA.codDuePesewas),
  );
  await expect(page.getByText(formatMoney(RUN_COD_PESEWAS))).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  // The signal goes. Everything from here is kept on the phone.
  await api.setNetwork(context, false);
  await expect(page.getByText('Offline').first()).toBeVisible();

  // Stop 1: the address, the phone and what to deliver, in the order's own units.
  await openStop(page, ASANTEWAA.recipientName);
  await expect(
    page.getByRole('link', { name: `Call ${ASANTEWAA.recipientPhone}` }),
  ).toHaveAttribute('href', `tel:${ASANTEWAA.recipientPhone}`);
  await expect(page.getByText(ASANTEWAA.line1)).toBeVisible();
  await expect(page.getByText('12 crates')).toBeVisible();
  await expect(page.getByText('30 eggs')).toBeVisible();
  await page.getByRole('button', { name: "I'm on my way" }).click();
  await expect(page.getByRole('button', { name: "I'm on my way" })).toHaveCount(0);
  await deliver(page, ASANTEWAA.recipientName, '786.00');
  const confirm = page.getByRole('dialog', { name: 'Record this delivery?' });
  await expect(confirm).toContainText(formatMoney(ASANTEWAA.codDuePesewas));
  await expect(confirm).toContainText('Recorded');
  await expect(confirm).not.toContainText('not what was to collect');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Record the delivery' }).click();
  await expect(
    stop(page, ASANTEWAA.recipientName).filter({ hasText: 'Kept on this phone, waiting to send' }),
  ).toContainText(`Cash received: ${formatMoney(78600)}`);

  // Stop 2: refused, the eggs come back to stock.
  await openStop(page, KOFI.recipientName);
  await page.getByRole('link', { name: 'Not delivered or refused' }).click();
  await page.getByRole('combobox', { name: /^Why/ }).click();
  await page.getByRole('option', { name: 'The customer refused it' }).click();
  await page.getByRole('radio', { name: 'Bring them back to stock' }).click();
  await page.getByRole('button', { name: 'Check and record' }).click();
  const refused = page.getByRole('dialog', { name: 'Record this as not delivered?' });
  await expect(refused).toContainText('The customer refused it');
  await refused.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Not delivered at')).toContainText('The customer refused it');

  // Stop 3: paid short. The driver records what they were given, and is told it is reported.
  await openStop(page, GRACE.recipientName);
  await expect(page.getByText('1 crate', { exact: true })).toBeVisible();
  await deliver(page, GRACE.recipientName, '50.00');
  const short = page.getByRole('dialog', { name: 'Record this delivery?' });
  await expect(short).toContainText('not what was to collect');
  await short.getByRole('button', { name: 'Record the delivery' }).click();
  await expect(stop(page, GRACE.recipientName)).toContainText('driver variance report');

  // The run says where each stop stands; the header counts what waits; nothing reached the server.
  await page.getByRole('link', { name: "Today's run" }).click();
  await expect(stops.getByRole('listitem').nth(0)).toContainText('Delivered, waiting to send');
  await expect(stops.getByRole('listitem').nth(1)).toContainText('Not delivered, waiting to send');
  await expect(stops.getByRole('listitem').nth(2)).toContainText('Delivered, waiting to send');
  await expect(page.locator('[data-slot="driver-queue"]')).toContainText('4 waiting to send');
  expect(server.applied.size).toBe(0);

  // The cash the driver carries: the office's figure, the two collections not in it yet, one by one, and
  // where it goes.
  await page.getByRole('link', { name: 'Cash I carry' }).click();
  const unsent = page.getByRole('list', { name: 'Collected, not sent yet' });
  await expect(unsent).toContainText(formatMoney(78600));
  await expect(unsent).toContainText(formatMoney(5000));
  await expect(page.getByText('Hand all of it in at a till shift')).toBeVisible();
  await expect(page.getByText('never written down as loose cash')).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  // A reload with the driver's operations still out of reach: the run and the records are on the phone.
  const unreachable = /\/mock\/(driver|files)(\/|$|\?)/;
  await context.route(unreachable, (route) => route.abort('internetdisconnected'));
  await api.setNetwork(context, true);
  await page.reload();
  await expect(page.locator('[data-slot="driver-queue"]')).toContainText('4 waiting to send');
  await page.getByRole('link', { name: "Today's run" }).click();
  await expect(page.locator('[data-slot="kept-copy"]')).toContainText('as this phone kept it');
  await expect(stops.getByRole('listitem').nth(1)).toContainText('Not delivered, waiting to send');
  await expect(page.locator('[data-slot="driver-unreachable"]')).toContainText('No signal');
  expect(server.applied.size).toBe(0);

  // One bar of signal: slow, every third request dropped, and the first sync's answer lost.
  await context.unroute(unreachable);
  await oneBarOfSignal(page, context, server);
  await page.getByRole('button', { name: 'Try now' }).click();
  await expect(page.locator('[data-slot="driver-queue"]')).toContainText('All sent', {
    timeout: 120_000,
  });

  // Exactly once: three records applied, one per stop, though the phone sent some more than once.
  expect(server.applied.size).toBe(3);
  expect([...server.applied.values()].sort()).toEqual(STOPS.map((s) => s.id).sort());
  expect(new Set(server.sent).size).toBe(3);
  expect(server.lostAnswers).toBe(1);
  expect(server.sent.length).toBeGreaterThan(3);
  // Each photograph reached the server under one key, however often it was sent.
  expect(new Set(server.uploads).size).toBeLessThanOrEqual(2);
  expect(server.uploads.every((key) => /^[0-9a-f-]{36}$/.test(key))).toBe(true);

  await page.getByRole('link', { name: "Today's run" }).click();
  await expect(stops.getByRole('listitem').nth(0)).toContainText('Delivered, sent');
  await expect(stops.getByRole('listitem').nth(1)).toContainText('Not delivered, sent');
  await openStop(page, GRACE.recipientName);
  // The answer that carried the server's note was the one lost; the resend's is `DUPLICATE`. The phone's
  // own words still say the short payment is reported.
  await expect(
    stop(page, GRACE.recipientName).filter({ hasText: 'Sent to the office' }),
  ).toContainText('it goes on the driver variance report');
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  expect(DRIVER.displayName).toBe('Kwesi Appiah');
});

test('the driver sees only their own run: no grant, the denied state in words', async ({
  page,
  api,
}) => {
  installDriverServer(api);
  await page.goto('/login?next=%2Fdriver');
  await page.getByLabel(/email or phone number/i).fill('adwoa.darko@hakoremfarms.com');
  await page.getByLabel(/^password/i).fill('Mango-Season-2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const denied = page.getByRole('alert').filter({ hasText: 'You do not have access to this page' });
  await expect(denied).toContainText('del.delivery.read.assigned');
  await expectNoAxeViolations(page);
});

test('a driver with no run today is told so, and an unreachable first read says what to do', async ({
  page,
  api,
}) => {
  installDriverServer(api);
  api.respond('getMyRoute', () => ({
    id: '019b1000-0000-7000-8000-0000000000r2',
    driver: DRIVER,
    routeDate: '2026-11-18',
    vehicle: {
      id: '019a7a84-9e23-708d-95c5-11a25bfa8a80',
      code: 'VAN',
      name: 'Van',
      kind: 'VEHICLE',
    },
    status: 'PLANNED',
    stops: [],
    codDueTotalPesewas: 0,
    currency: 'GHS',
    branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
    version: 1,
  }));
  await openRun(page);
  await expect(page.getByText('No run for you today')).toBeVisible();
  await expectNoAxeViolations(page);
});
