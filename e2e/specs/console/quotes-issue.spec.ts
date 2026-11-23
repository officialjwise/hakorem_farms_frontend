import type { components } from '@hakorem/api-client';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { QUOTE_ID, eggQuote, version1, version2 } from '../../support/quotes';
import { expect, test } from '../../support/test';

/**
 * Issuing a quote as contract 2.31.0 has it (F10o): markup is over cost and margin over the selling price
 * (2.29.0). Asantewaa Chop Bar's eggs, at 360 px; every figure is the API's.
 */

type S = components['schemas'];
type Page<T> = { data: T[]; page: unknown };

const pageOf = <T>(body: unknown, rows: T[]) => ({ ...(body as Page<T>), data: rows });

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
