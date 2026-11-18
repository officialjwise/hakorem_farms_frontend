import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import type { FakeApi } from '../../support/fakeApi';
import { confirmStepUp, signInWithTotp, USERS } from '../../support/helpers';
import { installTillServer, openTillShift, find } from '../../support/till';
import { PEOPLE, installTillPins } from '../../support/requested';
import {
  APPROVAL_ID,
  CLAIM_ID,
  eggClaim,
  eggPayment,
  INVOICE_ID,
  MANAGER,
  PAYMENT_ID,
  paymentApproval,
  rightInvoice,
  seedPayables,
  wrongInvoice,
} from '../../support/payables';
import type { components } from '@hakorem/api-client';
import { GET_ORDER_CREDIT_CHECK } from '../../../apps/console/src/requested/creditControl';
import {
  CUSTOMER,
  ORDER_ID as QUOTE_ORDER_ID,
  OVERRIDE_APPROVAL_ID,
  QUOTE_ID,
  QUOTE_NO,
  VERSION_1,
  chopBar,
  chopBarAccount,
  chopBarAgeing,
  eggOrder as quoteOrder,
  eggPrices as quotePrices,
  eggQuote,
  overLimit,
  overrideApproval,
  overrideState,
  version1,
  version2,
} from '../../support/quotes';
import {
  eggEntries,
  eggOrder,
  eggReceipt,
  eggsByTheEgg,
  ORDER_ID,
  seedEggs,
  SUPPLIER,
} from '../../support/eggs';

/**
 * Screenshots of every screen a phase built, for the owner to review from a phone (owner, 2026-11-15).
 * Console screens; the storefront's are in specs/storefront/screenshots.spec.ts. The production build on the mock, through the e2e fake API, signed in as the owner (A-F4-12). One shot
 * at 1280 px and one at 360 px per screen, PNG at 1x, light theme for the back office and storefront, dark
 * for the till. Tagged `@screenshots`: `pnpm test:e2e` leaves it out, `pnpm screenshots` runs it and
 * writes `docs/screenshots/<phase>/<screen>-<width>.png`.
 */

/** Any id: the mock answers a record read with its example. */
const ID = '019a7a86-3046-711a-a652-1a7389f79351';

interface Shot {
  name: string;
  path: string;
  /** Something on the screen once its data is in, so the shot is not of a loading state. */
  ready: string;
  theme?: 'light' | 'dark';
  /** Rewrites for a state the contract's examples cannot show by themselves. */
  prepare?: (api: FakeApi) => void;
  /** Steps on the screen before the shot, for a state reached by using it. */
  act?: (page: Page) => Promise<void>;
}

const PHASES: Record<string, Shot[]> = {
  F04: [
    { name: 'products', path: '/products', ready: 'LIV-0004' },
    {
      name: 'product',
      path: '/products/019a7a8d-137d-74bf-b9f8-54cda260cdab',
      ready: 'Stock-keeping facts',
    },
    { name: 'product-new', path: '/products/new', ready: 'Create product' },
    { name: 'categories', path: '/categories', ready: 'Feed and medication' },
    { name: 'units', path: '/units', ready: 'Kilogram' },
    { name: 'species', path: '/species', ready: 'Local chicken' },
    {
      name: 'species-goat',
      path: '/species/019a7a8b-a049-7e16-b34e-ea33ee146311',
      ready: 'GOAT-M',
    },
    { name: 'price-lists', path: '/price-lists', ready: 'Royal Palm Hotel contract prices' },
    {
      name: 'price-list',
      path: '/price-lists/019a7a94-5381-760f-bb48-69ce27dce2ac',
      ready: 'Versions',
    },
    {
      name: 'price-list-version-preview',
      path: '/price-list-versions/019a7aa3-e9f0-71af-86e7-23c27a0d9ca0',
      ready: 'Preview before it takes effect',
      prepare: previewWithChanges,
    },
  ],
  F05: [
    { name: 'stock-on-hand', path: '/stock', ready: 'Stock value at cost' },
    { name: 'stock-takes', path: '/stock-takes', ready: 'Feed and produce store' },
    { name: 'stock-take-counting', path: `/stock-takes/${ID}`, ready: 'Save counts on this page' },
    { name: 'adjustments', path: '/stock-adjustments', ready: 'ADJ-2026-DDW-000038' },
    { name: 'adjustment', path: `/stock-adjustments/${ID}`, ready: 'Yam, tuber' },
    { name: 'adjustment-new', path: '/stock-adjustments/new', ready: 'Save the draft' },
    { name: 'transfers', path: '/stock-transfers', ready: 'TRF-2026-DDW-00009' },
    { name: 'transfer', path: `/stock-transfers/${ID}`, ready: 'Goat meat, 15 kg pack' },
    {
      name: 'transfer-receive',
      path: `/stock-transfers/${ID}`,
      ready: 'Receive what arrived',
      prepare: (api) =>
        api.rewrite('getStockTransfer', (body) => {
          const transfer = body as { lines: Record<string, unknown>[] };
          return {
            ...transfer,
            status: 'DISPATCHED',
            receivedAt: null,
            receivedBy: null,
            lines: transfer.lines.map((l) => ({
              ...l,
              qtyReceived: null,
              varianceQty: null,
              varianceReasonCode: null,
            })),
          };
        }),
    },
    { name: 'transfer-new', path: '/stock-transfers/new', ready: 'Save the draft' },
    { name: 'goods-receipts', path: '/goods-receipts', ready: 'GRN-2026-DDW-000072' },
    { name: 'goods-receipt', path: `/goods-receipts/${ID}`, ready: 'Total at cost' },
    { name: 'goods-receipt-new', path: '/goods-receipts/new', ready: 'Save the draft' },
  ],
};

PHASES.F05b = [
  { name: 'dashboard', path: '/', ready: 'Selling best today' },
  { name: 'dashboard-dark', path: '/', ready: 'Selling best today', theme: 'dark' },
  { name: 'branches', path: '/branches', ready: 'HaKorem Farms, Dodowa' },
  { name: 'branch', path: `/branches/${ID}`, ready: 'Locations in this branch' },
  { name: 'labels', path: '/labels', ready: 'LIV-0004' },
  {
    name: 'labels-sheet',
    path: '/labels',
    ready: 'LIV-0004',
    act: async (page) => {
      await page.getByRole('button', { name: 'Add a label for Goat' }).click();
      await page.getByRole('button', { name: 'Add a label for Broiler chicken' }).click();
      await page.getByRole('button', { name: 'One more label for Broiler chicken' }).click();
      await page.getByRole('tab', { name: 'Lots and animals' }).click();
      await page.getByRole('button', { name: /^Add a label for Goat G-0142/ }).click();
    },
  },
  { name: 'lots', path: '/lots', ready: 'G-0142' },
  { name: 'movements', path: '/movements', ready: 'Sale issue' },
  { name: 'suppliers', path: '/suppliers', ready: 'Kpone Livestock Traders' },
  { name: 'registers', path: '/registers', ready: 'Shift open' },
  { name: 'stock-on-hand', path: '/stock', ready: 'Stock value at cost' },
  { name: 'transfers', path: '/stock-transfers', ready: 'TRF-2026-DDW-00009' },
  { name: 'products', path: '/products', ready: 'LIV-0004' },
  { name: 'users', path: '/users', ready: 'Akua Mensah' },
  { name: 'roles', path: '/roles', ready: 'Cashier' },
  { name: 'sessions', path: '/sessions', ready: 'This device' },
  { name: 'reports', path: '/reports', ready: 'Stock valuation' },
  { name: 'report-sales', path: '/reports/sales', ready: 'Export' },
  {
    name: 'report-stock-valuation',
    path: '/reports/stock-valuation',
    ready: 'Export',
  },
  {
    name: 'report-profit-and-loss',
    path: '/reports/profit-and-loss',
    ready: 'Sales, live animals',
  },
  {
    name: 'branch-new-modal',
    path: '/branches',
    ready: 'HaKorem Farms, Dodowa',
    act: async (page) => {
      await page.getByRole('button', { name: 'New branch' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'branch-close-modal',
    path: `/branches/${ID}`,
    ready: 'Locations in this branch',
    act: async (page) => {
      await page.getByRole('button', { name: 'Close the branch' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'stock-takes', path: '/stock-takes', ready: 'Feed and produce store' },
  { name: 'goods-receipts', path: '/goods-receipts', ready: 'GRN-2026-DDW-000072' },
  { name: 'price-lists', path: '/price-lists', ready: 'Royal Palm Hotel contract prices' },
  {
    name: 'transfer-receive-gap',
    path: `/stock-transfers/${ID}`,
    ready: 'Receive what arrived',
    prepare: (api) =>
      api.rewrite('getStockTransfer', (body) => {
        const transfer = body as { lines: Record<string, unknown>[] };
        return {
          ...transfer,
          status: 'DISPATCHED',
          receivedAt: null,
          receivedBy: null,
          lines: transfer.lines.map((l) => ({
            ...l,
            qtyReceived: null,
            varianceQty: null,
            varianceReasonCode: null,
          })),
        };
      }),
    act: async (page) => {
      await page.getByLabel(/^Goat meat, 15 kg pack: quantity that arrived/).fill('29.750');
      await page.getByText('fewer than sent').first().waitFor();
    },
  },
];

/** F5c, the closer pass: every back office screen, re-shot beside the reference. */
PHASES.F05c = [
  { name: 'dashboard', path: '/', ready: 'Selling best today' },
  { name: 'dashboard-dark', path: '/', ready: 'Selling best today', theme: 'dark' },
  { name: 'products', path: '/products', ready: 'LIV-0004' },
  {
    name: 'products-columns-menu',
    path: '/products',
    ready: 'LIV-0004',
    act: async (page) => {
      await page.getByRole('button', { name: /^Columns/ }).click();
      await page.getByRole('dialog', { name: 'Columns' }).waitFor();
    },
  },
  {
    name: 'products-page-2',
    path: '/products',
    ready: 'LIV-0004',
    act: async (page) => {
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('combobox', { name: 'Go to page' }).waitFor();
    },
  },
  {
    name: 'products-sort-menu',
    path: '/products',
    ready: 'LIV-0004',
    act: async (page) => {
      await page.getByRole('button', { name: /^Sort by/ }).click();
      await page.getByRole('dialog', { name: 'Sort by' }).waitFor();
    },
  },
  {
    name: 'product',
    path: '/products/019a7a8d-137d-74bf-b9f8-54cda260cdab',
    ready: 'Stock-keeping facts',
  },
  { name: 'product-new', path: '/products/new', ready: 'Create product' },
  { name: 'categories', path: '/categories', ready: 'Feed and medication' },
  { name: 'units', path: '/units', ready: 'Kilogram' },
  { name: 'species', path: '/species', ready: 'Local chicken' },
  { name: 'price-lists', path: '/price-lists', ready: 'Royal Palm Hotel contract prices' },
  { name: 'stock-on-hand', path: '/stock', ready: 'Stock value at cost' },
  { name: 'lots', path: '/lots', ready: 'G-0142' },
  { name: 'movements', path: '/movements', ready: 'Sale issue' },
  { name: 'stock-takes', path: '/stock-takes', ready: 'Feed and produce store' },
  { name: 'adjustments', path: '/stock-adjustments', ready: 'ADJ-2026-DDW-000038' },
  { name: 'transfers', path: '/stock-transfers', ready: 'TRF-2026-DDW-00009' },
  { name: 'goods-receipts', path: '/goods-receipts', ready: 'GRN-2026-DDW-000072' },
  { name: 'suppliers', path: '/suppliers', ready: 'Kpone Livestock Traders' },
  { name: 'registers', path: '/registers', ready: 'Shift open' },
  { name: 'branches', path: '/branches', ready: 'HaKorem Farms, Dodowa' },
  { name: 'branch', path: `/branches/${ID}`, ready: 'Locations in this branch' },
  {
    name: 'branch-new-modal',
    path: '/branches',
    ready: 'HaKorem Farms, Dodowa',
    act: async (page) => {
      await page.getByRole('button', { name: 'New branch' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'branch-close-modal',
    path: `/branches/${ID}`,
    ready: 'Locations in this branch',
    act: async (page) => {
      await page.getByRole('button', { name: 'Close the branch' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'labels', path: '/labels', ready: 'LIV-0004' },
  { name: 'reports', path: '/reports', ready: 'Stock valuation' },
  { name: 'report-sales', path: '/reports/sales', ready: 'Export' },
  { name: 'report-stock-valuation', path: '/reports/stock-valuation', ready: 'Export' },
  {
    name: 'report-profit-and-loss',
    path: '/reports/profit-and-loss',
    ready: 'Sales, live animals',
  },
  { name: 'users', path: '/users', ready: 'Akua Mensah' },
  { name: 'roles', path: '/roles', ready: 'Cashier' },
  { name: 'sessions', path: '/sessions', ready: 'This device' },
  { name: 'audit', path: '/audit', ready: '2026-11-13 08:03' },
  { name: 'settings', path: '/settings', ready: 'Menu width' },
  {
    name: 'settings-business',
    path: '/settings/business',
    ready: 'Taxpayer identification number',
  },
  { name: 'settings-system', path: '/settings/system', ready: 'tax.registered' },
];

/** F6: the dashboard on contract 1.24.0, then the livestock and processing screens. */
PHASES.F06 = [
  { name: 'dashboard', path: '/', ready: 'Animals on hand' },
  { name: 'dashboard-dark', path: '/', ready: 'Animals on hand', theme: 'dark' },
  {
    // What the API answers today (1.21.1): sales, money and alerts named as pending, never as zero.
    name: 'dashboard-before-sales',
    path: '/',
    ready: 'Figures still to come from the server',
    prepare: (api) => api.prefer('getOwnerDashboard', 'example=beforeSalesAndBilling'),
  },
  { name: 'animals', path: '/animals', ready: 'G-0157' },
  { name: 'animal', path: `/animals/${ID}`, ready: 'Bought from Kpone Livestock Traders' },
  {
    name: 'animal-dark',
    path: `/animals/${ID}`,
    ready: 'Bought from Kpone Livestock Traders',
    theme: 'dark',
  },
  { name: 'weights', path: '/weights', ready: 'BRL-2610-01' },
  { name: 'health', path: '/health-events', ready: 'Every animal in Broiler house 1' },
  { name: 'breeding', path: '/breeding', ready: 'Dam G-0122' },
  { name: 'mortality', path: '/mortality', ready: 'G-0171' },
  { name: 'mortality-record', path: `/mortality/${ID}`, ready: 'Death of G-0171' },
  { name: 'feed', path: '/feed', ready: 'Layer house' },
  { name: 'processing-orders', path: '/processing-orders', ready: 'G-0104' },
  { name: 'processing-order', path: `/processing-orders/${ID}`, ready: 'PRC-261109-3a247e03-01' },
  { name: 'processing-order-new', path: '/processing-orders/new', ready: 'Planning an order' },
  { name: 'yield-standards', path: '/yield-standards', ready: 'Broiler chicken' },
  { name: 'lots-came-from', path: '/lots', ready: 'Came from' },
];

/** A small grey picture for a death's photograph, so no shot fetches the example's signed link. */
const PHOTO =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDMiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9ImdyYXkiLz48L3N2Zz4=';

PHASES.F06b = [
  { name: 'approvals', path: '/approvals', ready: 'Void a sale' },
  {
    // The contract's G-0171 death, waiting as a MORTALITY_WRITE_OFF with its photograph (1.24.0).
    name: 'approval-death',
    path: `/approvals/${ID}`,
    ready: 'Death or cull write-off',
    prepare: (api) => {
      api.rewrite('getApproval', (body) => ({
        ...(body as Record<string, unknown>),
        kind: 'MORTALITY_WRITE_OFF',
        subject: {
          id: '019a7ac0-1177-71b6-96ef-24403c269d1e',
          docType: 'MORTALITY_RECORD',
          number: null,
        },
        summary: 'Death of G-0171 (DISEASE_SUSPECTED), valued 58900 pesewas',
        amountPesewas: 58900,
        evidenceFileId: '019a7ac0-3066-7b9a-a0d2-c277b5d73b55',
        requestedBy: { id: '019a7a87-08cf-7652-9b8a-6df7ddcee6d5', displayName: 'Abena Quaye' },
      }));
      api.rewrite('getFile', (body) => ({
        ...(body as Record<string, unknown>),
        scanStatus: 'CLEAN',
      }));
      api.rewrite('createFileSignedUrl', (body) => ({
        ...(body as Record<string, unknown>),
        url: PHOTO,
      }));
    },
  },
  { name: 'report-death', path: '/report-death', ready: 'Take or choose a photo' },
  {
    name: 'pack-labels',
    path: `/processing-orders/${ID}`,
    ready: 'PRC-261109-3a247e03-01',
    act: async (page) => {
      await page.getByRole('button', { name: /^Print \d+ labels?$/ }).click();
      await expect(page.getByRole('list', { name: 'Pack labels' })).toBeVisible();
    },
  },
];

/** F8: billing. The receipt in `getBillingDocument`'s example; the reprint is given a PDF (CR-030). */
const RECEIPT = '019a7ae2-fd46-7b80-a0b9-c0e09cf739be';
const PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDEwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==';

PHASES.F08 = [
  { name: 'billing-documents', path: '/billing-documents', ready: 'Invoice INV-2026-DDW-001198' },
  { name: 'billing-document', path: `/billing-documents/${RECEIPT}`, ready: 'Reprint history' },
  {
    name: 'billing-document-reprinted',
    path: `/billing-documents/${RECEIPT}`,
    ready: 'Reprint history',
    prepare: (api) =>
      api.rewrite('reprintBillingDocument', () => ({
        copyNo: 2,
        channel: 'PDF',
        url: null,
        escPosBase64: null,
        pdfBase64: PDF_BASE64,
        expiresAt: null,
      })),
    act: async (page) => {
      await page.getByRole('button', { name: 'Reprint as PDF' }).click();
      await page
        .getByRole('dialog', { name: 'Reprint this document?' })
        .getByRole('button', { name: 'Reprint as PDF' })
        .click();
      await expect(
        page.getByRole('region', { name: 'Reprint 2: a copy, not a new document' }),
      ).toBeVisible();
    },
  },
  {
    name: 'billing-document-dark',
    path: `/billing-documents/${RECEIPT}`,
    ready: 'Reprint history',
    theme: 'dark',
  },
  {
    name: 'credit-note',
    path: `/billing-documents/${RECEIPT}/credit-note`,
    ready: 'What to credit',
  },
  { name: 'debit-note', path: `/billing-documents/${RECEIPT}/debit-note`, ready: 'Charges' },
  { name: 'statements', path: '/statements', ready: 'STM-2026-DDW-000031' },
  {
    name: 'statement',
    path: '/statements/019a7b05-ca26-7b67-a09f-bf4984173827',
    ready: 'Balance brought forward',
  },
  { name: 'statement-new', path: '/statements/new', ready: 'Draw up a statement' },
];

const WIDTHS = [1280, 360] as const;

for (const [phase, shots] of Object.entries(PHASES)) {
  for (const shot of shots) {
    for (const width of WIDTHS) {
      test(`@screenshots ${phase} ${shot.name} at ${width}`, async ({ page, api }) => {
        shot.prepare?.(api);
        await page.emulateMedia({ colorScheme: shot.theme ?? 'light' });
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        await signInWithTotp(page, USERS.owner, shot.path);
        await expect(page.getByText(shot.ready).first()).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        await shot.act?.(page);
        await page.screenshot({
          path: `../docs/screenshots/${phase}/${shot.name}-${width}.png`,
          fullPage: true,
          scale: 'css',
        });
      });
    }
  }
}

/** The same rewrite as the F4 gate spec: a version in force whose beef is cheaper, and baby pig dropped. */
function previewWithChanges(api: FakeApi) {
  const active = '019a7aa4-46bd-7f59-b491-fe68e7207746';
  api.rewrite('getPriceList', (body) => ({
    ...(body as object),
    activeVersion: { id: active, versionNo: 4, validFrom: '2026-11-01T00:00:00Z', validTo: null },
  }));
  api.rewrite('listPriceListEntries', (body, path) => {
    const answer = body as { data: { product: { name: string } }[] };
    if (!path.includes(active)) {
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
}

/**
 * F09, the till: each shot sets the device up as till T1 and opens the cashier's shift first (the manager
 * enrols, the cashier opens), as a till is used, then takes the screen to its state.
 */
interface TillShot {
  name: string;
  theme?: 'light' | 'dark';
  act: (page: Page, api: FakeApi, offline: (off: boolean) => Promise<void>) => Promise<void>;
}

async function cart(page: Page) {
  await find(page, 'G-0142', /G-0142$/);
  await page.getByRole('button', { name: 'Beef, 15 kg pack' }).click();
  const line = page.getByRole('dialog', { name: 'Change Beef, 15 kg pack' });
  await line.getByRole('textbox', { name: /^Weight \(kg\)/ }).fill('15.250');
  await line.getByRole('button', { name: 'Save the item' }).click();
  await expect(line).toBeHidden();
}

async function payOffline(page: Page, offline: (off: boolean) => Promise<void>) {
  await offline(true);
  await cart(page);
  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('1400');
}

const TILL_SHOTS: TillShot[] = [
  { name: 'sale-empty', act: async () => undefined },
  { name: 'sale-cart', act: async (page) => cart(page) },
  { name: 'sale-cart-dark', theme: 'dark', act: async (page) => cart(page) },
  {
    name: 'line-agreed-price',
    act: async (page) => {
      await find(page, 'G-0142', /G-0142$/);
      await page.getByRole('button', { name: 'Change Goat G-0142' }).click();
      const line = page.getByRole('dialog', { name: 'Change G-0142' });
      await line.getByRole('textbox', { name: /^Agreed price a head/ }).fill('789.99');
      await line.getByRole('combobox', { name: /^Why the price differs/ }).click();
      await page.getByRole('option', { name: 'Regular customer, agreed price' }).click();
      await line.getByRole('button', { name: 'Save the item' }).click();
      await expect(
        line.getByText('That discount is more than you may give on one item'),
      ).toBeVisible();
    },
  },
  { name: 'pay-offline', act: async (page, _api, offline) => payOffline(page, offline) },
  {
    name: 'pay-confirm',
    act: async (page, _api, offline) => {
      await payOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
    },
  },
  {
    name: 'sale-done-offline',
    act: async (page, _api, offline) => {
      await payOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
      await page.getByRole('button', { name: 'Complete the sale' }).click();
      await expect(page.getByText('Kept on this till as P-T1-312-0001')).toBeVisible();
    },
  },
  {
    name: 'sale-done-synced',
    act: async (page, _api, offline) => {
      await payOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
      await page.getByRole('button', { name: 'Complete the sale' }).click();
      await offline(false);
      await expect(page.getByText('Official receipt RCP-2026-DDW-T1-006201')).toBeVisible();
    },
  },
  {
    name: 'queue-offline',
    act: async (page, _api, offline) => {
      await payOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
      await page.getByRole('button', { name: 'Complete the sale' }).click();
      await page.getByRole('link', { name: 'See sales to send' }).click();
      await expect(page.getByText('1 record is waiting on this till.')).toBeVisible();
    },
  },
  {
    name: 'shift',
    act: async (page) => {
      await page.getByRole('link', { name: 'Shift', exact: true }).click();
      await expect(
        page.getByText('What the till expected is shown only after you declare.'),
      ).toBeVisible();
    },
  },
  {
    name: 'shift-counted',
    act: async (page) => {
      await page.getByRole('link', { name: 'Shift', exact: true }).click();
      await page.getByRole('textbox', { name: /^Cash counted/ }).fill('8225');
      await page.getByRole('textbox', { name: /^Mobile money counted/ }).fill('4120');
      await page.getByRole('button', { name: 'Declare the count' }).click();
      await page
        .getByRole('dialog', { name: 'Declare this count?' })
        .getByRole('button', { name: 'Declare the count' })
        .click();
      await expect(page.locator('[data-slot="over-short"]')).toBeVisible();
    },
  },
  {
    name: 'returns',
    act: async (page, api) => {
      api.rewrite('listReasonCodes', () => ({
        data: [
          {
            code: 'CHANGED_MIND',
            domain: 'RETURN',
            description: 'Customer changed their mind',
            requiresNote: false,
            lossAccountGroup: null,
          },
        ],
        page: { nextCursor: null, limit: 100, hasMore: false },
      }));
      await page.getByRole('link', { name: 'Returns' }).click();
      await page.getByRole('textbox', { name: /^Receipt number/ }).fill('RCP-2026-DDW-T1-018834');
      await page.getByRole('button', { name: 'Find the receipt' }).click();
      await page.getByRole('textbox', { name: /^Returning of Eggs/ }).fill('1');
    },
  },
];

for (const shot of TILL_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F09 ${shot.name} at ${width}`, async ({ page, context, api }) => {
      installTillServer(api, (sale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0));
      await page.emulateMedia({ colorScheme: shot.theme ?? 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await openTillShift(page);
      if (shot.theme === 'dark') {
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      }
      await shot.act(page, api, (off) => api.setNetwork(context, !off));
      await page.screenshot({
        path: `../docs/screenshots/F09/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

/**
 * F10, the till PIN and the receipt, against CR-032 and CR-033 as requested (ADR 0046). As F09: the device
 * is till T1 with the cashier's shift open first.
 */
const PRINTER_SCRIPT = () => {
  const server = {
    connected: true,
    getPrimaryService: async () => ({
      getCharacteristics: async () => [
        {
          properties: { write: true, writeWithoutResponse: false },
          writeValue: async () => undefined,
        },
      ],
    }),
  };
  Object.defineProperty(Navigator.prototype, 'bluetooth', {
    configurable: true,
    get: () => ({
      getAvailability: async () => true,
      requestDevice: async () => ({
        name: 'MTP-II',
        gatt: { connected: true, connect: async () => server },
      }),
    }),
  });
};

async function sellTomatoes(page: Page, phone: string | null) {
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('700');
  if (phone !== null) {
    await page.getByRole('textbox', { name: /^Customer's phone for the receipt/ }).fill(phone);
  }
  await page.getByRole('button', { name: 'Review the sale' }).click();
  await page.getByRole('button', { name: 'Complete the sale' }).click();
}

async function approveMomoOffline(page: Page, offline: (off: boolean) => Promise<void>) {
  await offline(true);
  await page.getByRole('button', { name: 'Tomatoes, crate' }).click();
  await page.getByRole('button', { name: 'Take payment' }).click();
  const momo = page.getByRole('group', { name: 'Mobile money without the network' });
  await momo.getByRole('textbox', { name: /^Amount/ }).fill('200');
  await momo
    .getByRole('textbox', { name: /^Customer's mobile money number/ })
    .fill('+233245550142');
  await momo.getByRole('textbox', { name: /^Transaction id/ }).fill('MP261113.1149.C41872');
  await momo.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
  await momo.getByRole('button', { name: 'Approve with this PIN' }).click();
  await expect(page.getByText(/not yet verified, approved by Kwabena Owusu/)).toBeVisible();
  await page.getByRole('textbox', { name: /^Cash handed over/ }).fill('500');
}

interface TenShot extends TillShot {
  printer?: boolean;
  offlineMobileMoney?: boolean;
}

const TEN_SHOTS: TenShot[] = [
  {
    name: 'till-locked',
    act: async (page) => {
      await page.getByRole('button', { name: 'Lock the till' }).click();
      await page.getByLabel(/^PIN/).fill('1111');
      await page.getByRole('button', { name: 'Open the till' }).click();
      await expect(page.getByText(/^Wrong PIN\. 2 more wrong tries/)).toBeVisible();
    },
  },
  {
    name: 'pay-unverified-momo',
    offlineMobileMoney: true,
    act: async (page, _api, offline) => approveMomoOffline(page, offline),
  },
  {
    name: 'sale-done-unverified-momo',
    offlineMobileMoney: true,
    act: async (page, _api, offline) => {
      await approveMomoOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
      await page.getByRole('button', { name: 'Complete the sale' }).click();
      await expect(page.locator('[data-slot="receipt-unverified"]')).toBeVisible();
    },
  },
  {
    name: 'cash-drop-witness',
    act: async (page, _api, offline) => {
      await page.getByRole('link', { name: 'Shift', exact: true }).click();
      // Offline the till cannot see who is signed in, so the supervisor witnesses with a PIN (2.5.0).
      await offline(true);
      await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
      await page.getByLabel(/^PIN/).fill(PEOPLE.manager.pin);
      await page.getByRole('button', { name: 'Approve with this PIN' }).click();
      await expect(page.locator('[data-slot="cash-witness"]')).toBeVisible();
    },
  },
  {
    name: 'sale-done-digital-receipt',
    act: async (page) => {
      await sellTomatoes(page, '+233244550199');
      await expect(page.getByText('Sent by SMS to +233244550199.')).toBeVisible();
      await expect(page.locator('[data-slot="printer-unsupported"]')).toBeVisible();
    },
  },
  {
    name: 'sale-done-printer',
    printer: true,
    act: async (page) => {
      await sellTomatoes(page, null);
      await page.getByRole('button', { name: 'Connect a receipt printer' }).click();
      await page.getByRole('button', { name: 'Print on MTP-II' }).click();
      await expect(page.getByText('Printed on MTP-II.')).toBeVisible();
    },
  },
  {
    name: 'queue-approval',
    offlineMobileMoney: true,
    act: async (page, _api, offline) => {
      await approveMomoOffline(page, offline);
      await page.getByRole('button', { name: 'Review the sale' }).click();
      await page.getByRole('button', { name: 'Complete the sale' }).click();
      await page.getByRole('link', { name: 'See sales to send' }).click();
      await expect(page.locator('[data-slot="queue-approvals"]')).toBeVisible();
    },
  },
];

for (const shot of TEN_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10 ${shot.name} at ${width}`, async ({ page, context, api }) => {
      if (shot.printer === true) await page.addInitScript(PRINTER_SCRIPT);
      else {
        // Chromium on Linux has no Web Bluetooth, as Safari on iOS has none: the words show.
        await page.addInitScript(() => {
          Object.defineProperty(Navigator.prototype, 'bluetooth', {
            configurable: true,
            get: () => undefined,
          });
        });
      }
      installTillServer(api, (sale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0), {
        offlineMobileMoney: shot.offlineMobileMoney === true,
      });
      installTillPins(api);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await openTillShift(page);
      await shot.act(page, api, (off) => api.setNetwork(context, !off));
      await page.screenshot({
        path: `../docs/screenshots/F10/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

/**
 * F10i, the till's shift on contract 2.5.0 (CR-045 as requested): a drop witnessed by a supervisor signed in
 * at the branch, a drop plainly unwitnessed when none is (dark and compact too), a refused drop, and the
 * shift signed off with its Z report. Each opens the cashier's shift first, as F09 does.
 */
interface ShiftShot {
  name: string;
  theme?: 'light' | 'dark';
  density?: 'compact';
  witnesses?: { id: string; displayName: string }[];
  refuseDrop?: boolean;
  act: (page: Page) => Promise<void>;
}

async function dropReady(page: Page, choose: boolean) {
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await page.getByRole('textbox', { name: /^Amount/ }).fill('500');
  if (choose) {
    await page.getByRole('combobox', { name: /^Supervisor who takes the cash/ }).click();
    await page.getByRole('option', { name: PEOPLE.manager.name }).click();
  }
}

async function recordDrop(page: Page) {
  await page.getByRole('button', { name: 'Record it' }).click();
  await page
    .getByRole('dialog', { name: 'Record this Cash drop?' })
    .getByRole('button', { name: 'Record it' })
    .click();
}

const SHIFT_SHOTS: ShiftShot[] = [
  { name: 'drop-witness-signed-in', act: async (page) => dropReady(page, true) },
  {
    name: 'drop-witnessed-recorded',
    act: async (page) => {
      await dropReady(page, true);
      await recordDrop(page);
      await expect(page.locator('[data-slot="cash-moved"]').first()).toContainText('Witnessed by');
    },
  },
  {
    name: 'drop-unwitnessed',
    witnesses: [],
    act: async (page) => {
      await dropReady(page, false);
      await recordDrop(page);
      await expect(page.getByText('Cash drop recorded, unwitnessed.')).toBeVisible();
    },
  },
  {
    name: 'drop-unwitnessed-dark-compact',
    witnesses: [],
    theme: 'dark',
    density: 'compact',
    act: async (page) => {
      await dropReady(page, false);
      await recordDrop(page);
      await expect(page.getByText('Cash drop recorded, unwitnessed.')).toBeVisible();
    },
  },
  {
    name: 'drop-refused',
    refuseDrop: true,
    act: async (page) => {
      await dropReady(page, true);
      await recordDrop(page);
      await expect(page.locator('[data-slot="cash-outcome"]')).toBeVisible();
    },
  },
  {
    name: 'shift-signed-off',
    act: async (page) => {
      await page.getByRole('link', { name: 'Shift', exact: true }).click();
      await page.getByRole('textbox', { name: /^Cash counted/ }).fill('8225');
      await page.getByRole('textbox', { name: /^Mobile money counted/ }).fill('4120');
      await page.getByRole('button', { name: 'Declare the count' }).click();
      await page
        .getByRole('dialog', { name: 'Declare this count?' })
        .getByRole('button', { name: 'Declare the count' })
        .click();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page
        .getByRole('dialog', { name: 'Sign out of the point of sale?' })
        .getByRole('button', { name: 'Sign out' })
        .click();
      await signInWithTotp(page, USERS.manager, '/pos/shift');
      await page.getByRole('textbox', { name: /^Sign-off note/ }).fill('Counted twice');
      await page.getByRole('button', { name: 'Sign the close off' }).click();
      await page
        .getByRole('dialog', { name: 'Sign this close off?' })
        .getByRole('button', { name: 'Sign the close off' })
        .click();
      await confirmStepUp(page);
      await expect(page.getByRole('heading', { name: 'Z report: the closed shift' })).toBeVisible();
      await expect(page.getByText(/^Made/)).toBeVisible();
    },
  },
];

for (const shot of SHIFT_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10i ${shot.name} at ${width}`, async ({ page, api }) => {
      installTillServer(api, (sale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0), {
        ...(shot.witnesses === undefined ? {} : { witnesses: shot.witnesses }),
      });
      if (shot.refuseDrop === true) {
        api.refuse('recordCashMovement', 422, 'CASH_MOVEMENT_INVALID', 'Not recorded.');
      }
      await page.emulateMedia({ colorScheme: shot.theme ?? 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await openTillShift(page);
      if (shot.theme === 'dark') {
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      }
      if (shot.density === 'compact') {
        await page.evaluate(() => document.documentElement.setAttribute('data-density', 'compact'));
      }
      await shot.act(page);
      await page.screenshot({
        path: `../docs/screenshots/F10i/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

/**
 * The egg session (F10f, ADR 0049): buying in crates, bulk buyer prices, and a crate or a single egg at
 * the till (CR-038, requested). The shops run on phones, so every one is shot at 360 px too.
 */
const ROYAL_PALM_LIST = '019a7aa4-e168-70ca-8603-157e47958e5c';
const EGG_DRAFT = '019a7aa3-e9f0-71af-86e7-23c27a0d9ca0';
const eggPrices = (api: FakeApi) => {
  seedEggs(api);
  api.rewrite('listPriceListEntries', (body) => {
    const answer = body as { data: components['schemas']['PriceListEntry'][] };
    const first = answer.data[0];
    return first === undefined ? answer : { ...answer, data: eggEntries(first) };
  });
};
const EGG_SHOTS: Shot[] = [
  { name: 'purchase-orders', path: '/purchase-orders', ready: 'PO-2026-DDW-000040' },
  {
    name: 'purchase-order-new',
    path: '/purchase-orders/new',
    ready: 'Save the draft',
    prepare: seedEggs,
    act: async (page) => {
      await page.getByRole('combobox', { name: /^Product 1/ }).fill('Eggs');
      await page.getByRole('option', { name: 'Eggs, big (EGG-0003)' }).click();
      await page.getByRole('combobox', { name: 'Counted in, line 1' }).click();
      await page.getByRole('option', { name: 'Crate (30 Unit)' }).click();
      await page.getByLabel(/^Ordered, in Crate, line 1/).fill('20');
    },
  },
  {
    name: 'purchase-order',
    path: `/purchase-orders/${ORDER_ID}`,
    ready: 'PO-2026-DDW-000052',
    prepare: (api) =>
      api.rewrite('getPurchaseOrder', (body) =>
        eggOrder(body as components['schemas']['PurchaseOrder'], 'DRAFT'),
      ),
  },
  {
    name: 'goods-receipt-from-order',
    path: `/goods-receipts/new?purchaseOrder=${ORDER_ID}`,
    ready: 'ordered in Crate',
    prepare: (api) => {
      seedEggs(api);
      api.rewrite('getPurchaseOrder', (body) =>
        eggOrder(body as components['schemas']['PurchaseOrder'], 'SENT'),
      );
    },
    act: async (page) => {
      await page.getByLabel(/^Accepted, in Crate, line 1/).fill('18');
      await page.getByLabel(/^Rejected at the door, in Crate, line 1/).fill('2');
      await page.getByRole('combobox', { name: /^Why it was rejected, line 1/ }).click();
      await page.getByRole('option', { name: 'Cracked on arrival' }).click();
      await page.getByLabel(/^Cost of the accepted quantity, GHS, line 1/).fill('855.00');
    },
  },
  {
    name: 'goods-receipt-rejected',
    path: `/goods-receipts/${ID}`,
    ready: 'turned away at the door',
    prepare: (api) =>
      api.rewrite('getGoodsReceipt', (body) =>
        eggReceipt(body as components['schemas']['GoodsReceipt']),
      ),
  },
  {
    name: 'goods-receipt-claim',
    path: `/goods-receipts/${ID}`,
    ready: 'account until their invoice',
    prepare: (api) =>
      api.rewrite('getGoodsReceipt', (body) => ({
        ...eggReceipt(body as components['schemas']['GoodsReceipt']),
        status: 'POSTED',
        receiptNo: 'GRN-2026-DDW-000081',
      })),
  },
  {
    name: 'price-list-egg-prices',
    path: `/price-list-versions/${EGG_DRAFT}`,
    ready: 'from 10 Crate',
    prepare: eggPrices,
  },
  {
    name: 'price-list-add-price',
    path: `/price-list-versions/${EGG_DRAFT}`,
    ready: 'from 10 Crate',
    prepare: eggPrices,
    act: async (page) => {
      await page.getByRole('button', { name: 'Add a price' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add a price to the draft' });
      await dialog.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
      await page.getByRole('option', { name: 'Eggs, big (EGG-0003)' }).click();
      await dialog.getByRole('combobox', { name: 'Sold by' }).click();
      await page.getByRole('option', { name: 'Crate' }).click();
      await dialog.getByLabel('From how many, in Crate').fill('50');
    },
  },
  {
    name: 'buyer-price-list',
    path: `/price-lists/${ROYAL_PALM_LIST}`,
    ready: 'Give these prices to a buyer',
    prepare: (api) =>
      api.rewrite('getPriceList', (body) => ({
        ...(body as object),
        id: ROYAL_PALM_LIST,
        code: 'CUST-ROYALPALM',
        name: 'Royal Palm Hotel contract prices',
        kind: 'CUSTOMER',
        channel: null,
        customerTier: null,
      })),
  },
  {
    name: 'price-lists-new-buyer-list',
    path: '/price-lists',
    ready: 'Royal Palm Hotel contract prices',
    act: async (page) => {
      await page.getByRole('button', { name: 'New price list for a buyer' }).click();
    },
  },
];

for (const shot of EGG_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10f ${shot.name} at ${width}`, async ({ page, api }) => {
      shot.prepare?.(api);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await signInWithTotp(page, USERS.owner, shot.path);
      await expect(page.getByText(shot.ready).first()).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0);
      await shot.act?.(page);
      await page.screenshot({
        path: `../docs/screenshots/F10f/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

const EGG_TILL_SHOTS: { name: string; act: (page: Page) => Promise<void> }[] = [
  {
    name: 'till-choose-unit',
    act: async (page) => {
      await page.getByRole('button', { name: 'Eggs, big', exact: true }).click();
      await expect(
        page.getByRole('dialog', { name: 'Sell Eggs, big by which unit?' }),
      ).toBeVisible();
    },
  },
  {
    name: 'till-crate-and-eggs',
    act: async (page) => {
      for (const unit of [/^By the crate/, /^By the unit/]) {
        await page.getByRole('button', { name: 'Eggs, big', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'Sell Eggs, big by which unit?' })
          .getByRole('button', { name: unit })
          .click();
      }
      await page.getByRole('button', { name: 'Change Eggs, big, by the unit' }).click();
      const line = page.getByRole('dialog', { name: 'Change Eggs, big' });
      await line.getByRole('textbox', { name: /^Quantity/ }).fill('6');
      await line.getByRole('button', { name: 'Save the item' }).click();
      await expect(line).toBeHidden();
    },
  },
];

for (const shot of EGG_TILL_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10f ${shot.name} at ${width}`, async ({ page, api }) => {
      installTillServer(api, (sale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0), {
        products: eggsByTheEgg,
      });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await openTillShift(page);
      await shot.act(page);
      await page.screenshot({
        path: `../docs/screenshots/F10f/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

/**
 * Supplier invoices and payment (F10g): the egg supplier's invoice and its three-way match, the payment and
 * its approval, the claim's settlement and the supplier's account with its balance (CR-042, requested).
 */
type SS = components['schemas'];
const firstRow = <T>(body: unknown): T => {
  const row = (body as { data: T[] }).data[0];
  if (row === undefined) throw new Error('The example page has no row.');
  return row;
};
const onePage = <T>(body: unknown, rows: T[]) => ({ ...(body as object), data: rows });
const PAYABLE_SHOTS: Shot[] = [
  {
    name: 'supplier-invoice-entry',
    path: '/supplier-invoices/new',
    ready: 'Save the invoice',
    prepare: (api) => {
      seedEggs(api);
      seedPayables(api);
    },
    act: async (page) => {
      await page.getByRole('combobox', { name: /^Supplier/ }).click();
      await page.getByRole('option', { name: /^Awutu Poultry Farm/ }).click();
      await page.getByRole('combobox', { name: /^Purchase order/ }).click();
      await page.getByRole('option', { name: 'PO-2026-DDW-000052' }).click();
      await page.getByRole('combobox', { name: /^Goods receipt/ }).click();
      await page.getByRole('option', { name: 'GRN-2026-DDW-000081' }).click();
      await page.getByLabel(/^Supplier's invoice number/).fill('AWT-0471');
      await page.getByLabel(/^Invoiced, in Crate, line 1/).fill('21');
      await page.getByLabel(/^Price per Crate, GHS, line 1/).fill('48.00');
    },
  },
  {
    name: 'supplier-invoice-mismatch',
    path: `/supplier-invoices/${INVOICE_ID}`,
    ready: '1 line disagrees with the order or what was received',
    prepare: (api) =>
      api.rewrite('getSupplierInvoice', (body) =>
        wrongInvoice(body as SS['SupplierInvoice'], 'checked'),
      ),
  },
  {
    name: 'supplier-invoice-matched',
    path: `/supplier-invoices/${INVOICE_ID}`,
    ready: 'Every line matches the order and what was received',
    prepare: (api) =>
      api.rewrite('getSupplierInvoice', (body) =>
        rightInvoice(body as SS['SupplierInvoice'], 'MATCHED'),
      ),
  },
  {
    name: 'supplier-invoices',
    path: '/supplier-invoices',
    ready: 'Invoice AWT-0471',
    prepare: (api) =>
      api.rewrite('listSupplierInvoices', (body) =>
        onePage(body, [
          wrongInvoice(firstRow<SS['SupplierInvoice']>(body), 'checked'),
          rightInvoice(
            {
              ...firstRow<SS['SupplierInvoice']>(body),
              id: '019a7f21-9e0f-7a1b-8c2d-3e4f5a6b7c88',
            },
            'APPROVED',
          ),
        ]),
      ),
  },
  {
    name: 'supplier-payment-new',
    path: `/supplier-payments/new?supplier=${SUPPLIER.id}&invoice=${INVOICE_ID}`,
    ready: 'Pay invoice AWT-0471',
    prepare: (api) =>
      api.rewrite('listSupplierInvoices', (body) =>
        onePage(body, [rightInvoice(firstRow<SS['SupplierInvoice']>(body), 'APPROVED')]),
      ),
  },
  {
    name: 'supplier-payment-waiting',
    path: `/supplier-payments/${PAYMENT_ID}`,
    ready: 'This payment waits for approval',
    prepare: (api) =>
      api.rewrite('getSupplierPayment', (body) =>
        eggPayment(body as SS['SupplierPayment'], 'PENDING_APPROVAL'),
      ),
  },
  {
    name: 'supplier-payment-approval',
    path: `/approvals/${APPROVAL_ID}`,
    ready: 'Payment of 85500 pesewas to Awutu Poultry Farm',
    prepare: (api) =>
      api.rewrite('getApproval', (body) =>
        paymentApproval(body as Record<string, unknown>, MANAGER),
      ),
  },
  {
    name: 'supplier-claim',
    path: `/supplier-claims/${CLAIM_ID}`,
    ready: 'Settle the claim',
    prepare: (api) =>
      api.rewrite('getSupplierClaim', (body) => eggClaim(body as SS['SupplierClaim'])),
  },
  {
    name: 'supplier-account',
    path: `/suppliers/${SUPPLIER.id}`,
    ready: 'Owed on approved invoices',
    prepare: (api) => {
      seedPayables(api);
      api.rewrite('getSupplier', (body) => ({ ...(body as object), ...SUPPLIER }));
      api.rewrite('listSupplierInvoices', (body) =>
        onePage(body, [rightInvoice(firstRow<SS['SupplierInvoice']>(body), 'APPROVED')]),
      );
      api.rewrite('listSupplierClaims', (body) =>
        onePage(body, [eggClaim(firstRow<SS['SupplierClaim']>(body))]),
      );
      api.rewrite('listSupplierPayments', (body) =>
        onePage(body, [eggPayment(firstRow<SS['SupplierPayment']>(body), 'PENDING_APPROVAL')]),
      );
    },
  },
];

for (const shot of PAYABLE_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10g ${shot.name} at ${width}`, async ({ page, api }) => {
      shot.prepare?.(api);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await signInWithTotp(page, USERS.owner, shot.path);
      await expect(page.getByText(shot.ready).first()).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0);
      await shot.act?.(page);
      await page.screenshot({
        path: `../docs/screenshots/F10g/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}

/**
 * Quotes, wholesale and credit control (F10j): the egg quote built and priced by the API, its versions,
 * the order made from it with the server's credit refusal and the override, the buyer's account and the
 * ageing. The credit check is CR-047's requested shape.
 */
const pageWith = <T>(body: unknown, rows: T[]) => ({ ...(body as object), data: rows });
const WHOLESALE_SHOTS: Shot[] = [
  {
    name: 'quotes',
    path: '/quotes',
    ready: QUOTE_NO,
    prepare: (api) =>
      api.rewrite('listQuotes', (body) =>
        pageWith(body, [
          eggQuote(firstRow<SS['Quote']>(body), 'ISSUED', version2('ISSUED'), 2),
          ...(body as { data: SS['Quote'][] }).data.slice(1),
        ]),
      ),
  },
  {
    name: 'quote-new-priced',
    path: '/quotes/new',
    ready: 'Save the draft',
    prepare: (api) => {
      seedEggs(api);
      api.rewrite('listCustomers', (body) =>
        pageWith(body, [chopBar(firstRow<SS['Customer']>(body))]),
      );
      api.respond('resolvePrices', (request) => quotePrices(request as SS['PriceResolveRequest']));
    },
    act: async (page) => {
      await page.getByRole('combobox', { name: /^Customer/ }).fill('Asantewaa');
      await page.getByRole('option', { name: /^Asantewaa Chop Bar/ }).click();
      await page.getByLabel(/^Valid until/).fill('2026-11-24');
      const line1 = page.getByRole('heading', { name: 'Line 1' }).locator('..').locator('..');
      await line1.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
      await page.getByRole('option', { name: /^Eggs, big/ }).click();
      await line1.getByRole('combobox', { name: /^Sold by/ }).click();
      await page.getByRole('option', { name: /^Crate/ }).click();
      await line1.getByLabel(/^How many, in crate/).fill('10');
      await page.getByRole('button', { name: 'Add a line' }).click();
      const line2 = page.getByRole('heading', { name: 'Line 2' }).locator('..').locator('..');
      await line2.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
      await page.getByRole('option', { name: /^Eggs, big/ }).click();
      await line2.getByLabel(/^How many, in unit/).fill('30');
      await page.getByRole('button', { name: "Get the API's prices" }).click();
      await expect(line2.getByTestId('api-price')).toContainText('2.20');
    },
  },
  {
    name: 'quote-versions',
    path: `/quotes/${QUOTE_ID}`,
    ready: 'Version 2, in force',
    prepare: (api) => {
      api.rewrite('getQuote', (body) =>
        eggQuote(body as SS['Quote'], 'ISSUED', version2('ISSUED'), 2),
      );
      api.rewrite('listQuoteVersions', (body) =>
        pageWith(body, [version2('ISSUED'), version1('SUPERSEDED')]),
      );
    },
  },
  {
    name: 'quote-older-version',
    path: `/quotes/${QUOTE_ID}?version=${VERSION_1}`,
    ready: 'An earlier version, as it was',
    prepare: (api) => {
      api.rewrite('getQuote', (body) =>
        eggQuote(body as SS['Quote'], 'ISSUED', version2('ISSUED'), 2),
      );
      api.rewrite('listQuoteVersions', (body) =>
        pageWith(body, [version2('ISSUED'), version1('SUPERSEDED')]),
      );
    },
  },
  {
    name: 'quote-accepted',
    path: `/quotes/${QUOTE_ID}`,
    ready: 'Make it an order',
    prepare: (api) => {
      api.rewrite('getQuote', (body) =>
        eggQuote(body as SS['Quote'], 'ACCEPTED', version2('ACCEPTED'), 2),
      );
      api.rewrite('listQuoteVersions', (body) =>
        pageWith(body, [version2('ACCEPTED'), version1('SUPERSEDED')]),
      );
    },
  },
  {
    name: 'order-credit-refused',
    path: `/orders/${QUOTE_ORDER_ID}`,
    ready: 'Over the limit by',
    prepare: (api) => {
      api.rewrite('getOrder', (body) => quoteOrder(body as SS['SalesOrder'], 'PLACED'));
      api.respondRequested(GET_ORDER_CREDIT_CHECK, () => overLimit());
      api.refuse('confirmOrder', 422, 'CREDIT_LIMIT_EXCEEDED', 'Over the credit limit.');
    },
    act: async (page) => {
      await page.getByRole('button', { name: 'Confirm the order' }).click();
      await page
        .getByRole('dialog', { name: /^Confirm order/ })
        .getByRole('button', { name: 'Confirm the order' })
        .click();
      await expect(page.getByText('The server refused to confirm this order')).toBeVisible();
    },
  },
  {
    name: 'order-override-approved',
    path: `/orders/${QUOTE_ORDER_ID}`,
    ready: 'Override approved by Kwabena Owusu',
    prepare: (api) => {
      api.rewrite('getOrder', (body) => quoteOrder(body as SS['SalesOrder'], 'PLACED'));
      api.respondRequested(GET_ORDER_CREDIT_CHECK, () => overLimit(overrideState('APPROVED')));
    },
  },
  {
    name: 'override-approval',
    path: `/approvals/${OVERRIDE_APPROVAL_ID}`,
    ready: 'Credit override for Asantewaa Chop Bar',
    prepare: (api) =>
      api.rewrite('getApproval', (body) => overrideApproval(body as Record<string, unknown>)),
  },
  {
    name: 'business-accounts',
    path: '/business-accounts',
    ready: 'Asantewaa Chop Bar',
    prepare: (api) =>
      api.rewrite('listBusinessAccounts', (body) =>
        pageWith(body, [
          chopBarAccount(firstRow<SS['BusinessAccount']>(body)),
          ...(body as { data: SS['BusinessAccount'][] }).data.slice(1),
        ]),
      ),
  },
  {
    name: 'business-account',
    path: `/business-accounts/${CUSTOMER.id}`,
    ready: 'How late',
    prepare: (api) => {
      api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as SS['BusinessAccount']));
      api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as SS['AgeingReport']));
    },
  },
  { name: 'ageing', path: '/ageing', ready: 'Royal Palm Hotel Ltd' },
  { name: 'rfqs', path: '/rfqs', ready: 'RFQ-2026-DDW-000154' },
  { name: 'rfq', path: `/rfqs/${ID}`, ready: 'What they asked for' },
];

for (const shot of WHOLESALE_SHOTS) {
  for (const width of WIDTHS) {
    test(`@screenshots F10j ${shot.name} at ${width}`, async ({ page, api }) => {
      shot.prepare?.(api);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await signInWithTotp(page, USERS.owner, shot.path);
      await expect(page.getByText(shot.ready).first()).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0);
      await shot.act?.(page);
      await page.screenshot({
        path: `../docs/screenshots/F10j/${shot.name}-${width}.png`,
        fullPage: true,
        scale: 'css',
      });
    });
  }
}
