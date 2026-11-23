import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { refusePhotos, throttle3G } from '../../support/shop';
import { RECEIPT_TOKENS, RECORDED_RECEIPT, UNKNOWN_RECEIPT_TOKEN } from '../../support/shopApi';

/**
 * CR-033: the digital receipt a customer opens from the link the till printed or showed. The page reads
 * the receipt on the storefront's server from the shop API's fixtures, one per token (ADR 0054). Every
 * figure on it is the server's; the spec checks each one appears, formatted.
 */

const NOT_FOUND_TITLE = 'We cannot find this receipt';

test.beforeEach(async ({ context }) => {
  await refusePhotos(context);
});

/** The one answer for every link that reads nothing, with nothing of any sale on it. */
async function expectNotFound(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOT_FOUND_TITLE);
  await expect(page.getByText(/The link may be mistyped/)).toBeVisible();
  await expect(
    page.getByText(/the sale may not have reached the farm yet\. The link works once the till/),
  ).toBeVisible();
  // How to reach the shop: its number from the shop profile (Prism's example).
  await expect(
    page
      .getByRole('list', { name: 'Ask the shop' })
      .getByRole('link', { name: 'Call 020 000 0120' }),
  ).toHaveAttribute('href', 'tel:+233200000120');
  await expect(page.getByText(/RCP-|SO-2026|GH₵/)).toHaveCount(0);
  await expect(page.getByText('The receipt could not be loaded')).toHaveCount(0);
}

test.describe('a receipt from its link', () => {
  test('the gate: a customer reads a recorded receipt on a phone over 3G, every figure the API’s', async ({
    page,
  }) => {
    await throttle3G(page);
    const sentTo: string[] = [];
    page.on('request', (request) => sentTo.push(request.url()));
    await page.goto(`/r/${RECEIPT_TOKENS.recorded}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your receipt');

    // The business, from the receipt.
    const business = page.locator('address');
    await expect(business).toContainText('HaKorem Farms');
    await expect(business).toContainText('Akuse Road, Dodowa');
    await expect(business.getByRole('link', { name: 'Call 030 212 3456' })).toHaveAttribute(
      'href',
      'tel:+233302123456',
    );

    // The official number beside the sale reference, and when it was sold, in Accra time.
    const numbers = page.locator('dl').filter({ hasText: 'Receipt no.' });
    await expect(numbers).toContainText('RCP-2026-DDW-T1-006214');
    await expect(numbers).toContainText('SO-2026-DDW-004311');
    await expect(numbers.locator('time')).toHaveText('2026-11-21 10:05 (Accra time)');
    await expect(numbers.locator('time')).toHaveAttribute('datetime', RECORDED_RECEIPT.occurredAt);

    // Each line: quantity in its unit, weight where there is one, unit price and amount.
    const lines = page.getByRole('region', { name: 'What you bought' }).getByRole('listitem');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toContainText('Eggs, big, by the crate of 30');
    await expect(lines.nth(0)).toContainText('2 crates');
    await expect(lines.nth(0)).toContainText('GH₵55.00');
    await expect(lines.nth(0)).toContainText('GH₵110.00');
    await expect(lines.nth(0)).not.toContainText('Weight');
    await expect(lines.nth(1)).toContainText('Goat meat, 15 kg pack');
    await expect(lines.nth(1)).toContainText('Tag or lot LOT-2026-DDW-0193');
    await expect(lines.nth(1)).toContainText('1 pack');
    await expect(lines.nth(1)).toContainText('14.850 kg');
    await expect(lines.nth(1)).toContainText('GH₵26.00');
    await expect(lines.nth(1)).toContainText('GH₵386.10');
    await expect(lines.nth(2)).toContainText('Goat, West African Dwarf');
    await expect(lines.nth(2)).toContainText('Tag or lot GH-DDW-0042');
    await expect(lines.nth(2)).toContainText('1 head');
    await expect(lines.nth(2)).toContainText('GH₵1,200.00');

    // The total, the tenders as the till took them, and the change: the API's, none added here.
    const payment = page.getByRole('region', { name: 'Total and payment' });
    await expect(payment.locator('dl')).toHaveText(
      [
        'Total',
        'GH₵1,696.10',
        'MTN Mobile Money',
        'GH₵1,000.00',
        'Mobile money taken while the till was offline. The farm has still to confirm it.',
        'Cash',
        'GH₵696.10',
        'Handed over',
        'GH₵700.00',
        'Change',
        'GH₵3.90',
      ].join(''),
    );
    await expect(payment).toContainText('This link works until 2027-11-21 10:05 (Accra time).');

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // The token goes nowhere but the page's own address: no analytics, no other request carries it.
    const carrying = sentTo.filter((url) => url.includes(RECEIPT_TOKENS.recorded));
    expect(carrying.every((url) => new URL(url).pathname === `/r/${RECEIPT_TOKENS.recorded}`)).toBe(
      true,
    );
    expect(sentTo.every((url) => new URL(url).host === 'localhost:3100')).toBe(true);
  });

  test('the page is private: never indexed, no referrer, never kept by a shared cache', async ({
    page,
    request,
  }) => {
    const response = await request.get(`/r/${RECEIPT_TOKENS.recorded}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
    const cache = response.headers()['cache-control'] ?? '';
    expect(cache).toContain('no-store');
    expect(cache).toContain('private');
    expect(cache).not.toContain('public');
    await page.goto(`/r/${RECEIPT_TOKENS.recorded}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect((await request.get('/robots.txt').then((r) => r.text())).includes('Disallow: /r/')).toBe(
      true,
    );
  });

  test('with no business profile set, nothing stands in its place', async ({ page }) => {
    await page.goto(`/r/${RECEIPT_TOKENS.noBusiness}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your receipt');
    await expect(page.locator('address')).toHaveCount(0);
    await expect(page.getByText('RCP-2026-DDW-T1-006214')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Total and payment' })).toContainText(
      'GH₵1,696.10',
    );
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a link the server does not know, or a sale’s own numbers, get the one 404 in words', async ({
    page,
  }) => {
    for (const token of [
      UNKNOWN_RECEIPT_TOKEN,
      // The sale's id and its receipt number have the token's shape: asked, and answered 404 alike.
      '019a7aa9-1c15-7ae4-b01c-b713eac82ff1',
      RECORDED_RECEIPT.receiptNo,
    ]) {
      await page.goto(`/r/${token}`);
      await expectNotFound(page);
      await expect(page.getByText(token)).toHaveCount(0);
    }
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a link without the till’s shape gets the same 404, and no request is made for it', async ({
    page,
  }) => {
    // The shop API answers any such token 500, so a page that asked would show its error state instead.
    for (const token of [
      'too-short',
      'a'.repeat(87),
      `${RECEIPT_TOKENS.recorded}==`,
      'Rc7vN2kXc9TfL4mWb8Ry.1',
      'Rc7vN2kXc9TfL4mWb8Ry%2B1',
    ]) {
      await page.goto(`/r/${token}`);
      await expectNotFound(page);
    }
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a server failure says so in words, with its reference and a retry to the same address', async ({
    page,
  }) => {
    await page.goto(`/r/${RECEIPT_TOKENS.failing}`);
    const failed = page.getByRole('alert').filter({ hasText: 'The receipt could not be loaded' });
    await expect(failed).toContainText('The receipt could not be loaded');
    await expect(failed).toContainText('Check your connection and try again');
    await expect(failed).toContainText('000f 500a');
    await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      `/r/${RECEIPT_TOKENS.failing}`,
    );
    await expect(page.getByText(NOT_FOUND_TITLE)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('no answer at all says so in words, with a retry and no reference to quote', async ({
    page,
  }) => {
    await page.goto(`/r/${RECEIPT_TOKENS.dropped}`);
    const failed = page.getByRole('alert').filter({ hasText: 'The receipt could not be loaded' });
    await expect(failed).toContainText('The receipt could not be loaded');
    await expect(failed).not.toContainText('quote this reference');
    await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      `/r/${RECEIPT_TOKENS.dropped}`,
    );
    await expectNoAxeViolations(page);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`the receipt, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const [state, token] of [
      ['recorded', RECEIPT_TOKENS.recorded],
      ['not found', UNKNOWN_RECEIPT_TOKEN],
      ['failed', RECEIPT_TOKENS.failing],
    ] as const) {
      test(`${state}: axe, and no sideways scroll at 360 px`, async ({ page }) => {
        await page.goto(`/r/${token}`);
        await page.getByRole('main').waitFor();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}
