import type { Page } from '@playwright/test';
import type { components } from '@hakorem/api-client';
import { expectNoAxeViolations, expectNoHorizontalScroll } from '../../support/helpers';
import { expect, test } from '../../support/test';
import { installTillServer, openTillShift, type SentSale } from '../../support/till';

/**
 * An invoice paid in cash at the till's shift at 360 px (2.26.0, `payInvoiceAtTill`): the cashier finds the
 * invoice by its number (`listBillingDocuments`), enters what is paid and what was handed over, confirms the
 * exact amounts, and the server's change and what is still outstanding stay on screen. A refusal stays in
 * words with its reference; a settled invoice is not offered; offline, it waits for the network.
 */

type S = components['schemas'];
type Body = S['TillInvoicePaymentCreate'];

const serverTotal = (sale: SentSale) => sale.tenders.reduce((sum, t) => sum + t.amountPesewas, 0);
const INVOICE_ID = '019a7b52-6c10-7e3a-9d41-2f8b0c6a1e55';
const INVOICE_NO = 'INV-2026-DDW-000014';

/** The invoice the till finds: Prism's first document, made an issued invoice with GH₵425.60 outstanding. */
function installInvoice(
  api: Parameters<typeof installTillServer>[0],
  outstandingPesewas = 42560,
): void {
  api.rewrite('listBillingDocuments', (body) => {
    const page = body as S['BillingDocumentPage'];
    const first = page.data[0];
    if (first === undefined) throw new Error('Prism listed no billing document');
    return {
      ...page,
      data: [
        {
          ...first,
          id: INVOICE_ID,
          kind: 'INVOICE',
          status: 'ISSUED',
          documentNo: INVOICE_NO,
          customerName: 'Akosua Bakery',
          order: null,
          grossPesewas: 62560,
          settlement: {
            ...first.settlement,
            allocatedPesewas: 62560 - outstandingPesewas,
            outstandingPesewas,
            paymentStatus: outstandingPesewas === 0 ? 'PAID' : 'PART_PAID',
          },
        },
      ],
    };
  });
}

async function toShift(page: Page) {
  await page.getByRole('link', { name: 'Shift', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift SH-2026-DDW-T1-0312' })).toBeVisible();
}

async function find(page: Page) {
  const part = page.locator('[data-slot="invoice-payment"]');
  await part.getByRole('textbox', { name: /^Invoice or receipt number/ }).fill(INVOICE_NO);
  await part.getByRole('button', { name: 'Find it' }).click();
  await expect(part.locator('[data-slot="invoice-found"]')).toContainText(INVOICE_NO);
  return part;
}

test('an invoice is paid in part in cash, and the server’s change and balance stay on screen', async ({
  page,
  api,
}) => {
  installTillServer(api, serverTotal);
  installInvoice(api);
  const bodies: { path: string; body: Body }[] = [];
  api.respond(
    'payInvoiceAtTill',
    (request, path): S['TillInvoicePayment'] => {
      const body = request as Body;
      bodies.push({ path, body });
      return {
        paymentId: '019a7c2f-0a91-7b44-8e2d-6f3a1c9b0d12',
        shiftId: path.split('/')[2] ?? '',
        billingDocument: { id: INVOICE_ID, documentNo: INVOICE_NO },
        amountPesewas: body.amountPesewas,
        tenderedPesewas: body.tenderedPesewas ?? body.amountPesewas,
        changeDuePesewas: 0,
        outstandingPesewas: 22560,
        currency: 'GHS',
      };
    },
    201,
  );
  await openTillShift(page);
  await toShift(page);
  const part = await find(page);
  const found = part.locator('[data-slot="invoice-found"]');
  await expect(found).toContainText('Akosua Bakery');
  await expect(found).toContainText('Still to payGH₵425.60');

  // Checked before asking: nothing entered, then more than is outstanding.
  await part.getByRole('button', { name: 'Review the payment' }).click();
  await expect(part).toContainText('Enter what the customer pays off it, above zero.');
  await part.getByRole('textbox', { name: /^Amount paid off it/ }).fill('500');
  await part.getByRole('button', { name: 'Review the payment' }).click();
  await expect(part).toContainText('That is more than is still to pay.');

  await part.getByRole('textbox', { name: /^Amount paid off it/ }).fill('200');
  await part.getByRole('textbox', { name: /^Cash handed over/ }).fill('200');
  await part.getByRole('button', { name: 'Review the payment' }).click();
  const confirm = page.getByRole('dialog', { name: 'Take this cash for the invoice?' });
  await expect(confirm).toContainText(`The cash is paid off ${INVOICE_NO} now.`);
  await expect(confirm).toContainText('Amount paid off it (GH₵)GH₵200.00');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Take the payment' }).click();

  const done = part.locator('[data-slot="invoice-paid"]');
  await expect(done).toContainText(`Paid at the till: ${INVOICE_NO}`);
  await expect(done).toContainText('Paid off itGH₵200.00');
  await expect(done).toContainText('Change to give backGH₵0.00');
  await expect(done).toContainText('Still to pay on itGH₵225.60');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]?.path).toMatch(/^\/shifts\/[0-9a-f-]{36}\/invoice-payments$/);
  expect(bodies[0]?.body).toEqual({
    billingDocumentId: INVOICE_ID,
    amountPesewas: 20000,
    tenderedPesewas: 20000,
  });
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a refused payment stays on screen in words, with its reference', async ({ page, api }) => {
  installTillServer(api, serverTotal);
  installInvoice(api);
  api.refuse(
    'payInvoiceAtTill',
    422,
    'TILL_INVOICE_PAYMENT_INVALID',
    'The invoice belongs to another branch.',
  );
  await openTillShift(page);
  await toShift(page);
  const part = await find(page);
  await part.getByRole('textbox', { name: /^Amount paid off it/ }).fill('100');
  await part.getByRole('button', { name: 'Review the payment' }).click();
  const confirm = page.getByRole('dialog', { name: 'Take this cash for the invoice?' });
  await confirm.getByRole('button', { name: 'Take the payment' }).click();
  await expect(confirm).toContainText('The invoice payment was not taken');
  await page.keyboard.press('Escape');
  await expect(part).toContainText('The invoice payment was not taken at the till.');
  await expect(part).toContainText('Reference');
  await expect(part.locator('[data-slot="invoice-paid"]')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('a settled invoice is not offered, and offline the payment waits for the network', async ({
  page,
  api,
  context,
}) => {
  installTillServer(api, serverTotal);
  installInvoice(api, 0);
  await openTillShift(page);
  await toShift(page);
  const part = await find(page);
  await expect(part).toContainText('Nothing is outstanding on this document.');
  await expect(part.getByRole('button', { name: 'Review the payment' })).toHaveCount(0);
  await api.setNetwork(context, false);
  await expect(part).toContainText(
    'The till is offline. An invoice is paid at the till only while it reaches the server.',
  );
  await expectNoHorizontalScroll(page);
});
