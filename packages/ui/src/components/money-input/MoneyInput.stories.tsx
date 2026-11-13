import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { MoneyInput, type MoneyInputProps } from './MoneyInput';

const meta = { title: 'Primitives/MoneyInput' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({
  initial = null,
  error,
  hint = 'Per head, before delivery.',
  ...rest
}: { initial?: number | null; error?: string; hint?: string } & Partial<MoneyInputProps>) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div className="max-w-sm">
      <Field label="Agreed price (GH₵)" hint={hint} error={error}>
        <MoneyInput {...rest} value={value} onValueChange={setValue} />
      </Field>
    </div>
  );
}

export const Default: Story = {
  parameters: { matrix: true },
  render: () => <Live initial={145000} />,
};

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusWithin: ['[data-slot="affix-input"]'] } },
  render: () => <Live initial={145000} />,
};

export const Invalid: Story = {
  parameters: { matrix: true },
  render: () => <Live initial={0} error="Enter a price above zero." />,
};

export const Disabled: Story = {
  parameters: { matrix: true },
  render: () => <Live initial={145000} disabled hint="Fixed by the price list." />,
};

export const KeyboardPath: Story = {
  render: () => <Live />,
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const input = within(canvasElement).getByRole('textbox', { name: 'Agreed price (GH₵)' });
    await expect(input).toHaveFocus();
    await userEvent.keyboard('1450.5');
    await expect(input).toHaveValue('1450.5');
    await userEvent.tab();
    await expect(input).toHaveValue('1450.50');
  },
};
