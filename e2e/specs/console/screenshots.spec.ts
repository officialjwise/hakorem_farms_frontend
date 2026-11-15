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
