import { expect, test } from '../../support/test';
import { installServerSku } from '../../support/requested';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F4's primary flows (FR-MDM): the catalogue, its reference data and price lists. The gate is the first
 * test: a price list change is previewed, line by line against the prices in force, before it activates.
 */

const BASE_LIST = '019a7a94-5381-760f-bb48-69ce27dce2ac';
const DRAFT = '019a7aa3-e9f0-71af-86e7-23c27a0d9ca0';
/** Version 4 of the base list in the contract's `listPriceListVersions` example, the one in force. */
const ACTIVE = '019a7aa4-46bd-7f59-b491-fe68e7207746';
const GOAT = '019a7a8d-137d-74bf-b9f8-54cda260cdab';
const GOAT_SPECIES = '019a7a8b-a049-7e16-b34e-ea33ee146311';

interface Entry {
  product: { name: string };
  listPricePesewas: number;
  floorPricePesewas: number;
  ceilingPricePesewas: number;
}
interface Page {
  data: Entry[];
  page: unknown;
}

test.describe('the F4 gate: a price list change is previewed before it activates', () => {
  test('the owner opens the draft, sees what changes against the prices in force, changes a line and submits it, and nothing activates', async ({
    page,
    api,
  }) => {
    // The contract's examples serve one set of lines for every version and name the draft as the one in
    // force. Here the base list's version 4 is in force, with beef dearer than the draft and baby pig
    // priced, so the preview has a change and a dropped line to show.
    api.rewrite('getPriceList', (body) => ({
      ...(body as object),
      activeVersion: {
        id: ACTIVE,
        versionNo: 4,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: null,
      },
    }));
    api.rewrite('listPriceListEntries', (body, path) => {
      const answer = body as Page;
      if (!path.includes(ACTIVE)) {
        return { ...answer, data: answer.data.filter((e) => e.product.name !== 'Baby pig') };
      }
      return {
        ...answer,
        data: answer.data.map((e) =>
          e.product.name === 'Beef, 15 kg pack'
            ? { ...e, listPricePesewas: 2800, floorPricePesewas: 2000, ceilingPricePesewas: 4000 }
            : e,
        ),
      };
    });
    api.prefer('submitPriceListVersion', 'code=202');

    await signInWithTotp(page, USERS.owner, '/price-lists');
    await expect(page.getByRole('heading', { name: 'Price lists', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Preview the draft of Base prices' }).click();
    await expect(
      page.getByRole('heading', { name: 'Base prices, version 5', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    const preview = page.getByRole('region', {
      name: 'Preview of the draft against the prices in force',
    });
    await expect(page.getByText('Each line beside the same line in version 4')).toBeVisible();
    const summary = page.getByRole('list', { name: 'What changes' });
    await expect(summary).toContainText('1 price changes');
    await expect(summary).toContainText('1 line dropped');
    const beef = preview.getByRole('row').filter({ hasText: 'Beef, 15 kg pack' });
    await expect(beef).toContainText('Price changes');
    // Now: the active version's band. From the draft: the draft's. Both are the API's figures.
    await expect(beef).toContainText('GH₵20.00');
    await expect(beef).toContainText('GH₵22.00');
    await expect(preview.getByRole('row').filter({ hasText: 'Baby pig' })).toContainText(
      'No longer priced',
    );
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    await page
      .getByRole('button', { name: 'Change the prices of Full chicken, 15 kg pack' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Prices of Full chicken, 15 kg pack' });
    const list = dialog.getByLabel(/^list price, GHS per kg/i);
    await list.fill('21.00');
    await dialog.getByRole('button', { name: 'Save prices' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Prices of Full chicken, 15 kg pack saved' }),
    ).toBeVisible();
    const replaced = api.log.filter((e) => e.operationId === 'replacePriceListEntries');
    expect(replaced.map((e) => e.outcome)).toEqual(['prism']);

    await page.getByRole('button', { name: 'Submit for approval' }).click();
    const confirm = page.getByRole('dialog', { name: 'Submit this draft for approval?' });
    await expect(confirm).toContainText('Takes effect from 2026-12-01 00:00');
    await expectNoAxeViolations(page);
    await confirm.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent for approval' })).toContainText(
      'Nothing has changed yet',
    );
    expect(api.log.filter((e) => e.operationId === 'submitPriceListVersion')).toHaveLength(1);
  });
});

test.describe('products', () => {
  test('the owner finds a product, opens it and saves a change to its details', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/products');
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    const search = page.getByRole('searchbox', {
      name: /^search products by name, sku or barcode/i,
    });
    await search.fill('goat');
    await search.press('Enter');
    await expect
      .poll(() => api.log.filter((e) => e.operationId === 'listProducts').length)
      .toBeGreaterThan(1);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Goat' }).first().click();
    await expect(page.getByRole('heading', { name: 'Stock-keeping facts' })).toBeVisible();
    await page.getByLabel(/^name/i).fill('Goat, live');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Details saved' })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test('the owner creates a product by the keyboard, choosing how its stock is kept; the server gives the SKU', async ({
    page,
    api,
  }) => {
    const server = installServerSku(api);
    await signInWithTotp(page, USERS.owner, '/products/new');
    await expect(page.getByRole('heading', { name: 'New product', level: 1 })).toBeVisible();
    // The SKU is never typed (owner, 2026-11-17; CR-034): no field, and words saying who gives it.
    await expect(page.getByRole('textbox', { name: /^sku/i })).toHaveCount(0);
    await expect(page.locator('[data-slot="sku-given"]')).toContainText(
      'Given by the server when the product is saved',
    );
    await page.getByLabel(/^name/i).fill('Duck');
    for (const [label, option] of [
      [/^category/i, 'Live poultry'],
      [/^stock unit/i, 'Head (HEAD)'],
      [/^sale unit/i, 'Head (HEAD)'],
    ] as const) {
      const select = page.getByRole('combobox', { name: label });
      await select.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('option', { name: option }).press('Enter');
      await expect(select).toHaveText(option);
      await expect(page.getByRole('listbox')).toHaveCount(0);
    }
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Create product' }).click();
    // Prism answers with its example product, so the new screen is that one, its SKU shown read-only.
    await expect(page.getByRole('heading', { name: 'Stock-keeping facts' })).toBeVisible();
    expect(server.sent).toHaveLength(1);
    expect(server.sent[0]).not.toHaveProperty('sku');
    expect(server.sent[0]).toMatchObject({ name: 'Duck' });
  });
});

test.describe('reference data', () => {
  test('the owner adds a weight band to goats, in kilograms to three places', async ({
    page,
    api,
  }) => {
    await signInWithTotp(page, USERS.owner, '/species');
    await page.getByRole('link', { name: 'Goat' }).click();
    await expect(page.getByRole('heading', { name: 'Weight bands' })).toBeVisible();
    await expect(page.getByText('GOAT-M').first()).toBeVisible();
    await page.getByRole('button', { name: 'New weight band' }).click();
    const dialog = page.getByRole('dialog', { name: 'New weight band for Goat' });
    await dialog.getByLabel(/^code/i).fill('GOAT-XL');
    await dialog.getByLabel(/^from \(kg/i).fill('45');
    await dialog.getByLabel(/^up to \(kg/i).fill('70');
    await dialog.getByLabel(/^up to \(kg/i).blur();
    await expect(dialog.getByLabel(/^from \(kg/i)).toHaveValue('45.000');
    await dialog.getByRole('button', { name: 'Save weight band' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'GOAT-XL saved' })).toBeVisible();
    expect(api.log.some((e) => e.operationId === 'createWeightBand' && e.outcome === 'prism')).toBe(
      true,
    );
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test('the owner archives a category, giving a reason', async ({ page }) => {
    await signInWithTotp(page, USERS.owner, '/categories');
    await page.getByRole('button', { name: 'Archive Feed and medication' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archive Feed and medication?' });
    await dialog.getByLabel(/^reason/i).fill('Feed is bought, not sold');
    await dialog.getByRole('button', { name: 'Archive' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Feed and medication archived' }),
    ).toBeVisible();
  });
});

const F4_ROUTES = [
  '/products',
  `/products/${GOAT}`,
  '/products/new',
  '/categories',
  '/units',
  '/species',
  `/species/${GOAT_SPECIES}`,
  '/price-lists',
  `/price-lists/${BASE_LIST}`,
  `/price-list-versions/${DRAFT}`,
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`every F4 screen is axe clean at 360 px (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of F4_ROUTES) {
      test(path, async ({ page }) => {
        await signInWithTotp(page, USERS.owner, path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

const CASHIER_DENIED: { path: string; permission: string }[] = [
  { path: '/categories', permission: 'mdm.category.read' },
  { path: '/species', permission: 'mdm.species.read' },
  { path: '/price-lists', permission: 'mdm.price_list.read' },
  { path: `/price-list-versions/${DRAFT}`, permission: 'mdm.price_list.read' },
  { path: '/products/new', permission: 'mdm.product.create' },
];

test.describe('a wrong role meets words', () => {
  for (const { path, permission } of CASHIER_DENIED) {
    test(`a cashier opening ${path} is denied in words, on the same URL, naming ${permission}`, async ({
      page,
      api,
    }) => {
      await signIn(page, USERS.cashier, path);
      await expect(
        page.getByRole('alert').filter({ hasText: 'You do not have access to this page' }),
      ).toBeVisible();
      await expect(page.getByText(permission)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
      expect(api.log.filter((e) => e.outcome === 'prism-403')).toEqual([]);
      await expectNoAxeViolations(page);
    });
  }

  test('a storekeeper reads products but is offered no change', async ({ page }) => {
    await signIn(page, USERS.storekeeper, `/products/${GOAT}`);
    await expect(page.getByRole('heading', { name: 'Stock-keeping facts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save details' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive the product' })).toHaveCount(0);
  });
});
