import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { Textarea } from './Textarea';

const meta = { title: 'Primitives/Textarea', component: Textarea } satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Health notes" hint="Anything the vet should know.">
        <Textarea />
      </Field>
    </div>
  ),
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Health notes">
        <Textarea className="demo-focus" defaultValue="Limping on the left foreleg." />
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Reason for write-off" error="Give a reason for the write-off.">
        <Textarea />
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Delivery directions" hint="Locked once the order is dispatched.">
        <Textarea disabled defaultValue="Behind the Kasoa market, blue gate." />
      </Field>
    </div>
  ),
};

export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field label="Health notes">
        <Textarea />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const box = within(canvasElement).getByRole('textbox', { name: 'Health notes' });
    await expect(box).toHaveFocus();
    await userEvent.keyboard('Limping{Enter}Left foreleg');
    await expect(box).toHaveValue('Limping\nLeft foreleg');
  },
};
