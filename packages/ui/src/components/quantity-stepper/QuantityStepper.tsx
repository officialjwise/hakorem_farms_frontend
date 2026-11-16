'use client';

import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { inputVariants } from '../input/Input';

type NonEmpty<T extends string> = T extends '' ? never : T;

export interface QuantityStepperProps<L extends string = string> {
  /** Required. What is counted, for example "Packs" or "Quantity of Eggs, big". */
  label: NonEmpty<L>;
  /** Show the label above the control; otherwise it names the group for a screen reader only. */
  showLabel?: boolean;
  /** Whole units. */
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Required. The minus button's name, for example "One fewer". */
  decreaseLabel: NonEmpty<string>;
  /** Required. The plus button's name, for example "One more". */
  increaseLabel: NonEmpty<string>;
  disabled?: boolean;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * QuantityStepper. A whole number of units with minus and plus buttons big enough for a thumb, and the
 * number itself typed if that is quicker. Digits only; it never goes below `min` or above `max`. The
 * buttons are the keyboard path; the field takes Up and Down as well.
 */
export function QuantityStepper<L extends string>({
  label,
  showLabel = false,
  value,
  onValueChange,
  min = 1,
  max = 99,
  decreaseLabel,
  increaseLabel,
  disabled = false,
  size = 'md',
  className,
}: QuantityStepperProps<L>) {
  if (label.trim() === '' || decreaseLabel.trim() === '' || increaseLabel.trim() === '') {
    throw new Error('QuantityStepper needs non-empty label, decreaseLabel and increaseLabel.');
  }
  const labelId = useId();
  const inputId = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    const next = clamp(n);
    if (next !== value) onValueChange(next);
  };
  return (
    <div data-slot="quantity-stepper" className={cn('grid gap-1', className)}>
      <label
        id={labelId}
        htmlFor={inputId}
        className={showLabel ? 'text-control-sm font-medium text-fg' : 'sr-only'}
      >
        {label}
      </label>
      <div role="group" aria-labelledby={labelId} className="flex items-stretch gap-1">
        <Button
          iconOnly
          variant="secondary"
          size={size}
          aria-label={decreaseLabel}
          disabled={disabled || value <= min}
          onClick={() => set(value - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          value={String(value)}
          disabled={disabled}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '');
            if (digits !== '') set(Number.parseInt(digits, 10));
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              set(value + 1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              set(value - 1);
            }
          }}
          className={cn(inputVariants({ size }), 'w-16 text-center tabular-nums')}
        />
        <Button
          iconOnly
          variant="secondary"
          size={size}
          aria-label={increaseLabel}
          disabled={disabled || value >= max}
          onClick={() => set(value + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
