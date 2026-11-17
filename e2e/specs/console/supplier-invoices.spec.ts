import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';
import { EGGS_ID, ORDER_ID, ORDER_LINE_ID, seedEggs, SUPPLIER } from '../../support/eggs';
import {
  ACCOUNTANT,
  APPROVAL_ID,
  CLAIM_ID,
  CREDIT_NOTE_ID,
  claimCreditNote,
  eggClaim,
  eggPayment,
  FARM_INPUTS,
  INVOICE_ID,
  OWNER,
  PAYMENT_ID,
  paymentApproval,
  RECEIPT_LINE_ID,
  rightInvoice,
  seedPayables,
  wrongInvoice,
} from '../../support/payables';
import type { components } from '@hakorem/api-client';

/**
 * Supplier invoices and payment (F10g, contract 2.4.0): the owner pays the egg supplier. An invoice is
 * entered against its purchase order and the receipt the eggs came in on, the three-way match says which
 * line disagrees and by how much, the invoice is approved for payment, and the payment is prepared by one
 * person and approved by another, then recorded as paid. The claim for the cracked crates is settled by an
 * invoice or turned into a credit note, and the supplier's account shows the server's balance (CR-042,
 * requested). The suite runs at 360 px. Every amount shown is the API's: the browser adds nothing up.
 */

type S = components['schemas'];
type Page<T> = { data: T[]; page: unknown };

const pageOf = <T>(body: unknown, rows: T[]) => ({ ...(body as Page<T>), data: rows });
/** The example page's first row, for a fixture to reshape. */
function first<T>(body: unknown): T {
  const row = (body as Page<T>).data[0];
  if (row === undefined) throw new Error('The example page has no row.');
  return row;
}
const posted = (path: string) => (r: { method: () => string; url: () => string }) =>
  r.method() === 'POST' && new URL(r.url()).pathname === `/mock${path}`;

test.describe('entering a supplier invoice and the three-way match', () => {
  test('an invoice is entered against its order and receipt; the match says which line disagrees and by how much', async ({
    page,
    api,
  }) => {
    seedEggs(api);
    seedPayables(api);
    const checked = () => api.log.some((e) => e.operationId === 'matchSupplierInvoice');
    api.rewrite('createSupplierInvoice', (body) =>
      wrongInvoice(body as S['SupplierInvoice'], 'entered'),
    );
    api.rewrite('getSupplierInvoice', (body) =>
      wrongInvoice(body as S['SupplierInvoice'], checked() ? 'checked' : 'entered'),
    );
    api.rewrite('matchSupplierInvoice', (body) =>
      wrongInvoice(body as S['SupplierInvoice'], 'checked'),
    );

    await signInWithTotp(page, USERS.owner, '/supplier-invoices/new');
    await expect(page.getByRole('heading', { name: 'Enter a supplier invoice' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Supplier/ }).click();
    await page.getByRole('option', { name: `${SUPPLIER.name} (${SUPPLIER.publicId})` }).click();
    await page.getByRole('combobox', { name: /^Purchase order/ }).click();
    await page.getByRole('option', { name: 'PO-2026-DDW-000052' }).click();
    await page.getByRole('combobox', { name: /^Goods receipt/ }).click();
    await page.getByRole('option', { name: 'GRN-2026-DDW-000081' }).click();
    await page.getByLabel(/^Supplier's invoice number/).fill('AWT-0471');

    // The order line and the receipt line, as the API holds them: ordered in crates, eggs booked.
    const line = page.getByRole('heading', { name: 'Line 1, Eggs, big' }).locator('..');
    await expect(line).toContainText('47.50');
    await expect(line).toContainText('540');
    await expect(line).toContainText('Turned away');
    // What the supplier's paper says: 21 crates at GH₵48.00.
    await page.getByLabel(/^Invoiced, in Crate, line 1/).fill('21');
    await page.getByLabel(/^Price per Crate, GHS, line 1/).fill('48.00');
    await page.getByRole('combobox', { name: /^Tax category, line 1/ }).click();
    await page.getByRole('option', { name: FARM_INPUTS.name }).click();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    const sent = page.waitForRequest(posted('/supplier-invoices'));
    await page.getByRole('button', { name: 'Save the invoice' }).click();
    const body = (await sent).postDataJSON() as S['SupplierInvoiceCreate'];
    expect(body).toMatchObject({
      kind: 'INVOICE',
      supplierId: SUPPLIER.id,
      supplierInvoiceNo: 'AWT-0471',
      purchaseOrderId: ORDER_ID,
    });
    // Crates and pesewas as typed; the server converts, prices and totals.
    expect(body.lines).toEqual([
      {
        productId: EGGS_ID,
        description: 'Eggs, big',
        purchaseOrderLineId: ORDER_LINE_ID,
        goodsReceiptLineId: RECEIPT_LINE_ID,
        qty: '21.000',
        unitPricePesewas: 4800,
        taxCategoryId: FARM_INPUTS.id,
      },
    ]);

    await expect(page.getByRole('heading', { name: 'Invoice AWT-0471' })).toBeVisible();
    await expect(page.getByText('Not checked against the order yet')).toBeVisible();
    await expect(page.getByText('1,008.00').first()).toBeVisible();
    await page.getByRole('button', { name: 'Check against the order and receipt' }).click();

    // The match, from the API: which line disagrees, why, and by how much.
    const result = page
      .getByRole('alert')
      .filter({ hasText: '1 line disagrees with the order or what was received' });
    await expect(result).toBeVisible();
    const disagreement = result.getByRole('region', { name: 'Line 1' });
    await expect(disagreement).toContainText('It charges for more than was received.');
    await expect(disagreement).toContainText('1 Crate more than was received.');
    await expect(disagreement).toContainText(
      "Its price is more than 1 percent away from the order's price.",
    );
    await expect(disagreement).toContainText("GH₵10.50 over the order's price on this line.");
    // Goods not received cannot be paid on a variance, and a mismatch cannot be approved.
    await expect(page.getByRole('button', { name: 'Ask to pay it as invoiced' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Approve for payment' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a refused approval stays on the page in words after its dialog closes', async ({
    page,
    api,
  }) => {
    api.rewrite('getSupplierInvoice', (body) =>
      rightInvoice(body as S['SupplierInvoice'], 'MATCHED'),
    );
    api.refuse(
      'approveSupplierInvoice',
      422,
      'THREE_WAY_MATCH_FAILED',
      'Line 1 no longer matches what was received.',
    );
    await signInWithTotp(page, USERS.owner, `/supplier-invoices/${INVOICE_ID}`);
    await expect(
      page.getByText('Every line matches the order and what was received'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Approve for payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve Invoice AWT-0471 for payment?' });
    await expect(dialog).toContainText('855.00');
    await dialog.getByRole('button', { name: 'Approve for payment' }).click();
    const words = 'The invoice does not match its order and what was received.';
    await expect(dialog.getByRole('alert')).toContainText(words);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    const kept = page.getByRole('alert').filter({ hasText: 'The invoice was not approved' });
    await expect(kept).toContainText(words);
    await expectNoAxeViolations(page);
  });

  test('the corrected invoice matches and is approved for payment', async ({ page, api }) => {
    const approved = () => api.log.some((e) => e.operationId === 'approveSupplierInvoice');
    api.rewrite('getSupplierInvoice', (body) =>
      rightInvoice(body as S['SupplierInvoice'], approved() ? 'APPROVED' : 'MATCHED'),
    );
    api.rewrite('approveSupplierInvoice', (body) =>
      rightInvoice(body as S['SupplierInvoice'], 'APPROVED'),
    );
    await signInWithTotp(page, USERS.owner, `/supplier-invoices/${INVOICE_ID}`);
    await page.getByRole('button', { name: 'Approve for payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve Invoice AWT-0471 for payment?' });
    await dialog.getByRole('button', { name: 'Approve for payment' }).click();
    await expect(page.getByText('Invoice AWT-0471 is approved for payment')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pay this invoice' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('paying the supplier, with a different person approving', () => {
  test('a payment is prepared on the approved invoice and sent for approval; its maker cannot approve it', async ({
    page,
    api,
  }) => {
    const sentForApproval = () => api.log.some((e) => e.operationId === 'submitSupplierPayment');
    api.rewrite('getSupplierInvoice', (body) =>
      rightInvoice(body as S['SupplierInvoice'], 'APPROVED'),
    );
    api.rewrite('listSupplierInvoices', (body) =>
      pageOf(body, [rightInvoice(first<S['SupplierInvoice']>(body), 'APPROVED')]),
    );
    api.rewrite('createSupplierPayment', (body) =>
      eggPayment(body as S['SupplierPayment'], 'DRAFT'),
    );
    api.rewrite('getSupplierPayment', (body) =>
      eggPayment(body as S['SupplierPayment'], sentForApproval() ? 'PENDING_APPROVAL' : 'DRAFT'),
    );
    api.prefer('submitSupplierPayment', 'code=202');
    api.rewrite('submitSupplierPayment', (body) => ({
      ...(body as object),
      approvalRequestId: APPROVAL_ID,
      kind: 'SUPPLIER_PAYMENT',
    }));
    api.rewrite('getApproval', (body) =>
      paymentApproval(body as Record<string, unknown>, OWNER, { canDecide: false }),
    );

    await signInWithTotp(page, USERS.owner, `/supplier-invoices/${INVOICE_ID}`);
    await page.getByRole('link', { name: 'Pay this invoice' }).click();
    await expect(page.getByRole('heading', { name: 'Prepare a payment' })).toBeVisible();
    // The invoice it was opened from, with what the API says is still owed on it.
    await expect(page.getByRole('checkbox', { name: 'Pay invoice AWT-0471' })).toBeChecked();
    await expect(page.getByLabel(/^Amount on invoice AWT-0471, GHS/)).toHaveValue('855.00');
    await page.getByRole('combobox', { name: /^How it is paid/ }).click();
    await page.getByRole('option', { name: 'Mobile money' }).click();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    const sent = page.waitForRequest(posted('/supplier-payments'));
    await page.getByRole('button', { name: 'Save the payment' }).click();
    expect((await sent).postDataJSON()).toEqual({
      supplierId: SUPPLIER.id,
      method: 'MOBILE_MONEY',
      allocations: [{ supplierInvoiceId: INVOICE_ID, amountPesewas: 85500 }],
    });

    await expect(
      page.getByRole('heading', { name: 'Payment to Awutu Poultry Farm' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Send for approval' }).click();
    const dialog = page.getByRole('dialog', { name: 'Send this payment for approval?' });
    await expect(dialog).toContainText('whoever prepares a supplier payment cannot approve it');
    await expect(dialog).toContainText('855.00');
    await dialog.getByRole('button', { name: 'Send for approval' }).click();
    const waits = page.getByRole('alert').filter({ hasText: 'The payment waits for approval' });
    await expect(waits).toContainText('Someone other than you must approve it.');
    await waits.getByRole('link', { name: 'Open the approval' }).click();

    // The approval knows its maker: no Approve, and why.
    await expect(page.getByText('You asked for this, so you cannot decide it')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    expect(api.log.filter((e) => e.operationId === 'approveRequest')).toHaveLength(0);
  });

  test("the server refuses the payment's maker at approval, and the refusal stays in words", async ({
    page,
    api,
  }) => {
    // The Owner prepared the payment and the Accountant sent it: the inbox cannot tell, the server can.
    api.rewrite('getApproval', (body) =>
      paymentApproval(body as Record<string, unknown>, ACCOUNTANT),
    );
    api.refuse(
      'approveRequest',
      422,
      'MAKER_CANNOT_CHECK',
      'The maker of a supplier payment cannot be its checker.',
    );
    await signInWithTotp(page, USERS.owner, `/approvals/${APPROVAL_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Supplier payment' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: /^Approve this/ });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('It was not approved');
    await expect(alert).toContainText('You made this request, so you cannot approve or reject it.');
    await expectNoAxeViolations(page);
  });

  test('a different person approves the payment', async ({ page, api }) => {
    api.rewrite('getApproval', (body) => paymentApproval(body as Record<string, unknown>, OWNER));
    api.rewrite('approveRequest', (body) =>
      paymentApproval(body as Record<string, unknown>, OWNER, {
        status: 'APPROVED',
        canDecide: false,
      }),
    );
    await signInWithTotp(page, USERS.manager, `/approvals/${APPROVAL_ID}`);
    await expect(page.getByText('855.00').first()).toBeVisible();
    // The approval opens the payment it is about.
    await expect(page.getByRole('link', { name: 'Open the record' })).toHaveAttribute(
      'href',
      `/supplier-payments/${PAYMENT_ID}`,
    );
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog', { name: /^Approve this/ });
    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved. It has taken effect.')).toBeVisible();
    expect(api.log.filter((e) => e.operationId === 'approveRequest')).toHaveLength(1);
  });

  test('the approved payment is recorded as paid with its reference, and its remittance advice shows', async ({
    page,
    api,
  }) => {
    const paid = () => api.log.some((e) => e.operationId === 'markSupplierPaymentPaid');
    api.rewrite('getSupplierPayment', (body) =>
      eggPayment(body as S['SupplierPayment'], paid() ? 'PAID' : 'APPROVED'),
    );
    api.rewrite('markSupplierPaymentPaid', (body) =>
      eggPayment(body as S['SupplierPayment'], 'PAID'),
    );
    api.rewrite('getSupplierPaymentRemittance', (body) => ({
      ...(body as object),
      supplierPaymentId: PAYMENT_ID,
      paymentNo: 'SPY-2026-DDW-000007',
      supplier: SUPPLIER,
      amountPesewas: 85500,
      lines: [
        {
          supplierInvoiceId: INVOICE_ID,
          supplierInvoiceNo: 'AWT-0471',
          invoiceDate: '2026-11-18',
          grossPesewas: 85500,
          creditedPesewas: 0,
          amountPesewas: 85500,
          outstandingAfterPesewas: 0,
        },
      ],
    }));
    await signInWithTotp(page, USERS.owner, `/supplier-payments/${PAYMENT_ID}`);
    await page.getByRole('button', { name: 'Record as paid' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record this payment as paid?' });
    await dialog.getByLabel(/^Paid on/).fill('2026-11-18');
    await dialog.getByLabel(/^Paid at/).fill('2.30 pm');
    await dialog.getByLabel(/^Reference/).fill('MP261118.1430.A17');
    await dialog.getByRole('button', { name: 'Record as paid' }).click();
    await expect(dialog).toContainText('Enter the time as hours and minutes, such as 14:30.');
    expect(api.log.filter((e) => e.operationId === 'markSupplierPaymentPaid')).toHaveLength(0);
    await dialog.getByLabel(/^Paid at/).fill('14:30');
    await expectNoAxeViolations(page);
    const sent = page.waitForRequest(posted(`/supplier-payments/${PAYMENT_ID}/mark-paid`));
    await dialog.getByRole('button', { name: 'Record as paid' }).click();
    // Accra is UTC: the time typed is the instant.
    expect((await sent).postDataJSON()).toEqual({
      paidAt: '2026-11-18T14:30:00Z',
      externalReference: 'MP261118.1430.A17',
    });
    await expect(page.getByText('The payment is recorded as paid')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SPY-2026-DDW-000007' })).toBeVisible();
    const remittance = page.getByRole('region', { name: 'Remittance advice' });
    await expect(remittance).toContainText('Invoice AWT-0471');
    await expect(remittance).toContainText('855.00');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('settling the claim for the cracked crates', () => {
  test('the claim is settled by the invoice that left the cracked crates out', async ({
    page,
    api,
  }) => {
    const settled = () => api.log.some((e) => e.operationId === 'settleSupplierClaim');
    api.rewrite('getSupplierClaim', (body) =>
      eggClaim(body as S['SupplierClaim'], settled() ? { by: 'INVOICE' } : null),
    );
    api.rewrite('settleSupplierClaim', (body) =>
      eggClaim(body as S['SupplierClaim'], { by: 'INVOICE' }),
    );
    api.rewrite('listSupplierInvoices', (body) =>
      pageOf(body, [rightInvoice(first<S['SupplierInvoice']>(body), 'APPROVED')]),
    );
    await signInWithTotp(page, USERS.owner, `/supplier-claims/${CLAIM_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Claim on receipt GRN-2026-DDW-000081' }),
    ).toBeVisible();
    // Each rejected line with the value the server put on it: 60 eggs, a tenth of the delivery.
    const lines = page.getByRole('region', { name: 'What was turned away' });
    await expect(lines).toContainText('60');
    await expect(lines).toContainText('per Crate');
    await expect(lines).toContainText('95.00');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Settle by an invoice' }).click();
    const dialog = page.getByRole('dialog', { name: 'Settle the claim by an invoice?' });
    await dialog.getByRole('combobox', { name: /^Invoice/ }).click();
    await page.getByRole('option', { name: 'Invoice AWT-0471' }).click();
    const sent = page.waitForRequest(posted(`/supplier-claims/${CLAIM_ID}/settle`));
    await dialog.getByRole('button', { name: 'Settle by an invoice' }).click();
    expect((await sent).postDataJSON()).toEqual({ supplierInvoiceId: INVOICE_ID });
    const done = page.getByRole('status').filter({ hasText: 'The claim is settled' });
    await expect(done).toContainText('Settled by Invoice AWT-0471');
  });

  test("or the claim becomes a credit note with the claim's value, which waits for another person's approval", async ({
    page,
    api,
  }) => {
    const submitted = () => api.log.some((e) => e.operationId === 'submitSupplierCreditNote');
    api.rewrite('getSupplierClaim', (body) => eggClaim(body as S['SupplierClaim']));
    api.rewrite('listSupplierInvoices', (body) =>
      pageOf(body, [rightInvoice(first<S['SupplierInvoice']>(body), 'APPROVED')]),
    );
    api.rewrite('draftSupplierClaimCreditNote', (body) =>
      claimCreditNote(body as S['SupplierInvoice']),
    );
    api.rewrite('getSupplierInvoice', (body) => ({
      ...claimCreditNote(body as S['SupplierInvoice']),
      approvalRequestId: submitted() ? APPROVAL_ID : null,
    }));
    api.rewrite('submitSupplierCreditNote', (body) => ({
      ...(body as object),
      approvalRequestId: APPROVAL_ID,
      kind: 'SUPPLIER_CREDIT_NOTE',
    }));
    await signInWithTotp(page, USERS.owner, `/supplier-claims/${CLAIM_ID}`);
    await page.getByRole('button', { name: 'Turn it into a credit note' }).click();
    const dialog = page.getByRole('dialog', { name: 'Turn the claim into a credit note?' });
    await dialog.getByRole('combobox', { name: /^Invoice/ }).click();
    await page.getByRole('option', { name: 'Invoice AWT-0471' }).click();
    await dialog.getByLabel(/^Supplier's credit note number/).fill('AWT-CN-12');
    await dialog.getByLabel(/^Credit note date/).fill('2026-11-18');
    await expectNoAxeViolations(page);
    const sent = page.waitForRequest(posted(`/supplier-claims/${CLAIM_ID}/credit-note`));
    await dialog.getByRole('button', { name: 'Turn it into a credit note' }).click();
    // Only the invoice, the supplier's number and its date: the lines and amounts are the claim's.
    expect((await sent).postDataJSON()).toEqual({
      originalInvoiceId: INVOICE_ID,
      supplierInvoiceNo: 'AWT-CN-12',
      invoiceDate: '2026-11-18',
    });
    await expect(page).toHaveURL(new RegExp(`/supplier-invoices/${CREDIT_NOTE_ID}$`));
    await expect(page.getByRole('heading', { name: 'Credit note AWT-CN-12' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the claim' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Invoice lines' })).toContainText(
      "The claim's value",
    );
    await page.getByRole('button', { name: 'Send for approval' }).click();
    const send = page.getByRole('dialog', { name: 'Send Credit note AWT-CN-12 for approval?' });
    await send.getByRole('button', { name: 'Send for approval' }).click();
    const waits = page
      .getByRole('alert')
      .filter({ hasText: 'Credit note AWT-CN-12 waits for approval' });
    await expect(waits.getByRole('link', { name: 'Open the approval' })).toHaveAttribute(
      'href',
      `/approvals/${APPROVAL_ID}`,
    );
    await expectNoHorizontalScroll(page);
  });
});

test.describe("the supplier's account", () => {
  test("shows the server's balance, and each invoice still owed, open claim and payment", async ({
    page,
    api,
  }) => {
    seedPayables(api);
    api.rewrite('getSupplier', (body) => ({ ...(body as object), ...SUPPLIER }));
    api.rewrite('listSupplierInvoices', (body) =>
      pageOf(body, [rightInvoice(first<S['SupplierInvoice']>(body), 'APPROVED')]),
    );
    api.rewrite('listSupplierClaims', (body) =>
      pageOf(body, [eggClaim(first<S['SupplierClaim']>(body))]),
    );
    api.rewrite('listSupplierPayments', (body) => pageOf(body, []));
    await signInWithTotp(page, USERS.owner, '/suppliers');
    await page.getByRole('link', { name: "Awutu Poultry Farm's account" }).click();
    await expect(page.getByRole('heading', { name: "Awutu Poultry Farm's account" })).toBeVisible();
    // CR-042 (requested): every figure is the server's.
    const balance = page.getByRole('region', { name: 'Balance' });
    await expect(balance).toContainText('Owed on approved invoices');
    await expect(balance).toContainText('855.00');
    await expect(balance).toContainText('Claimed back');
    await expect(balance).toContainText('95.00');
    await expect(page.getByRole('link', { name: 'Invoice AWT-0471' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Claim on receipt GRN-2026-DDW-000081' }),
    ).toBeVisible();
    await expect(page.getByText('No payments yet')).toBeVisible();
    expect(api.log.some((e) => e.operationId === 'getSupplierBalance')).toBe(true);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('the supplier invoices list says how each one matched', async ({ page, api }) => {
    api.rewrite('listSupplierInvoices', (body) =>
      pageOf(body, [wrongInvoice(first<S['SupplierInvoice']>(body), 'checked')]),
    );
    await signInWithTotp(page, USERS.owner, '/supplier-invoices');
    await expect(page.getByRole('heading', { name: 'Supplier invoices' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Invoice AWT-0471' })).toBeVisible();
    await expect(page.getByText('Does not match').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });

  test('a cashier is told they cannot see supplier invoices', async ({ page }) => {
    await signIn(page, USERS.cashier, '/supplier-invoices');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('You do not have access to this page');
    await expect(alert).toContainText('pur.supplier_invoice.read');
  });
});
