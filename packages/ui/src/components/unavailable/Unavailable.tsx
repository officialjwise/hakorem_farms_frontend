import { CircleSlash } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type UnavailableProps<T extends string = string> = {
  /** Required. That the figure is unavailable, in words, such as "No data source yet". */
  title: NonEmpty<T>;
  /** Why, or when it arrives, such as "Sales figures arrive with the sales module". */
  description?: string;
  className?: string;
};

/**
 * Unavailable. The state of a figure, chart or list the API says has no data source yet. Distinct from
 * empty (the source exists and holds nothing) and from an error (the source failed): a dashed edge, a
 * crossed circle and words, and never a zero or a placeholder figure in its place.
 */
export function Unavailable<T extends string>({
  title,
  description,
  className,
}: UnavailableProps<T>) {
  if (title.trim() === '') throw new Error('Unavailable needs a non-empty title.');
  return (
    <div
      data-slot="unavailable"
      className={cn(
        'flex items-start gap-2 rounded-md border border-dashed border-border-strong bg-surface-sunken p-3',
        className,
      )}
    >
      <CircleSlash
        aria-hidden="true"
        focusable="false"
        className="mt-0.5 size-icon-md shrink-0 stroke-slate"
      />
      <div className="grid gap-0.5">
        <p className="font-semibold text-fg">{title}</p>
        {description === undefined ? null : <p className="text-sm text-fg-muted">{description}</p>}
      </div>
    </div>
  );
}
