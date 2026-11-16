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
  REFUND: 14,
  RETURN: 15,
  PRICE_LIST_ACTIVATION: 16,
  PROMOTION_ACTIVATION: 17,
  TAX_SCHEME_ACTIVATION: 18,
  MANUAL_JOURNAL: 19,
  POSTING_RULE_CHANGE: 20,
  CAPITAL_WITHDRAWAL: 21,
  INVESTOR_DISTRIBUTION: 22,
  DATA_DELETION: 23,
  BAD_DEBT_WRITE_OFF: 24,
  CREDIT_NOTE: 25,
  PAYMENT_REVERSAL: 26,
  PERIOD_REOPEN: 27,
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
 * needs. A type with no screen yet (a purchase order, a supplier payment: B7 is live, the screens are not)
 * has no link; its summary and amount still come from the request. A `PROCESSING_REVERSAL` subject is the
 * reversal itself, whose id no read resolves to its order, so it has no link either (CR-027).
 */
const SUBJECT_PAGES: Record<string, { path: string; permission: string }> = {
  MORTALITY_RECORD: { path: '/mortality', permission: 'liv.mortality.read' },
  STOCK_ADJUSTMENT: { path: '/stock-adjustments', permission: 'inv.adjustment.read' },
  STOCK_TAKE: { path: '/stock-takes', permission: 'inv.stock_take.read' },
  STOCK_TRANSFER: { path: '/stock-transfers', permission: 'inv.transfer.read' },
  PROCESSING_ORDER: { path: '/processing-orders', permission: 'prc.order.read' },
};

export function subjectPage(
  subject: ApprovalRequest['subject'],
  can: (permission: string) => boolean,
): string | null {
  const page = SUBJECT_PAGES[subject.docType];
  return page !== undefined && can(page.permission) ? `${page.path}/${subject.id}` : null;
}
