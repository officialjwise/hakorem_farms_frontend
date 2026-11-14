import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { Switch } from './Switch';

const meta = {
  title: 'Primitives/Switch',
  component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off: the thumb at the start edge, no tick. */
export const Off: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Show in the online shop" hint="Hidden products never reach the storefront.">
        <Switch />
      </Field>
    </div>
  ),
};

/** On: the thumb at the end edge with a tick in it, so state is position and shape, not colour. */
export const On: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Show in the online shop">
        <Switch defaultChecked />
      </Field>
    </div>
  ),
};

/** Focus, forced so the ring can be reviewed in both themes and densities. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <Field label="Show in the online shop">
        <Switch className="demo-focus" />
      </Field>
    </div>
  ),
};

/** Disabled: off and on. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Field label="Show in the online shop" hint="Set by the owner.">
        <Switch disabled />
      </Field>
      <Field label="Allow credit sales">
        <Switch disabled defaultChecked />
      </Field>
    </div>
  ),
};

/** Invalid in a Field: the border changes and the error is words. */
export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Confirm the void" error="Turn this on to continue.">
        <Switch />
      </Field>
    </div>
  ),
};

/** Keyboard: Tab reaches the switch and Space toggles it. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field label="Show in the online shop">
        <Switch />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const sw = within(canvasElement).getByRole('switch', { name: 'Show in the online shop' });
    await expect(sw).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(sw).toBeChecked();
    await userEvent.keyboard(' ');
    await expect(sw).not.toBeChecked();
  },
};
