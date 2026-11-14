import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';
import { inputVariants } from '../input/Input';

export type AffixInputProps = Omit<ComponentPropsWithRef<'input'>, 'size' | 'type' | 'children'> & {
  /** Visible unit before the value, for example the cedi sign. Hidden from screen readers: the label names the unit. */
  prefix?: string;
  /** Visible unit after the value, for example kg. Hidden from screen readers: the label names the unit. */
  suffix?: string;
};

/**
 * Shared by MoneyInput and WeightInput: a wrapper that wears inputVariants and
 * shows the unit beside a borderless input. The ring, the invalid border and the
 * disabled look are drawn on the wrapper from the input's own state (`has-[...]`),
 * so Field's aria-invalid on the input still drives it (ADR 0005).
 */
export function AffixInput({ className, prefix, suffix, ref, ...props }: AffixInputProps) {
  const labelled = useRequireLabel<HTMLInputElement>('AffixInput', ref);
  return (
    <span
      data-slot="affix-input"
      className={cn(
        inputVariants(),
        'flex items-center gap-1.5',
        'has-[input:focus-visible]:outline-2',
        'has-[input[aria-invalid=true]]:border-2 has-[input[aria-invalid=true]]:border-critical',
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-surface-sunken has-[input:disabled]:text-fg-disabled',
        'has-[input:read-only]:bg-surface-sunken',
        className,
      )}
    >
      {prefix ? (
        <span aria-hidden="true" className="shrink-0 text-fg-muted">
          {prefix}
        </span>
      ) : null}
      <input
        ref={labelled}
        type="text"
        data-slot="affix-input-control"
        className="h-full min-w-0 flex-1 bg-transparent text-end text-inherit outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
        {...props}
      />
      {suffix ? (
        <span aria-hidden="true" className="shrink-0 text-fg-muted">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
