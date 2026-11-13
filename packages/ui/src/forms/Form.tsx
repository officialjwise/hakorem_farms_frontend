import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useRef, type FormEvent } from 'react';
import {
  FormProvider,
  useFormContext,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { Button, type ButtonProps } from '../components/button/Button';
import { cn } from '../lib/cn';

export type FormProps<TValues extends FieldValues, TContext, TOutput extends FieldValues> = Omit<
  ComponentPropsWithRef<'form'>,
  'onSubmit' | 'noValidate' | 'children'
> & {
  /** The `useForm` return. The form's own FormProvider is mounted here, per form and never at app level (ADR 0006). */
  form: UseFormReturn<TValues, TContext, TOutput>;
  /**
   * Runs with the validated, resolver-parsed values. It RESOLVES when the work
   * succeeded and REJECTS when it failed, for example with the contract's
   * error envelope. Resolving is what tells Form the form is clean again, so do
   * not catch a failure here and return: the form would reset and wipe the
   * errors you just mapped. Handle the failure in `onSubmitError`.
   */
  onSubmit: (values: TOutput) => Promise<void> | void;
  /**
   * Receives what `onSubmit` rejected with: map a server envelope onto the
   * fields and leave a FormError on screen (mapServerErrors, ADR 0006). With no
   * handler the rejection is rethrown, so it is loud rather than silent.
   */
  onSubmitError?: (error: unknown) => void;
  children: ReactNode;
};

/**
 * Form. A native `<form noValidate>` (the Zod resolver validates, not the
 * browser) inside this form's own FormProvider.
 *
 * Submit-once: while the submit promise is pending, further submits are
 * ignored. A ref guards it, not state alone, because two submits in the same
 * tick both see the same render. Button's loading state is the visible half of
 * the same guarantee (see FormSubmitButton).
 *
 * After a successful submit the form is reset to the submitted values, so it is
 * clean and leaving it is not blocked (useDirtyGuard).
 */
export function Form<
  TValues extends FieldValues,
  TContext = unknown,
  TOutput extends FieldValues = TValues,
>({
  form,
  onSubmit,
  onSubmitError,
  children,
  className,
  ...rest
}: FormProps<TValues, TContext, TOutput>) {
  const pending = useRef(false);

  const run = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset(form.getValues());
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    run(event)
      .catch((error: unknown) => {
        if (onSubmitError === undefined) throw error;
        onSubmitError(error);
      })
      .finally(() => {
        pending.current = false;
      });
  };

  return (
    <FormProvider {...form}>
      <form
        noValidate
        data-slot="form"
        className={cn('grid gap-5', className)}
        onSubmit={handleSubmit}
        {...rest}
      >
        {children}
      </form>
    </FormProvider>
  );
}

/** True while the surrounding Form's submit is pending. Read it inside a Form. */
export function useFormSubmitting(): boolean {
  return useFormContext().formState.isSubmitting;
}

type SubmitButtonProps = Omit<
  Extract<ButtonProps, { asChild?: false; iconOnly?: false }>,
  'loading' | 'loadingLabel' | 'type' | 'asChild' | 'iconOnly'
> & {
  /** Required. What a screen reader hears while the form submits, already translated. */
  loadingLabel: string;
};

/** FormSubmitButton. A Button of type submit that shows loading while the Form submits. */
export function FormSubmitButton({ loadingLabel, ...props }: SubmitButtonProps) {
  const submitting = useFormSubmitting();
  return <Button {...props} type="submit" loading={submitting} loadingLabel={loadingLabel} />;
}
