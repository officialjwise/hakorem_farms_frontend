import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Checkbox } from '../checkbox/Checkbox';
import { Radio, RadioGroup } from '../radio/Radio';
import { FieldGroup } from './FieldGroup';

const meta = {
  title: 'Primitives/FieldGroup',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A radio group: RadioGroup asChild onto the FieldGroup, so there is one named group. */
function PaymentGroup(props: {
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { required, ...rest } = props;
  const requiredProps = required
    ? ({ required: true, requiredLabel: 'Required' } as const)
    : ({} as const);
  return (
    <RadioGroup asChild defaultValue="cash">
      <FieldGroup label="Payment method" {...requiredProps} {...rest}>
        <Radio value="cash" label="Cash" />
        <Radio value="momo" label="Mobile money" hint="MTN, Vodafone or AirtelTigo" />
        <Radio value="bank" label="Bank transfer" />
      </FieldGroup>
    </RadioGroup>
  );
}

/** A checkbox group needs no Radix root: it is a FieldGroup alone, role group. */
function CutsGroup(props: { error?: string; hint?: string }) {
  return (
    <FieldGroup label="Cuts in this order" {...props}>
      <Checkbox label="Chicken wings" defaultChecked />
      <Checkbox label="Drumsticks and thighs" hint="15 kg pack" />
      <Checkbox label="Backs" />
    </FieldGroup>
  );
}

/** Default: a labelled group with a hint, as a radio group and as a checkbox group. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-6">
      <PaymentGroup hint="How the buyer is paying today." />
      <CutsGroup hint="Choose every cut the buyer wants." />
    </div>
  ),
};

/** Invalid: the error is words under the options, and it is the group's description. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-6">
      <PaymentGroup error="Choose a payment method." />
      <CutsGroup error="Choose at least one cut." />
    </div>
  ),
};

/** Required: visible words inside the legend, never an asterisk alone. */
export const Required: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <PaymentGroup required hint="Needed to close the sale." error="Choose a payment method." />
    </div>
  ),
};

/** Disabled: the native fieldset disables every option, and their labels dim. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-6">
      <PaymentGroup disabled hint="Locked once the shift is closed." />
      <FieldGroup label="Cuts in this order" disabled>
        <Checkbox label="Chicken wings" defaultChecked />
        <Checkbox label="Backs" />
      </FieldGroup>
    </div>
  ),
};

/** Proves one group, one name in a real browser, with the description and required words. */
export const Wiring: Story = {
  render: () => (
    <div className="max-w-sm">
      <PaymentGroup required hint="Needed to close the sale." error="Choose a payment method." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('radiogroup')).toHaveLength(1);
    await expect(canvas.queryAllByRole('group')).toHaveLength(0);
    const group = canvas.getByRole('radiogroup', { name: 'Payment method Required' });
    await expect(group.tagName).toBe('FIELDSET');
    await expect(group).toHaveAccessibleDescription(
      'Choose a payment method. Needed to close the sale.',
    );
    await expect(canvas.getAllByRole('radio')).toHaveLength(3);
    for (const radio of canvas.getAllByRole('radio')) {
      await expect(radio).not.toHaveAttribute('aria-invalid');
    }
  },
};

/** The checkbox group is exactly one named group too. */
export const CheckboxWiring: Story = {
  render: () => (
    <div className="max-w-sm">
      <CutsGroup hint="Choose every cut the buyer wants." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('group')).toHaveLength(1);
    await expect(
      canvas.getByRole('group', { name: 'Cuts in this order' }),
    ).toHaveAccessibleDescription('Choose every cut the buyer wants.');
  },
};
