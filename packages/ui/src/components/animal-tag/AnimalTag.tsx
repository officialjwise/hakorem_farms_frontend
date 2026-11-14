import { cn } from '../../lib/cn';
import type { BadgeIcon } from '../status-badge/StatusBadge';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type AnimalTagProps<T extends string = string> = {
  /** Required. The ear tag number, shown in full. Truncation is visual only. */
  tagNo: NonEmpty<T>;
  /** Decorative species icon. */
  icon?: BadgeIcon;
  /** Secondary text, already translated, for example "Goat". */
  speciesLabel?: string;
  className?: string;
  /** Not accepted: tagNo is the only content, so nothing can bypass it. */
  children?: never;
};

/** AnimalTag. An individual animal's tag number as a pill. Display only. */
export function AnimalTag<T extends string>({
  tagNo,
  icon: Icon,
  speciesLabel,
  className,
}: AnimalTagProps<T>) {
  if (tagNo.trim() === '') {
    throw new Error('AnimalTag needs a non-empty tagNo.');
  }
  return (
    <span
      data-slot="animal-tag"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2 py-0.5 align-middle',
        'text-control-sm leading-tight text-fg',
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" focusable="false" className="size-icon-sm shrink-0" />
      ) : null}
      <span className="truncate font-mono font-semibold tabular-nums">{tagNo}</span>
      {speciesLabel ? (
        <>
          {/* A real space, so the accessible name reads "GT-0142 Goat"; flex layout ignores it visually. */}{' '}
          <span className="shrink-0 font-normal text-fg-muted">{speciesLabel}</span>
        </>
      ) : null}
    </span>
  );
}
