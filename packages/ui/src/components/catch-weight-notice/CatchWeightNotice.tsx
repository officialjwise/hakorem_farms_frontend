import { Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type NonEmpty<T extends string> = T extends '' ? never : T;

export interface CatchWeightFact {
  /** The fact's name, already translated, for example "Price per kg". */
  term: string;
  /** Its value, already formatted: a `MoneyDisplay`, a `WeightDisplay`, or words. */
  value: ReactNode;
}

export interface CatchWeightNoticeProps<T extends string = string> {
  /** Required. What the notice is, for example "Priced by weight". It is the region's name. */
  title: NonEmpty<T>;
  /** The figures the API gives: the price per kg, the estimated weight, the estimate, the most it can be. */
  facts?: readonly CatchWeightFact[];
  /** The API's final-charge rule, in its own words: how the weighed amount is charged or refunded. */
  children?: ReactNode;
  /** `page` beside a price or a total; `compact` inside a basket line. */
  size?: 'page' | 'compact';
  className?: string;
}

/**
 * CatchWeightNotice (ADR 0040). A weighed item's price is an estimate until the scale. This says so where
 * the price is, so it cannot be missed: a thick accent edge, the scale icon and a title, the API's figures,
 * and the API's rule in its words. It computes nothing; every figure is one the API sent.
 */
export function CatchWeightNotice<T extends string>({
  title,
  facts = [],
  children,
  size = 'page',
  className,
}: CatchWeightNoticeProps<T>) {
  if (title.trim() === '') throw new Error('CatchWeightNotice needs a non-empty title.');
  const compact = size === 'compact';
  return (
    <section
      data-slot="catch-weight-notice"
      aria-label={title}
      className={cn(
        'grid gap-2 rounded-lg border-accent bg-accent-subtle text-fg',
        compact ? 'border-s-4 p-3 text-sm' : 'border-2 border-s-8 p-4',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-accent-subtle-fg">
        <Scale
          aria-hidden="true"
          focusable="false"
          className={cn('shrink-0 stroke-accent', compact ? 'size-icon-sm' : 'size-icon-lg')}
        />
        <span className={compact ? undefined : 'text-lg'}>{title}</span>
      </p>
      {facts.length === 0 ? null : (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
          {facts.map((fact) => (
            <div key={fact.term} className="contents">
              <dt className="text-fg-muted">{fact.term}</dt>
              <dd className="text-end font-semibold tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children === undefined ? null : <div className="text-pretty">{children}</div>}
    </section>
  );
}
