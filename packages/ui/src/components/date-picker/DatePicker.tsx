import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants, type InputProps } from '../input/Input';

/** A calendar date, `YYYY-MM-DD`, the contract's `date` format. */
export type DateString = string;

export type DatePickerProps = Omit<
  ComponentPropsWithRef<'input'>,
  'size' | 'type' | 'children' | 'value' | 'defaultValue' | 'min' | 'max'
> &
  Pick<InputProps, 'size'> & {
    value?: DateString;
    defaultValue?: DateString;
    min?: DateString;
    max?: DateString;
  };

/**
 * DatePicker (ADR 0010): a token-styled native date input. The browser supplies
 * the calendar and the month names, so the UI package holds no copy and adds no
 * bytes. Wired by Field (ADR 0005).
 */
export function DatePicker({ className, size, ref, ...props }: DatePickerProps) {
  const labelled = useRequireLabel<HTMLInputElement>('DatePicker', ref);
  return (
    <input
      ref={labelled}
      type="date"
      data-slot="date-picker"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
