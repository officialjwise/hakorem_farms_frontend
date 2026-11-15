'use client';

import type { ComponentPropsWithRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants } from '../input/Input';

const textareaVariants = cva('h-auto resize-y py-2', {
  variants: { size: { sm: '', md: '', lg: '' } },
});

export type TextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'children'> &
  VariantProps<typeof textareaVariants> & {
    /** Visible lines. Defaults to 3. */
    rows?: number;
  };

/**
 * Textarea. Wired by Field, never by itself (ADR 0005). Wears inputVariants with
 * an automatic height, so it grows with `rows`, and resizes vertically only.
 */
export function Textarea({ className, size, rows = 3, ref, ...props }: TextareaProps) {
  const labelled = useRequireLabel<HTMLTextAreaElement>('Textarea', ref);
  return (
    <textarea
      ref={labelled}
      rows={rows}
      data-slot="textarea"
      className={cn(inputVariants({ size }), 'rounded-lg', textareaVariants({ size }), className)}
      {...props}
    />
  );
}
