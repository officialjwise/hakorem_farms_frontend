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
  return <Badge look={TAKE[status]} label={t(`takeStatus.${status}`)} />;
}
export function AdjustmentStatusBadge({ status }: { status: S['StockAdjustment']['status'] }) {
  const { t } = useTranslation('stock');
  return <Badge look={ADJUSTMENT[status]} label={t(`adjustmentStatus.${status}`)} />;
}
export function TransferStatusBadge({ status }: { status: S['StockTransfer']['status'] }) {
  const { t } = useTranslation('stock');
  return <Badge look={TRANSFER[status]} label={t(`transferStatus.${status}`)} />;
}
export function ReceiptStatusBadge({ status }: { status: S['GoodsReceipt']['status'] }) {
  const { t } = useTranslation('stock');
  return <Badge look={RECEIPT[status]} label={t(`receiptStatus.${status}`)} />;
}

const DIRECTION = {
  GAIN: { tone: 'good', icon: ArrowUpRight },
  LOSS: { tone: 'critical', icon: ArrowDownRight },
  NONE: { tone: 'slate', icon: Equal },
} as const;

/** A variance or adjustment line's direction in words: the sign never travels in the number. */
export function DirectionBadge({ direction }: { direction: 'GAIN' | 'LOSS' | 'NONE' }) {
  const { t } = useTranslation('stock');
  return <Badge look={DIRECTION[direction]} label={t(`direction.${direction}`)} />;
}
