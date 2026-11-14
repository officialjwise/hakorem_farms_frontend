import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { NumberInput } from './NumberInput';

const meta = { title: 'Primitives/NumberInput' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({
  initial = '',
  label = 'Heads received',
  ...rest
}: { initial?: string; label?: string } & Partial<React.ComponentProps<typeof NumberInput>>) {
  const [value, setValue] = useState(initial);
  return (
    <div className="max-w-sm">
      <Field label={label} hint={rest.disabled ? 'Set by the goods receipt.' : 'Count the heads.'}>
        <NumberInput {...rest} value={value} onValueChange={setValue} />
      </Field>
    </div>
  );
}

export const Default: Story = {
  parameters: { matrix: true },
  render: () => <Live initial="20" />,
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['.demo-focus'] } },
  render: () => <Live initial="20" className="demo-focus" />,
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-sm">
      <Field label="Heads received" error="Enter a number above zero.">
        <NumberInput value="0" onValueChange={() => undefined} />
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => <Live initial="20" disabled />,
};

export const KeyboardPath: Story = {
  render: () => <Live decimals={2} label="Feed bags" />,
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const input = within(canvasElement).getByRole('textbox', { name: 'Feed bags' });
    await expect(input).toHaveFocus();
    await userEvent.keyboard('12x.505');
    await expect(input).toHaveValue('12.50');
  },
};
