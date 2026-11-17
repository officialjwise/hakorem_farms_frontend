import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { eggEntries, EGGS_ID, seedEggs } from '../../support/eggs';
import type { components } from '@hakorem/api-client';

/**
 * The egg session, part c: bulk buyer prices (ADR 0049; contract 2.1.0). A price list holds a crate's
 * price and a single egg's price as two entries, a quantity break is counted in crates ("from 10 crates"),
 * and a list is given to a buyer. Every price is the API's or typed by the owner; nothing is derived.
 */

type S = components['schemas'];

const DRAFT = '019a7aa3-e9f0-71af-86e7-23c27a0d9ca0';
const ROYAL_PALM_LIST = '019a7aa4-e168-70ca-8603-157e47958e5c';
const CHOP_BAR = '019a7a87-c269-71a7-b6df-2344b7f49c22';

test.describe('bulk buyer prices for eggs', () => {
  test('a draft shows a crate, a break in crates and a single egg, and takes a new break in crates', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    api.rewrite('listPriceListEntries', (body) => {
      const answer = body as { data: S['PriceListEntry'][] };
      const first = answer.data[0];
      return first === undefined ? answer : { ...answer, data: eggEntries(first) };
    });

    await signInWithTotp(page, USERS.owner, `/price-list-versions/${DRAFT}`);
    const preview = page.getByRole('region', {
      name: 'Preview of the draft against the prices in force',
    });
    const rows = preview.getByRole('row').filter({ hasText: 'Eggs, big' });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('per crate');
    await expect(rows.nth(1)).toContainText('from 10 Crate (300 in the base unit)');
    await expect(rows.nth(1)).toContainText('GH₵55.00');
    await expect(rows.nth(2)).toContainText('per unit');
    await expect(rows.nth(2)).toContainText('GH₵2.20');
    // A crate and a single egg are told apart on their buttons too.
    await expect(
      page.getByRole('button', {
        name: 'Change the prices of Eggs, big, per crate, from 10 Crate (300 in the base unit)',
      }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Add a price' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a price to the draft' });
    await dialog.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
    await page.getByRole('option', { name: 'Eggs, big (EGG-0003)' }).click();
    await dialog.getByRole('combobox', { name: 'Sold by' }).click();
    await page.getByRole('option', { name: 'Crate' }).click();
    await dialog.getByLabel(/^List price per Crate, GHS/).fill('52.00');
    await dialog.getByLabel(/^Floor price per Crate, GHS/).fill('50.00');
    await dialog.getByLabel(/^Ceiling price per Crate, GHS/).fill('58.00');
    await dialog.getByLabel('From how many, in Crate').fill('50');
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes(`/price-list-versions/${DRAFT}/entries`),
    );
    await dialog.getByRole('button', { name: 'Add the price' }).click();
    const body = (await sent).postDataJSON() as S['PriceListEntriesReplace'];
    // Every entry keeps its unit and its break as entered; the new one is in crates, from 50 crates.
    expect(body.entries.map((e) => [e.uom, e.minQty, e.listPricePesewas])).toEqual([
      ['CRATE', '0.000', 6000],
      ['CRATE', '10.000', 5500],
      ['UNIT', '0.000', 220],
      ['CRATE', '50.000', 5200],
    ]);
    expect(body.entries[3]).toMatchObject({ productId: EGGS_ID, basis: 'PER_UNIT' });
    await expect(
      page.getByRole('status').filter({ hasText: 'A price for Eggs, big added to the draft' }),
    ).toBeVisible();
  });

  test('a new price list is made for a buyer, and a list is given to a buyer from a day', async ({
    page,
    api,
  }) => {
    api.rewrite('getPriceList', (body) => ({
      ...(body as object),
      id: ROYAL_PALM_LIST,
      code: 'CUST-ROYALPALM',
      name: 'Royal Palm Hotel contract prices',
      kind: 'CUSTOMER',
      channel: null,
      customerTier: null,
    }));

    await signInWithTotp(page, USERS.owner, '/price-lists');
    await page.getByRole('button', { name: 'New price list for a buyer' }).click();
    await page.getByLabel(/^Name/).fill('Asantewaa Chop Bar prices');
    await page.getByLabel(/^Code/).fill('cust-asantewaa');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    const made = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/mock/price-lists',
    );
    await page.getByRole('button', { name: 'Create the price list' }).click();
    expect((await made).postDataJSON()).toEqual({
      code: 'CUST-ASANTEWAA',
      name: 'Asantewaa Chop Bar prices',
      kind: 'CUSTOMER',
      taxInclusive: true,
    });

    await page.waitForURL(/\/price-lists\/[0-9a-f-]{36}$/);
    const card = page.getByRole('heading', { name: 'Give these prices to a buyer' });
    await expect(card).toBeVisible();
    await page.getByRole('combobox', { name: /^Buyer/ }).fill('Asan');
    await page.getByRole('option', { name: /^Asantewaa Chop Bar/ }).click();
    await page.getByLabel(/^From/).fill('2026-12-01');
    // Sending without the acknowledgement is stopped in words.
    await page.getByRole('button', { name: 'Give the buyer these prices' }).click();
    await expect(page.getByText('Tick this to give the buyer these prices.')).toBeVisible();
    await page.getByRole('checkbox', { name: /replaces any list/ }).check();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().endsWith(`/customers/${CHOP_BAR}/price-list`),
    );
    await page.getByRole('button', { name: 'Give the buyer these prices' }).click();
    expect((await sent).postDataJSON()).toEqual({
      priceListId: ROYAL_PALM_LIST,
      validFrom: '2026-12-01T00:00:00Z',
    });
    // The answer is the contract's example; the screen shows what the server recorded.
    await expect(
      page.getByText('Asantewaa Chop Bar pays Royal Palm Hotel contract prices from 2026-11-01.'),
    ).toBeVisible();
  });
});
