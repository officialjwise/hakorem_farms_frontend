import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../support/test';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { refusePhotos, throttle3G } from '../../support/shop';
import { TOKENS, UNKNOWN_TOKEN } from '../../support/shopApi';

/**
 * F10j: a buyer asks for a quote from the shop, and a customer accepts a quote from the link the farm sent
 * (the F10 gate). The page reads the quote on the storefront's server from the shop API's fixtures, one per
 * token (ADR 0054); the browser's writes are routed here, so what was sent is checked.
 */

type Sent = { path: string; body: unknown };

const ERROR = (code: string, message: string) => ({
  error: { code, message, correlationId: '019a7b41-5c2d-7e3f-8a4b-9c0d1e2f3a4b', details: [] },
});

/** Answers one browser write and records what the page sent. */
async function answer(page: Page, glob: string, status: number, body: unknown): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route(glob, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.continue();
    sent.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://localhost:3100',
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify(body),
    });
  });
  return sent;
}

test.beforeEach(async ({ context }) => {
  await refusePhotos(context);
});

test.describe('a quote from its link', () => {
  test('the gate: a customer reads the quote on a phone over 3G and accepts it after a confirmation', async ({
    page,
  }) => {
    await throttle3G(page);
    const sent = await answer(page, '**/shop/quotes/*/accept', 200, {
      quoteNo: 'QUO-2026-DDW-000091',
      versionNo: 2,
      status: 'ACCEPTED',
      message: 'Thank you. We will call you to arrange the deposit and delivery.',
    });
    await page.goto(`/q/${TOKENS.issued}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quote QUO-2026-DDW-000091');
    await expect(page.getByText('Waiting for your answer')).toBeVisible();
    await expect(page.getByText('Version 2 · For Akosua Bakery')).toBeVisible();
    await expect(page.getByText('Valid until 2026-11-24 18:00 (Accra time)')).toBeVisible();
    const lines = page.getByRole('list').filter({ hasText: 'Eggs, big' });
    await expect(lines.getByRole('listitem')).toHaveCount(2);
    await expect(lines.getByRole('listitem').first()).toContainText('10 crates');
    await expect(lines.getByRole('listitem').first()).toContainText('GH₵55.00 a crate');
    await expect(lines.getByRole('listitem').first()).toContainText('GH₵550.00');
    await expect(lines.getByRole('listitem').nth(1)).toContainText('30 items');
    await expect(lines.getByRole('listitem').nth(1)).toContainText('GH₵2.20 each');
    const totals = page.locator('dl').filter({ hasText: 'Before tax' });
    await expect(totals).toContainText('GH₵60.00');
    await expect(totals).toContainText('GH₵676.00');
    await expect(totals).toContainText('GH₵12.00');
    await expect(totals).toContainText('GH₵688.00');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // Accept with no name is stopped in words, before any dialog or request.
    await page.getByRole('button', { name: 'Accept this quote' }).click();
    await expect(page.getByText('Type your full name to accept.')).toBeVisible();
    expect(sent).toEqual([]);

    await page.getByRole('textbox', { name: /Your full name/ }).fill('Akosua Mensah');
    await page.getByRole('button', { name: 'Accept this quote' }).click();
    const dialog = page.getByRole('dialog', { name: 'Accept quote QUO-2026-DDW-000091?' });
    await expect(dialog).toContainText(
      'You are accepting version 2 for a total of GH₵688.00, as Akosua Mensah.',
    );
    await expectNoAxeViolations(page);
    expect(sent).toEqual([]);
    await dialog.getByRole('button', { name: 'Yes, accept the quote' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('heading', { name: 'You accepted this quote' })).toBeVisible();
    await expect(
      page.getByText('Thank you. We will call you to arrange the deposit and delivery.'),
    ).toBeVisible();
    // Only the token names the quote, and only the name is sent.
    expect(sent).toEqual([
      { path: `/shop/quotes/${TOKENS.issued}/accept`, body: { acceptedName: 'Akosua Mensah' } },
    ]);
    expect(sent[0]?.path).not.toContain('QUO-');
    await expectNoAxeViolations(page);
  });

  test('the page is private: never indexed, and the link is never passed on as a referrer', async ({
    page,
    request,
  }) => {
    const response = await request.get(`/q/${TOKENS.issued}`);
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await page.goto(`/q/${TOKENS.issued}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect((await request.get('/robots.txt').then((r) => r.text())).includes('Disallow: /q/')).toBe(
      true,
    );
  });

  test('an expired quote says when it expired and how to ask for a new one, with no accept', async ({
    page,
  }) => {
    await page.goto(`/q/${TOKENS.expired}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quote QUO-2026-DDW-000084');
    await expect(page.getByText('This quote has expired')).toBeVisible();
    await expect(
      page.getByText(
        /It was valid until 2026-11-10 18:00 \(Accra time\), so it can no longer be accepted/,
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask for a new quote' })).toHaveAttribute(
      'href',
      '/quote',
    );
    await expect(page.getByRole('button', { name: 'Accept this quote' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a quote replaced by a newer version says so, and this link cannot be accepted', async ({
    page,
  }) => {
    await page.goto(`/q/${TOKENS.superseded}`);
    await expect(page.getByText('Replaced by a newer version').first()).toBeVisible();
    await expect(page.getByText('This quote was replaced by a newer version')).toBeVisible();
    await expect(page.getByText(/This link can no longer be used/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept this quote' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('an accepted quote says so, and a declined one offers a new request', async ({ page }) => {
    await page.goto(`/q/${TOKENS.accepted}`);
    await expect(page.getByText('You accepted this quote')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept this quote' })).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.goto(`/q/${TOKENS.declined}`);
    await expect(page.getByText('You declined this quote')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask for a new quote' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a wrong link says only that it is not valid', async ({ page }) => {
    await page.goto(`/q/${UNKNOWN_TOKEN}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link is not valid');
    await expect(page.getByText(/QUO-/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a refused accept keeps its words on the page', async ({ page }) => {
    const sent = await answer(
      page,
      '**/shop/quotes/*/accept',
      409,
      ERROR('CONFLICT', 'This version of the quote can no longer be accepted.'),
    );
    await page.goto(`/q/${TOKENS.issued}`);
    await page.getByRole('textbox', { name: /Your full name/ }).fill('Akosua Mensah');
    await page.getByRole('button', { name: 'Accept this quote' }).click();
    await page.getByRole('button', { name: 'Yes, accept the quote' }).click();
    const refused = page.getByRole('alert').filter({ hasText: 'The quote could not be answered' });
    await expect(refused).toContainText('This version of the quote can no longer be accepted.');
    await expect(refused).toContainText('Its state now is shown above.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(sent).toHaveLength(1);
    await expectNoAxeViolations(page);
  });

  test('declining is confirmed, and sends the reason given', async ({ page }) => {
    const sent = await answer(page, '**/shop/quotes/*/decline', 200, {
      quoteNo: 'QUO-2026-DDW-000091',
      versionNo: 2,
      status: 'DECLINED',
      message: 'Thank you for letting us know.',
    });
    await page.goto(`/q/${TOKENS.issued}`);
    await page.getByRole('button', { name: 'Decline' }).click();
    const dialog = page.getByRole('dialog', { name: 'Decline quote QUO-2026-DDW-000091?' });
    await dialog.getByRole('textbox', { name: /Why/ }).fill('Found eggs closer to Kasoa');
    await dialog.getByRole('button', { name: 'Yes, decline' }).click();
    await expect(page.getByText('Thank you for letting us know.')).toBeVisible();
    expect(sent).toEqual([
      {
        path: `/shop/quotes/${TOKENS.issued}/decline`,
        body: { reason: 'Found eggs closer to Kasoa' },
      },
    ]);
  });
});

test.describe('asking for a quote', () => {
  test('an empty request is stopped in words; a filled one sends what was typed and shows its number', async ({
    page,
  }) => {
    const sent = await answer(page, '**/shop/quote-requests', 202, {
      rfqNo: 'RFQ-2026-DDW-000161',
      message: 'Thank you. Kojo from our sales team will call you within one working day.',
    });
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Ask for a quote' }).click();
    await expect(page).toHaveURL('/quote');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ask for a quote');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Send my request' }).click();
    await expect(page.getByText('Some details need correcting')).toBeVisible();
    await expect(page.getByText('Enter your name.')).toBeVisible();
    await expect(page.getByText('Say what you want.')).toBeVisible();
    await expect(
      page.getByText('Tick this so we may contact you about your request.'),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /You may call/ })).not.toBeChecked();
    expect(sent).toEqual([]);
    await expectNoAxeViolations(page);

    await page.getByRole('textbox', { name: /Your name/ }).fill('Akosua Bakery');
    await page.getByRole('textbox', { name: /Phone number/ }).fill('024 451 2876');
    await page
      .getByRole('textbox', { name: /What you want/ })
      .fill('Big eggs every Friday morning');
    await page.getByRole('textbox', { name: /How many crates/ }).fill('40');
    await page.getByRole('textbox', { name: /Delivery area/ }).fill('Kasoa');
    await page.getByRole('checkbox', { name: /You may call/ }).check();
    await page.getByRole('button', { name: 'Send my request' }).click();

    await expect(
      page.getByRole('heading', { name: 'Request RFQ-2026-DDW-000161 is with us' }),
    ).toBeVisible();
    await expect(
      page.getByText('Thank you. Kojo from our sales team will call you within one working day.'),
    ).toBeVisible();
    expect(sent).toEqual([
      {
        path: '/shop/quote-requests',
        body: {
          contactName: 'Akosua Bakery',
          contactPhone: '+233244512876',
          requirements: 'Big eggs every Friday morning\nCrates wanted: 40',
          deliveryArea: 'Kasoa',
          consentToContact: true,
        },
      },
    ]);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('too many requests are said in words, with the reference, and nothing else is lost', async ({
    page,
  }) => {
    await answer(page, '**/shop/quote-requests', 429, ERROR('RATE_LIMITED', 'Too many requests.'));
    await page.goto('/quote');
    await page.getByRole('textbox', { name: /Your name/ }).fill('Akosua Bakery');
    await page.getByRole('textbox', { name: /Phone number/ }).fill('024 451 2876');
    await page.getByRole('textbox', { name: /What you want/ }).fill('Big eggs every Friday');
    await page.getByRole('checkbox', { name: /You may call/ }).check();
    await page.getByRole('button', { name: 'Send my request' }).click();
    const failed = page.getByRole('alert').filter({ hasText: 'Your request was not sent' });
    await expect(failed).toContainText(/Too many requests have come from this phone/);
    await expect(failed).toContainText('3a4b');
    await expect(page.getByRole('textbox', { name: /What you want/ })).toHaveValue(
      'Big eggs every Friday',
    );
    await expectNoAxeViolations(page);
  });
});
