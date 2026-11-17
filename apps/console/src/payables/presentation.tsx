import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
type InvoiceStatus = S['SupplierInvoice']['status'];
type MatchStatus = S['SupplierInvoice']['matchStatus'];
type PaymentStatus = S['SupplierPayment']['status'];
type ClaimStatus = S['SupplierClaim']['status'];

/** Every state a supplier invoice or credit note can be in, in the order it moves through them. */
export const INVOICE_STATUSES = [
  'DRAFT',
  'MATCHED',
  'MISMATCH',
  'APPROVED',
  'PAID',
  'CANCELLED',
] as const satisfies readonly InvoiceStatus[];

/** Every state a supplier payment can be in. */
export const PAYMENT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PAID',
  'REJECTED',
  'CANCELLED',
] as const satisfies readonly PaymentStatus[];

/** How a supplier is paid; the contract's order. */
export const PAYMENT_METHODS = [
  'CASH',
  'MOBILE_MONEY',
  'BANK',
  'CHEQUE',
] as const satisfies readonly S['SupplierPayment']['method'][];

/**
 * Why a line does not match, in the contract's fixed order (`SupplierInvoiceLine.matchReasons`). A reason a
 * later contract adds is shown by its code until it has words.
 */
export const MATCH_REASONS = [
  'NO_ORDER_LINE',
  'PRODUCT_DIFFERS',
  'QTY_EXCEEDS_RECEIVED',
  'PRICE_OUTSIDE_TOLERANCE',
  'LEVY_DIFFERS',
] as const;

/** The reasons a variance may be asked for: price and levy only (`requestSupplierInvoiceVariance`). */
const VARIANCE_REASONS: ReadonlySet<string> = new Set(['PRICE_OUTSIDE_TOLERANCE', 'LEVY_DIFFERS']);

/** Whether every mismatched line fails only on price or a levy, so a variance may be asked for. */
export function varianceAllowed(invoice: S['SupplierInvoice']): boolean {
  const failing = invoice.lines.filter((line) => line.matchStatus === 'MISMATCH');
  return (
    invoice.matchStatus === 'MISMATCH' &&
    failing.length > 0 &&
    failing.every((line) => line.matchReasons.every((reason) => VARIANCE_REASONS.has(reason)))
  );
}

const INVOICE_LOOK: Record<InvoiceStatus, { tone: BadgeTone }> = {
  DRAFT: { tone: 'info' },
  MATCHED: { tone: 'violet' },
  MISMATCH: { tone: 'critical' },
  APPROVED: { tone: 'plum' },
  PAID: { tone: 'good' },
  CANCELLED: { tone: 'slate' },
};

const MATCH_LOOK: Record<MatchStatus, { tone: BadgeTone }> = {
  UNMATCHED: { tone: 'info' },
  MATCHED: { tone: 'good' },
  MISMATCH: { tone: 'critical' },
  NOT_REQUIRED: { tone: 'slate' },
  VARIANCE_APPROVED: { tone: 'warning' },
};

const PAYMENT_LOOK: Record<PaymentStatus, { tone: BadgeTone }> = {
  DRAFT: { tone: 'info' },
  PENDING_APPROVAL: { tone: 'warning' },
  APPROVED: { tone: 'violet' },
  PAID: { tone: 'good' },
  REJECTED: { tone: 'critical' },
  CANCELLED: { tone: 'slate' },
};

const CLAIM_LOOK: Record<ClaimStatus, { tone: BadgeTone }> = {
  OPEN: { tone: 'warning' },
  SETTLED: { tone: 'good' },
};

/** A supplier invoice's or credit note's state in words, with a tone and a dot (ADR 0036). */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation('payables');
  return (
    <StatusBadge
      tone={lookup(INVOICE_LOOK, status, UNKNOWN).tone}
      label={t(`invoiceStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** The three-way match result in words. */
export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { t } = useTranslation('payables');
  return (
    <StatusBadge
      tone={lookup(MATCH_LOOK, status, UNKNOWN).tone}
      label={t(`matchStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** A supplier payment's state in words. */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('payables');
  return (
    <StatusBadge
      tone={lookup(PAYMENT_LOOK, status, UNKNOWN).tone}
      label={t(`paymentStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** A claim's state in words. */
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation('payables');
  return (
    <StatusBadge
      tone={lookup(CLAIM_LOOK, status, UNKNOWN).tone}
      label={t(`claimStatus.${status}`, { defaultValue: status })}
    />
  );
}

/** "Invoice 88120" or "Credit note CN-12": the supplier's own number, with what kind of document it is. */
export function useInvoiceName() {
  const { t } = useTranslation('payables');
  return (invoice: { kind: S['SupplierInvoice']['kind']; supplierInvoiceNo: string }) =>
    t(`kindName.${invoice.kind}`, { number: invoice.supplierInvoiceNo });
}
