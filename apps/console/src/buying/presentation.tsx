import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type Status = components['schemas']['PurchaseOrder']['status'];

/** Every state a purchase order can be in, in the order it moves through them. */
export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
] as const satisfies readonly Status[];

const LOOK: Record<Status, { tone: BadgeTone }> = {
  DRAFT: { tone: 'info' },
  PENDING_APPROVAL: { tone: 'warning' },
  APPROVED: { tone: 'violet' },
  SENT: { tone: 'plum' },
  PARTIALLY_RECEIVED: { tone: 'warning' },
  RECEIVED: { tone: 'good' },
  CLOSED: { tone: 'slate' },
  CANCELLED: { tone: 'slate' },
};

/** A purchase order's state in words, with a tone and a dot (ADR 0036). */
export function PurchaseOrderStatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation('buying');
  return (
    <StatusBadge
      tone={lookup(LOOK, status, UNKNOWN).tone}
      label={t(`status.${status}`, { defaultValue: status })}
    />
  );
}
