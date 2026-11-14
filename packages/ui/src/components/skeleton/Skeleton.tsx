import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const skeletonVariants = cva(
  'block bg-surface-sunken animate-pulse motion-reduce:animate-none',
  {
    variants: {
      shape: {
        /** One line of text. */
        line: 'h-3 w-full rounded-sm',
        /** A block: an image, a card body. Give it a height with className. */
        block: 'h-24 w-full rounded-md',
        /** An avatar or a dot. Give it a size with className. */
        circle: 'size-icon-lg rounded-full',
      },
    },
    defaultVariants: { shape: 'line' },
  },
);

export type SkeletonProps = VariantProps<typeof skeletonVariants> & {
  /**
   * Announced once to screen readers as a status, for example "Loading stock on
   * hand". Pass it on one skeleton per loading region, not on every bar. Without
   * it the skeleton is decorative and the region around it must announce.
   */
  label?: string;
  className?: string;
};

/** Skeleton. A placeholder shape that keeps the layout from jumping when data lands. */
export function Skeleton({ shape, label, className }: SkeletonProps) {
  const bar = (
    <span
      aria-hidden="true"
      data-slot="skeleton"
      data-shape={shape ?? 'line'}
      className={cn(skeletonVariants({ shape }), className)}
    />
  );
  if (label === undefined) return bar;
  return (
    <>
      <span role="status" className="sr-only">
        {label}
      </span>
      {bar}
    </>
  );
}
