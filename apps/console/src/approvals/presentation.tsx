import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type ApprovalKind = components['schemas']['ApprovalKind'];
export type ApprovalStatus = ApprovalRequest['status'];

/** Every kind the contract names, in the inbox's filter (MORTALITY_WRITE_OFF since 1.24.0). */
export const APPROVAL_KINDS: readonly ApprovalKind[] = [
  'MORTALITY_WRITE_OFF',
  'STOCK_WRITE_OFF',
  'STOCK_REVERSAL',
  'PURCHASE_ORDER',
  'SUPPLIER_PAYMENT',
  'SUPPLIER_PAYOUT_CHANGE',
  'SALE_VOID',
  'PRICE_OVERRIDE',
  'QUOTE_BELOW_MARGIN',
  'CREDIT_OVERRIDE',
  'REFUND',
  'RETURN',
  'PRICE_LIST_ACTIVATION',
  'PROMOTION_ACTIVATION',
  'TAX_SCHEME_ACTIVATION',
  'MANUAL_JOURNAL',
  'POSTING_RULE_CHANGE',
  'CAPITAL_WITHDRAWAL',
  'INVESTOR_DISTRIBUTION',
  'DATA_DELETION',
  'BAD_DEBT_WRITE_OFF',
  'CREDIT_NOTE',
  'PAYMENT_REVERSAL',
  'PERIOD_REOPEN',
];

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
 * has no link; its summary and amount still come from the request.
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
