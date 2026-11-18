import type { components } from '@hakorem/api-client';
import { seedEggs, EGGS_ID } from '../../support/eggs';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { MANAGER } from '../../support/payables';
import {
  CUSTOMER,
  CUSTOMER_PHONE,
  ORDER_ID,
  ORDER_NO,
  OVERRIDE_APPROVAL_ID,
  PRICE_LIST,
  QUOTE_ID,
  QUOTE_NO,
  VERSION_1,
  VERSION_2,
  chopBar,
  chopBarAccount,
  chopBarAgeing,
  eggOrder,
  eggPrices,
  eggQuote,
  overLimit,
  overrideApproval,
  overrideState,
  version1,
  version2,
} from '../../support/quotes';
import { expect, test } from '../../support/test';

/**
 * Quotes, wholesale and credit control (F10i, contract 2.5.0): Asantewaa Chop Bar buys big eggs by the
 * crate and the single egg. A quote is built with lines priced by the API for the buyer (each line naming
 * its unit, CR-045 in 2.12.0), revised into a new version with the old one kept readable, sent, accepted and made an order
 * with every link kept. Confirming the credit order is refused by the server with the amount over the
 * limit (CR-046), an override is asked for with a reason, the person who asked cannot approve it, and a
 * Manager does; the account shows who approved it. The suite runs at 360 px. Every amount shown is the
 * API's: the browser adds nothing up.
 */

type S = components['schemas'];
type Page<T> = { data: T[]; page: unknown };

const pageOf = <T>(body: unknown, rows: T[]) => ({ ...(body as Page<T>), data: rows });
function first<T>(body: unknown): T {
  const row = (body as Page<T>).data[0];
  if (row === undefined) throw new Error('The example page has no row.');
  return row;
}
const posted = (path: string) => (r: { method: () => string; url: () => string }) =>
  r.method() === 'POST' && new URL(r.url()).pathname === `/mock${path}`;

test.describe('a quote for crates and single eggs', () => {
  test('is built with each line priced by the API for its own unit; the server totals it', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    api.rewrite('listCustomers', (body) => pageOf(body, [chopBar(first<S['Customer']>(body))]));
    api.respond('resolvePrices', (request) => eggPrices(request as S['PriceResolveRequest']));
    // The server's draft, with its own line totals (Prism answers its example, not these lines).
    api.respond('createQuote', () => eggQuote({} as S['Quote'], 'DRAFT', version1('DRAFT'), 1));
    api.rewrite('getQuote', (body) => eggQuote(body as S['Quote'], 'DRAFT', version1('DRAFT'), 1));
    api.rewrite('listQuoteVersions', (body) => pageOf(body, [version1('DRAFT')]));

    await signInWithTotp(page, USERS.owner, '/quotes/new');
    await expect(page.getByRole('heading', { name: 'New quote' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Customer/ }).fill('Asantewaa');
    await page.getByRole('option', { name: `${CUSTOMER.name} (${CUSTOMER.publicId})` }).click();
    // The buyer's name and phone fill the contact.
    await expect(page.getByLabel(/^Contact phone/)).toHaveValue(CUSTOMER_PHONE);
    await page.getByLabel(/^Valid until/).fill('2026-11-24');

    // Line 1: 12 crates. Line 2: 30 single eggs.
    const line1 = page.getByRole('heading', { name: 'Line 1' }).locator('..').locator('..');
    await line1.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
    await page.getByRole('option', { name: /^Eggs, big/ }).click();
    await line1.getByRole('combobox', { name: /^Sold by/ }).click();
    await page.getByRole('option', { name: /^Crate/ }).click();
    await line1.getByLabel(/^How many, in crate/).fill('12');
    await page.getByRole('button', { name: 'Add a line' }).click();
    const line2 = page.getByRole('heading', { name: 'Line 2' }).locator('..').locator('..');
    await line2.getByRole('combobox', { name: /^Product/ }).fill('Eggs');
    await page.getByRole('option', { name: /^Eggs, big/ }).click();
    await line2.getByRole('combobox', { name: /^Sold by/ }).click();
    await page.getByRole('option', { name: 'Egg', exact: true }).click();
    await line2.getByLabel(/^How many, in eggs/).fill('30');
    await line2.getByLabel(/^Line words/).fill('Eggs, big, single');

    // Saving before the API has priced the lines is stopped in words.
    await page.getByRole('button', { name: 'Save the draft' }).click();
    await expect(page.getByText('Some lines have no price yet')).toBeVisible();

    const asked = page.waitForRequest(posted('/pricing/resolve'));
    await page.getByRole('button', { name: "Get the API's prices" }).click();
    const pricing = (await asked).postDataJSON() as S['PriceResolveRequest'];
    expect(pricing).toMatchObject({ channel: 'QUOTE', customerId: CUSTOMER.id });
    expect(pricing.lines.map((l) => [l.productId, l.quantity, l.uom])).toEqual([
      [EGGS_ID, '12.000', 'CRATE'],
      [EGGS_ID, '30.000', 'EGG'],
    ]);
    // Each line shows the API's price for its own unit: a single egg is not a thirtieth of a crate.
    await expect(line1.getByTestId('api-price')).toContainText('per crate');
    await expect(line1.getByTestId('api-price')).toContainText('60.00');
    await expect(line2.getByTestId('api-price')).toContainText('per egg');
    await expect(line2.getByTestId('api-price')).toContainText('2.20');
    await expect(line2.getByTestId('api-price')).toContainText(PRICE_LIST.name);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(posted('/quotes'));
    await page.getByRole('button', { name: 'Save the draft' }).click();
    const body = (await sent).postDataJSON() as S['QuoteCreate'] & {
      lines: (S['QuoteLineInput'] & { uom?: string })[];
    };
    expect(body).toMatchObject({
      customerId: CUSTOMER.id,
      contactPhone: CUSTOMER_PHONE,
      validUntil: '2026-11-24T23:59:59.999Z',
      taxInclusive: false,
    });
    // The API's prices, in pesewas, each with its unit (CR-045); no total is sent.
    expect(body.lines).toEqual([
      {
        productId: EGGS_ID,
        description: 'Eggs, big',
        quantity: '12.000',
        priceBasis: 'PER_UNIT',
        unitPricePesewas: 6000,
        uom: 'CRATE',
      },
      {
        productId: EGGS_ID,
        description: 'Eggs, big, single',
        quantity: '30.000',
        priceBasis: 'PER_UNIT',
        unitPricePesewas: 220,
        uom: 'EGG',
      },
    ]);

    // The quote, as the server totals it.
    await expect(page.getByRole('heading', { name: QUOTE_NO })).toBeVisible();
    const lines = page.getByRole('region', { name: "The version's lines" });
    await expect(lines).toContainText('12 crates');
    await expect(lines).toContainText('30 eggs');
    await expect(lines).toContainText('720.00');
    await expect(page.getByText('786.00').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('is revised into a new version; the old one stays as it was and can be read', async ({
    page,
    api,
  }) => {
    const revised = () => api.log.some((e) => e.operationId === 'reviseQuote');
    api.rewrite('getQuote', (body) =>
      revised()
        ? eggQuote(body as S['Quote'], 'ISSUED', version2('DRAFT'), 2)
        : eggQuote(body as S['Quote'], 'ISSUED', version1('ISSUED'), 1),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, revised() ? [version2('DRAFT'), version1('SUPERSEDED')] : [version1('ISSUED')]),
    );
    api.rewrite('reviseQuote', () => version2('DRAFT'));

    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    await expect(page.getByRole('heading', { name: QUOTE_NO })).toBeVisible();
    await page.getByRole('button', { name: 'Revise' }).click();
    const dialog = page.getByRole('dialog', { name: `Revise ${QUOTE_NO}?` });
    await dialog.getByRole('textbox').fill('Ten crates, not twelve');
    const sent = page.waitForRequest(posted(`/quotes/${QUOTE_ID}/versions`));
    await dialog.getByRole('button', { name: 'Revise' }).click();
    expect((await sent).postDataJSON()).toEqual({
      changeNote: 'Ten crates, not twelve',
      copyFromVersionId: VERSION_1,
    });
    await expect(page.getByText(`A new draft version of ${QUOTE_NO} was started`)).toBeVisible();

    // Both versions are listed; the new one is in force.
    const versions = page.getByRole('navigation', { name: 'Versions' });
    await expect(versions.getByRole('button', { name: 'Version 2, in force' })).toBeVisible();
    await expect(versions).toContainText('Replaced by a newer version');
    await expect(page.getByText('666.00').first()).toBeVisible();

    // The old version opens as it was: 12 crates, GH₵786.00, and cannot be changed.
    await versions.getByRole('button', { name: 'Version 1' }).click();
    await expect(page).toHaveURL(new RegExp(`version=${VERSION_1}`));
    await expect(page.getByText('An earlier version, as it was')).toBeVisible();
    await expect(page.getByRole('region', { name: "The version's lines" })).toContainText(
      '12 crates',
    );
    await expect(page.getByText('786.00').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit the draft' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('is issued, and its link is shown once, to copy or send on WhatsApp with the number', async ({
    page,
    api,
  }) => {
    const issued = () => api.log.some((e) => e.operationId === 'issueQuoteVersion');
    api.rewrite('getQuote', (body) =>
      eggQuote(
        body as S['Quote'],
        issued() ? 'ISSUED' : 'DRAFT',
        version2(issued() ? 'ISSUED' : 'DRAFT'),
        2,
      ),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [version2(issued() ? 'ISSUED' : 'DRAFT'), version1('SUPERSEDED')]),
    );
    const tokens = ['quo_FirstLinkMadeAtIssue_9fK2', 'quo_SecondLinkMadeLater_x7Qp'];
    let answered = 0;
    api.respond('issueQuoteVersion', () => ({
      ...version2('ISSUED'),
      acceptanceLinkToken: tokens[Math.min(answered++, tokens.length - 1)],
    }));
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    await page.getByRole('button', { name: 'Send to the customer' }).click();
    const dialog = page.getByRole('dialog', { name: `Send ${QUOTE_NO}, version 2?` });
    await expect(dialog).toContainText('666.00');
    const sent = page.waitForRequest(posted(`/quote-versions/${VERSION_2}/issue`));
    await dialog.getByRole('button', { name: 'Send to the customer' }).click();
    // Only the channels: the token in the link is the server's, never a number or id of ours.
    expect((await sent).postDataJSON()).toEqual({ channels: ['WHATSAPP', 'SMS'] });
    await expect(
      page.getByText(`${QUOTE_NO} is issued, and its link is ready to pass on`),
    ).toBeVisible();

    // The link, from the build's shop address and the server's token, said plainly to be shown once.
    const panel = page.getByRole('region', { name: "The customer's link" });
    const first = `http://127.0.0.1:3100/q/${tokens[0]}`;
    await expect(panel.getByText('This link is shown only once.', { exact: false })).toBeVisible();
    await expect(panel.getByText(/make a new link from this quote/)).toBeVisible();
    await expect(panel.getByText(first, { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Copy the link' })).toBeVisible();
    const whatsApp = panel.getByRole('link', { name: `Send on WhatsApp to ${CUSTOMER_PHONE}` });
    const href = new URL((await whatsApp.getAttribute('href')) ?? '');
    expect(href.origin + href.pathname).toBe(`https://wa.me/${CUSTOMER_PHONE.slice(1)}`);
    expect(href.searchParams.get('text')).toContain(first);
    expect(href.searchParams.get('text')).toContain(QUOTE_NO);
    await expect(whatsApp).toHaveAttribute('rel', 'noopener noreferrer');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // A new link is made from the quote: nothing is sent again, and the new token is shown once.
    await page.getByRole('button', { name: 'Make a new link' }).click();
    const again = page.getByRole('dialog', { name: `Make a new link to ${QUOTE_NO}?` });
    await expect(again).toContainText('Nothing is sent to the customer');
    const remade = page.waitForRequest(posted(`/quote-versions/${VERSION_2}/issue`));
    await again.getByRole('button', { name: 'Make a new link' }).click();
    expect((await remade).postDataJSON()).toEqual({ channels: [] });
    await expect(page.getByText(`A new link to ${QUOTE_NO} is ready to pass on`)).toBeVisible();
    await expect(
      panel.getByText(`http://127.0.0.1:3100/q/${tokens[1]}`, { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText(first, { exact: true })).toHaveCount(0);
  });

  test('a draft is saved at its own version, the lock 2.12.0 names', async ({ page, api }) => {
    api.rewrite('getQuote', (body) =>
      eggQuote(body as S['Quote'], 'ISSUED', { ...version2('DRAFT'), version: 4 }, 2),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [{ ...version2('DRAFT'), version: 4 }, version1('SUPERSEDED')]),
    );
    api.rewrite('updateQuoteVersion', () => ({ ...version2('DRAFT'), version: 5 }));
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    // Each version says who made it and when.
    await expect(page.getByText('Made', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit the draft' }).click();
    const sent = page.waitForRequest(
      (r) =>
        r.method() === 'PUT' && new URL(r.url()).pathname === `/mock/quote-versions/${VERSION_2}`,
    );
    await page.getByRole('button', { name: 'Save the version' }).click();
    // The version's lock (4), never the quote's (3).
    expect((await sent).postDataJSON()).toMatchObject({ version: 4 });
    await expectNoAxeViolations(page);
  });

  test('accepted by phone, the acceptance needs what the buyer said, and sends it', async ({
    page,
    api,
  }) => {
    api.rewrite('getQuote', (body) =>
      eggQuote(body as S['Quote'], 'ISSUED', version2('ISSUED'), 2),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [version2('ISSUED'), version1('SUPERSEDED')]),
    );
    api.rewrite('recordQuoteAcceptance', (body) => ({
      ...eggQuote(body as S['Quote'], 'ACCEPTED', version2('ACCEPTED'), 2),
    }));
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    await page.getByRole('button', { name: 'Record an acceptance' }).click();
    const dialog = page.getByRole('dialog', { name: /^Record that / });
    await dialog.getByRole('textbox', { name: /The name they gave/ }).fill('Akosua Asantewaa');
    await dialog.getByRole('button', { name: 'Record an acceptance' }).click();
    // No note, no call: the server would refuse it (NOTE_REQUIRED).
    await expect(dialog.getByText('Required').first()).toBeVisible();
    expect(api.log.some((e) => e.operationId === 'recordQuoteAcceptance')).toBe(false);
    await expectNoAxeViolations(page);
    await dialog
      .getByRole('textbox', { name: /What they said, and where/ })
      .fill('Called from 024 451 2876 at 10:40 and said yes to version 2');
    const sent = page.waitForRequest(posted(`/quotes/${QUOTE_ID}/record-acceptance`));
    await dialog.getByRole('button', { name: 'Record an acceptance' }).click();
    expect((await sent).postDataJSON()).toEqual({
      method: 'PHONE_CONFIRMED',
      acceptedName: 'Akosua Asantewaa',
      note: 'Called from 024 451 2876 at 10:40 and said yes to version 2',
    });
    await expectNoHorizontalScroll(page);
  });

  test('below the margin floor, sending waits for someone else to approve it', async ({
    page,
    api,
  }) => {
    api.rewrite('getQuote', (body) =>
      eggQuote(body as S['Quote'], 'DRAFT', { ...version2('DRAFT'), belowMarginFloor: true }, 2),
    );
    api.rewrite('listQuoteVersions', (body) => pageOf(body, [version2('DRAFT')]));
    api.prefer('issueQuoteVersion', 'code=202');
    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    await expect(page.getByText('Below the margin floor', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Send to the customer' }).click();
    await page
      .getByRole('dialog', { name: /^Send / })
      .getByRole('button', { name: 'Send to the customer' })
      .click();
    const waiting = page
      .getByRole('alert')
      .filter({ hasText: 'waits for approval by someone other than you' });
    await expect(waiting).toContainText('waits for approval by someone other than you');
    await expect(waiting.getByRole('link', { name: 'Open the approval' })).toBeVisible();
  });

  test('accepted from its link, it becomes one order, linked both ways', async ({ page, api }) => {
    const converted = () => api.log.some((e) => e.operationId === 'convertQuote');
    api.rewrite('getQuote', (body) =>
      eggQuote(body as S['Quote'], converted() ? 'CONVERTED' : 'ACCEPTED', version2('ACCEPTED'), 2),
    );
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [version2('ACCEPTED'), version1('SUPERSEDED')]),
    );
    api.rewrite('convertQuote', (body) => eggOrder(body as S['SalesOrder'], 'PLACED'));
    api.rewrite('getOrder', (body) => eggOrder(body as S['SalesOrder'], 'PLACED'));
    api.respond('getOrderCreditCheck', () => overLimit());

    await signInWithTotp(page, USERS.owner, `/quotes/${QUOTE_ID}`);
    // How it was accepted, from the API.
    await expect(page.getByText('By Akosua Asantewaa, by the link sent to them')).toBeVisible();
    await page.getByRole('button', { name: 'Make it an order' }).click();
    const dialog = page.getByRole('dialog', { name: `Make ${QUOTE_NO} an order?` });
    const sent = page.waitForRequest(posted(`/quotes/${QUOTE_ID}/convert`));
    await dialog.getByRole('button', { name: 'Make it an order' }).click();
    expect((await sent).postDataJSON()).toEqual({
      fulfilmentMode: 'COLLECTION',
      paymentTerms: 'CREDIT',
    });
    await expect(page.getByText(`${QUOTE_NO} is now order ${ORDER_NO}`)).toBeVisible();
    await expect(page.getByRole('link', { name: ORDER_NO })).toHaveAttribute(
      'href',
      `/orders/${ORDER_ID}`,
    );
    await page.getByRole('link', { name: 'Open the order' }).click();
    await expect(page.getByRole('heading', { name: ORDER_NO })).toBeVisible();
    // The order names the quote it came from, and each line is at the quote's price.
    await expect(page.getByRole('link', { name: `Back to quote ${QUOTE_NO}` })).toHaveAttribute(
      'href',
      `/quotes/${QUOTE_ID}`,
    );
    const lines = page.getByRole('region', { name: "The order's lines" });
    await expect(lines.getByText("At the quote's price")).toHaveCount(2);
    await expect(lines).toContainText('10 crates');
    await expect(lines).toContainText('30 eggs');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('credit control', () => {
  test('a credit order past the limit is refused in words with the amount over; an override is asked for with a reason', async ({
    page,
    api,
  }) => {
    const asked = () => api.log.some((e) => e.operationId === 'requestCreditOverride');
    api.rewrite('getOrder', (body) => eggOrder(body as S['SalesOrder'], 'PLACED'));
    api.respond('getOrderCreditCheck', () =>
      overLimit(asked() ? overrideState('PENDING_APPROVAL') : null),
    );
    api.refuse(
      'confirmOrder',
      422,
      'CREDIT_LIMIT_EXCEEDED',
      'This order would take Asantewaa Chop Bar GH₵286.00 over its GH₵5,000.00 credit limit.',
    );
    let overrideBody: unknown = null;
    api.respond(
      'requestCreditOverride',
      (request) => {
        overrideBody = request;
        return {
          status: 'PENDING_APPROVAL',
          approvalRequestId: OVERRIDE_APPROVAL_ID,
          kind: 'CREDIT_OVERRIDE',
          subject: { id: ORDER_ID, docType: 'SALES_ORDER', number: ORDER_NO },
          summary: 'Awaiting approval by a different user with the approving permission',
          requestedAt: '2026-11-17T12:35:00Z',
          creditCheck: overLimit(),
        };
      },
      202,
    );

    await signInWithTotp(page, USERS.owner, `/orders/${ORDER_ID}`);
    // The server's check, before anything is sent: GH₵286.00 over, every figure the API's.
    const words =
      'This order would take Asantewaa Chop Bar GH₵286.00 over their GH₵5,000.00 credit limit.';
    await expect(page.getByText(words).first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirm the order' }).click();
    const dialog = page.getByRole('dialog', { name: `Confirm order ${ORDER_NO}?` });
    await expect(dialog).toContainText('666.00');
    await dialog.getByRole('button', { name: 'Confirm the order' }).click();
    await expect(dialog).toBeHidden();
    // The refusal stays on the page, in words, with the amount over.
    const refusal = page
      .getByRole('alert')
      .filter({ hasText: 'The server refused to confirm this order' });
    await expect(refusal).toContainText(words);
    await expect(refusal).toContainText('an Owner or Manager other than you approves it');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Ask for a credit override' }).click();
    const ask = page.getByRole('dialog', {
      name: `Ask for a credit override on order ${ORDER_NO}?`,
    });
    await expect(ask).toContainText('GH₵286.00');
    await ask.getByRole('textbox').fill('They pay every Friday; this week is the festival order');
    await ask.getByRole('button', { name: 'Ask for a credit override' }).click();
    await expect(
      page.getByText('The override waits for an Owner or Manager other than you'),
    ).toBeVisible();
    expect(overrideBody).toEqual({
      reason: 'They pay every Friday; this week is the festival order',
    });
    // The check reads it back: who asked, why, and that someone else must decide.
    await expect(
      page.getByText('The override waits for an Owner or Manager other than Ama Mensah'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the approval' }).first()).toHaveAttribute(
      'href',
      `/approvals/${OVERRIDE_APPROVAL_ID}`,
    );
    await expectNoAxeViolations(page);
  });

  test('the person who asked for the override cannot approve it', async ({ page, api }) => {
    api.rewrite('getApproval', (body) => overrideApproval(body as Record<string, unknown>));
    await signInWithTotp(page, USERS.owner, `/approvals/${OVERRIDE_APPROVAL_ID}`);
    await expect(page.getByText('You asked for this, so you cannot decide it')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: `Open ${ORDER_NO}` })).toHaveAttribute(
      'href',
      `/orders/${ORDER_ID}`,
    );
    await expectNoAxeViolations(page);
  });

  test('a Manager approves it, and the order and the account say who approved it', async ({
    page,
    api,
  }) => {
    api.rewrite('getApproval', (body) => overrideApproval(body as Record<string, unknown>));
    api.rewrite('approveRequest', (body) =>
      overrideApproval(body as Record<string, unknown>, {
        status: 'APPROVED',
        canDecide: false,
        decidedBy: MANAGER,
      }),
    );
    api.rewrite('getOrder', (body) => eggOrder(body as S['SalesOrder'], 'PLACED'));
    api.respond('getOrderCreditCheck', () => overLimit(overrideState('APPROVED')));
    api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as S['BusinessAccount']));
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    api.rewrite('listCreditOverrides', (body) => {
      const base = first<S['CreditOverride']>(body);
      return pageOf(body, [
        {
          ...base,
          customer: CUSTOMER,
          order: { id: ORDER_ID, docType: 'SALES_ORDER', number: ORDER_NO },
          limitPesewas: 500000,
          exposurePesewas: 528600,
          approvalRequestId: OVERRIDE_APPROVAL_ID,
          approvedBy: MANAGER,
          recordedAt: '2026-11-17T12:50:00Z',
          reason: 'They pay every Friday; this week is the festival order',
          requestedBy: { id: '019a7a86-1c4e-7b9a-9e2f-5d3c8a1b7e04', displayName: 'Ama Mensah' },
          overLimitPesewas: 28600,
        },
      ]);
    });

    await signInWithTotp(page, USERS.manager, `/approvals/${OVERRIDE_APPROVAL_ID}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: /^Approve this/ });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved. It has taken effect.')).toBeVisible();

    await page.goto(`/orders/${ORDER_ID}`);
    await expect(
      page.getByText('Override approved by Kwabena Owusu at 2026-11-17 12:50'),
    ).toBeVisible();
    await expect(page.getByText('Asked for by Ama Mensah at 2026-11-17 12:35')).toBeVisible();

    await page.goto(`/business-accounts/${CUSTOMER.id}`);
    const overrides = page.getByRole('region', { name: 'Credit overrides' });
    await expect(overrides).toContainText(ORDER_NO);
    await expect(overrides).toContainText('Kwabena Owusu, 2026-11-17 12:50');
    await expect(overrides).toContainText('Asked for by Ama Mensah');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('wholesale accounts and the ageing', () => {
  test("a buyer's account: limit, terms, price list, what they owe and how late, from the API", async ({
    page,
    api,
  }) => {
    api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as S['BusinessAccount']));
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    await signInWithTotp(page, USERS.owner, `/business-accounts/${CUSTOMER.id}`);
    await expect(page.getByRole('heading', { name: CUSTOMER.name })).toBeVisible();
    await expect(page.getByText('30 days', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(PRICE_LIST.name)).toBeVisible();
    const owes = page.getByRole('heading', { name: 'What they owe' }).locator('..').locator('..');
    await expect(owes).toContainText('5,000.00');
    await expect(owes).toContainText('4,620.00');
    await expect(owes).toContainText('1,250.00');
    const late = page.getByRole('heading', { name: 'How late' }).locator('..').locator('..');
    await expect(late).toContainText('31 to 60 days late');
    await expect(late).toContainText('1,250.00');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // Put on hold, with a reason.
    await page.getByRole('button', { name: 'Put on hold' }).click();
    const hold = page.getByRole('dialog', { name: `Put ${CUSTOMER.name} on hold?` });
    await hold.getByRole('textbox').fill('Cheque returned unpaid');
    const sent = page.waitForRequest(posted(`/business-accounts/${CUSTOMER.id}/hold`));
    await hold.getByRole('button', { name: 'Put on hold' }).click();
    expect((await sent).postDataJSON()).toEqual({ reason: 'Cheque returned unpaid' });
    await expect(page.getByText(`${CUSTOMER.name} is on hold`)).toBeVisible();
  });

  test("the ageing: who owes what in the API's buckets, with its totals", async ({ page, api }) => {
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    await signInWithTotp(page, USERS.owner, '/ageing');
    await expect(page.getByRole('heading', { name: 'Ageing' })).toBeVisible();
    await expect(page.getByText('As the server worked it out on 2026-11-17').first()).toBeVisible();
    const table = page.getByRole('region', { name: 'Ageing' }).last();
    await expect(table).toContainText(CUSTOMER.name);
    await expect(table).toContainText('3,370.00');
    await expect(table).toContainText('4,620.00');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a cashier is denied the quotes in words', async ({ page }) => {
    await signIn(page, USERS.cashier, '/quotes');
    await expect(page.getByText(/quo\.quote\.read/).first()).toBeVisible();
  });
});

test.describe('who may do what (the owner, 2026-11-18)', () => {
  const onHold = (body: unknown) => ({
    ...chopBarAccount(body as S['BusinessAccount']),
    status: 'ON_HOLD' as const,
    holdReason: 'Cheque returned unpaid',
    heldAt: '2026-11-17T09:00:00Z',
  });

  test('Sales builds, sends and converts quotes, and neither approves an override nor changes credit', async ({
    page,
    api,
  }) => {
    api.rewrite('getQuote', (body) => eggQuote(body as S['Quote'], 'DRAFT', version2('DRAFT'), 2));
    api.rewrite('listQuoteVersions', (body) =>
      pageOf(body, [version2('DRAFT'), version1('SUPERSEDED')]),
    );
    api.rewrite('getBusinessAccount', onHold);
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    await signIn(page, USERS.sales, `/quotes/${QUOTE_ID}`);
    await expect(page.getByRole('heading', { name: QUOTE_NO })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit the draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send to the customer' })).toBeVisible();

    await page.goto(`/business-accounts/${CUSTOMER.id}`);
    await expect(page.getByRole('heading', { name: 'How late' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the terms' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Put on hold' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Release from hold' })).toHaveCount(0);

    // An override is never Sales' to approve: the approval is denied in words.
    await page.goto(`/approvals/${OVERRIDE_APPROVAL_ID}`);
    await expect(page.getByText(/iam\.approval\.read/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('the Accountant may put an account on hold, and neither releases it nor changes the limit', async ({
    page,
    api,
  }) => {
    const held = () => api.log.some((e) => e.operationId === 'holdBusinessAccount');
    api.rewrite('getBusinessAccount', (body) =>
      held() ? onHold(body) : chopBarAccount(body as S['BusinessAccount']),
    );
    api.rewrite('holdBusinessAccount', onHold);
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    await signInWithTotp(page, USERS.accountantEnrolled, `/business-accounts/${CUSTOMER.id}`);
    await expect(page.getByRole('heading', { name: CUSTOMER.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the terms' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Put on hold' }).click();
    const hold = page.getByRole('dialog', { name: `Put ${CUSTOMER.name} on hold?` });
    await hold.getByRole('textbox').fill('Cheque returned unpaid');
    await hold.getByRole('button', { name: 'Put on hold' }).click();
    await expect(page.getByText(`${CUSTOMER.name} is on hold`)).toBeVisible();
    await expect(page.getByText(/^On hold since/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release from hold' })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('an Owner or Manager asks for a release, which waits for a second person (2.14.0)', async ({
    page,
    api,
  }) => {
    const asked = () => api.log.some((e) => e.operationId === 'releaseBusinessAccount');
    api.rewrite('getBusinessAccount', (body) => ({ ...onHold(body), pendingRelease: asked() }));
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    api.respond(
      'releaseBusinessAccount',
      () => ({
        status: 'PENDING_APPROVAL',
        approvalRequestId: OVERRIDE_APPROVAL_ID,
        kind: 'ACCOUNT_RELEASE',
        subject: { id: CUSTOMER.id, docType: 'BUSINESS_ACCOUNT', number: null },
        summary: 'Awaiting approval by a different user with the approving permission',
        requestedAt: '2026-11-17T13:00:00Z',
      }),
      202,
    );
    await signInWithTotp(page, USERS.manager, `/business-accounts/${CUSTOMER.id}`);
    await expect(page.getByText(/^On hold since/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the terms' })).toBeVisible();
    await page.getByRole('button', { name: 'Release from hold' }).click();
    const release = page.getByRole('dialog', { name: `Release ${CUSTOMER.name} from hold?` });
    await release.getByRole('textbox').fill('Cheque cleared this morning');
    await release.getByRole('button', { name: 'Release from hold' }).click();
    await expect(
      page.getByText('The release waits for an Owner or Manager other than you'),
    ).toBeVisible();
    // The account, read again, says so, stays on hold, and offers no second release.
    await expect(
      page.getByText(/^A release from hold waits for an Owner or Manager/),
    ).toBeVisible();
    await expect(page.getByText(/^On hold since/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release from hold' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('changing the terms sends the limit only when it changes, and never a price list (2.14.0)', async ({
    page,
    api,
  }) => {
    const bodies: Record<string, unknown>[] = [];
    api.rewrite('getBusinessAccount', (body) => chopBarAccount(body as S['BusinessAccount']));
    api.rewrite('getAgeingReport', (body) => chopBarAgeing(body as S['AgeingReport']));
    api.respond('updateBusinessAccount', (request) => {
      bodies.push(request as Record<string, unknown>);
      return 'creditLimitPesewas' in (request as object)
        ? {
            status: 'PENDING_APPROVAL',
            approvalRequestId: OVERRIDE_APPROVAL_ID,
            kind: 'CREDIT_LIMIT_CHANGE',
            subject: { id: CUSTOMER.id, docType: 'BUSINESS_ACCOUNT', number: null },
            summary: 'Awaiting approval by a different user with the approving permission',
            requestedAt: '2026-11-17T13:00:00Z',
          }
        : chopBarAccount({} as S['BusinessAccount']);
    });
    await signInWithTotp(page, USERS.manager, `/business-accounts/${CUSTOMER.id}`);
    await page.getByRole('button', { name: 'Change the terms' }).click();
    const form = page.getByRole('form', { name: 'Change the terms' });
    // A buyer's prices are given on the price list now, never on the account.
    await expect(form.getByLabel('Price list')).toHaveCount(0);
    await form.getByLabel('Payment terms', { exact: false }).fill('45');
    await form.getByRole('button', { name: 'Save the terms' }).click();
    await expect(page.getByText(`The terms for ${CUSTOMER.name} were saved`)).toBeVisible();
    expect(bodies[0]).toMatchObject({ paymentTermsDays: 45 });
    expect(bodies[0]).not.toHaveProperty('creditLimitPesewas');
    expect(bodies[0]).not.toHaveProperty('priceListId');

    await page.getByRole('button', { name: 'Change the terms' }).click();
    await form.getByLabel('Credit limit', { exact: false }).fill('6000');
    await form.getByLabel('Why this limit').fill('Two years paying on time');
    await form.getByRole('button', { name: 'Save the terms' }).click();
    await expect(
      page.getByText('The new limit waits for an Owner or Manager other than you'),
    ).toBeVisible();
    expect(bodies[1]).toMatchObject({
      creditLimitPesewas: 600000,
      reason: 'Two years paying on time',
    });
    await expectNoAxeViolations(page);
  });
});
