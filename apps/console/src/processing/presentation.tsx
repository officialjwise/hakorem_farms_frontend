import { CircleAlert, CircleCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { MoneyDisplay, StatusBadge, WeightDisplay, type BadgeTone } from '@hakorem/ui';
import { lookup, UNKNOWN } from '../lib/lookup';

type S = components['schemas'];
export type Order = S['ProcessingOrder'];
export type OrderStatus = Order['status'];
export type OutputKind = S['ProcessingOutput']['outputKind'];
export type CostKind = S['ProcessingCost']['costKind'];
export type WeightSource = S['WeightSource'];

/** The contract's own values, in the order a person meets them. */
export const ORDER_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const OUTPUT_KINDS = ['MEAT', 'OFFAL', 'BY_PRODUCT', 'WASTE'] as const;
export const COST_KINDS = ['LABOUR', 'CONSUMABLE', 'SERVICE', 'UTILITY'] as const;
export const WEIGHT_SOURCES = ['SCALE', 'MANUAL', 'ESTIMATE'] as const;

/** The contract's `Percent`: 0 to 100, up to four places, as a string. Checked, never parsed. */
export const PERCENT = /^(100|[0-9]{1,2})(\.[0-9]{1,4})?$/;

const STATUS: Record<OrderStatus, { tone: BadgeTone }> = {
  PLANNED: { tone: 'info' },
  IN_PROGRESS: { tone: 'warning' },
  COMPLETED: { tone: 'good' },
  CANCELLED: { tone: 'slate' },
};

/** A processing order's state in words, never only by colour (ADR 0036). */
export function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('processing');
  return (
    <StatusBadge
      tone={lookup(STATUS, status, UNKNOWN).tone}
      label={t(`orderStatus.${status as OrderStatus}`, { defaultValue: status })}
    />
  );
}

/**
 * The yield against its standard, in words. `yieldVarianceFlag` is set only when the order completes
 * (completeProcessingOrder), so before that the flag's `false` means "not judged yet", not "within".
 */
export function YieldFlag({ order }: { order: Pick<Order, 'status' | 'yieldVarianceFlag'> }) {
  const { t } = useTranslation('processing');
  if (order.status !== 'COMPLETED') {
    return <StatusBadge tone="slate" icon={Clock} label={t('yield.notJudged')} />;
  }
  return order.yieldVarianceFlag ? (
    <StatusBadge tone="warning" icon={CircleAlert} label={t('yield.flagged')} />
  ) : (
    <StatusBadge tone="good" icon={CircleCheck} label={t('yield.within')} />
  );
}

/** A percentage exactly as the API sent it ("48", "58.446"), with its sign. */
export function PercentText({ value }: { value: string }) {
  const { t } = useTranslation('processing');
  return <>{t('percent', { value })}</>;
}

/**
 * A figure the API sets only when the order completes (contract 1.22.0): until then it is null or zero,
 * and the screen says "Set at completion" in words rather than show a zero or a dash.
 */
export function SetAtCompletion() {
  const { t } = useTranslation('processing');
  return <span className="text-fg-muted">{t('setAtCompletion')}</span>;
}

/** Money the API sets at completion: the amount once it exists, "Set at completion" before. */
export function CompletionMoney({
  pesewas,
  settled,
  strong,
}: {
  pesewas: number | null;
  /** True once the order is COMPLETED, when a zero is a real zero. */
  settled: boolean;
  strong?: boolean;
}) {
  if (!settled || pesewas === null) return <SetAtCompletion />;
  return <MoneyDisplay pesewas={pesewas} strong={strong ?? false} />;
}

/** A weight the API may not have yet: the weight, or "Set at completion". */
export function CompletionWeight({ kilograms }: { kilograms: string | null }) {
  if (kilograms === null) return <SetAtCompletion />;
  return <WeightDisplay kilograms={kilograms} />;
}

/** The order's name: its number, or "Not numbered yet" until document numbering exists. */
export function useOrderName(): (order: Pick<Order, 'orderNo'>) => string {
  const { t } = useTranslation('processing');
  return (order) => order.orderNo ?? t('notNumbered');
}
