import type { BrowserContext, Page, Route } from '@playwright/test';
import { expect, test } from '../../support/test';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { fillDetails, refusePhotos, throttle3G, withCart } from '../../support/shop';

/**
 * Paying by card at the shop's checkout (contract 2.30.0, `placeOrder`). The order is placed and the API
 * answers the card provider's hosted page in `payment.redirectUrl`, always on
 * `https://checkout.paystack.com/`; the shop sends the browser there and nowhere else. A page that cannot
 * be opened is a 503 `PAYMENT_PROVIDER_UNAVAILABLE` with the order placed, and a replay with the same
 * idempotency key opens it.
 *
 * The placement goes from the browser to the shop API (ADR 0054), so it is routed here: the 201 is Prism's
 * own example, fetched through the shop API, with its payment as a card's. The provider's page is answered
 * here too, so nothing reaches the internet. On the 3G profile the checkout specs use, at 360 px.
 */

const PLACE = '**/shop/checkouts/*/place';
const CARD_PAGE = 'https://checkout.paystack.com/0peioxfhpn2f4h1';
const WRONG_PAGE = 'https://checkout.paystack.com.evil.example/0peioxfhpn2f4h1';
const ORIGIN = 'http://localhost:3100';

type Placement = { key: string | undefined; body: unknown };

/** No request leaves the machine: anything not local is refused, unless a test answers it itself. */
async function stayLocal(context: BrowserContext): Promise<void> {
  await context.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());
}

/**
 * Answers `placeOrder` and records each attempt's idempotency key and body. While `unavailable()` is true
 * the answer is the 503 with the order placed; after it, Prism's 201 with a card payment on `redirectUrl`.
 */
async function answerPlacement(
  page: Page,
  redirectUrl: string,
  unavailable: () => boolean = () => false,
): Promise<Placement[]> {
  const sent: Placement[] = [];
  await page.route(PLACE, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.continue();
    sent.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
    if (unavailable()) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': ORIGIN,
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify({
          error: {
            code: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'The card page could not be opened. Try again with the same key.',
            correlationId: '019a7b42-6d3e-7f40-9b5c-0d1e2f3a4b5c',
            details: [],
          },
        }),
      });
      return;
    }
    const response = await route.fetch();
    const placed = (await response.json()) as { payment: Record<string, unknown> };
    placed.payment = { ...placed.payment, redirectUrl, instructions: null };
    await route.fulfill({ response, json: placed });
  });
  return sent;
}

/**
 * Answers the card provider's page, recording each address the browser asked for. The first visit is
 * cancelled (ERR_ABORTED, which shows no error page), so the browser sets off and then stays on the shop's
 * page: what that page said
 * as the customer left can be read, checked with axe, and its own link to the page followed. Every later
 * visit is the provider's page.
 */
async function answerCardPage(page: Page): Promise<{ asked: () => string[] }> {
  const asked: string[] = [];
  await page.route('https://checkout.paystack.com/**', async (route) => {
    asked.push(route.request().url());
    if (asked.length === 1) {
      await route.abort('aborted');
      return;
    }
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="en"><title>Card page</title><h1>The card provider’s page</h1></html>',
    });
  });
  return { asked: () => [...asked] };
}

/** From an empty checkout to the review, with card chosen in words and the total the API's. */
async function reviewByCard(page: Page): Promise<void> {
  await withCart(page);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible({
    timeout: 30_000,
  });
  await fillDetails(page);
  const card = page.getByRole('radio', { name: 'Card', exact: true });
  await card.check();
  await expect(card).toBeChecked();
  await expect(card).toHaveAccessibleDescription(
    "You pay on our card provider's page, Paystack. You type your card there, never on this site.",
  );
  await page.getByRole('button', { name: 'Hold my items and show the total' }).click();
  await expect(page.getByRole('heading', { name: 'Pay by card' })).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ context }) => {
  await refusePhotos(context);
  await stayLocal(context);
});

test.describe('paying by card', () => {
  test('card chosen by its label, the order placed, said in words, then the card provider’s page', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await throttle3G(page);
    const sent = await answerPlacement(page, CARD_PAGE);
    const cardPage = await answerCardPage(page);
    await reviewByCard(page);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Pay GH₵450.00 by card' }).click();
    // The browser set off for the provider's page on its own; what the shop's page said as it left.
    await expect.poll(cardPage.asked, { timeout: 30_000 }).toEqual([CARD_PAGE]);
    await expect(
      page.getByRole('heading', { name: /Your order SO-2026-DDW-004216 is placed/ }),
    ).toBeVisible();
    const leaving = page.getByRole('status').filter({ hasText: 'Taking you to the card page' });
    await expect(leaving).toContainText(
      "You are going to our card provider's page, Paystack, to pay GH₵450.00",
    );
    await expect(page.getByText(/Keep this reference .*SO-2026-DDW-004216/)).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    // Its own link, for a browser that did not go: the same page, and only that one.
    const link = leaving.getByRole('link', {
      name: 'If the card page does not open, continue to it here',
    });
    await expect(link).toHaveAttribute('href', CARD_PAGE);
    await link.click();
    await page.waitForURL(CARD_PAGE, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'The card provider’s page' })).toBeVisible();
    // Only the method: no card number, expiry or code ever goes to the API.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({ paymentMethod: 'CARD' });
  });

  test('the card page did not open: the order is placed, said in words; a replay with the same key opens it', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await throttle3G(page);
    let opens = false;
    const sent = await answerPlacement(page, CARD_PAGE, () => !opens);
    const cardPage = await answerCardPage(page);
    await reviewByCard(page);

    await page.getByRole('button', { name: 'Pay GH₵450.00 by card' }).click();
    // The data layer tries a 503 again twice with the same key before it says so.
    const notOpened = page
      .getByRole('alert')
      .filter({ hasText: 'Your order is placed, but the card page did not open' });
    await expect(notOpened).toBeVisible({ timeout: 60_000 });
    await expect(notOpened).toContainText('You have not paid yet.');
    // The refusal's reference, as the shop shows one: its last eight characters.
    await expect(notOpened).toContainText('quote this reference: 2f3a 4b5c');
    await expect(page.getByRole('button', { name: /^Pay GH₵/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Change these details' })).toBeDisabled();
    await expect(page.getByText('Your order was not placed')).toHaveCount(0);
    expect(cardPage.asked()).toEqual([]);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    const attempts = sent.length;
    opens = true;
    await notOpened.getByRole('button', { name: 'Open the card page' }).click();
    await expect.poll(cardPage.asked, { timeout: 30_000 }).toEqual([CARD_PAGE]);
    await expect(
      page.getByRole('status').filter({ hasText: 'Taking you to the card page' }),
    ).toBeVisible();
    await page.getByRole('link', { name: /continue to it here/ }).click();
    await page.waitForURL(CARD_PAGE, { timeout: 30_000 });

    // Every attempt, the replay included, is the same request with the same key: one order, one page.
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(sent).toHaveLength(attempts + 1);
    const keys = new Set(sent.map((attempt) => attempt.key));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toMatch(/^[0-9a-f-]{36}$/);
    for (const attempt of sent) expect(attempt.body).toEqual({ paymentMethod: 'CARD' });
  });

  test('a card page on any other host is refused in words and never opened', async ({ page }) => {
    test.setTimeout(180_000);
    await throttle3G(page);
    await answerPlacement(page, WRONG_PAGE);
    let visited = false;
    await page.route('https://checkout.paystack.com.evil.example/**', async (route) => {
      visited = true;
      await route.abort();
    });
    await reviewByCard(page);

    await page.getByRole('button', { name: 'Pay GH₵450.00 by card' }).click();
    const refused = page.getByRole('alert').filter({ hasText: 'We did not open the card page' });
    await expect(refused).toBeVisible({ timeout: 30_000 });
    await expect(refused).toContainText('Do not pay on any other page.');
    await expect(refused).toContainText('SO-2026-DDW-004216');
    await expect(page.getByText('Taking you to the card page')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /continue to it here/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Check my payment' })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    expect(new URL(page.url()).pathname).toBe('/checkout');
    expect(visited).toBe(false);
  });
});
