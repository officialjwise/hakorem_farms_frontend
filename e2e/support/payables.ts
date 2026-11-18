/**
 * The supplier invoice session's fixtures (F10g, contract 2.4.0): the egg order of the buying session
 * (20 crates of big eggs at GH₵47.50 a crate from Awutu Poultry Farm), its receipt (18 crates in, 2 cracked
 * crates turned away), the claim for those 2 crates, the supplier's invoices, a payment and the supplier's
 * balance (`getSupplierBalance`, CR-042 as it landed in 2.9.0). Every amount here is the server's answer, stated as the server would give it;
 * the screens never work one out.
 */
import type { components } from '@hakorem/api-client';
import { eggOrder, eggReceipt, EGGS_REF, ORDER_ID, ORDER_LINE_ID, SUPPLIER } from './eggs';
import type { FakeApi } from './fakeApi';

type S = components['schemas'];

export const RECEIPT_ID = '019a7f20-1a2b-7c3d-8e4f-5a6b7c8d9e01';
export const RECEIPT_LINE_ID = '019a7f20-2b3c-7d4e-8f5a-6b7c8d9e0f12';
export const RECEIPT_NO = 'GRN-2026-DDW-000081';
export const ORDER_NO = 'PO-2026-DDW-000052';
export const INVOICE_ID = '019a7f21-3c4d-7e5f-8a6b-7c8d9e0f1a23';
export const CREDIT_NOTE_ID = '019a7f21-4d5e-7f6a-8b7c-8d9e0f1a2b34';
export const PAYMENT_ID = '019a7f22-5e6f-7a8b-8c9d-9e0f1a2b3c45';
export const CLAIM_ID = '019a7f23-6f7a-7b8c-8d9e-0f1a2b3c4d56';
export const APPROVAL_ID = '019a7f24-7a8b-7c9d-8e0f-1a2b3c4d5e67';
export const FARM_INPUTS = {
  id: '019a7a8a-e6af-72c1-97f9-34e713eeadc4',
  code: 'FARM_INPUTS',
  name: 'Farm Inputs',
};
/** The test fake's people (fakeAuthServer.ts). */
export const OWNER = { id: '019a7a86-1c4e-7b9a-9e2f-5d3c8a1b7e04', displayName: 'Ama Mensah' };
export const MANAGER = { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', displayName: 'Kwabena Owusu' };
export const ACCOUNTANT = {
  id: '019a7a86-b3c8-7f14-8e62-2d9a5c1f0e47',
  displayName: 'Akua Sarpong',
};
const BRANCH_ID = '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6';
const RECEIPT_REF = { id: RECEIPT_ID, docType: 'GOODS_RECEIPT', number: RECEIPT_NO };
const ORDER_REF = { id: ORDER_ID, docType: 'PURCHASE_ORDER', number: ORDER_NO };

/** The posted receipt against the egg order, as the server answers it. */
export function postedReceipt(base: S['GoodsReceipt']): S['GoodsReceipt'] {
  const receipt = eggReceipt(base);
  return {
    ...receipt,
    id: RECEIPT_ID,
    status: 'POSTED',
    receiptNo: RECEIPT_NO,
    lines: receipt.lines.map((line) => ({ ...line, id: RECEIPT_LINE_ID })),
  };
}

/** The order once the 18 crates came in: 540 eggs received, 60 outstanding. */
export function receivedOrder(base: S['PurchaseOrder']) {
  const order = eggOrder(base, 'PARTIALLY_RECEIVED');
  return {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      qtyReceived: '540.000',
      qtyOutstanding: '60.000',
    })),
  };
}

/** One invoice line against the egg order line and the receipt line, in crates. */
function eggLine(
  base: S['SupplierInvoiceLine'],
  qty: string,
  unitPricePesewas: number,
  lineNetPesewas: number,
  match: Pick<
    S['SupplierInvoiceLine'],
    | 'matchStatus'
    | 'matchReasons'
    | 'qtyVariance'
    | 'priceVariancePesewas'
    | 'priceVarianceLinePesewas'
    | 'priceVarianceDirection'
  >,
): S['SupplierInvoiceLine'] {
  return {
    ...base,
    id: '019a7f21-5e6f-7a8b-8c9d-0e1f2a3b4c55',
    lineNo: 1,
    product: EGGS_REF,
    description: EGGS_REF.name,
    purchaseOrderLineId: ORDER_LINE_ID,
    goodsReceiptLineId: RECEIPT_LINE_ID,
    qty,
    uom: 'CRATE',
    unitPricePesewas,
    lineNetPesewas,
    taxCategory: FARM_INPUTS,
    levies: [],
    returnFromLocationId: null,
    returnStockUnitId: null,
    supplierClaimLineId: null,
    ...match,
  };
}

const UNCHECKED: Pick<
  S['SupplierInvoiceLine'],
  | 'matchStatus'
  | 'matchReasons'
  | 'qtyVariance'
  | 'priceVariancePesewas'
  | 'priceVarianceLinePesewas'
  | 'priceVarianceDirection'
> = {
  matchStatus: 'UNMATCHED',
  matchReasons: [],
  qtyVariance: null,
  priceVariancePesewas: null,
  priceVarianceLinePesewas: null,
  priceVarianceDirection: null,
};

/**
 * Invoice AWT-0471 as the supplier sent it: 21 crates at GH₵48.00, GH₵1,008.00. Entered, then checked:
 * one crate more than came in (the 2 cracked crates are on the open claim, so 20 would have matched on
 * quantity), and GH₵0.50 a crate over the order's GH₵47.50, which is 1.05 percent, so GH₵10.50 over on
 * the line. These are the server's figures.
 */
export function wrongInvoice(
  base: S['SupplierInvoice'],
  stage: 'entered' | 'checked',
): S['SupplierInvoice'] {
  const line = base.lines[0];
  if (line === undefined) throw new Error('The supplier invoice example has no line.');
  return {
    ...base,
    id: INVOICE_ID,
    kind: 'INVOICE',
    status: stage === 'entered' ? 'DRAFT' : 'MISMATCH',
    supplier: SUPPLIER,
    supplierInvoiceNo: 'AWT-0471',
    invoiceDate: '2026-11-18',
    dueDate: '2026-12-18',
    purchaseOrder: ORDER_REF,
    originalInvoiceId: null,
    netPesewas: 100800,
    taxPesewas: 0,
    grossPesewas: 100800,
    paidPesewas: 0,
    creditedPesewas: 0,
    outstandingPesewas: 100800,
    matchStatus: stage === 'entered' ? 'UNMATCHED' : 'MISMATCH',
    approvalRequestId: null,
    varianceReason: null,
    returnReasonCode: null,
    supplierClaimId: null,
    file: null,
    lines: [
      eggLine(
        line,
        '21.000',
        4800,
        100800,
        stage === 'entered'
          ? UNCHECKED
          : {
              matchStatus: 'MISMATCH',
              matchReasons: ['QTY_EXCEEDS_RECEIVED', 'PRICE_OUTSIDE_TOLERANCE'],
              // CR-044 (2.9.0): one crate over is 30 eggs, in the product's base unit; the price is
              // GH₵0.50 a crate over the order's GH₵47.50, GH₵10.50 on the line's 21 crates.
              qtyVariance: '30.000',
              priceVariancePesewas: 50,
              priceVarianceLinePesewas: 1050,
              priceVarianceDirection: 'OVER',
            },
      ),
    ],
    branchId: BRANCH_ID,
    version: stage === 'entered' ? 1 : 2,
    createdAt: '2026-11-18T09:00:00Z',
    createdBy: OWNER,
  };
}

/**
 * The supplier's corrected invoice AWT-0471: the 18 crates that came in, at the order's GH₵47.50,
 * GH₵855.00. It leaves the 2 cracked crates out, so it settles their claim. The server's figures. The
 * Accountant entered it.
 */
export function rightInvoice(
  base: S['SupplierInvoice'],
  status: 'MATCHED' | 'APPROVED' | 'PAID',
  paidPesewas = 0,
): S['SupplierInvoice'] {
  const wrong = wrongInvoice(base, 'entered');
  const line = wrong.lines[0];
  if (line === undefined) throw new Error('No line.');
  return {
    ...wrong,
    status,
    netPesewas: 85500,
    grossPesewas: 85500,
    paidPesewas,
    outstandingPesewas: 85500 - paidPesewas,
    matchStatus: 'MATCHED',
    lines: [
      {
        ...line,
        qty: '18.000',
        unitPricePesewas: 4750,
        lineNetPesewas: 85500,
        matchStatus: 'MATCHED',
        matchReasons: [],
        qtyVariance: '0.000',
        priceVariancePesewas: null,
        priceVarianceLinePesewas: null,
        priceVarianceDirection: null,
      },
    ],
    version: 3,
    // Entered by the Accountant, so the Owner may approve it (CR-043, 2.9.0: never its maker).
    createdBy: ACCOUNTANT,
  };
}

/** The claim for the 2 cracked crates: 60 eggs of the 600 delivered, a tenth of GH₵950.00. */
export function eggClaim(
  base: S['SupplierClaim'],
  settled: { by: 'INVOICE' | 'CREDIT_NOTE' } | null = null,
  creditNote: S['SupplierClaim']['creditNote'] = null,
): S['SupplierClaim'] {
  const line = base.lines[0];
  if (line === undefined) throw new Error('The claim example has no line.');
  return {
    ...base,
    id: CLAIM_ID,
    status: settled === null ? 'OPEN' : 'SETTLED',
    supplier: SUPPLIER,
    purchaseOrder: ORDER_REF,
    goodsReceipt: RECEIPT_REF,
    receivedBy: { id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11', displayName: 'Yaw Boateng' },
    note: 'Two crates cracked, signed by the driver',
    claimedPesewas: 9500,
    lines: [
      {
        ...line,
        goodsReceiptLineId: RECEIPT_LINE_ID,
        purchaseOrderLineId: ORDER_LINE_ID,
        product: EGGS_REF,
        rejectionReasonCode: 'CRACKED',
        baseUom: 'EGG',
        qtyDeliveredBase: '600.000',
        qtyAcceptedBase: '540.000',
        qtyRejectedBase: '60.000',
        orderUom: 'CRATE',
        orderUnitPricePesewas: 4750,
        lineValuePesewas: 95000,
        acceptedValuePesewas: 85500,
        claimedValuePesewas: 9500,
      },
    ],
    creditNote,
    settlement: settled?.by ?? null,
    settledBy:
      settled === null
        ? null
        : settled.by === 'INVOICE'
          ? { id: INVOICE_ID, kind: 'INVOICE', supplierInvoiceNo: 'AWT-0471' }
          : { id: CREDIT_NOTE_ID, kind: 'CREDIT_NOTE', supplierInvoiceNo: 'AWT-CN-12' },
    settledAt: settled === null ? null : '2026-11-18T10:00:00Z',
    branchId: BRANCH_ID,
    createdAt: '2026-11-17T16:00:00Z',
    createdBy: OWNER,
  };
}

/** The claim's credit note, drafted by the server from the claim: its line and value are the claim's. */
export function claimCreditNote(base: S['SupplierInvoice']): S['SupplierInvoice'] {
  const wrong = wrongInvoice(base, 'entered');
  const line = wrong.lines[0];
  if (line === undefined) throw new Error('No line.');
  return {
    ...wrong,
    id: CREDIT_NOTE_ID,
    kind: 'CREDIT_NOTE',
    status: 'DRAFT',
    supplierInvoiceNo: 'AWT-CN-12',
    originalInvoiceId: INVOICE_ID,
    netPesewas: 9500,
    grossPesewas: 9500,
    outstandingPesewas: 0,
    supplierClaimId: CLAIM_ID,
    lines: [
      {
        ...line,
        qty: '60.000',
        uom: 'EGG',
        unitPricePesewas: 0,
        lineNetPesewas: 9500,
        supplierClaimLineId: '019a7f23-7a8b-7c9d-8e0f-1a2b3c4d5e66',
      },
    ],
  };
}

/** A payment of GH₵855.00 on AWT-0471, by mobile money, prepared by the Owner. */
export function eggPayment(
  base: S['SupplierPayment'],
  status: S['SupplierPayment']['status'],
): S['SupplierPayment'] {
  return {
    ...base,
    id: PAYMENT_ID,
    paymentNo: status === 'PAID' ? 'SPY-2026-DDW-000007' : null,
    status,
    supplier: SUPPLIER,
    method: 'MOBILE_MONEY',
    payeeDetailsMasked: 'MTN ••• ••• 4471',
    bankAccount: null,
    amountPesewas: 85500,
    scheduledFor: null,
    paidAt: status === 'PAID' ? '2026-11-18T14:30:00Z' : null,
    externalReference: status === 'PAID' ? 'MP261118.1430.A17' : null,
    approvalRequestId: status === 'DRAFT' ? null : APPROVAL_ID,
    allocations: [
      { supplierInvoiceId: INVOICE_ID, supplierInvoiceNo: 'AWT-0471', amountPesewas: 85500 },
    ],
    remittanceDocumentId: null,
    branchId: BRANCH_ID,
    createdAt: '2026-11-18T11:00:00Z',
    createdBy: OWNER,
  };
}

/** The payment's approval, sent for approval by `requestedBy`. */
export function paymentApproval(
  base: Record<string, unknown>,
  requestedBy: { id: string; displayName: string },
  changes: Record<string, unknown> = {},
) {
  return {
    ...base,
    id: APPROVAL_ID,
    kind: 'SUPPLIER_PAYMENT',
    status: 'PENDING',
    subject: { id: PAYMENT_ID, docType: 'SUPPLIER_PAYMENT', number: null },
    summary: 'Payment of 85500 pesewas to Awutu Poultry Farm by mobile money',
    amountPesewas: 85500,
    evidenceFileId: null,
    requestedBy,
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    canDecide: true,
    ...changes,
  };
}

/** The supplier's balance as `getSupplierBalance` gives it (2.9.0), with the right invoice approved. */
export const BALANCE: S['SupplierBalance'] = {
  supplier: SUPPLIER,
  asOf: '2026-11-18T12:00:00Z',
  owedPesewas: 85500,
  awaitingApprovalPesewas: 0,
  claimedPesewas: 9500,
  inPaymentPesewas: 0,
  paidPesewas: 0,
  currency: 'GHS',
};

/** The receipt, the order and the tax categories every invoice screen reads, in the egg session's shape. */
export function seedPayables(api: FakeApi): void {
  api.rewrite('listPurchaseOrders', (body) => {
    const page = body as { data: S['PurchaseOrder'][] };
    const first = page.data[0];
    return first === undefined ? page : { ...page, data: [receivedOrder(first)] };
  });
  api.rewrite('getPurchaseOrder', (body) => receivedOrder(body as S['PurchaseOrder']));
  api.rewrite('listGoodsReceipts', (body) => {
    const page = body as { data: S['GoodsReceipt'][] };
    const first = page.data[0];
    return first === undefined ? page : { ...page, data: [postedReceipt(first)] };
  });
  api.rewrite('getGoodsReceipt', (body) => postedReceipt(body as S['GoodsReceipt']));
  api.respond('getSupplierBalance', () => ({ ...BALANCE }));
}
