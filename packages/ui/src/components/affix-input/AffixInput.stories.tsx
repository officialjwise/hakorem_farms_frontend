import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from '../field/Field';
import { AffixInput } from './AffixInput';

const meta = {
  title: 'Primitives/AffixInput',
  component: AffixInput,
} satisfies Meta<typeof AffixInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shared shell of MoneyInput and WeightInput. Apps use those, not this. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Weight (kg)">
        <AffixInput suffix="kg" defaultValue="38.400" />
      </Field>
    </div>
  ),
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Price (GH₵)">
        <AffixInput prefix="GH₵" className="demo-focus" defaultValue="1450.00" />
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Weight (kg)" error="Enter a weight above zero.">
        <AffixInput suffix="kg" defaultValue="0.000" />
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Price (GH₵)" hint="Set by the price list.">
        <AffixInput prefix="GH₵" disabled defaultValue="1450.00" />
      </Field>
    </div>
  ),
};
