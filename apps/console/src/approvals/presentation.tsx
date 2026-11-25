import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type ApprovalKind = components['schemas']['ApprovalKind'];
export type ApprovalStatus = ApprovalRequest['status'];

/**
 * Every kind the contract names, in the inbox's filter: the death and cull kinds first. A Record keyed by
 * the contract's enum, so a kind a later contract adds fails the typecheck until it is placed here.
 */
const KIND_ORDER: Record<ApprovalKind, number> = {
  MORTALITY_WRITE_OFF: 0,
  MORTALITY_CONFIRMATION: 1,
  STOCK_WRITE_OFF: 2,
  STOCK_REVERSAL: 3,
  PROCESSING_REVERSAL: 4,
  PURCHASE_ORDER: 5,
  SUPPLIER_PAYMENT: 6,
  SUPPLIER_PAYOUT_CHANGE: 7,
  SUPPLIER_CREDIT_NOTE: 8,
  SUPPLIER_INVOICE_VARIANCE: 9,
  SALE_VOID: 10,
  PRICE_OVERRIDE: 11,
  QUOTE_BELOW_MARGIN: 12,
  CREDIT_OVERRIDE: 13,
  CREDIT_LIMIT_CHANGE: 14,
  ACCOUNT_RELEASE: 15,
  REFUND: 16,
  RETURN: 17,
  PRICE_LIST_ACTIVATION: 18,
  PROMOTION_ACTIVATION: 19,
  TAX_SCHEME_ACTIVATION: 20,
  MANUAL_JOURNAL: 21,
  POSTING_RULE_CHANGE: 22,
  CAPITAL_WITHDRAWAL: 23,
  INVESTOR_DISTRIBUTION: 24,
  INVESTOR_PAYOUT_CHANGE: 25,
  FINANCING: 26,
  DATA_DELETION: 27,
  BAD_DEBT_WRITE_OFF: 28,
  CREDIT_NOTE: 29,
  PAYMENT_REVERSAL: 30,
  PERIOD_REOPEN: 31,
  RECONCILIATION_BREAK: 32,
};
export const APPROVAL_KINDS: readonly ApprovalKind[] = (
  Object.keys(KIND_ORDER) as ApprovalKind[]
).sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b]);

export const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

const STATUS: Record<ApprovalStatus, { tone: BadgeTone }> = {
  PENDING: { tone: 'warning' },
  APPROVED: { tone: 'good' },
  REJECTED: { tone: 'critical' },
  CANCELLED: { tone: 'slate' },
  EXPIRED: { tone: 'slate' },
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { t } = useTranslation('approvals');
  return (
    <StatusBadge
      tone={lookup(STATUS, status, UNKNOWN).tone}
      label={t(`status.${status}`, { defaultValue: status })}
    />
  );
}

/** "Death or cull write-off": a kind in words, or its code for a kind a later contract adds. */
export function useKindName() {
  const { t } = useTranslation('approvals');
  return (kind: string) => t(`kinds.${kind as ApprovalKind}`, { defaultValue: kind });
}

/**
 * Where the console shows the record an approval is about, by its document type, and what opening it
 * needs. A type with no screen yet (a purchase order's approval)
 * has no link; its summary and amount still come from the request. A supplier invoice (a credit note or a
 * variance) and a supplier payment open on their own screens (F10g), an order and a quote on theirs (F10i). A `PROCESSING_REVERSAL` subject is the
 * reversal itself: the detail screen finds its order with `listProcessingOrders` by `reversalId` (CR-027).
 */
const SUBJECT_PAGES: Record<string, { path: string; permission: string }> = {
  MORTALITY_RECORD: { path: '/mortality', permission: 'liv.mortality.read' },
  STOCK_ADJUSTMENT: { path: '/stock-adjustments', permission: 'inv.adjustment.read' },
  STOCK_TAKE: { path: '/stock-takes', permission: 'inv.stock_take.read' },
  STOCK_TRANSFER: { path: '/stock-transfers', permission: 'inv.transfer.read' },
  PROCESSING_ORDER: { path: '/processing-orders', permission: 'prc.order.read' },
  SUPPLIER_INVOICE: { path: '/supplier-invoices', permission: 'pur.supplier_invoice.read' },
  SUPPLIER_PAYMENT: { path: '/supplier-payments', permission: 'pur.supplier_payment.read' },
  // F10i: a credit override's subject is the order; a margin approval's is the quote.
  SALES_ORDER: { path: '/orders', permission: 'ord.order.read' },
  QUOTE: { path: '/quotes', permission: 'quo.quote.read' },
};

export function subjectPage(
  subject: ApprovalRequest['subject'],
  can: (permission: string) => boolean,
): string | null {
  const page = SUBJECT_PAGES[subject.docType];
  return page !== undefined && can(page.permission) ? `${page.path}/${subject.id}` : null;
}
