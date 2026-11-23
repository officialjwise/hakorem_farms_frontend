import type { components } from '@hakorem/api-client';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import {
  MARGIN_APPROVAL_ID,
  QUOTE_ID,
  QUOTE_NO,
  VERSION_2,
  approvedVersion2,
  eggQuote,
  version1,
  version2,
} from '../../support/quotes';
import { expect, test } from '../../support/test';

/**
 * Issuing a quote as contract 2.31.0 has it (F10o): a margin approval only approves, and the salesperson
 * then issues and sends the version (2.19.0, CR-058); and markup is over cost and margin over the selling
 * price (2.29.0). Asantewaa Chop Bar's eggs, at 360 px; every figure is the API's.
 */

type S = components['schemas'];
type Page<T> = { data: T[]; page: unknown };

const pageOf = <T>(body: unknown, rows: T[]) => ({ ...(body as Page<T>), data: rows });
const posted = (path: string) => (r: { method: () => string; url: () => string }) =>
  r.method() === 'POST' && new URL(r.url()).pathname === `/mock${path}`;

/** The contract's 422 envelope with the broken rule named, as the server answers it. */
const refusal = (code: string, rule: string, message: string) => ({
  error: {
    code,
    message,
    correlationId: '019a7b1d-5a33-73ab-98e3-438b35eabc70',
    details: [{ field: null, code: rule, message }],
  },
});

test.describe('after a margin approval (2.19.0, CR-058)', () => {
  test('the salesperson issues and sends the approved version, and its link is shown once', async ({
    page,
    api,
  }) => {
    const issued = () => api.log.some((e) => e.operationId === 'issueQuoteVersion');
    api.rewrite('getQuote', (body) =>
      issued()
        ? eggQuote(body as S['Quote'], 'ISSUED', version2('ISSUED'), 2)
        : eggQuote(body as S['Quote'], 'DRAFT', approvedVersion2(), 2),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [issued() ? version2('ISSUED') : approvedVersion2(), version1('SUPERSEDED')]),
    );
    const token = 'quo_IssuedAfterApproval_4hT9';
    api.respond('issueQuoteVersion', () => ({
      ...version2('ISSUED'),
      acceptanceLinkToken: token,
    }));

    await signIn(page, USERS.sales, `/quotes/${QUOTE_ID}`);
    await expect(page.getByRole('heading', { name: QUOTE_NO })).toBeVisible();
    // The quote reads Draft; its version says the margin is approved and nothing is sent yet.
    await expect(page.getByText('Margin approved, not yet sent').first()).toBeVisible();
    await expect(page.getByText('Below the margin floor, and approved')).toBeVisible();
    const waiting = page
      .getByRole('status')
      .filter({ hasText: 'The margin of version 2 is approved: issue and send it' });
    await expect(waiting).toContainText('Nothing is held or sent yet, and it has no link.');
    await expect(waiting.getByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      `/approvals/${MARGIN_APPROVAL_ID}`,
    );
    // No word tells anyone to make a new link after the approval, and the draft's own actions are gone.
    await expect(page.getByRole('button', { name: 'Make a new link' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send to the customer' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit the draft' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Issue and send' }).click();
    const dialog = page.getByRole('dialog', { name: `Issue and send ${QUOTE_NO}, version 2?` });
    await expect(dialog).toContainText('666.00');
    await expect(dialog).toContainText('It is issued at the figures approved');
    await expect(dialog).toContainText('Whoever approved it cannot issue it.');
    await expect(dialog.getByRole('checkbox', { name: 'WhatsApp' })).toBeChecked();
    await expectNoAxeViolations(page);
    const sent = page.waitForRequest(posted(`/quote-versions/${VERSION_2}/issue`));
    await dialog.getByRole('button', { name: 'Issue and send' }).click();
    // The channels of any issue; the version is the approved one, issued at its approved figures.
    expect((await sent).postDataJSON()).toEqual({ channels: ['WHATSAPP', 'SMS'] });
    await expect(
      page.getByText(`${QUOTE_NO} is issued, and its link is ready to pass on`),
    ).toBeVisible();
    const panel = page.getByRole('region', { name: "The customer's link" });
    await expect(
      panel.getByText(`http://127.0.0.1:3100/q/${token}`, { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText('This link is shown only once.', { exact: false })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('its approver is refused in words, and the refusal stays on the page', async ({
    page,
    api,
  }) => {
    api.rewrite('getQuote', (body) => eggQuote(body as S['Quote'], 'DRAFT', approvedVersion2(), 2));
    api.rewrite('listQuoteVersions', (body) => pageOf(body, [approvedVersion2()]));
    api.respond(
      'issueQuoteVersion',
      () =>
        refusal(
          'QUOTE_INVALID',
          'APPROVER_CANNOT_ISSUE',
          'The approver of a quote version cannot issue it.',
        ),
      422,
    );
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    await page.getByRole('button', { name: 'Issue and send' }).click();
    const dialog = page.getByRole('dialog', { name: /^Issue and send / });
    await dialog.getByRole('button', { name: 'Issue and send' }).click();
    const words =
      "This quote cannot be saved or sent as it is. You approved this version's margin, so someone else who may send quotes issues it.";
    await expect(dialog.getByRole('alert').filter({ hasText: words })).toBeVisible();
    await expectNoAxeViolations(page);
    // Closed, the refusal is still said on the page, with nothing issued and no link.
    await dialog.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('alert').filter({ hasText: words })).toBeVisible();
    await expect(page.getByRole('region', { name: "The customer's link" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('markup is not margin (2.29.0)', () => {
  test('the version shows markup over cost and margin over the selling price, never the deprecated field', async ({
    page,
    api,
  }) => {
    const draft: S['QuoteVersion'] = {
      ...version2('DRAFT'),
      belowMarginFloor: true,
      estimatedCostPesewas: 53280,
      // Deprecated: markup under its old name. A wrong figure here proves it is never read.
      marginPercent: '99.99',
      markupPercent: '25.00',
      marginOverPricePercent: '20.00',
    };
    api.rewrite('getQuote', (body) => eggQuote(body as S['Quote'], 'DRAFT', draft, 2));
    api.rewrite('listQuoteVersions', (body) => pageOf(body, [draft, version1('SUPERSEDED')]));
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    const totals = page.locator('dl').filter({ hasText: 'Markup over cost' });
    await expect(totals).toContainText('Markup over cost');
    await expect(totals).toContainText('25.00 percent');
    await expect(totals).toContainText('Margin over the selling price');
    await expect(totals).toContainText('20.00 percent');
    await expect(page.getByText('99.99')).toHaveCount(0);
    // The floor is a margin over the selling price, said so.
    await expect(
      page.getByText(
        /Its margin over the selling price, on the product lines without the delivery fee/,
      ),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a markup or margin the server cannot work out is said in words', async ({ page, api }) => {
    api.rewrite('getQuote', (body) =>
      eggQuote(body as S['Quote'], 'ISSUED', version2('ISSUED'), 2),
    );
    api.rewrite('listQuoteVersions', (body) => pageOf(body, [version2('ISSUED')]));
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    const totals = page.locator('dl').filter({ hasText: 'Markup over cost' });
    await expect(totals.getByText('Not known: a cost is missing')).toHaveCount(2);
  });
});
