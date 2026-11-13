import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const badgeVariants = cva(
  [
    'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 align-middle',
    'text-control-sm leading-tight font-semibold whitespace-nowrap tabular-nums',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-border-strong bg-surface-sunken text-fg',
        accent: 'border-accent bg-accent-subtle text-accent-subtle-fg',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = Omit<ComponentPropsWithRef<'span'>, 'children'> &
  VariantProps<typeof badgeVariants> & {
    /** Short text, already formatted by the caller: a count, a tag, a category. */
    children: ReactNode;
  };

/**
 * Badge. A small label that is not a state. A state (in stock, overdue, voided)
 * is a StatusBadge, which carries an icon and words as well as colour. Nothing
 * is formatted here: a count arrives as the text to show.
 */
export function Badge({ className, tone, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-tone={tone ?? 'neutral'}
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
