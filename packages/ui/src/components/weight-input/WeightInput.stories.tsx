import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { WeightInput, type WeightInputProps } from './WeightInput';

const meta = { title: 'Primitives/WeightInput' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({
  initial = null,
  error,
  hint = 'Read from the scale, to three decimals.',
  ...rest
}: { initial?: string | null; error?: string; hint?: string } & Partial<WeightInputProps>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className="max-w-sm">
      <Field label="Weight (kg)" hint={hint} error={error}>
        <WeightInput {...rest} value={value} onValueChange={setValue} />
      </Field>
    </div>
  );
}

export const Default: Story = {
  parameters: { matrix: true },
  render: () => <Live initial="38.400" />,
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusWithin: ['[data-slot="affix-input"]'] } },
  render: () => <Live initial="38.400" />,
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => <Live initial="0.000" error="Enter a weight above zero." />,
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => <Live initial="38.400" disabled hint="Locked once the lot is received." />,
};

export const KeyboardPath: Story = {
  render: () => <Live />,
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const input = within(canvasElement).getByRole('textbox', { name: 'Weight (kg)' });
    await expect(input).toHaveFocus();
    await userEvent.keyboard('38.4');
    await expect(input).toHaveValue('38.4');
    await userEvent.tab();
    await expect(input).toHaveValue('38.400');
  },
};
