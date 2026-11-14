import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { Input } from './Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: an empty control with its label and hint. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Tag number" hint="Printed on the ear tag.">
        <Input />
      </Field>
    </div>
  ),
};

/** Focus, forced so the ring can be reviewed in both themes and densities. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Tag number">
        <Input className="demo-focus" defaultValue="GT-0142" />
      </Field>
    </div>
  ),
};

/** Invalid: the error is words, and the border thickens, so colour is never alone. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Tag number" error="Enter a tag number.">
        <Input defaultValue="" />
      </Field>
    </div>
  ),
};

/** Disabled: recessed, and out of the tab order. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Location" hint="Set by the goods receipt.">
        <Input defaultValue="Cold room" disabled />
      </Field>
    </div>
  ),
};

/** Read-only keeps the value selectable and in the tab order. */
export const ReadOnly: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Document number">
        <Input defaultValue="INV-2026-000412" readOnly />
      </Field>
    </div>
  ),
};

/** The three sizes follow density: compact 28, 32 and 44px; comfortable 36, 44 and 52px. */
export const Sizes: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Field label="Small">
        <Input size="sm" defaultValue="GT-0142" />
      </Field>
      <Field label="Medium">
        <Input size="md" defaultValue="GT-0142" />
      </Field>
      <Field label="Large">
        <Input size="lg" defaultValue="GT-0142" />
      </Field>
    </div>
  ),
};

/** Proves the keyboard path: tab lands on the input and typing works. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field label="Tag number">
        <Input />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const input = within(canvasElement).getByRole('textbox', { name: 'Tag number' });
    await expect(input).toHaveFocus();
    await userEvent.keyboard('GT-0142');
    await expect(input).toHaveValue('GT-0142');
  },
};
