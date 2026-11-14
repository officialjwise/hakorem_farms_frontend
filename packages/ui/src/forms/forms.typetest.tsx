/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { useForm } from 'react-hook-form';
import { Input } from '../components/input/Input';
import { Checkbox } from '../components/checkbox/Checkbox';
import { Form, FormSubmitButton } from './Form';
import { FormError } from './FormError';
import { FormField } from './FormField';
import { FormFieldGroup } from './FormFieldGroup';
import { mapServerErrors, type ServerErrorEnvelope } from './serverErrors';

interface Values {
  tagNo: string;
  vaccines: string[];
}

export function Valid() {
  const form = useForm<Values>({ defaultValues: { tagNo: '', vaccines: [] } });
  return (
    <Form form={form} onSubmit={(values: Values) => void values}>
      <FormField control={form.control} name="tagNo" label="Tag number">
        {(field) => <Input {...field} />}
      </FormField>
      <FormField
        control={form.control}
        name="tagNo"
        label="Tag number"
        required
        requiredLabel="Required"
      >
        {(field) => <Input {...field} />}
      </FormField>
      <FormFieldGroup control={form.control} name="vaccines" label="Vaccinations">
        {() => <Checkbox label="PPR" />}
      </FormFieldGroup>
      <FormSubmitButton loadingLabel="Saving">Save</FormSubmitButton>
      <FormError failure={null} title="Not saved" referenceLabel="Reference" />
    </Form>
  );
}

export function Invalid() {
  const form = useForm<Values>({ defaultValues: { tagNo: '', vaccines: [] } });
  return (
    <>
      {/* A field name the form does not have. */}
      {/* @ts-expect-error name must be a path of the form's values */}
      <FormField control={form.control} name="weight" label="Weight">
        {(field) => <Input {...field} />}
      </FormField>

      {/* A field without a label. */}
      {/* @ts-expect-error label is required */}
      <FormField control={form.control} name="tagNo">
        {(field) => <Input {...field} />}
      </FormField>

      {/* An empty label is no label. */}
      {/* @ts-expect-error label cannot be an empty string */}
      <FormField control={form.control} name="tagNo" label="">
        {(field) => <Input {...field} />}
      </FormField>

      {/* Required needs visible words. */}
      {/* @ts-expect-error requiredLabel is required when required is set */}
      <FormField control={form.control} name="tagNo" label="Tag number" required>
        {(field) => <Input {...field} />}
      </FormField>

      {/* A group without its legend. */}
      {/* @ts-expect-error label is required */}
      <FormFieldGroup control={form.control} name="vaccines">
        {() => <Checkbox label="PPR" />}
      </FormFieldGroup>

      {/* The submit button must say what a screen reader hears while it submits. */}
      {/* @ts-expect-error loadingLabel is required */}
      <FormSubmitButton>Save</FormSubmitButton>

      {/* Loading is the form's to decide, never the caller's. */}
      {/* @ts-expect-error loading is not accepted */}
      <FormSubmitButton loadingLabel="Saving" loading>
        Save
      </FormSubmitButton>

      {/* A failure panel with no words for what did not happen. */}
      {/* @ts-expect-error title is required */}
      <FormError failure={null} referenceLabel="Reference" />

      {/* A dismiss button without a name. */}
      {/* @ts-expect-error dismissLabel is required with onDismiss */}
      <FormError failure={null} title="Not saved" referenceLabel="Reference" onDismiss={() => {}} />

      {/* The handler's values are the form's output type. */}
      {/* @ts-expect-error values do not match the form */}
      <Form form={form} onSubmit={(values: { other: number }) => void values}>
        <span />
      </Form>
    </>
  );
}

export function mapsOnlyTheContractEnvelope(form: ReturnType<typeof useForm<Values>>) {
  const ok: ServerErrorEnvelope = {
    error: { code: 'X', message: 'm', correlationId: 'c', details: [] },
  };
  mapServerErrors(ok, form);

  // The correlation id is what a support call starts from.
  // @ts-expect-error correlationId is required
  const missing: ServerErrorEnvelope = { error: { code: 'X', message: 'm', details: [] } };
  return missing;
}
