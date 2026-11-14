import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const spinnerVariants = cva('inline-block shrink-0 animate-spin-token', {
  variants: {
    size: { sm: 'size-icon-sm', md: 'size-icon-md', lg: 'size-icon-lg' },
  },
  defaultVariants: { size: 'md' },
});

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/**
 * Either announced or decorative, never neither. A spinner on its own must tell
 * a screen reader what is loading; one inside a Button is already named by the
 * button's `loadingLabel`, so it is `decorative`.
 */
type NameProps<L extends string> =
  | {
      /** The text a screen reader hears, already translated, for example "Loading stock". */
      label: NonEmpty<L>;
      decorative?: never;
    }
  | { decorative: true; label?: never };

export type SpinnerProps<L extends string = string> = VariantProps<typeof spinnerVariants> &
  NameProps<L> & { className?: string };

/** Spinner. The one loading mark: Button composes it, and so can a screen that has nothing to skeleton. */
export function Spinner<L extends string>({ size, label, decorative, className }: SpinnerProps<L>) {
  if (!decorative && (label ?? '').trim() === '') {
    throw new Error('Spinner needs a label, or must be marked decorative.');
  }
  const mark = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(spinnerVariants({ size }), className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (decorative) return <span data-slot="spinner">{mark}</span>;
  return (
    <span data-slot="spinner" role="status" className="inline-flex">
      {mark}
      <span className="sr-only">{label}</span>
    </span>
  );
}
