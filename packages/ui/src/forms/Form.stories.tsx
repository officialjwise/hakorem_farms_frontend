import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FarmFields, farmMessages, useFarmForm, type FarmValues } from './FarmForm.fixture';
import { Form, FormSubmitButton } from './Form';
import { FormError } from './FormError';
import {
  isServerErrorEnvelope,
  mapServerErrors,
  type ServerErrorEnvelope,
  type ServerFailure,
} from './serverErrors';
import { formatReference } from '../format/format';

const meta = {
  title: 'Forms/Form',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The contract's error envelope, as the API would send it for a rejected save. */
const rejected: ServerErrorEnvelope = {
  error: {
    code: 'VALIDATION_FAILED',
    message: 'The animal could not be saved.',
    correlationId: '0b6e0e1c-6c0f-4a35-9b8e-2a1f0d9d1c11',
    details: [
      { field: '/weightKg', code: 'OUT_OF_RANGE', message: 'A goat this size is above 90 kg.' },
      {
        field: null,
        code: 'WITHDRAWAL_HOLD',
        message: 'The dam GT-0207 is under a withdrawal hold.',
      },
    ],
  },
};

const filled: FarmValues = {
  tagNo: 'GT-0142',
  species: 'goat',
  damId: 'gt-0207',
  weightKg: '138.400',
  pricePesewas: 125000,
  purpose: 'BREEDING',
  vaccines: ['ppr'],
};

function FarmForm({
  defaults,
  onSubmit,
}: {
  defaults?: FarmValues;
  onSubmit: (values: FarmValues) => Promise<void> | void;
}) {
  const form = useFarmForm(farmMessages, defaults);
  const [failure, setFailure] = useState<ServerFailure | null>(null);

  return (
    <div className="max-w-md">
      <Form
        form={form}
        aria-label="Add animal"
        onSubmit={async (values) => {
          await onSubmit(values);
          setFailure(null);
        }}
        onSubmitError={(error) => {
          if (!isServerErrorEnvelope(error)) throw error;
          setFailure(mapServerErrors(error, form));
        }}
      >
        <FormError
          failure={failure}
          title="The animal was not saved"
          referenceLabel="Reference"
          referenceCopy={{
            copy: 'Copy the full reference',
            copied: 'Copied',
            failed: 'Could not copy',
          }}
          onDismiss={() => setFailure(null)}
          dismissLabel="Dismiss"
        />
        <FarmFields control={form.control} />
        <FormSubmitButton loadingLabel="Saving animal">Save animal</FormSubmitButton>
      </Form>
    </div>
  );
}

/** Default: an empty form. Nothing is invalid until the first submit. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => <FarmForm onSubmit={fn()} />,
};

/** Invalid: a submit with nothing filled. Every message comes from the Zod schema and lands on its field, and no field is red without words. */
export const Invalid: Story = {
  render: () => <FarmForm onSubmit={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save animal' }));
    const tag = await canvas.findByRole('textbox', { name: 'Tag number Required' });
    await expect(tag).toBeInvalid();
    await expect(tag).toHaveAccessibleDescription(farmMessages.tagNo);
    await expect(
      canvas.getByRole('textbox', { name: 'Asking price (GH₵)' }),
    ).toHaveAccessibleDescription(farmMessages.pricePesewas);
    await expect(canvas.getByRole('radiogroup', { name: 'Purpose' })).toHaveAccessibleDescription(
      farmMessages.purpose,
    );
  },
};

/** Submitting: the button keeps its size and focus, announces its loading label, and a second submit is ignored. */
export const Submitting: Story = {
  render: () => <FarmForm defaults={filled} onSubmit={() => new Promise<void>(() => undefined)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: 'Save animal' });
    await userEvent.click(save);
    const busy = await canvas.findByRole('button', { name: 'Saving animal' });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    await expect(busy).toHaveAttribute('aria-busy', 'true');
  },
};

/**
 * Failed: the server rejects. The weight error lands on the weight field, and
 * the detail with no field plus the reference stay in the FormError at the top
 * of the form until dismissed or the next successful save. Nothing here is a
 * toast: a toast is never the only record of a failed save (ADR 0006).
 */
export const Failed: Story = {
  render: () => <FarmForm defaults={filled} onSubmit={() => Promise.reject(rejected)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save animal' }));

    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('The animal was not saved');
    await expect(alert).toHaveTextContent('The dam GT-0207 is under a withdrawal hold.');
    await expect(alert).toHaveTextContent(
      `Reference ${formatReference(rejected.error.correlationId)}`,
    );

    const weight = canvas.getByRole('textbox', { name: 'Weight (kg)' });
    await expect(weight).toBeInvalid();
    await expect(weight).toHaveAccessibleDescription(
      'A goat this size is above 90 kg. From the scale.',
    );
    await expect(canvas.queryByRole('status', { name: /notification/i })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull());
  },
};

/** Keyboard path: fill a complete form with real key presses and submit with Enter. */
export const KeyboardPath: Story = {
  args: {},
  render: () => {
    const onSubmit = fn();
    return (
      <>
        <FarmForm onSubmit={onSubmit} />
        <output data-testid="submitted" />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('textbox', { name: 'Tag number Required' })).toHaveFocus();
    await userEvent.keyboard('GT-0142');

    await userEvent.tab(); // species
    await userEvent.tab(); // dam
    await expect(canvas.getByRole('combobox', { name: 'Dam' })).toHaveFocus();
    await userEvent.keyboard('GT-0207{ArrowDown}{Enter}');

    await userEvent.tab();
    await expect(canvas.getByRole('textbox', { name: 'Weight (kg)' })).toHaveFocus();
    await userEvent.keyboard('38.4');

    await userEvent.tab();
    await userEvent.keyboard('1250');

    await userEvent.tab(); // radio group, into its checked or first option
    // Radix selects on an arrow key that is held, so hold it, as a real key press does.
    await userEvent.keyboard('{ArrowDown>}{/ArrowDown}');
    await expect(canvas.getByRole('radio', { name: 'Breeding' })).toBeChecked();

    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('checkbox', { name: 'PPR' })).toBeChecked();

    // Enter in a text field submits the form.
    const tag = canvas.getByRole('textbox', { name: 'Tag number Required' });
    tag.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Save animal' })).not.toHaveAttribute('aria-busy'),
    );
    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(tag).not.toBeInvalid();
  },
};
