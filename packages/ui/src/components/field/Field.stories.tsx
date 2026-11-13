import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Field } from './Field';

const meta = {
  title: 'Foundations/Field',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Story fixture only, not the Input component (built in F0c): a native input
 * styled from tokens, so Field's wiring can be seen and tested. Note that it
 * carries no id, aria or required attributes of its own.
 */
const fixtureInput =
  'h-control-md w-full rounded-md border border-border-strong bg-surface px-control-md text-control-md text-fg ' +
  'outline-focus outline-offset-2 focus-visible:outline-2 disabled:bg-surface-sunken disabled:text-fg-disabled ' +
  'aria-invalid:border-2 aria-invalid:border-critical tabular-nums';

/** Every state, both themes, both densities. */
export const States: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-5">
      <Field label="Tag number">
        <input className={fixtureInput} defaultValue="GT-0142" />
      </Field>
      <Field label="Weight (kg)" hint="Read from the scale, to three decimals.">
        <input className={fixtureInput} inputMode="decimal" defaultValue="38.400" />
      </Field>
      <Field label="Buyer phone" required requiredLabel="Required">
        <input className={fixtureInput} inputMode="tel" />
      </Field>
      <Field
        label="Weight (kg)"
        hint="Read from the scale, to three decimals."
        error="Enter a weight above zero."
      >
        <input className={fixtureInput} inputMode="decimal" defaultValue="0" />
      </Field>
      <Field label="Location" hint="Set by the goods receipt.">
        <input className={fixtureInput} defaultValue="Cold room" disabled />
      </Field>
    </div>
  ),
};

/** Proves the wiring in a real browser: names, descriptions, validity and required. */
export const Wiring: Story = {
  render: () => (
    <div className="grid max-w-sm gap-5">
      <Field
        label="Weight (kg)"
        hint="Read from the scale."
        error="Enter a weight above zero."
        required
        requiredLabel="Required"
      >
        <input className={fixtureInput} inputMode="decimal" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Weight (kg) Required' });
    await expect(input).toBeRequired();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(
      'Enter a weight above zero. Read from the scale.',
    );
  },
};
