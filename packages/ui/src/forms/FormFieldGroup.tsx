'use client';

import type { ReactElement, ReactNode } from 'react';
import {
  Controller,
  useFormContext,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { FieldGroup } from '../components/field-group/FieldGroup';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

type RequiredProps =
  { required?: false; requiredLabel?: never } | { required: true; requiredLabel: string };

export type FormFieldGroupProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  L extends string = string,
> = RequiredProps & {
  name: TName;
  control?: Control<TValues>;
  /** Required. The group's question, as the legend, already translated. */
  label: NonEmpty<L>;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** The options: Radio or Checkbox, each with its own visible label. */
  children: (field: ControllerRenderProps<TValues, TName>) => ReactNode;
  /**
   * For a radio group: wrap the FieldGroup so one element is both the fieldset
   * and the radiogroup (ADR 0009, ADR 0010). A checkbox group leaves it out.
   *
   *   wrap={(group, field) => (
   *     <RadioGroup asChild value={field.value} onValueChange={field.onChange}>{group}</RadioGroup>
   *   )}
   */
  wrap?: (group: ReactElement, field: ControllerRenderProps<TValues, TName>) => ReactElement;
};

/**
 * FormFieldGroup. A Controller and a FieldGroup in one, as FormField is for
 * Field. The form's error for `name` goes to FieldGroup's `error`. For a
 * checkbox group the value is an array, and `toggleInList` flips one item.
 */
export function FormFieldGroup<
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
  disabled,
  children,
  wrap,
}: FormFieldGroupProps<TValues, TName, L>) {
  const context = useFormContext<TValues>();
  const requiredProps = (
    required ? { required: true, requiredLabel: requiredLabel ?? '' } : {}
  ) as RequiredProps;

  return (
    <Controller
      control={control ?? context.control}
      name={name}
      render={({ field, fieldState }) => {
        const group = (
          <FieldGroup
            label={label}
            hint={hint}
            error={fieldState.error?.message}
            className={className}
            disabled={disabled}
            {...requiredProps}
          >
            {children(field)}
          </FieldGroup>
        );
        return wrap ? wrap(group, field) : group;
      }}
    />
  );
}

/** A checkbox group's array with one item switched on or off, in a new array, keeping the order of first selection. */
export function toggleInList(list: readonly string[], item: string, on: boolean): string[] {
  const without = list.filter((existing) => existing !== item);
  return on ? [...without, item] : without;
}
