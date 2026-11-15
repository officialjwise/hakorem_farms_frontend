import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  ClipboardList,
  Equal,
  ScanSearch,
  Truck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { StatusBadge, type BadgeIcon, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
type Look = { tone: BadgeTone; icon: BadgeIcon };

const DRAFT: Look = { tone: 'info', icon: CircleDashed };
const PENDING: Look = { tone: 'warning', icon: Clock };
const POSTED: Look = { tone: 'good', icon: CircleCheck };
const CANCELLED: Look = { tone: 'slate', icon: CircleX };

const TAKE: Record<S['StockTake']['status'], Look> = {
  DRAFT,
  COUNTING: { tone: 'info', icon: ClipboardList },
  REVIEW: { tone: 'warning', icon: ScanSearch },
  PENDING_APPROVAL: PENDING,
  POSTED,
  CANCELLED,
};
const ADJUSTMENT: Record<S['StockAdjustment']['status'], Look> = {
  DRAFT,
  PENDING_APPROVAL: PENDING,
  POSTED,
  REJECTED: { tone: 'critical', icon: CircleX },
};
const TRANSFER: Record<S['StockTransfer']['status'], Look> = {
  DRAFT,
  DISPATCHED: { tone: 'warning', icon: Truck },
  RECEIVED: POSTED,
  CANCELLED,
};
const RECEIPT: Record<S['GoodsReceipt']['status'], Look> = { DRAFT, POSTED, CANCELLED };

function Badge({ look, label }: { look: Look; label: string }) {
  return <StatusBadge tone={look.tone} icon={look.icon} label={label} />;
}

export function StockTakeStatusBadge({ status }: { status: S['StockTake']['status'] }) {
  const { t } = useTranslation('stock');
  return (
    <Badge
      look={lookup(TAKE, status, UNKNOWN)}
      label={t(`takeStatus.${status}`, { defaultValue: status })}
    />
  );
}
export function AdjustmentStatusBadge({ status }: { status: S['StockAdjustment']['status'] }) {
  const { t } = useTranslation('stock');
  return (
    <Badge
      look={lookup(ADJUSTMENT, status, UNKNOWN)}
      label={t(`adjustmentStatus.${status}`, { defaultValue: status })}
    />
  );
}
export function TransferStatusBadge({ status }: { status: S['StockTransfer']['status'] }) {
  const { t } = useTranslation('stock');
  return (
    <Badge
      look={lookup(TRANSFER, status, UNKNOWN)}
      label={t(`transferStatus.${status}`, { defaultValue: status })}
    />
  );
}
export function ReceiptStatusBadge({ status }: { status: S['GoodsReceipt']['status'] }) {
  const { t } = useTranslation('stock');
  return (
    <Badge
      look={lookup(RECEIPT, status, UNKNOWN)}
      label={t(`receiptStatus.${status}`, { defaultValue: status })}
    />
  );
}

const DIRECTION = {
  GAIN: { tone: 'good', icon: ArrowUpRight },
  LOSS: { tone: 'critical', icon: ArrowDownRight },
  NONE: { tone: 'slate', icon: Equal },
} as const;

/** A variance or adjustment line's direction in words: the sign never travels in the number. */
export function DirectionBadge({ direction }: { direction: 'GAIN' | 'LOSS' | 'NONE' }) {
  const { t } = useTranslation('stock');
  return (
    <Badge
      look={lookup(DIRECTION, direction, UNKNOWN)}
      label={t(`direction.${direction}`, { defaultValue: direction })}
    />
  );
}
