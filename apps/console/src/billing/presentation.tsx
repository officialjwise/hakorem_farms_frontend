import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
export type BillingDocument = S['BillingDocument'];
export type BillingLine = S['BillingLine'];
export type DocumentKind = BillingDocument['kind'];
export type PaymentStatus = S['Settlement']['paymentStatus'];
export type Statement = S['CustomerStatement'];

/** The contract's own values, in the order a person meets them. */
export const DOCUMENT_KINDS = [
  'INVOICE',
  'RECEIPT',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'PROFORMA',
] as const;
export const PAYMENT_STATUSES = [
  'UNPAID',
  'PART_PAID',
  'PAID',
  'CREDITED',
  'NOT_APPLICABLE',
] as const;

/** An invoice or a receipt, once issued, is corrected by a credit or a debit note (FR-BIL-007). */
export function isCorrectable(document: Pick<BillingDocument, 'kind' | 'status'>): boolean {
  return (
    document.status === 'ISSUED' && (document.kind === 'INVOICE' || document.kind === 'RECEIPT')
  );
}

const PAYMENT: Record<PaymentStatus, { tone: BadgeTone }> = {
  UNPAID: { tone: 'warning' },
  PART_PAID: { tone: 'info' },
  PAID: { tone: 'good' },
  CREDITED: { tone: 'slate' },
  NOT_APPLICABLE: { tone: 'slate' },
};

/** Where a document stands on payment, in words (ADR 0036). */
export function PaymentBadge({ status }: { status: string }) {
  const { t } = useTranslation('billing');
  return (
    <StatusBadge
      tone={lookup(PAYMENT, status, UNKNOWN).tone}
      label={t(`payment.${status as PaymentStatus}`, { defaultValue: status })}
    />
  );
}

/** A draft is a credit note waiting for its second person (listBillingDocuments' description). */
export function DocumentStatusBadge({ document }: { document: Pick<BillingDocument, 'status'> }) {
  const { t } = useTranslation('billing');
  return document.status === 'DRAFT' ? (
    <StatusBadge tone="warning" label={t('draftCredit')} />
  ) : (
    <StatusBadge tone="good" label={t('status.ISSUED')} />
  );
}

/** The kind in words; the raw value for a kind this build does not know. */
export function useKindWords(): (kind: string) => string {
  const { t } = useTranslation('billing');
  return (kind) => t(`kind.${kind as DocumentKind}`, { defaultValue: kind });
}

/**
 * A document's name: its kind and number; a till's provisional reference before sync (FR-BIL-011); or, for a
 * credit note waiting for approval, that it has no number yet.
 */
export function useDocumentName(): (
  document: Pick<BillingDocument, 'kind' | 'documentNo' | 'provisionalRef' | 'status'>,
) => string {
  const { t } = useTranslation('billing');
  const kindWords = useKindWords();
  return (document) => {
    const kind = kindWords(document.kind);
    if (document.documentNo !== null) {
      return t('name.numbered', { kind, number: document.documentNo });
    }
    if (document.provisionalRef !== null) {
      return t('name.provisional', { kind, reference: document.provisionalRef });
    }
    return document.status === 'DRAFT' ? t('name.draft', { kind }) : t('name.unnumbered', { kind });
  };
}

/** Who the document is for: the customer on it, or a walk-in sale with none. */
export function useCustomerWords(): (
  document: Pick<BillingDocument, 'customer' | 'customerName'>,
) => string {
  const { t } = useTranslation('billing');
  return (document) => document.customerName ?? document.customer?.name ?? t('walkIn');
}
