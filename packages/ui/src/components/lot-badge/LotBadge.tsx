import { cn } from '../../lib/cn';
import { StatusBadge, type BadgeIcon, type BadgeTone } from '../status-badge/StatusBadge';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/**
 * The lot's expiry state in words, tone and icon. The screen derives all three
 * from the API's state: whether a lot is expiring or expired is never decided here.
 */
export interface LotExpiry {
  label: string;
  tone: BadgeTone;
  icon: BadgeIcon;
}

export type LotBadgeProps<B extends string = string> = {
  /** Required. The batch number of the lot, shown in full. */
  batchNo: NonEmpty<B>;
  expiry?: LotExpiry;
  className?: string;
};

/** LotBadge. A meat lot's batch number, with its expiry state as a StatusBadge when one applies. */
export function LotBadge<B extends string>({ batchNo, expiry, className }: LotBadgeProps<B>) {
  if (batchNo.trim() === '') {
    throw new Error('LotBadge needs a non-empty batchNo.');
  }
  return (
    <span
      data-slot="lot-badge"
      className={cn('inline-flex max-w-full items-center gap-2 align-middle', className)}
    >
      <span className="inline-flex min-w-0 items-center rounded-md border border-border-strong bg-surface px-2 py-0.5 text-control-sm text-fg">
        <span className="truncate font-mono font-semibold tabular-nums">{batchNo}</span>
      </span>
      {expiry ? <StatusBadge tone={expiry.tone} icon={expiry.icon} label={expiry.label} /> : null}
    </span>
  );
}
