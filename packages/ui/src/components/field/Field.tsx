import { Slot } from '@radix-ui/react-slot';
import { CircleAlert } from 'lucide-react';
import { useId, type HTMLAttributes, type ReactElement } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** Required fields carry the `required` attribute and visible words, never an asterisk alone. */
type RequiredProps =
  | { required?: false; requiredLabel?: never }
  | {
      required: true;
      /** Visible text inside the label, for example "Required", already translated. */
      requiredLabel: string;
    };

export type FieldProps<L extends string = string> = RequiredProps & {
  /** Required. The visible label. A placeholder is never a label. */
  label: NonEmpty<L>;
  /** Help text under the label, linked to the control by aria-describedby. */
  hint?: string;
  /**
   * The error, in words. The field is invalid exactly when this has text, so a
   * red border without a message cannot happen. An empty string means no error.
   */
  error?: string;
  /**
   * Exactly one control. Field gives it its id, aria-describedby, aria-invalid
   * and required. The control never wires these itself.
   */
  children: ReactElement;
  className?: string;
};

/**
 * Field (ADR 0005). Owns everything that links a control to its words: the
 * generated id, the label association, the hint and error descriptions,
 * validity and required marking. It passes them to the control through Slot,
 * the same mechanism as Button's asChild.
 */
export function Field<L extends string>({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  children,
  className,
}: FieldProps<L>) {
  if (label.trim() === '') {
    throw new Error('Field needs a non-empty label. A placeholder is never a label.');
  }
  if (required && (requiredLabel ?? '').trim() === '') {
    throw new Error('A required Field needs visible requiredLabel text, not a marker alone.');
  }

  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasHint = hint !== undefined && hint.trim() !== '';
  const hasError = error !== undefined && error.trim() !== '';
  const describedBy = [hasError ? errorId : null, hasHint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  // What the control receives. `required` is not in Slot's generic HTML props, so it is typed here.
  const control: HTMLAttributes<HTMLElement> & { required?: boolean } = {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': hasError || undefined,
    required: required || undefined,
  };

  return (
    <div
      data-slot="field"
      data-invalid={hasError || undefined}
      className={cn('grid gap-1.5', className)}
    >
      <label htmlFor={id} className="text-control-sm font-semibold text-fg">
        {label}
        {required ? (
          <>
            {' '}
            <span className="font-normal text-fg-muted">{requiredLabel}</span>
          </>
        ) : null}
      </label>
      {hasHint ? (
        <p id={hintId} className="text-control-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      <Slot {...control}>{children}</Slot>
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
    </div>
  );
}
