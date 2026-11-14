import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { DatePicker } from './DatePicker';

const meta = { title: 'Primitives/DatePicker', component: DatePicker } satisfies Meta<
  typeof DatePicker
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Delivery date" hint="Slots open 08:00 to 17:00.">
        <DatePicker defaultValue="2026-12-04" />
      </Field>
    </div>
  ),
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Delivery date">
        <DatePicker className="demo-focus" defaultValue="2026-12-04" />
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Delivery date" error="Pick a date from tomorrow onward.">
        <DatePicker />
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Acquired on" hint="Set by the goods receipt.">
        <DatePicker disabled defaultValue="2026-11-02" />
      </Field>
    </div>
  ),
};

export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field label="Delivery date">
        <DatePicker />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const input = within(canvasElement).getByLabelText('Delivery date');
    await expect(input).toHaveFocus();
    await userEvent.type(input, '2026-12-09');
    await expect(input).toHaveValue('2026-12-09');
  },
};
