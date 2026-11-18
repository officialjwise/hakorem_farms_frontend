/**
 * The quotes and credit session's fixtures (F10i, contract 2.5.0): Asantewaa Chop Bar asks for 10 crates
 * of big eggs and 30 single eggs. The API prices a crate at GH₵60.00 and a single egg at GH₵2.20, each by
 * its own entry; the quote's totals, the order's estimate, the account's figures, the ageing and the credit
 * check (CR-046, requested) are all the server's answers, stated as the server would give them. The
 * screens never work one out.
 */
import type { components } from '@hakorem/api-client';
import type { OrderCreditCheck } from '../../apps/console/src/requested/creditControl';
import { EGGS_REF } from './eggs';
import { MANAGER, OWNER } from './payables';

type S = components['schemas'];

export const CUSTOMER = {
  id: '019a7a87-c269-71a7-b6df-2344b7f49c22',
  publicId: 'cus_TS4VEDD3ZZNAAQGD',
  name: 'Asantewaa Chop Bar',
};
export const CUSTOMER_PHONE = '+233557018924';
export const QUOTE_ID = '019a7f30-1a2b-7c3d-8e4f-5a6b7c8d9e01';
export const QUOTE_NO = 'QUO-2026-DDW-000091';
export const VERSION_1 = '019a7f30-2b3c-7d4e-8f5a-6b7c8d9e0f11';
export const VERSION_2 = '019a7f30-3c4d-7e5f-8a6b-7c8d9e0f1a22';
export const ORDER_ID = '019a7f31-4d5e-7f6a-8b7c-8d9e0f1a2b33';
export const ORDER_NO = 'SO-2026-DDW-004230';
export const OVERRIDE_APPROVAL_ID = '019a7f32-5e6f-7a8b-8c9d-9e0f1a2b3c44';
export const PRICE_LIST = {
  id: '019a7aa4-5c1e-7b2a-9d3f-1e2f3a4b5c6d',
  code: 'ASANTEWAA',
  name: 'Asantewaa Chop Bar prices',
  kind: 'CUSTOMER',
};
const SALESPERSON = { id: OWNER.id, displayName: OWNER.displayName };

/** The two prices the API gives this buyer for the big eggs: a crate and a single egg, never derived. */
export const PRICES = { CRATE: 6000, EGG: 220 } as const;

/** The buyer as `listCustomers` answers it. */
export function chopBar(base: S['Customer']): S['Customer'] {
  return { ...base, ...CUSTOMER, phone: CUSTOMER_PHONE, kind: 'BUSINESS', status: 'ACTIVE' };
}

/** `resolvePrices` for the lines asked: each priced by the entry for its own unit, for this buyer. */
export function eggPrices(request: S['PriceResolveRequest']): S['PriceResolveResult'] {
  return {
    channel: request.channel,
    resolvedAt: '2026-11-17T10:00:00Z',
    currency: 'GHS',
    lines: request.lines.map((line) => {
      const uom = line.uom === 'EGG' ? 'EGG' : 'CRATE';
      return {
        lineRef: line.lineRef,
        outcome: 'RESOLVED' as const,
        resolved: {
          priceListEntryId: `019a7aa6-0000-7000-8000-00000000000${uom === 'EGG' ? '1' : '2'}`,
          priceList: PRICE_LIST,
          basis: 'PER_UNIT' as const,
          uom,
          listPricePesewas: PRICES[uom],
          floorPricePesewas: uom === 'EGG' ? 200 : 5500,
          ceilingPricePesewas: uom === 'EGG' ? 250 : 6500,
          grade: null,
          weightBand: null,
        },
        quoteRequiredReason: null,
        promotions: [],
      };
    }),
  } as S['PriceResolveResult'];
}

/** A quote line as the server answers it, with its own line total. */
function line(
  id: string,
  lineNo: number,
  description: string,
  quantity: string,
  uom: 'CRATE' | 'EGG',
  lineNetPesewas: number,
  baseQuantity: string,
): S['QuoteLine'] {
  return {
    id,
    lineNo,
    product: EGGS_REF,
    description,
    grade: null,
    weightBand: null,
    stockUnit: null,
    reservationId: null,
    quantity,
    uom,
    baseQuantity,
    priceBasis: 'PER_UNIT',
    resolvedUnitPricePesewas: PRICES[uom],
    unitPricePesewas: PRICES[uom],
    lineNetPesewas,
    estimatedUnitCostPesewas: null,
  };
}

/** Version 1: 12 crates and 30 eggs (GH₵720.00 + GH₵66.00 = GH₵786.00, the server's sum). */
export function version1(status: S['QuoteVersion']['status']): S['QuoteVersion'] {
  return {
    id: VERSION_1,
    versionNo: 1,
    status,
    validUntil: '2026-11-24T23:59:59.999Z',
    terms: 'Pay within 30 days on account.',
    deliveryEstimate: 'Delivered to Asantewaa Chop Bar, Kaneshie, on Friday morning',
    deliveryFeePesewas: 0,
    taxInclusive: false,
    netPesewas: 78600,
    taxPesewas: 0,
    grossPesewas: 78600,
    estimatedCostPesewas: null,
    marginPercent: null,
    belowMarginFloor: false,
    approvalRequestId: null,
    changeNote: null,
    issuedAt: status === 'DRAFT' ? null : '2026-11-17T10:30:00Z',
    issuedBy: status === 'DRAFT' ? null : SALESPERSON,
    createdBy: SALESPERSON,
    createdAt: '2026-11-17T10:20:00Z',
    version: 1,
    acceptanceLinkToken: null,
    lines: [
      line(
        '019a7f30-4d5e-7f6a-8b7c-000000000011',
        1,
        'Eggs, big, crates of 30',
        '12.000',
        'CRATE',
        72000,
        '360.000',
      ),
      line('019a7f30-4d5e-7f6a-8b7c-000000000012', 2, 'Eggs, big, single', '30.000', 'EGG', 6600, '30.000'),
    ],
    acceptance: null,
    documentId: null,
    currency: 'GHS',
  };
}

/** Version 2, revised to 10 crates and 30 eggs (GH₵600.00 + GH₵66.00 = GH₵666.00). */
export function version2(status: S['QuoteVersion']['status']): S['QuoteVersion'] {
  return {
    ...version1('SUPERSEDED'),
    id: VERSION_2,
    versionNo: 2,
    status,
    netPesewas: 66600,
    grossPesewas: 66600,
    changeNote: 'Ten crates, not twelve',
    createdAt: '2026-11-17T10:50:00Z',
    issuedAt: status === 'DRAFT' ? null : '2026-11-17T11:00:00Z',
    issuedBy: status === 'DRAFT' ? null : SALESPERSON,
    lines: [
      line(
        '019a7f30-4d5e-7f6a-8b7c-000000000021',
        1,
        'Eggs, big, crates of 30',
        '10.000',
        'CRATE',
        60000,
        '300.000',
      ),
      line('019a7f30-4d5e-7f6a-8b7c-000000000022', 2, 'Eggs, big, single', '30.000', 'EGG', 6600, '30.000'),
    ],
    acceptance:
      status === 'ACCEPTED'
        ? {
            method: 'SIGNED_LINK',
            acceptedName: 'Akosua Asantewaa',
            acceptedAt: '2026-11-17T12:05:00Z',
          }
        : null,
  };
}

/** The quote, with the version in force and its own state. */
export function eggQuote(
  base: S['Quote'],
  status: S['Quote']['status'],
  current: S['QuoteVersion'],
  versionCount: number,
): S['Quote'] {
  return {
    ...base,
    id: QUOTE_ID,
    quoteNo: QUOTE_NO,
    status,
    rfqId: null,
    customer: CUSTOMER,
    contactName: 'Akosua Asantewaa',
    contactPhone: CUSTOMER_PHONE,
    salesperson: SALESPERSON,
    productLine: 'LIVE',
    currentVersion: current,
    versionCount,
    acceptedVersionId: status === 'ACCEPTED' || status === 'CONVERTED' ? current.id : null,
    convertedOrder:
      status === 'CONVERTED' ? { id: ORDER_ID, docType: 'SALES_ORDER', number: ORDER_NO } : null,
    declineReason: null,
    branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
    version: 3,
    createdAt: '2026-11-17T10:00:00Z',
  };
}

/** The order made from version 2: on credit, its lines at the quote's prices, the server's estimate. */
export function eggOrder(
  base: S['SalesOrder'],
  status: S['SalesOrder']['status'],
): S['SalesOrder'] {
  const template = base.lines[0];
  if (template === undefined) throw new Error('The order example has no line.');
  const orderLine = (
    id: string,
    lineNo: number,
    qty: string,
    uom: 'CRATE' | 'EGG',
    total: number,
    quoteLineId: string,
  ): S['OrderLine'] => ({
    ...template,
    id,
    lineNo,
    product: EGGS_REF,
    stockUnit: null,
    qtyOrdered: qty,
    uom,
    priceSource: 'QUOTE',
    quoteLineId,
    resolvedUnitPricePesewas: PRICES[uom],
    agreedUnitPricePesewas: PRICES[uom],
    estimatedLineTotalPesewas: total,
    finalLineTotalPesewas: null,
  });
  return {
    ...base,
    id: ORDER_ID,
    orderNo: ORDER_NO,
    channel: 'WHOLESALE',
    status,
    paymentStatus: 'UNPAID',
    customer: CUSTOMER,
    paymentTerms: 'CREDIT',
    fulfilmentMode: 'COLLECTION',
    source: { id: QUOTE_ID, docType: 'QUOTE', number: QUOTE_NO },
    estimatedTotalPesewas: 66600,
    paidPesewas: 0,
    outstandingPesewas: 66600,
    billingDocument: null,
    creditCheck: status === 'CONFIRMED' ? 'OVERRIDDEN' : null,
    lines: [
      orderLine(
        '019a7f31-0000-7000-8000-000000000001',
        1,
        '10.000',
        'CRATE',
        60000,
        '019a7f30-4d5e-7f6a-8b7c-000000000021',
      ),
      orderLine(
        '019a7f31-0000-7000-8000-000000000002',
        2,
        '30.000',
        'EGG',
        6600,
        '019a7f30-4d5e-7f6a-8b7c-000000000022',
      ),
    ],
  };
}

/**
 * CR-046's credit check of the order: GH₵4,620.00 owed before it, GH₵666.00 more, against a GH₵5,000.00
 * limit, so GH₵286.00 over (the server's figure). `override` adds the request for an override.
 */
export function overLimit(override: OrderCreditCheck['override'] = null): OrderCreditCheck {
  return {
    order: { id: ORDER_ID, docType: 'SALES_ORDER', number: ORDER_NO },
    customer: CUSTOMER,
    outcome: 'OVER_LIMIT',
    creditLimitPesewas: 500000,
    exposurePesewas: 462000,
    orderPesewas: 66600,
    overLimitPesewas: 28600,
    overduePesewas: 0,
    oldestOverdueDays: null,
    paymentTermsDays: 30,
    override,
    checkedAt: '2026-11-17T12:30:00Z',
    currency: 'GHS',
  };
}

/** The override the Owner asked for, waiting, or decided by the Manager. */
export function overrideState(
  status: 'PENDING_APPROVAL' | 'APPROVED',
): NonNullable<OrderCreditCheck['override']> {
  return {
    approvalRequestId: OVERRIDE_APPROVAL_ID,
    status,
    reason: 'They pay every Friday; this week is the festival order',
    requestedBy: OWNER,
    requestedAt: '2026-11-17T12:35:00Z',
    decidedBy: status === 'APPROVED' ? MANAGER : null,
    decidedAt: status === 'APPROVED' ? '2026-11-17T12:50:00Z' : null,
  };
}

/** The approval request for the override, as the inbox reads it. */
export function overrideApproval(
  base: Record<string, unknown>,
  changes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...base,
    id: OVERRIDE_APPROVAL_ID,
    kind: 'CREDIT_OVERRIDE',
    status: 'PENDING',
    subject: { id: ORDER_ID, docType: 'SALES_ORDER', number: ORDER_NO },
    summary: 'Credit override for Asantewaa Chop Bar: GH₵286.00 over the limit',
    amountPesewas: 28600,
    evidenceFileId: null,
    requestedBy: OWNER,
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    canDecide: true,
    ...changes,
  };
}

/** The buyer's account: GH₵5,000.00 limit, 30 days, their own price list (CR-041), the server's figures. */
export function chopBarAccount(base: S['BusinessAccount']): S['BusinessAccount'] {
  return {
    ...base,
    customer: CUSTOMER,
    creditLimitPesewas: 500000,
    paymentTermsDays: 30,
    accountManager: { id: OWNER.id, displayName: OWNER.displayName },
    overdueHoldDays: 60,
    status: 'ACTIVE',
    holdReason: null,
    heldAt: null,
    exposurePesewas: 462000,
    availableCreditPesewas: 38000,
    overduePesewas: 125000,
    priceList: { id: PRICE_LIST.id, code: PRICE_LIST.code, name: PRICE_LIST.name },
    currency: 'GHS',
  } as S['BusinessAccount'];
}

/** The buyer's ageing row: GH₵3,370.00 not yet due, GH₵1,250.00 between 31 and 60 days late. */
export function chopBarAgeing(base: S['AgeingReport']): S['AgeingReport'] {
  const row = {
    customer: CUSTOMER,
    currentPesewas: 337000,
    days1To30Pesewas: 0,
    days31To60Pesewas: 125000,
    days61To90Pesewas: 0,
    daysOver90Pesewas: 0,
    totalPesewas: 462000,
    creditLimitPesewas: 500000,
    onHold: false,
  };
  return {
    ...base,
    asOf: '2026-11-17',
    data: [row],
    page: { nextCursor: null, limit: 25, hasMore: false },
    totals: {
      currentPesewas: 337000,
      days1To30Pesewas: 0,
      days31To60Pesewas: 125000,
      days61To90Pesewas: 0,
      daysOver90Pesewas: 0,
      totalPesewas: 462000,
    },
  };
}
