import { useComposedRefs } from '@radix-ui/react-compose-refs';
import * as RadioPrimitive from '@radix-ui/react-radio-group';
import { useEffect, useId, useRef, type ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/cn';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

export type RadioGroupProps = ComponentPropsWithRef<typeof RadioPrimitive.Root>;

/**
 * RadioGroup. A thin wrapper of Radix's root (state, roving focus, arrow keys).
 * Compose it with FieldGroup through `asChild`, so one element is both the
 * fieldset and the radiogroup and the accessibility tree holds exactly one
 * named group (ADR 0009, ADR 0010):
 *
 *   <RadioGroup asChild><FieldGroup label="…"><Radio … /></FieldGroup></RadioGroup>
 *
 * It throws after mount when the group has no name, so an unlabelled group
 * cannot ship.
 */
export function RadioGroup({ ref, ...props }: RadioGroupProps) {
  const own = useRef<HTMLDivElement | null>(null);
  const composed = useComposedRefs(own, ref);

  useEffect(() => {
    const el = own.current;
    if (el === null) return;
    const named =
      (el.getAttribute('aria-label') ?? '').trim() !== '' ||
      (el.getAttribute('aria-labelledby') ?? '').trim() !== '' ||
      el.querySelector(':scope > legend') !== null;
    if (!named) {
      throw new Error(
        'RadioGroup has no name. Compose it with FieldGroup through asChild (ADR 0009), or give it an aria-label.',
      );
    }
  });

  return <RadioPrimitive.Root ref={composed} {...props} />;
}

export type RadioProps<L extends string = string> = Omit<
  ComponentPropsWithRef<typeof RadioPrimitive.Item>,
  'children' | 'asChild'
> & {
  /** Required. The option's own visible label, already translated. */
  label: NonEmpty<L>;
  /** Help text under the label, linked to the option by aria-describedby. */
  hint?: string;
};

/**
 * Radio. One option of a RadioGroup, labelled by its own visible text, not by
 * FieldGroup and not by Field (ADR 0009). The circle holds a dot when
 * selected, so state is shape as well as colour.
 */
export function Radio<L extends string>({
  label,
  hint,
  id,
  className,
  'aria-describedby': describedByProp,
  ...props
}: RadioProps<L>) {
  if (label.trim() === '') {
    throw new Error('Radio needs a non-empty label. Each option keeps its own label.');
  }
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const hasHint = hint !== undefined && hint.trim() !== '';
  const describedBy = [describedByProp, hasHint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div data-slot="radio" className="flex min-h-control-sm items-start gap-2.5 py-0.5">
      <RadioPrimitive.Item
        id={controlId}
        aria-describedby={describedBy || undefined}
        className={cn(
          'peer mt-px flex size-6 shrink-0 items-center justify-center rounded-full',
          'border border-border-strong bg-surface',
          'outline-focus outline-offset-2 focus-visible:outline-2',
          'data-[state=checked]:border-2 data-[state=checked]:border-accent',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken',
          className,
        )}
        {...props}
      >
        <RadioPrimitive.Indicator className="block size-3 rounded-full bg-accent" />
      </RadioPrimitive.Item>
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
