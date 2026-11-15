import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface StatGroupProps<L extends string = string> {
  /** Required. Names the group, for example "Today at a glance". */
  label: NonEmpty<L>;
  /** StatTiles with `variant="cell"`. */
  children: ReactNode;
  className?: string;
}

/**
 * StatGroup (ADR 0036). The reference's stat row: one wide card divided into columns. As many columns as
 * fit at 11rem each, wrapping on a narrow screen. Each cell draws the rule on its leading and top edge,
 * pulled out by a pixel, and the card clips the rules on its outer edges, so every gap between two
 * figures has a rule and the card's edge has none, whatever the column count.
 */
export function StatGroup<L extends string>({ label, children, className }: StatGroupProps<L>) {
  if (label.trim() === '') throw new Error('StatGroup needs a non-empty label.');
  return (
    <section
      aria-label={label}
      data-slot="stat-group"
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] overflow-hidden',
        'rounded-lg border border-border bg-surface shadow-sm',
        '[&>*]:-ms-px [&>*]:-mt-px [&>*]:border-s [&>*]:border-t [&>*]:border-border',
        className,
      )}
    >
      {children}
    </section>
  );
}
