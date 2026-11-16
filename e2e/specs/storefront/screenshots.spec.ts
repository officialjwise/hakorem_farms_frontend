import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import { fillDetails, refusePhotos, withCart } from '../../support/shop';

/**
 * Screenshots of every storefront page F7 built, for the owner, who judges the shop on the phone view
 * first (owner, 2026-11-16). The production build on the Prism mock. The mock's photographs are on the real
 * media origin and are refused, so cards show their tiles. 360 px at 2x, as a phone shows it; 1280 px at
 * 1x. Light theme, and the phone views again in dark. Tagged `@screenshots`: `pnpm screenshots` runs it and
 * writes `docs/screenshots/F07/<page>-<width>[-dark].png`.
 */
interface Shot {
  name: string;
  path: string;
  ready: string;
  cart?: boolean;
  act?: (page: Page) => Promise<void>;
}

const HOLD = 'Hold my items and show the total';

const SHOTS: Shot[] = [
  { name: 'home', path: '/', ready: 'In the shop now' },
  { name: 'category', path: '/c/meat', ready: 'Filter and sort' },
  { name: 'search', path: '/search?q=goat', ready: 'Results for' },
  { name: 'product-weighed', path: '/p/goat-meat-15-kg-pack', ready: 'Priced by weight' },
  {
    name: 'basket',
    path: '/',
    ready: 'In the shop now',
    cart: true,
    act: async (page) => {
      await page.getByRole('button', { name: /^Basket \d+ items?$/ }).click();
      await expect(page.getByRole('dialog', { name: 'Your basket' })).toContainText(
        'Estimated subtotal',
      );
    },
  },
  { name: 'checkout-basket', path: '/checkout', ready: '1. Your basket', cart: true },
  {
    name: 'checkout-details',
    path: '/checkout',
    ready: '1. Your basket',
    cart: true,
    act: fillDetails,
  },
  {
    name: 'checkout-review',
    path: '/checkout',
    ready: '1. Your basket',
    cart: true,
    act: async (page) => {
      await fillDetails(page);
      await page.getByRole('button', { name: HOLD }).click();
      await expect(page.getByRole('region', { name: 'Your total is an estimate' })).toBeVisible();
    },
  },
  {
    name: 'order-placed',
    path: '/checkout',
    ready: '1. Your basket',
    cart: true,
    act: async (page) => {
      await fillDetails(page);
      await page.getByRole('button', { name: HOLD }).click();
      await page.getByRole('button', { name: 'Pay GH₵450.00' }).click();
      await expect(page.getByRole('heading', { name: /is placed/ })).toBeVisible();
    },
  },
  { name: 'checkout-empty', path: '/checkout', ready: 'Nothing to check out' },
  { name: 'not-found', path: '/c/unicorns', ready: 'Page not found' },
];

const VIEWS = [
  { width: 360, height: 800, scale: 2, theme: 'light' },
  { width: 1280, height: 900, scale: 1, theme: 'light' },
  { width: 360, height: 800, scale: 2, theme: 'dark' },
] as const;

for (const shot of SHOTS) {
  for (const view of VIEWS) {
    const file = `${shot.name}-${view.width}${view.theme === 'dark' ? '-dark' : ''}`;
    test(`@screenshots F07 ${file}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.scale,
        colorScheme: view.theme,
        baseURL: 'http://localhost:3100',
      });
      await refusePhotos(context);
      const page = await context.newPage();
      if (shot.cart === true) await withCart(page);
      await page.goto(shot.path);
      await expect(page.getByText(shot.ready).first()).toBeVisible();
      await shot.act?.(page);
      await page.screenshot({ path: `../docs/screenshots/F07/${file}.png`, fullPage: true });
      await context.close();
    });
  }
}
