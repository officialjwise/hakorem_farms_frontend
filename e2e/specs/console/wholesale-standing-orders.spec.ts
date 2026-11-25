import type { components } from '@hakorem/api-client';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { CUSTOMER, chopBarAccount, chopBarAgeing } from '../../support/quotes';
import { expect, test, type Page } from '../../support/test';
import type { FakeApi } from '../../support/fakeApi';

/**
 * Standing orders on a wholesale account (contract 2.18.0). Asantewaa Chop Bar takes goat meat every
 * Friday. Sales sets up a second standing order for big eggs on Mondays and Thursdays, changes it, pauses,
 * resumes and ends it, each with a reason, and reads each run with what happened and why. A refusal stays
 * on the form in words with its reference. Those without the permission are told so in words. The suite
 * runs at 360 px. Every date shown is the API's.
 */

type S = components['schemas'];
type Page_<T> = { data: T[]; page: unknown };

const pageOf = <T>(body: unknown, rows: T[]) => ({
  ...(body as Page_<T>),
  data: rows,
  page: { nextCursor: null, limit: 25, hasMore: false },
});
const sent = (method: string, path: string) => (r: { method: () => string; url: () => string }) =>
  r.method() === method && new URL(r.url()).pathname === `/mock${path}`;

/** The contract's example of Asantewaa's weekly goat meat, and its ended yams. */
const FRIDAYS_ID = '019a7b04-56f2-74bd-a9f6-54afcfcbcd8d';
const NEW_ID = '019a7f40-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const ACCOUNT = `/business-accounts/${CUSTOMER.id}`;
const EGGS = {
  id: '019a7a8d-ae28-7631-8b69-6be302d5e4c0',
  sku: 'EGG-0003',
  name: 'Eggs, big, crate of 30',
};
/** The standing order the server answers with once Sales has set it up, in the state it is in now. */
function eggsOrder(change: Partial<S['StandingOrder']> = {}): S['StandingOrder'] {
  return {
    id: NEW_ID,
    customer: CUSTOMER,
    status: 'ACTIVE',
    frequency: 'WEEKLY',
    weekday: 1,
    weekdays: [1, 4],
    dayOfMonth: null,
    intervalDays: null,
    startsOn: '2026-11-30',
    endsOn: null,
    nextRunOn: '2026-11-30',
    deliveryAddress: null,
    lines: [
      {
        id: '019a7f40-2b3c-7d4e-8f5a-6b7c8d9e0f11',
        lineNo: 1,
        product: EGGS,
        quantity: '20.000',
        uom: 'CRATE',
      },
    ],
    branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
    version: 1,
    ...change,
  };
}

/** Each run day the server recorded for the order: made, held for credit, skipped, missed. */
const RUNS: S['StandingOrderRun'][] = [
  {
    runDate: '2026-11-21',
    outcome: 'HELD_FOR_CREDIT',
    reason: 'Over the credit limit by GHS 412.00',
    order: {
      id: '019a7f42-3c4d-7e5f-8a6b-7c8d9e0f1a23',
      docType: 'SALES_ORDER',
      number: 'SO-2026-DDW-004301',
    },
    recordedAt: '2026-11-21T05:00:00Z',
  },
  {
    runDate: '2026-11-14',
    outcome: 'MISSED',
    reason: 'The job did not run on 2026-11-14',
    order: null,
    recordedAt: '2026-11-15T05:00:00Z',
  },
  {
    runDate: '2026-11-07',
    outcome: 'CREATED',
    reason: null,
    order: {
      id: '019a7f42-4d5e-7f6a-8b7c-8d9e0f1a2b34',
      docType: 'SALES_ORDER',
      number: 'SO-2026-DDW-004250',
    },
    recordedAt: '2026-11-07T05:00:00Z',
  },
];

/** The account as the other wholesale specs show it, with Asantewaa's own standing orders. */
function asantewaa(api: FakeApi) {
  api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as S['BusinessAccount']));
  api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
  api.rewrite('listStandingOrders', (body) => {
    const page = body as Page_<S['StandingOrder']>;
    return pageOf(
      body,
      page.data.filter((o) => o.customer.id === CUSTOMER.id),
    );
  });
}

/** The screen at 360 px in both themes and both densities: no sideways scroll, and axe in each theme. */
async function checkEveryLook(page: Page) {
  await page.mouse.move(0, 0);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    );
    await expectNoAxeViolations(page);
    for (const density of ['comfortable', 'compact'] as const) {
      await page.evaluate((d) => {
        for (const node of document.querySelectorAll('[data-density]'))
          node.setAttribute('data-density', d);
      }, density);
      await expectNoHorizontalScroll(page);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

test.describe('standing orders on a wholesale account', () => {
  test('Sales sets one up, changes it, pauses, resumes and ends it, and reads its runs', async ({
    page,
    api,
  }) => {
    // The whole life of one standing order, checked at 360 px in every look along the way.
    test.slow();
    asantewaa(api);
    let order = eggsOrder();
    const bodies: Record<string, unknown[]> = {};
    const keep = (op: string, body: unknown) => (bodies[op] = [...(bodies[op] ?? []), body]);
    api.respond('createStandingOrder', (request) => {
      keep('create', request);
      return order;
    });
    api.rewrite('getStandingOrder', () => order);
    api.rewrite('listStandingOrderRuns', (body) => pageOf(body, RUNS));
    api.respond('updateStandingOrder', (request) => {
      keep('update', request);
      order = eggsOrder({
        weekdays: [1, 3, 4],
        version: 2,
        lines: eggsOrder().lines.map((line) => ({ ...line, quantity: '25.000' })),
      });
      return order;
    });
    api.respond('pauseStandingOrder', (request) => {
      keep('pause', request);
      order = { ...order, status: 'PAUSED', nextRunOn: null, version: order.version + 1 };
      return order;
    });
    api.respond('resumeStandingOrder', (request) => {
      keep('resume', request);
      order = { ...order, status: 'ACTIVE', nextRunOn: '2026-12-03', version: order.version + 1 };
      return order;
    });
    api.respond('endStandingOrder', (request) => {
      keep('end', request);
      order = {
        ...order,
        status: 'ENDED',
        nextRunOn: null,
        endsOn: '2026-11-25',
        version: order.version + 1,
      };
      return order;
    });

    await signIn(page, USERS.sales, ACCOUNT);
    await expect(page.getByRole('heading', { name: 'Standing orders' })).toBeVisible();
    // Each schedule in words, what it orders, the next run day the server worked out, and its state.
    const list = page.getByRole('region', {
      name: 'Each standing order of this buyer, newest first',
    });
    await expect(list).toContainText('Every week on Friday');
    await expect(list).toContainText('Goat meat, 15 kg pack');
    await expect(list).toContainText('2026-11-14');
    await expect(list).toContainText('Running');
    await expect(list).toContainText('Every week on Wednesday');
    await expect(list).toContainText('None: it has ended');
    await expect(list).toContainText('Ended');
    await expect(list).not.toContainText('Royal Palm Hotel Ltd');
    await checkEveryLook(page);

    await page.getByRole('link', { name: 'Set up a standing order' }).click();
    await expect(
      page.getByRole('heading', { name: `Standing order for ${CUSTOMER.name}`, level: 1 }),
    ).toBeVisible();
    // Saving with nothing chosen is stopped in words, field by field.
    await page.getByRole('button', { name: 'Set up the standing order' }).click();
    await expect(page.getByText('Every line needs a product and a quantity.')).toBeVisible();
    expect(bodies.create).toBeUndefined();

    await page.getByRole('combobox', { name: /^How often/ }).click();
    await page.getByRole('option', { name: 'Every week, on chosen days' }).click();
    await page.getByRole('button', { name: 'Set up the standing order' }).click();
    await expect(page.getByText('Choose at least one day.')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Thursday' }).check();
    await page.getByRole('checkbox', { name: 'Monday' }).check();
    await page.getByLabel(/^First day/).fill('2026-11-30');
    await page.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
    await page.getByRole('option', { name: `${EGGS.name} (${EGGS.sku})` }).click();
    await page.getByLabel(/^How many/).fill('20');
    await checkEveryLook(page);

    const created = page.waitForRequest(sent('POST', '/standing-orders'));
    await page.getByRole('button', { name: 'Set up the standing order' }).click();
    // The days Monday first, never the deprecated weekday; three places; the unit it is counted in.
    expect((await created).postDataJSON()).toEqual({
      customerId: CUSTOMER.id,
      frequency: 'WEEKLY',
      weekdays: [1, 4],
      startsOn: '2026-11-30',
      lines: [{ productId: EGGS.id, quantity: '20.000', uom: 'CRATE' }],
    });

    // The order as the server keeps it, with every run in words.
    await expect(
      page.getByRole('heading', { name: `Standing order for ${CUSTOMER.name}`, level: 1 }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/standing-orders/${NEW_ID}$`));
    await expect(page.getByText('Every week on Monday and Thursday')).toBeVisible();
    await expect(page.getByText('Collected from the farm')).toBeVisible();
    const runs = page.getByRole('region', {
      name: 'Each run of this standing order, newest first',
    });
    await expect(runs).toContainText('Order made, held for credit');
    await expect(runs).toContainText('it needs a credit override before it is confirmed');
    await expect(runs).toContainText('Over the credit limit by GHS 412.00');
    await expect(runs).toContainText('SO-2026-DDW-004301');
    await expect(runs).toContainText('Missed: the job did not run');
    await expect(runs).toContainText('The job did not run on 2026-11-14');
    await expect(runs).toContainText('No order');
    await expect(runs).toContainText('Order made');
    await checkEveryLook(page);

    // A change: one more day and more crates; the frequency and first day stay, and say so.
    await page.getByRole('button', { name: 'Change it' }).click();
    const form = page.getByRole('form', { name: 'Change the standing order' });
    await expect(form).toContainText('First day: 2026-11-30. It never changes.');
    await expect(form.getByRole('combobox', { name: /^How often/ })).toHaveCount(0);
    await form.getByRole('checkbox', { name: 'Wednesday' }).check();
    await form.getByLabel(/^How many/).fill('25');
    await checkEveryLook(page);
    const updated = page.waitForRequest(sent('PATCH', `/standing-orders/${NEW_ID}`));
    await form.getByRole('button', { name: 'Save the changes' }).click();
    expect((await updated).postDataJSON()).toEqual({
      version: 1,
      weekdays: [1, 3, 4],
      lines: [{ productId: EGGS.id, quantity: '25.000', uom: 'CRATE' }],
    });
    await expect(page.getByText('The standing order was changed')).toBeVisible();
    await expect(page.getByText('Every week on Monday, Wednesday and Thursday')).toBeVisible();

    // Paused with a reason, confirmed first.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const pause = page.getByRole('dialog', {
      name: `Pause the standing order for ${CUSTOMER.name}?`,
    });
    await pause.getByLabel(/^Reason/).fill('Closed for the Christmas fortnight');
    const paused = page.waitForRequest(sent('POST', `/standing-orders/${NEW_ID}/pause`));
    await pause.getByRole('button', { name: 'Pause' }).click();
    expect((await paused).postDataJSON()).toEqual({ reason: 'Closed for the Christmas fortnight' });
    await expect(page.getByText('The standing order is paused')).toBeVisible();
    await expect(page.getByText('None while it is paused')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Resume' }).click();
    const resume = page.getByRole('dialog', {
      name: `Resume the standing order for ${CUSTOMER.name}?`,
    });
    await resume.getByLabel(/^Reason/).fill('Open again');
    await resume.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByText('The standing order is running again')).toBeVisible();
    await expect(page.getByText('2026-12-03')).toBeVisible();

    await page.getByRole('button', { name: 'End it' }).click();
    const end = page.getByRole('dialog', { name: `End the standing order for ${CUSTOMER.name}?` });
    await expect(end).toContainText('This cannot be undone.');
    await end.getByLabel(/^Reason/).fill('They buy at the counter now');
    await end.getByRole('button', { name: 'End it' }).click();
    await expect(
      page.getByText('The standing order has ended: it makes no more orders'),
    ).toBeVisible();
    // Ended for good: nothing more is offered.
    await expect(page.getByRole('button', { name: 'Change it' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
    expect(bodies.end).toEqual([{ reason: 'They buy at the counter now' }]);
    await checkEveryLook(page);
  });

  test("the server's refusal stays on the form in words, with its reference", async ({
    page,
    api,
  }) => {
    asantewaa(api);
    api.respond(
      'createStandingOrder',
      () => ({
        error: {
          code: 'STANDING_ORDER_INVALID',
          message: 'The standing order is not valid.',
          correlationId: '019a7b2e-1c40-7d3a-9f0e-5b2d6c8e4a12',
          details: [
            {
              field: '/startsOn',
              code: 'STARTS_IN_PAST',
              message: 'The first day is before today in Accra.',
            },
          ],
        },
      }),
      422,
    );
    await signIn(page, USERS.sales, `${ACCOUNT}/standing-orders/new`);
    await page.getByRole('combobox', { name: /^How often/ }).click();
    await page.getByRole('option', { name: 'Every so many days' }).click();
    await page.getByLabel(/^Every how many days/).fill('3');
    await page.getByLabel(/^First day/).fill('2026-11-01');
    await page.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
    await page.getByRole('option', { name: `${EGGS.name} (${EGGS.sku})` }).click();
    await page.getByLabel(/^How many/).fill('5');
    const asked = page.waitForRequest(sent('POST', '/standing-orders'));
    await page.getByRole('button', { name: 'Set up the standing order' }).click();
    expect((await asked).postDataJSON()).toMatchObject({
      frequency: 'EVERY_N_DAYS',
      intervalDays: 3,
    });
    const refusal = page.getByRole('alert').filter({ hasText: 'The standing order was not saved' });
    await expect(refusal).toContainText('This standing order cannot be saved as it is.');
    // The rule the server broke is said beside the field it points at.
    await expect(
      page.getByText('The first day is before today in Accra.', { exact: true }),
    ).toBeVisible();
    // The reference's last eight characters, to quote to support.
    await expect(refusal).toContainText('6c8e 4a12');
    // The person stays on the form with what they typed.
    await expect(page.getByLabel(/^Every how many days/)).toHaveValue('3');
    await checkEveryLook(page);
  });
});

test.describe('without the permission, and when a read fails', () => {
  test('a cashier is denied a standing order and its set-up in words', async ({ page }) => {
    await signIn(page, USERS.cashier, `${ACCOUNT}/standing-orders/${FRIDAYS_ID}`);
    await expect(
      page.getByRole('alert').filter({ hasText: 'You do not have access to this page' }),
    ).toBeVisible();
    await expect(page.getByText('whl.standing_order.read')).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.goto(`${ACCOUNT}/standing-orders/new`);
    await expect(page.getByText('whl.standing_order.manage')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('an Accountant reads a standing order and its runs, and is offered no change', async ({
    page,
    api,
  }) => {
    api.rewrite('listStandingOrderRuns', (body) => pageOf(body, RUNS));
    await signInWithTotp(
      page,
      USERS.accountantEnrolled,
      `${ACCOUNT}/standing-orders/${FRIDAYS_ID}`,
    );
    await expect(page.getByText('Every week on Tuesday')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Each run of this standing order, newest first' }),
    ).toContainText('Order made, held for credit');
    for (const name of ['Change it', 'Pause', 'Resume', 'End it']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    expect(api.log.filter((e) => e.operationId === 'pauseStandingOrder')).toEqual([]);
    await checkEveryLook(page);
  });

  test('runs that fail to load say so with a reference and a retry, under the order', async ({
    page,
    api,
  }) => {
    api.prefer('listStandingOrderRuns', 'code=500');
    await signIn(page, USERS.sales, `${ACCOUNT}/standing-orders/${FRIDAYS_ID}`);
    await expect(page.getByText('Every week on Tuesday')).toBeVisible();
    const failed = page.getByRole('alert').filter({ hasText: 'The runs could not be loaded' });
    await expect(failed).toBeVisible();
    await expect(failed.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await checkEveryLook(page);
  });

  test('a section the server refuses says so in words, and the rest of the account shows', async ({
    page,
    api,
  }) => {
    asantewaa(api);
    // The server's own 403: permission denied in words, on the same page.
    api.prefer('listStandingOrders', 'code=403');
    await signInWithTotp(page, USERS.manager, ACCOUNT);
    await expect(
      page.getByText('You cannot see standing orders (whl.standing_order.read).'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment reminders' })).toBeVisible();
    await checkEveryLook(page);
  });
});
