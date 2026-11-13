import type { ReactElement } from 'react';
import {
  Controller,
  useFormContext,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Field } from '../components/field/Field';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

type RequiredProps =
  { required?: false; requiredLabel?: never } | { required: true; requiredLabel: string };

export type FormFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  L extends string = string,
> = RequiredProps & {
  name: TName;
  /**
   * Pass `form.control` to type `name` against the form's values. Without it the
   * control comes from the surrounding Form and `name` is any string.
   */
  control?: Control<TValues>;
  /** Required. The visible label, already translated. */
  label: NonEmpty<L>;
  hint?: string;
  className?: string;
  /**
   * Renders exactly one control, wired from the controller. `field.value`,
   * `field.onChange` and `field.onBlur` are the form's; pass `field.ref` so a
   * failed submit can focus the control. Field wires the id, description,
   * validity and required state, never the control.
   */
  children: (field: ControllerRenderProps<TValues, TName>) => ReactElement;
};

/**
 * FormField. A Controller and a Field in one. The error text is the form's
 * error message for `name` (a Zod message, or a server detail mapped by
 * mapServerErrors), handed to Field's `error`, so Field alone owns
 * aria-invalid and aria-describedby (ADR 0005).
 */
export function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  L extends string,
>({
  name,
  control,
  label,
  hint,
  required,
  requiredLabel,
  className,
  children,
}: FormFieldProps<TValues, TName, L>) {
  const context = useFormContext<TValues>();
  const requiredProps = (
    required ? { required: true, requiredLabel: requiredLabel ?? '' } : {}
  ) as RequiredProps;

  return (
    <Controller
      control={control ?? context.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
          {...requiredProps}
        >
          {children(field)}
        </Field>
      )}
    />
  );
}
