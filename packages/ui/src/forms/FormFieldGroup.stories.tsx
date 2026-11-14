import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useForm } from 'react-hook-form';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';
import { Checkbox } from '../components/checkbox/Checkbox';
import { Radio, RadioGroup } from '../components/radio/Radio';
import { Form, FormSubmitButton } from './Form';
import { FormFieldGroup, toggleInList } from './FormFieldGroup';

const meta = {
  title: 'Forms/FormFieldGroup',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const schema = z.object({
  payment: z.string().min(1, 'Choose how the buyer paid.'),
  documents: z.array(z.string()).min(1, 'Choose at least one document to print.'),
});
type Values = z.input<typeof schema>;

function PaymentForm({ defaults }: { defaults: Values }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  return (
    <div className="max-w-sm">
      <Form form={form} aria-label="Close sale" onSubmit={() => undefined}>
        <FormFieldGroup
          control={form.control}
          name="payment"
          label="Payment method"
          hint="One method per sale."
          required
          requiredLabel="Required"
          wrap={(group, field) => (
            <RadioGroup asChild value={field.value} onValueChange={field.onChange}>
              {group}
            </RadioGroup>
          )}
        >
          {() => (
            <>
              <Radio value="CASH" label="Cash" />
              <Radio value="MOMO" label="Mobile money" />
            </>
          )}
        </FormFieldGroup>
        <FormFieldGroup control={form.control} name="documents" label="Print">
          {(field) => (
            <>
              {[
                ['RECEIPT', 'Receipt'],
                ['DELIVERY_NOTE', 'Delivery note'],
              ].map(([value, label]) => (
                <Checkbox
                  key={value}
                  label={label ?? value ?? ''}
                  checked={field.value.includes(value ?? '')}
                  onCheckedChange={(on) =>
                    field.onChange(toggleInList(field.value, value ?? '', on === true))
                  }
                />
              ))}
            </>
          )}
        </FormFieldGroup>
        <FormSubmitButton loadingLabel="Closing sale">Close sale</FormSubmitButton>
      </Form>
    </div>
  );
}

/** Default: nothing chosen, nothing invalid yet. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => <PaymentForm defaults={{ payment: '', documents: [] }} />,
};

/** Chosen: a radio and boxes carry the form's values, and the group stays one named group. */
export const Chosen: Story = {
  parameters: { matrix: true },
  render: () => <PaymentForm defaults={{ payment: 'MOMO', documents: ['RECEIPT'] }} />,
};

/** Invalid: the errors come from the schema and land on the groups, not the options. */
export const Invalid: Story = {
  render: () => <PaymentForm defaults={{ payment: '', documents: [] }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Close sale' }));
    const group = await canvas.findByRole('radiogroup', { name: 'Payment method Required' });
    await expect(group).toHaveAccessibleDescription(
      'Choose how the buyer paid. One method per sale.',
    );
    await expect(canvas.getAllByRole('radiogroup')).toHaveLength(1);
    await expect(canvas.getByRole('group', { name: 'Print' })).toHaveAccessibleDescription(
      'Choose at least one document to print.',
    );
  },
};

/** Keyboard path: the arrow keys choose a radio, Space ticks a box, Enter submits. */
export const KeyboardPath: Story = {
  render: () => <PaymentForm defaults={{ payment: '', documents: [] }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown>}{/ArrowDown}');
    await expect(
      canvas.getAllByRole('radio').some((r) => r.getAttribute('aria-checked') === 'true'),
    ).toBe(true);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('checkbox', { name: 'Receipt' })).toBeChecked();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByText('Choose at least one document to print.')).toBeNull();
  },
};
