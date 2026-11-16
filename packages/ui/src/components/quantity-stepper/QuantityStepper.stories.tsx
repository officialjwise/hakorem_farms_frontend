import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { QuantityStepper, type QuantityStepperProps } from './QuantityStepper';

function Stateful(
  props: Omit<QuantityStepperProps, 'value' | 'onValueChange'> & { start?: number },
) {
  const { start = 1, ...rest } = props;
  const [value, setValue] = useState(start);
  return <QuantityStepper {...rest} value={value} onValueChange={setValue} />;
}

const meta = {
  title: 'Primitives/QuantityStepper',
  component: QuantityStepper,
  args: {
    label: 'Packs',
    value: 2,
    onValueChange: () => undefined,
    decreaseLabel: 'One fewer',
    increaseLabel: 'One more',
  },
} satisfies Meta<typeof QuantityStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { matrix: true } };

/** At the lowest it can go, minus is off. */
export const AtMinimum: Story = { parameters: { matrix: true }, args: { value: 1 } };

/** The label shown above, as on the product page. */
export const Labelled: Story = { parameters: { matrix: true }, args: { showLabel: true } };

export const Focus: Story = {
  parameters: { matrix: true, pseudo: { focusVisible: ['input'] } },
};

export const Disabled: Story = { parameters: { matrix: true }, args: { disabled: true } };

/** Tab to plus, Space twice, Tab back to the field, Down once: three. */
export const KeyboardPath: Story = {
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Packs' });
    await userEvent.click(field);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'One more' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard(' ');
    await expect(field).toHaveValue('3');
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    await expect(field).toHaveValue('3');
  },
};
