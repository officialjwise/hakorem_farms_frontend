import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { useId, type ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';
import { useRequireLabel } from '../../lib/useRequireLabel';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type CheckboxProps<L extends string = string> = Omit<
  ComponentPropsWithRef<typeof CheckboxPrimitive.Root>,
  'children' | 'asChild'
> & {
  /**
   * The option's own visible label, for a Checkbox inside a FieldGroup. Leave
   * it out for a single Checkbox inside a Field, which names it (ADR 0009).
   */
  label?: NonEmpty<L>;
  /** Help text under the option's label. Only with `label`. */
  hint?: string;
};

const box = [
  'peer group flex size-6 shrink-0 items-center justify-center rounded-sm',
  'border border-border-strong bg-surface text-accent-fg',
  'outline-focus outline-offset-2 focus-visible:outline-2',
  'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
  'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
  'aria-invalid:border-2 aria-invalid:border-critical',
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-fg-disabled',
  'disabled:data-[state=checked]:bg-surface-sunken disabled:data-[state=indeterminate]:bg-surface-sunken',
];

/**
 * Checkbox. A tick for checked and a dash for indeterminate, so state is shape
 * as well as colour. In a Field it is wired by Field; in a FieldGroup it keeps
 * its own visible label (ADR 0009). It throws after mount with no name.
 */
export function Checkbox<L extends string>({
  label,
  hint,
  id,
  className,
  ref,
  'aria-describedby': describedByProp,
  ...props
}: CheckboxProps<L>) {
  if (label !== undefined && label.trim() === '') {
    throw new Error('Checkbox label cannot be blank. Leave it out inside a Field.');
  }
  const named = useRequireLabel<HTMLButtonElement>('Checkbox', ref);
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const hasHint = label !== undefined && hint !== undefined && hint.trim() !== '';
  const describedBy = [describedByProp, hasHint ? hintId : null].filter(Boolean).join(' ');

  const control = (
    <CheckboxPrimitive.Root
      ref={named}
      id={controlId}
      data-slot="checkbox"
      aria-describedby={describedBy || undefined}
      className={cn(box, className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="size-icon-sm group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden="true"
          strokeWidth={3}
          className="hidden size-icon-sm group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (label === undefined) return control;

  return (
    <div data-slot="checkbox-option" className="flex min-h-control-sm items-start gap-2.5 py-0.5">
      {control}
      <div className="grid gap-0.5 pt-0.5">
        <label
          htmlFor={controlId}
          className="text-control-md text-fg peer-disabled:cursor-not-allowed peer-disabled:text-fg-disabled"
        >
          {label}
        </label>
        {hasHint ? (
          <p id={hintId} className="text-control-sm text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
