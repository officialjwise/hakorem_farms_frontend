import { Slot, Slottable } from '@radix-ui/react-slot';
import { ChevronRight } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeTone } from '../status-badge/StatusBadge';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type AlertRowProps<T extends string = string> = {
  /** Required. What needs attention, such as the product's name. */
  title: NonEmpty<T>;
  /** The record's reference or where it is, such as a lot number and location. */
  meta?: ReactNode;
  /** The state on the right, usually a StatusBadge (words, icon and tone). */
  status?: ReactNode;
  /** An icon that says what kind of record it is. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The icon well's tone. Decorative: the status carries the meaning in words. */
  tone?: BadgeTone | 'accent';
  /** Pass a link as the only child to make the whole row go to the record, as Card does. */
  asChild?: boolean;
  children?: ReactNode;
  className?: string;
};

const WELL: Record<NonNullable<AlertRowProps['tone']>, { well: string; icon: string }> = {
  accent: { well: 'bg-accent-subtle', icon: 'stroke-accent' },
  good: { well: 'bg-good-subtle', icon: 'stroke-good' },
  warning: { well: 'bg-warning-subtle', icon: 'stroke-warning' },
  critical: { well: 'bg-critical-subtle', icon: 'stroke-critical' },
  info: { well: 'bg-info-subtle', icon: 'stroke-info' },
  violet: { well: 'bg-violet-subtle', icon: 'stroke-violet' },
  plum: { well: 'bg-plum-subtle', icon: 'stroke-plum' },
  clay: { well: 'bg-clay-subtle', icon: 'stroke-clay' },
  slate: { well: 'bg-slate-subtle', icon: 'stroke-slate' },
};

/**
 * AlertRow. One record in an attention list (stock alerts, expiring lots, expired lots): what it is, its
 * reference, and its state in words. With `asChild` and a link child the whole row opens the record.
 */
export function AlertRow<T extends string>({
  title,
  meta,
  status,
  icon: Icon,
  tone = 'accent',
  asChild = false,
  children,
  className,
}: AlertRowProps<T>) {
  if (title.trim() === '') throw new Error('AlertRow needs a non-empty title.');
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      data-slot="alert-row"
      className={cn(
        'flex min-h-row items-center gap-3 rounded-md px-2 py-2 text-fg',
        asChild && [
          'transition-colors duration-fast hover-enabled:bg-surface-hover',
          'outline-focus outline-offset-[-2px] focus-visible:outline-2',
        ],
        className,
      )}
    >
      <Slottable>{children}</Slottable>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', WELL[tone].well)}>
        <Icon
          aria-hidden="true"
          focusable="false"
          className={cn('size-icon-md', WELL[tone].icon)}
        />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-semibold">{title}</span>
        {meta === undefined ? null : (
          <span className="truncate text-control-sm text-fg-muted">{meta}</span>
        )}
      </span>
      {status === undefined ? null : <span className="shrink-0">{status}</span>}
      {asChild ? (
        <ChevronRight
          aria-hidden="true"
          focusable="false"
          className="size-icon-sm shrink-0 stroke-slate"
        />
      ) : null}
    </Comp>
  );
}
