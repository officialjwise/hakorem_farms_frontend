import type { ChangeEvent, ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants, type InputProps } from '../input/Input';

/**
 * Keeps digits, at most one '.', at most `decimals` places, and a leading minus
 * when negatives are allowed. Everything else is dropped, so text that is not a
 * number cannot exist. Works on strings only: no number conversion.
 */
export function sanitizeNumber(raw: string, decimals: number, allowNegative: boolean): string {
  const negative = allowNegative && raw.trimStart().startsWith('-');
  let seenPoint = false;
  let whole = '';
  let fraction = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (seenPoint) fraction += ch;
      else whole += ch;
    } else if (ch === '.' && decimals > 0 && !seenPoint) {
      seenPoint = true;
    }
  }
  fraction = fraction.slice(0, decimals);
  const body = seenPoint ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}

export type NumberInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'size' | 'type' | 'children' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> &
  Pick<InputProps, 'size'> & {
    /** The digits as typed, for example "38.5". Never a JavaScript number. */
    value: string;
    onValueChange: (value: string) => void;
    /** Decimal places allowed, 0 to 6. Defaults to 0 (whole numbers). */
    decimals?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /** Allow a leading minus. Defaults to false. */
    allowNegative?: boolean;
  };

/**
 * NumberInput. A text input, never type="number" (no spinner, no locale, no
 * scroll-wheel edits). It sanitises as the operator types and hands back the
 * string, so nothing is ever parsed as a float. Wired by Field (ADR 0005).
 */
export function NumberInput({
  className,
  size,
  value,
  onValueChange,
  decimals = 0,
  allowNegative = false,
  ref,
  ...props
}: NumberInputProps) {
  const labelled = useRequireLabel<HTMLInputElement>('NumberInput', ref);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(sanitizeNumber(event.target.value, decimals, allowNegative));
  };
  return (
    <input
      ref={labelled}
      type="text"
      inputMode={decimals === 0 ? 'numeric' : 'decimal'}
      autoComplete="off"
      data-slot="number-input"
      value={value}
      onChange={handleChange}
      className={cn(inputVariants({ size }), 'text-end', className)}
      {...props}
    />
  );
}
