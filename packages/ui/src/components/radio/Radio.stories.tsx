import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/Button';
import { FieldGroup } from '../field-group/FieldGroup';
import { Radio, RadioGroup } from './Radio';

const meta = {
  title: 'Primitives/Radio',
  component: Radio,
  args: { value: 'cash', label: 'Cash' },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

function Group({ defaultValue, disabled }: { defaultValue?: string; disabled?: boolean }) {
  return (
    <RadioGroup asChild defaultValue={defaultValue}>
      <FieldGroup label="Payment method" disabled={disabled}>
        <Radio value="cash" label="Cash" />
        <Radio value="momo" label="Mobile money" hint="MTN, Vodafone or AirtelTigo" />
      </FieldGroup>
    </RadioGroup>
  );
}

/** Off: nothing chosen yet. */
export const Off: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Group />
    </div>
  ),
};

/** On: the chosen option has a dot and a thicker border, so it reads without colour. */
export const On: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Group defaultValue="momo" />
    </div>
  ),
};

/** Focus, forced so the ring can be reviewed in both themes and densities. */
export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => (
    <div className="max-w-sm">
      <RadioGroup asChild defaultValue="cash">
        <FieldGroup label="Payment method">
          <Radio value="cash" label="Cash" className="demo-focus" />
          <Radio value="momo" label="Mobile money" />
        </FieldGroup>
      </RadioGroup>
    </div>
  ),
};

/** Disabled: the whole group, and one option inside an enabled group. */
export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-sm gap-6">
      <Group defaultValue="cash" disabled />
      <RadioGroup asChild defaultValue="cash">
        <FieldGroup label="Payment method">
          <Radio value="cash" label="Cash" />
          <Radio value="card" label="Card" hint="The card reader is offline." disabled />
        </FieldGroup>
      </RadioGroup>
    </div>
  ),
};

/** Keyboard: Tab enters the group, arrows move and select, Tab leaves to the next control. */
export const KeyboardPath: Story = {
  render: () => (
    <div className="grid max-w-sm gap-4">
      <Group defaultValue="cash" />
      <Button>Continue</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('radiogroup')).toHaveLength(1);
    await userEvent.tab();
    await expect(canvas.getByRole('radio', { name: 'Cash' })).toHaveFocus();
    // Radix selects on focus while an arrow key is held, and moves focus in a timeout.
    // Hold the key as a person does: an instant keydown and keyup would release it first.
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Mobile money' })).toHaveFocus());
    await userEvent.keyboard('{/ArrowDown}');
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Mobile money' })).toBeChecked());
    await userEvent.keyboard('{ArrowUp>}');
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Cash' })).toHaveFocus());
    await userEvent.keyboard('{/ArrowUp}');
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Cash' })).toBeChecked());
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toHaveFocus();
  },
};
