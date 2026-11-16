import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import type { FakeApi } from '../../support/fakeApi';
import { signInWithTotp, USERS } from '../../support/helpers';

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
    { name: 'products', path: '/products', ready: 'LIV-GOAT' },
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
  { name: 'labels', path: '/labels', ready: 'LIV-GOAT' },
  {
    name: 'labels-sheet',
    path: '/labels',
    ready: 'LIV-GOAT',
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
  { name: 'products', path: '/products', ready: 'LIV-GOAT' },
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
  { name: 'products', path: '/products', ready: 'LIV-GOAT' },
  {
    name: 'products-columns-menu',
    path: '/products',
    ready: 'LIV-GOAT',
    act: async (page) => {
      await page.getByRole('button', { name: /^Columns/ }).click();
      await page.getByRole('dialog', { name: 'Columns' }).waitFor();
    },
  },
  {
    name: 'products-page-2',
    path: '/products',
    ready: 'LIV-GOAT',
    act: async (page) => {
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('combobox', { name: 'Go to page' }).waitFor();
    },
  },
  {
    name: 'products-sort-menu',
    path: '/products',
    ready: 'LIV-GOAT',
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
  { name: 'labels', path: '/labels', ready: 'LIV-GOAT' },
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
