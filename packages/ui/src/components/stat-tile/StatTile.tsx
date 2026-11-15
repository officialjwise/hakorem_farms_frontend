import { Slot, Slottable } from '@radix-ui/react-slot';
import { ArrowDownRight, ArrowUpRight, CircleSlash, Minus } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';
import { Skeleton } from '../skeleton/Skeleton';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type TrendDirection = 'up' | 'down' | 'flat';
/** Whether the movement is good news. Separate from direction: purchases going up is not good news. */
export type TrendTone = 'good' | 'critical' | 'neutral';

export interface StatTrend {
  direction: TrendDirection;
  tone: TrendTone;
  /** Required. The change in words, from the API's figures, for example "12.4% on yesterday". */
  label: string;
}

export type StatTileProps<L extends string = string> = {
  /** Required. What the figure is, already translated. */
  label: NonEmpty<L>;
  /** The figure, already formatted (MoneyDisplay, QuantityDisplay or a count). */
  value?: ReactNode;
  /** A second line under the figure, such as "of which GH₵ 1,200.00 overdue". */
  detail?: ReactNode;
  trend?: StatTrend;
  /** A decorative icon that says which area the figure belongs to. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** While the figure loads: a skeleton with this label in place of value, detail and trend. */
  loadingLabel?: string;
  /**
   * The figure has no data source yet: these words replace value, detail and trend. Never a zero or a
   * placeholder number. Wins over `value`.
   */
  unavailable?: string;
  /** Pass a link (or button) as the only child to make the whole tile the target, as Card does. */
  asChild?: boolean;
  /** The link element when `asChild` is set. */
  children?: ReactNode;
  className?: string;
};

const ARROW: Record<TrendDirection, ComponentType<SVGProps<SVGSVGElement>>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const TONE: Record<TrendTone, { text: string; icon: string }> = {
  good: { text: 'text-good-fg bg-good-subtle', icon: 'stroke-good' },
  critical: { text: 'text-critical-fg bg-critical-subtle', icon: 'stroke-critical' },
  neutral: { text: 'text-fg-muted bg-surface-sunken', icon: 'stroke-slate' },
};

/**
 * StatTile. One headline figure, what it is, and how it moved. The movement is an arrow (shape) plus words
 * plus colour, never colour alone; the words and the figures come from the API, this only lays them out.
 * With `asChild` and a link child the whole tile goes to the screen behind the figure.
 */
export function StatTile<L extends string>({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  loadingLabel,
  unavailable,
  asChild = false,
  children,
  className,
}: StatTileProps<L>) {
  if (label.trim() === '') {
    throw new Error('StatTile needs a non-empty label: a figure must say what it is.');
  }
  const Comp = asChild ? Slot : 'div';
  const Arrow = trend === undefined ? null : ARROW[trend.direction];
  const loading = loadingLabel !== undefined;
  return (
    <Comp
      data-slot="stat-tile"
      aria-busy={loading || undefined}
      data-state={unavailable !== undefined ? 'unavailable' : loading ? 'loading' : 'ready'}
      className={cn(
        'grid min-w-0 content-start gap-1 rounded-lg border border-border bg-surface p-4 text-fg',
        unavailable !== undefined && 'border-dashed bg-surface-sunken',
        asChild && [
          'cursor-pointer transition-colors duration-fast hover-enabled:bg-surface-hover',
          'outline-focus outline-offset-2 focus-visible:outline-2',
        ],
        className,
      )}
    >
      <Slottable>{children}</Slottable>
      <span className="flex items-center gap-2 text-sm text-fg-muted">
        {Icon === undefined ? null : (
          <Icon
            aria-hidden="true"
            focusable="false"
            className="size-icon-md shrink-0 stroke-accent"
          />
        )}
        <span className="min-w-0">{label}</span>
      </span>
      {unavailable !== undefined ? (
        <span className="flex items-center gap-1.5 py-1 text-sm font-semibold text-fg-muted">
          <CircleSlash
            aria-hidden="true"
            focusable="false"
            className="size-icon-sm shrink-0 stroke-slate"
          />
          {unavailable}
        </span>
      ) : loading ? (
        <Skeleton label={loadingLabel} shape="line" className="h-8" />
      ) : (
        <>
          <span className="text-xl font-semibold break-words tabular-nums sm:text-2xl">
            {value}
          </span>
          {detail === undefined ? null : (
            <span className="text-control-sm text-fg-muted">{detail}</span>
          )}
          {trend === undefined || Arrow === null ? null : (
            <span
              data-trend={trend.direction}
              data-tone={trend.tone}
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full px-2 py-0.5 text-control-sm font-semibold',
                TONE[trend.tone].text,
              )}
            >
              <Arrow
                aria-hidden="true"
                focusable="false"
                strokeWidth={2.5}
                className={cn('size-icon-sm shrink-0', TONE[trend.tone].icon)}
              />
              {trend.label}
            </span>
          )}
        </>
      )}
    </Comp>
  );
}
