/**
 * What the F11 back office screens share: each status in words with an icon (never colour alone), and the
 * order's money as the API states it. Nothing is added up here.
 */
import {
  CircleCheck,
  CircleX,
  Clock,
  PackageCheck,
  Truck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { MoneyDisplay, StatusBadge, type StatusTone } from '@hakorem/ui';

type S = components['schemas'];
export type Order = S['SalesOrder'];
/** The order as the store reads it (2.29.0): lines, quantities and delivery, and never any money. */
export type OrderView = S['OrderFulfilmentView'];
/** What a pick screen reads of an order: the whole order, or the store's view of it. */
export type PickOrder = Order | OrderView;
export type Fulfilment = S['Fulfilment'];
export type Delivery = S['Delivery'];
export type Route = S['Route'];

export const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PICKING',
  'AWAITING_CUSTOMER',
  'PACKED',
  'READY_FOR_COLLECTION',
  'DISPATCHED',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURNED',
  'COMPLETED',
  'CANCELLED',
  'VOIDED',
] as const satisfies readonly Order['status'][];

export const CHANNELS = ['ONLINE', 'POS', 'WHOLESALE', 'QUOTE'] as const;

export const FULFILMENT_STATUSES = [
  'PICK_LIST',
  'PICKING',
  'PACKED',
  'DISPATCHED',
  'COLLECTED',
  'CANCELLED',
] as const satisfies readonly Fulfilment['status'][];

export const DELIVERY_STATUSES = [
  'SCHEDULED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'CANCELLED',
] as const satisfies readonly Delivery['status'][];

function look(status: string): { tone: StatusTone; icon: LucideIcon } {
  switch (status) {
    case 'DELIVERED':
    case 'COMPLETED':
    case 'COLLECTED':
      return { tone: 'good', icon: CircleCheck };
    case 'AWAITING_CUSTOMER':
    case 'DELIVERY_FAILED':
    case 'FAILED':
      return { tone: 'warning', icon: TriangleAlert };
    case 'CANCELLED':
    case 'VOIDED':
    case 'RETURNED':
      return { tone: 'critical', icon: CircleX };
    case 'PACKED':
    case 'READY_FOR_COLLECTION':
      return { tone: 'info', icon: PackageCheck };
    case 'DISPATCHED':
    case 'OUT_FOR_DELIVERY':
    case 'IN_PROGRESS':
      return { tone: 'info', icon: Truck };
    default:
      return { tone: 'info', icon: Clock };
  }
}

/** An order's, a pick list's, a delivery's or a run's status, in words and with an icon. */
export function FulfilmentStatusBadge({
  kind,
  status,
}: {
  kind: 'order' | 'fulfilment' | 'delivery' | 'route';
  status: string;
}) {
  const { t } = useTranslation('fulfilment');
  const { tone, icon } = look(status);
  return (
    <StatusBadge
      tone={tone}
      icon={icon}
      label={t(`status.${kind}.${status}`, { defaultValue: status })}
    />
  );
}

/** The order's money as the API states it: estimate, the most without consent, final, paid and owed. */
export function OrderTotals({ order: o }: { order: Order }) {
  const { t } = useTranslation('fulfilment');
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
      <dt>{t('totals.estimate')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={o.estimatedTotalPesewas} />
      </dd>
      <dt>{t('totals.maximum')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={o.maximumTotalPesewas} />
      </dd>
      <dt>{t('totals.deliveryFee')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={o.deliveryFeePesewas} />
      </dd>
      <dt className="font-semibold">{t('totals.final')}</dt>
      <dd className="text-end">
        <MoneyDisplay
          pesewas={o.finalTotalPesewas}
          strong
          notApplicableLabel={t('totals.notFinal')}
        />
      </dd>
      <dt>{t('totals.paid')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={o.paidPesewas} />
      </dd>
      <dt>{t('totals.outstanding')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={o.outstandingPesewas} />
      </dd>
    </dl>
  );
}
