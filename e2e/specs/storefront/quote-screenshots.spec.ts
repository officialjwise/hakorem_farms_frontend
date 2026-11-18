import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import { refusePhotos } from '../../support/shop';
import { TOKENS, UNKNOWN_TOKEN } from '../../support/shopApi';

/**
 * F10i's storefront screens for the owner: asking for a quote, and a quote by its link in each state. 360 px
 * at 2x, as a phone shows it, and 1280 px at 1x. Tagged `@screenshots`: `pnpm screenshots` writes
 * `docs/screenshots/F10i/<screen>-<width>.png`. The browser's writes are answered here as the API would.
 */
interface Shot {
  name: string;
  path: string;
  ready: string;
  act?: (page: Page) => Promise<void>;
}

const CORS = {
  'access-control-allow-origin': 'http://localhost:3100',
  'access-control-allow-credentials': 'true',
};

async function fillRequest(page: Page) {
  await page.getByRole('textbox', { name: /Your name/ }).fill('Akosua Bakery');
  await page.getByRole('textbox', { name: /Phone number/ }).fill('024 451 2876');
  await page.getByRole('textbox', { name: /What you want/ }).fill('Big eggs every Friday morning');
  await page.getByRole('textbox', { name: /How many crates/ }).fill('40');
  await page.getByRole('checkbox', { name: /You may call/ }).check();
}

const SHOTS: Shot[] = [
  { name: 'quote-request', path: '/quote', ready: 'Ask for a quote' },
  {
    name: 'quote-request-sent',
    path: '/quote',
    ready: 'Ask for a quote',
    act: async (page) => {
      await page.route('**/shop/quote-requests', (route) =>
        route.request().method() === 'OPTIONS'
          ? route.continue()
          : route.fulfill({
              status: 202,
              contentType: 'application/json',
              headers: CORS,
              body: JSON.stringify({
                rfqNo: 'RFQ-2026-DDW-000161',
                message:
                  'Thank you. Kojo from our sales team will call you within one working day.',
              }),
            }),
      );
      await fillRequest(page);
      await page.getByRole('button', { name: 'Send my request' }).click();
      await expect(page.getByText('is with us')).toBeVisible();
    },
  },
  { name: 'quote-link', path: `/q/${TOKENS.issued}`, ready: 'Waiting for your answer' },
  {
    name: 'quote-link-confirm',
    path: `/q/${TOKENS.issued}`,
    ready: 'Waiting for your answer',
    act: async (page) => {
      await page.getByRole('textbox', { name: /Your full name/ }).fill('Akosua Mensah');
      await page.getByRole('button', { name: 'Accept this quote' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'quote-link-accepted',
    path: `/q/${TOKENS.issued}`,
    ready: 'Waiting for your answer',
    act: async (page) => {
      await page.route('**/shop/quotes/*/accept', (route) =>
        route.request().method() === 'OPTIONS'
          ? route.continue()
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              headers: CORS,
              body: JSON.stringify({
                quoteNo: 'QUO-2026-DDW-000091',
                versionNo: 2,
                status: 'ACCEPTED',
                message: 'Thank you. We will call you to arrange the deposit and delivery.',
              }),
            }),
      );
      await page.getByRole('textbox', { name: /Your full name/ }).fill('Akosua Mensah');
      await page.getByRole('button', { name: 'Accept this quote' }).click();
      await page.getByRole('button', { name: 'Yes, accept the quote' }).click();
      await expect(page.getByRole('heading', { name: 'You accepted this quote' })).toBeVisible();
    },
  },
  { name: 'quote-link-expired', path: `/q/${TOKENS.expired}`, ready: 'This quote has expired' },
  {
    name: 'quote-link-replaced',
    path: `/q/${TOKENS.superseded}`,
    ready: 'This quote was replaced by a newer version',
  },
  { name: 'quote-link-not-valid', path: `/q/${UNKNOWN_TOKEN}`, ready: 'This link is not valid' },
];

const VIEWS = [
  { width: 360, height: 800, scale: 2 },
  { width: 1280, height: 900, scale: 1 },
] as const;

for (const shot of SHOTS) {
  for (const view of VIEWS) {
    const file = `${shot.name}-${view.width}`;
    test(`@screenshots F10i ${file}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.scale,
        colorScheme: 'light',
        baseURL: 'http://localhost:3100',
      });
      await refusePhotos(context);
      const page = await context.newPage();
      await page.goto(shot.path);
      await expect(page.getByText(shot.ready).first()).toBeVisible();
      await shot.act?.(page);
      await page.screenshot({ path: `../docs/screenshots/F10i/${file}.png`, fullPage: true });
      await context.close();
    });
  }
}
