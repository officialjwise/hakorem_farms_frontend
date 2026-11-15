import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export interface ProgressItem {
  /** A stable key, such as the category id. */
  id: string;
  /** Required. The row's name, such as "Live goats". */
  label: string;
  /** Geometry only: the bar's length in the row's own unit. */
  value: number;
  /** The figure people read, already formatted, such as "1,565 head". */
  formatted: string;
  /** Where the row leads, if anywhere. */
  href?: string;
}

export type ProgressListProps<T extends string = string> = {
  /** Required. The list's accessible name. */
  label: NonEmpty<T>;
  items: readonly ProgressItem[];
  /** The bar's full length. Defaults to the largest value, so the longest bar fills the track. */
  max?: number;
  /** Renders a row's link with the app's router; defaults to a plain anchor. */
  renderLink?: (href: string, children: ReactNode, className: string) => ReactNode;
  className?: string;
};

const LINK =
  'rounded-sm underline-offset-2 outline-focus outline-offset-2 hover:underline focus-visible:outline-2';

/**
 * ProgressList. Horizontal bars with their figures, such as stock by category. Each row says its name and
 * figure in words; the bar only shows proportion. A row with `href` is a link.
 */
export function ProgressList<T extends string>({
  label,
  items,
  max,
  renderLink = (href, children, className) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  className,
}: ProgressListProps<T>) {
  if (label.trim() === '') throw new Error('A progress list needs a non-empty label.');
  const top = max ?? Math.max(0, ...items.map((item) => item.value));
  return (
    <ul data-slot="progress-list" aria-label={label} className={cn('grid gap-3', className)}>
      {items.map((item) => {
        const width = top > 0 ? Math.max(0, Math.min(100, (item.value / top) * 100)) : 0;
        return (
          <li key={item.id} className="grid gap-1">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              {item.href === undefined ? (
                <span className="min-w-0 truncate">{item.label}</span>
              ) : (
                renderLink(item.href, item.label, cn('min-w-0 truncate text-fg', LINK))
              )}
              <span className="shrink-0 font-semibold tabular-nums">{item.formatted}</span>
            </span>
            <span
              aria-hidden="true"
              className="block h-2 overflow-hidden rounded-full bg-surface-sunken"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${width}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
