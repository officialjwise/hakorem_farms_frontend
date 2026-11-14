'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';

/**
 * The look shared by every single-line text control: Input, NumberInput,
 * MoneyInput, WeightInput, DatePicker, and the triggers of Select and Combobox.
 * Like `buttonVariants`, it is exported so a control built on another primitive
 * wears the same boundary, focus ring and invalid treatment.
 *
 * Invalid is read from `aria-invalid`, which Field sets (ADR 0005). The control
 * never decides it, so a red border without words cannot happen.
 */
export const inputVariants = cva(
  [
    'w-full min-w-0 rounded-md border border-border-strong bg-surface text-fg tabular-nums',
    'placeholder:text-fg-muted',
    'outline-focus outline-offset-2 focus-visible:outline-2',
    'transition-colors duration-fast ease-standard',
    'read-only:bg-surface-sunken',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-disabled',
    'aria-invalid:border-2 aria-invalid:border-critical',
  ],
  {
    variants: {
      size: {
        sm: 'h-control-sm px-control-sm text-control-sm',
        md: 'h-control-md px-control-md text-control-md',
        lg: 'h-control-lg px-control-lg text-control-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** A text-like control. Checkboxes, radios, files and the like have their own components. */
export type InputType = 'text' | 'email' | 'tel' | 'url' | 'search' | 'password';

export type InputProps = Omit<ComponentPropsWithRef<'input'>, 'size' | 'type' | 'children'> &
  VariantProps<typeof inputVariants> & {
    type?: InputType;
  };

/**
 * Input. Wired by Field, never by itself: put it inside a Field (ADR 0005). It
 * throws after mount if it has no label, so an unlabelled input cannot ship.
 */
export function Input({ className, size, type = 'text', ref, ...props }: InputProps) {
  const labelled = useRequireLabel<HTMLInputElement>('Input', ref);
  return (
    <input
      ref={labelled}
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
