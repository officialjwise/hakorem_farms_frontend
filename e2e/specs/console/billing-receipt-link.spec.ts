import type { components } from '@hakorem/api-client';
import { FakeApi } from '../../support/fakeApi';
import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * A supervisor revokes the till's receipt link from the receipt's page at 360 px (2.26.0,
 * `revokeReceiptLink`): with a reason, after a step-up, and the answer stays on the page. Refusals stay in
 * words; a cashier is never offered it; a receipt the till did not sync offers nothing.
 */

type S = components['schemas'];
type Body = S['ReasonRequest'];

const RECEIPT = '019a7ae2-fd46-7b80-a0b9-c0e09cf739be';
const NAME = 'Receipt RCP-2026-DDW-T1-018834';
const SALE = '019a7c1e-2b40-7c11-8a3e-5d0b6f1e2a77';

/** The receipt as the till's offline sync made it: issued, of a counter sale, synced from offline. */
function syncedReceipt(api: FakeApi, synced = true) {
  api.rewrite('getBillingDocument', (body) => ({
    ...(body as S['BillingDocument']),
    kind: 'RECEIPT',
    status: 'ISSUED',
    order: { id: SALE, docType: 'SALES_ORDER', number: 'ORD-2026-DDW-T1-018834' },
    syncedFromOffline: synced,
  }));
}

test('a manager revokes the receipt link with a reason, and the page keeps who did and why', async ({
  page,
  api,
}) => {
  syncedReceipt(api);
  const sent: { path: string; body: Body }[] = [];
  api.respond('revokeReceiptLink', (request, path): S['ReceiptLinkRevocation'] => {
    const body = request as Body;
    sent.push({ path, body });
    return {
      saleId: SALE,
      reason: body.reason,
      revokedAt: '2026-11-25T10:42:00Z',
      revokedBy: { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', displayName: 'Kwabena Owusu' },
    };
  });
  await signInWithTotp(page, USERS.manager, `/billing-documents/${RECEIPT}`);
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  const part = page.locator('[data-slot="receipt-link-revoke"]');
  await expect(part.getByRole('heading', { name: 'The till’s receipt link' })).toBeVisible();
  await part.getByRole('button', { name: 'Revoke the receipt link' }).click();

  const dialog = page.getByRole('dialog', {
    name: 'Revoke the receipt link of RCP-2026-DDW-T1-018834?',
  });
  await expect(dialog).toContainText('The link stops working at once');
  await dialog.getByRole('textbox').fill('Sent to the wrong number');
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Revoke the link' }).click();

  await expect(part).toContainText('The receipt link is revoked');
  await expect(part).toContainText('Revoked by Kwabena Owusu: Sent to the wrong number.');
  await expect(part.getByRole('button', { name: 'Revoke the receipt link' })).toHaveCount(0);
  expect(sent).toEqual([
    {
      path: `/pos/sales/${SALE}/revoke-receipt-link`,
      body: { reason: 'Sent to the wrong number' },
    },
  ]);
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a link already revoked is refused in words, with its reference', async ({ page, api }) => {
  syncedReceipt(api);
  api.refuse('revokeReceiptLink', 422, 'RECEIPT_LINK_INVALID', 'Already revoked.');
  await signInWithTotp(page, USERS.manager, `/billing-documents/${RECEIPT}`);
  const part = page.locator('[data-slot="receipt-link-revoke"]');
  await part.getByRole('button', { name: 'Revoke the receipt link' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Revoke the receipt link of RCP-2026-DDW-T1-018834?',
  });
  await dialog.getByRole('textbox').fill('Shown to the wrong customer');
  await dialog.getByRole('button', { name: 'Revoke the link' }).click();
  await expect(dialog).toContainText(/reference/i);
  await page.keyboard.press('Escape');
  await expect(part).toContainText('The receipt link was not revoked');
  await expect(part).toContainText('The receipt link was not changed.');
  await expect(part).toContainText(/reference/i);
  await expectNoAxeViolations(page);
});

test('a receipt the till did not sync offers no revoke, and a cashier is never offered it', async ({
  page,
  api,
  browser,
}) => {
  syncedReceipt(api, false);
  await signInWithTotp(page, USERS.manager, `/billing-documents/${RECEIPT}`);
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await expect(page.locator('[data-slot="receipt-link-revoke"]')).toHaveCount(0);

  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    baseURL: test.info().project.use.baseURL,
  });
  const cashierApi = new FakeApi();
  await cashierApi.install(context);
  syncedReceipt(cashierApi);
  const cashier = await context.newPage();
  await signIn(cashier, USERS.cashier, `/billing-documents/${RECEIPT}`);
  await expect(cashier.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await expect(cashier.locator('[data-slot="receipt-link-revoke"]')).toHaveCount(0);
  await context.close();
});
