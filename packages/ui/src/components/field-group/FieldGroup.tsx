'use client';

import { CircleAlert } from 'lucide-react';
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** Required groups carry visible words inside the legend, never an asterisk alone (ADR 0009). */
type RequiredProps =
  | { required?: false; requiredLabel?: never }
  | {
      required: true;
      /** Visible text inside the legend, for example "Required", already translated. */
      requiredLabel: string;
    };

type NativeProps = Omit<
  ComponentPropsWithRef<'fieldset'>,
  'children' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid'
>;

export type FieldGroupProps<L extends string = string> = NativeProps &
  RequiredProps & {
    /** Required. The group's question, as the legend. A placeholder is never a label. */
    label: NonEmpty<L>;
    /** Help text under the legend, linked to the group by aria-describedby. */
    hint?: string;
    /**
     * The error, in words. The group is invalid exactly when this has text. It
     * reaches screen readers through the group's description; the options carry
     * no aria-invalid.
     */
    error?: string;
    /** The options: radios or checkboxes, each with its own visible label. */
    children: ReactNode;
  };

/**
 * FieldGroup (ADR 0009). Labels a group of options with a `fieldset` and a
 * `legend`, and owns the group's hint, error and aria-describedby. Field wires
 * one control; FieldGroup labels a group. Each option keeps its own label.
 *
 * Extra props are spread onto the fieldset, so it can be the target of Radix's
 * `asChild`: `<RadioGroup asChild><FieldGroup …>` renders one element that is
 * both the fieldset and the radiogroup, named by the legend.
 */
export function FieldGroup<L extends string>({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  children,
  className,
  ...rest
}: FieldGroupProps<L>) {
  if (label.trim() === '') {
    throw new Error('FieldGroup needs a non-empty label. A placeholder is never a label.');
  }
  if (required && (requiredLabel ?? '').trim() === '') {
    throw new Error('A required FieldGroup needs visible requiredLabel text, not a marker alone.');
  }

  const id = useId();
  const legendId = `${id}-legend`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasHint = hint !== undefined && hint.trim() !== '';
  const hasError = error !== undefined && error.trim() !== '';
  const describedBy = [hasError ? errorId : null, hasHint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      {...rest}
      data-slot="field-group"
      data-invalid={hasError || undefined}
      aria-labelledby={legendId}
      aria-describedby={describedBy || undefined}
      className={cn('m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0', className)}
    >
      <legend id={legendId} className="mb-1.5 p-0 text-control-sm font-semibold text-fg">
        {label}
        {required ? (
          <>
            {' '}
            <span className="font-normal text-fg-muted">{requiredLabel}</span>
          </>
        ) : null}
      </legend>
      {hasHint ? (
        <p id={hintId} className="text-control-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-1">{children}</div>
      {hasError ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-control-sm font-medium text-critical-fg"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-icon-sm shrink-0 stroke-critical"
          />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
