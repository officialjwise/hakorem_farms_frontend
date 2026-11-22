import type { components } from '@hakorem/api-client';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { CUSTOMER, chopBar, chopBarAccount, chopBarAgeing } from '../../support/quotes';
import { expect, test, type Page } from '../../support/test';

/**
 * Payment reminders (dunning, contract 2.16.0), with credit control. The reminder levels say at how many
 * days overdue a wholesale account's unpaid invoice is sent a reminder, by which channels in the order they
 * are tried, and with which template. A Manager replaces the whole set at once; the server's refusal stays on
 * screen in words with its reason; an empty set turns reminders off, said before saving. Sales reads the
 * levels and cannot change them. The reminders sent are listed newest first, by customer and by day, and a
 * buyer's account shows their own. The suite runs at 360 px. Every amount shown is the API's.
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

/** The levels as the server keeps them after a save, read again by the screen. */
const SAVED: S['DunningLevel'][] = [
  { level: 1, daysOverdue: 7, channels: ['SMS'], templateCode: 'PAYMENT_REMINDER_1' },
  { level: 2, daysOverdue: 14, channels: ['SMS'], templateCode: 'PAYMENT_REMINDER_2' },
  { level: 3, daysOverdue: 21, channels: ['SMS', 'EMAIL'], templateCode: 'PAYMENT_REMINDER_3' },
  {
    level: 4,
    daysOverdue: 45,
    channels: ['WHATSAPP', 'SMS'],
    templateCode: 'PAYMENT_REMINDER_FINAL',
  },
];

/** The screen at 360 px in both themes and both densities: no sideways scroll, and axe in each theme. */
async function checkEveryLook(page: Page) {
  // The pointer off the rows, so no row is read in its hover colour.
  await page.mouse.move(0, 0);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    // A theme change fades the colours: axe reads them once the fade is over, not halfway.
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

/** One level's card in the editor, found by its heading. */
const levelCard = (page: Page, number: number) =>
  page
    .getByRole('form', { name: 'Change the reminder levels' })
    .getByRole('heading', { name: `Level ${number}`, exact: true })
    .locator('..')
    .locator('..');

async function chooseChannel(page: Page, number: number, which: string, channel: string) {
  await levelCard(page, number)
    .getByRole('combobox', { name: new RegExp(`^${which}`) })
    .click();
  await page.getByRole('option', { name: channel, exact: true }).click();
}

test.describe('the reminder levels', () => {
  test("a Manager replaces the whole set; the server's refusal stays on screen with its reason", async ({
    page,
    api,
  }) => {
    let saved = false;
    api.rewrite('listDunningLevels', (body) =>
      saved ? pageOf(body, SAVED) : (body as Page_<S['DunningLevel']>),
    );
    const bodies: unknown[] = [];
    api.respond(
      'replaceDunningLevels',
      (request) => {
        bodies.push(request);
        return {
          error: {
            code: 'DUNNING_POLICY_INVALID',
            message: 'Level 4 must fire later than level 3.',
            correlationId: '019a7b2e-1c40-7d3a-9f0e-5b2d6c8e4a11',
            details: [
              {
                field: '/levels/3/daysOverdue',
                code: 'DAYS_NOT_INCREASING',
                message: 'Level 4 must fire later than level 3.',
              },
            ],
          },
        };
      },
      422,
    );

    await signInWithTotp(page, USERS.manager, '/dunning-policy');
    await expect(page.getByRole('heading', { name: 'Reminder levels', level: 1 })).toBeVisible();
    // The contract's levels, lowest first, each in words.
    const table = page.getByRole('region', { name: 'The reminder levels, lowest first' });
    await expect(table).toContainText('Level 1');
    await expect(table).toContainText('7 days overdue');
    await expect(table).toContainText('Level 5');
    await expect(table).toContainText('60 days overdue');
    await expect(table).toContainText('SMS, Email');
    await checkEveryLook(page);

    await page.getByRole('button', { name: 'Change the levels' }).click();
    const form = page.getByRole('form', { name: 'Change the reminder levels' });
    await form.getByRole('button', { name: 'Remove level 5' }).click();
    await form.getByRole('button', { name: 'Remove level 4' }).click();
    await levelCard(page, 3)
      .getByLabel(/^Days overdue/)
      .fill('21');
    await form.getByRole('button', { name: 'Add a level' }).click();
    await levelCard(page, 4)
      .getByLabel(/^Days overdue/)
      .fill('20');
    await chooseChannel(page, 4, 'First channel', 'WhatsApp');
    await chooseChannel(page, 4, 'Second channel', 'SMS');
    // A channel chosen above is not offered again below.
    await levelCard(page, 4)
      .getByRole('combobox', { name: /^Third channel/ })
      .click();
    await expect(page.getByRole('option', { name: 'WhatsApp', exact: true })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'SMS', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await levelCard(page, 4)
      .getByLabel(/^Template code/)
      .fill('PAYMENT_REMINDER_FINAL');
    await checkEveryLook(page);

    // Confirmed first, with every level in words.
    await form.getByRole('button', { name: 'Save the levels' }).click();
    const confirm = page.getByRole('dialog', { name: 'Save these reminder levels?' });
    await expect(confirm).toContainText('reminders follow these 4 levels');
    await expect(confirm).toContainText(
      'Level 4: 20 days overdue, by WhatsApp, SMS, template PAYMENT_REMINDER_FINAL',
    );
    const first = page.waitForRequest(sent('PUT', '/dunning-policy'));
    await confirm.getByRole('button', { name: 'Save the levels' }).click();
    const firstRequest = await first;
    // The whole set, numbered 1 to 4 in order, each channel once, in the order chosen.
    expect(firstRequest.postDataJSON()).toEqual({
      levels: [
        { level: 1, daysOverdue: 7, channels: ['SMS'], templateCode: 'PAYMENT_REMINDER_1' },
        { level: 2, daysOverdue: 14, channels: ['SMS'], templateCode: 'PAYMENT_REMINDER_2' },
        {
          level: 3,
          daysOverdue: 21,
          channels: ['SMS', 'EMAIL'],
          templateCode: 'PAYMENT_REMINDER_3',
        },
        {
          level: 4,
          daysOverdue: 20,
          channels: ['WHATSAPP', 'SMS'],
          templateCode: 'PAYMENT_REMINDER_FINAL',
        },
      ],
    });

    // The refusal: the dialog closes and the words stay on the form, with the reason and the level.
    await expect(confirm).toBeHidden();
    const refusal = form
      .getByRole('alert')
      .filter({ hasText: 'The reminder levels were not saved' });
    await expect(refusal).toContainText('These reminder levels cannot be saved that way.');
    await expect(refusal).toContainText(
      'Each level must be sent at more days overdue than the level before it.',
    );
    await expect(levelCard(page, 4)).toContainText(
      'The server refused this level, for the reason above.',
    );
    await expect(levelCard(page, 3)).not.toContainText('The server refused this level');
    await checkEveryLook(page);

    // Put right and saved: a new intent, with a new key.
    api.respond('replaceDunningLevels', (request) => {
      bodies.push(request);
      saved = true;
      return pageOf({}, SAVED);
    });
    await levelCard(page, 4)
      .getByLabel(/^Days overdue/)
      .fill('45');
    await form.getByRole('button', { name: 'Save the levels' }).click();
    const second = page.waitForRequest(sent('PUT', '/dunning-policy'));
    await page
      .getByRole('dialog', { name: 'Save these reminder levels?' })
      .getByRole('button', { name: 'Save the levels' })
      .click();
    const secondRequest = await second;
    expect(secondRequest.headers()['idempotency-key']).not.toBe(
      firstRequest.headers()['idempotency-key'],
    );
    await expect(page.getByText('The reminder levels were saved')).toBeVisible();
    await expect(table).toContainText('45 days overdue');
    await expect(table).toContainText('WhatsApp, SMS');
    await expect(table).toContainText('PAYMENT_REMINDER_FINAL');
    expect(bodies).toHaveLength(2);
    await checkEveryLook(page);
  });

  test('an empty set turns reminders off, said in words before saving and confirmed', async ({
    page,
    api,
  }) => {
    let off = false;
    api.rewrite('listDunningLevels', (body) =>
      off ? pageOf(body, []) : (body as Page_<S['DunningLevel']>),
    );
    api.respond('replaceDunningLevels', () => {
      off = true;
      return pageOf({}, []);
    });
    await signInWithTotp(page, USERS.manager, '/dunning-policy');
    await page.getByRole('button', { name: 'Change the levels' }).click();
    const form = page.getByRole('form', { name: 'Change the reminder levels' });
    for (const number of [5, 4, 3, 2, 1]) {
      await form.getByRole('button', { name: `Remove level ${number}` }).click();
    }
    await expect(
      form.getByText('With no levels, payment reminders are off: no customer is sent one.'),
    ).toBeVisible();
    await checkEveryLook(page);
    await form.getByRole('button', { name: 'Save the levels' }).click();
    const confirm = page.getByRole('dialog', { name: 'Turn payment reminders off?' });
    await expect(confirm).toContainText('no customer is sent a payment reminder');
    const request = page.waitForRequest(sent('PUT', '/dunning-policy'));
    await confirm.getByRole('button', { name: 'Turn reminders off' }).click();
    expect((await request).postDataJSON()).toEqual({ levels: [] });
    await expect(
      page.getByText('Payment reminders are off: no customer is sent one'),
    ).toBeVisible();
    // Read again: no levels, said in words, with the way to set them.
    await expect(
      page.getByText('No level is set, so no customer is sent a payment reminder.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set the levels' })).toBeVisible();
    await checkEveryLook(page);
  });

  test('Sales reads the levels and is offered no change', async ({ page, api }) => {
    await signIn(page, USERS.sales, '/dunning-policy');
    const table = page.getByRole('region', { name: 'The reminder levels, lowest first' });
    await expect(table).toContainText('Level 3');
    await expect(table).toContainText('30 days overdue');
    await expect(
      page.getByText('An Owner or Manager changes the levels (whl.dunning.manage).'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the levels' })).toHaveCount(0);
    await expect(page.getByRole('form', { name: 'Change the reminder levels' })).toHaveCount(0);
    expect(api.log.filter((e) => e.operationId === 'replaceDunningLevels')).toEqual([]);
    await checkEveryLook(page);
  });

  test('a cashier is denied the levels and the reminders sent in words', async ({ page }) => {
    await signIn(page, USERS.cashier, '/dunning-policy');
    await expect(
      page.getByRole('alert').filter({ hasText: 'You do not have access to this page' }),
    ).toBeVisible();
    await expect(page.getByText('whl.dunning.read')).toBeVisible();
    await page.goto('/dunning-notices');
    await expect(page.getByText('whl.dunning.read')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('the reminders sent', () => {
  test('newest first, each with its amount; filtered by customer and day, and paged by cursor', async ({
    page,
    api,
  }) => {
    api.rewrite('listCustomers', (body) =>
      pageOf(body, [chopBar((body as Page_<S['Customer']>).data[0] as S['Customer'])]),
    );
    await signIn(page, USERS.sales, '/dunning-notices');
    await expect(page.getByRole('heading', { name: 'Reminders sent', level: 1 })).toBeVisible();
    const table = page.getByRole('region', { name: 'Reminders sent' }).last();
    await expect(table).toContainText('Royal Palm Hotel Ltd');
    await expect(table).toContainText('INV-2026-DDW-001150');
    await expect(table).toContainText('Level 2');
    await expect(table).toContainText('2,225.00');
    await expect(table).toContainText('SMS, Email');
    await expect(table).toContainText('2026-11-13');
    await checkEveryLook(page);

    // The next page, by the API's cursor.
    const next = page.waitForRequest(sent('GET', '/dunning-notices'));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    expect(new URL((await next).url()).searchParams.get('cursor')).toBe('eyJpZCI6IjAxOWE3YyJ9');

    // One customer: asked of the API, never filtered here.
    await page.getByRole('combobox', { name: /^Customer/ }).fill('Asantewaa');
    const byCustomer = page.waitForRequest(
      (r) =>
        sent('GET', '/dunning-notices')(r) &&
        new URL(r.url()).searchParams.get('customerId') === CUSTOMER.id,
    );
    await page.getByRole('option', { name: `${CUSTOMER.name} (${CUSTOMER.publicId})` }).click();
    const asked = new URL((await byCustomer).url());
    // A new filter starts again from the first page.
    expect(asked.searchParams.get('cursor')).toBeNull();

    const byDay = page.waitForRequest(
      (r) =>
        sent('GET', '/dunning-notices')(r) && new URL(r.url()).searchParams.get('from') !== null,
    );
    await page.getByLabel(/^Queued on or after/).fill('2026-11-05');
    const day = new URL((await byDay).url());
    expect(day.searchParams.get('from')).toBe('2026-11-05T00:00:00.000Z');
    expect(day.searchParams.get('customerId')).toBe(CUSTOMER.id);
    await checkEveryLook(page);
  });

  test("a buyer's account shows their own reminders, read-only", async ({ page, api }) => {
    api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as S['BusinessAccount']));
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    api.rewrite('listDunningNotices', (body) => {
      const page_ = body as Page_<S['DunningNotice']>;
      return pageOf(
        body,
        page_.data.filter((n) => n.customer.id === CUSTOMER.id),
      );
    });
    const asked = page.waitForRequest(sent('GET', '/dunning-notices'));
    await signIn(page, USERS.sales, `/business-accounts/${CUSTOMER.id}`);
    expect(new URL((await asked).url()).searchParams.get('customerId')).toBe(CUSTOMER.id);
    await expect(page.getByRole('heading', { name: 'Payment reminders' })).toBeVisible();
    const reminders = page.getByRole('region', {
      name: 'Each payment reminder sent to this buyer, newest first',
    });
    await expect(reminders).toContainText('INV-2026-DDW-001159');
    await expect(reminders).toContainText('INV-2026-DDW-001168');
    await expect(reminders).toContainText('Level 3');
    await expect(reminders).toContainText('45 days');
    await expect(reminders).toContainText('1,860.00');
    await expect(reminders).not.toContainText('Royal Palm Hotel Ltd');
    await expect(page.getByRole('link', { name: 'See the reminder levels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the levels' })).toHaveCount(0);
    await checkEveryLook(page);
  });
});
