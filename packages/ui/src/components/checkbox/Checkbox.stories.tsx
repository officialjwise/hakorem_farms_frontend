import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { FieldGroup } from '../field-group/FieldGroup';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off: one checkbox in a Field, named by Field. */
export const Off: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Send receipt by SMS" hint="Costs one SMS credit.">
        <Checkbox />
      </Field>
    </div>
  ),
};

/** On: a tick inside the box, so state is shape as well as colour. */
export const On: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Send receipt by SMS">
        <Checkbox defaultChecked />
      </Field>
    </div>
  ),
};

/** Indeterminate: a dash, for a parent that has some children chosen. */
export const Indeterminate: Story = {
  parameters: { matrix: true },
  render: () => (
    <FieldGroup label="Cuts in this order">
      <Checkbox label="All cuts" checked="indeterminate" />
      <div className="ps-8">
        <Checkbox label="Chicken wings" defaultChecked />
        <Checkbox label="Backs" />
      </div>
    </FieldGroup>
  ),
};

/** Focus, forced so the ring can be reviewed in both themes and densities. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <FieldGroup label="Cuts in this order">
      <Checkbox label="Chicken wings" className="demo-focus" />
      <Checkbox label="Backs" defaultChecked />
    </FieldGroup>
  ),
};

/** Disabled: unchecked and checked, with the label dimmed. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <FieldGroup label="Cuts in this order">
      <Checkbox label="Chicken wings" disabled />
      <Checkbox label="Backs" disabled defaultChecked hint="Sold out until Friday." />
    </FieldGroup>
  ),
};

/** Invalid in a Field: the red border is backed by words. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Buyer accepts the weighed total" error="Confirm to continue.">
        <Checkbox />
      </Field>
    </div>
  ),
};

/** Keyboard: Tab reaches the box, Space toggles it, Enter does not. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field label="Send receipt by SMS">
        <Checkbox />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const box = within(canvasElement).getByRole('checkbox', { name: 'Send receipt by SMS' });
    await expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(box).toBeChecked();
    await userEvent.keyboard('{Enter}');
    await expect(box).toBeChecked();
    await userEvent.keyboard(' ');
    await expect(box).not.toBeChecked();
  },
};
