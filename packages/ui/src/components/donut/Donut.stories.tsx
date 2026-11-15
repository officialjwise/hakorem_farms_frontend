import type { Meta, StoryObj } from '@storybook/react-vite';
import { Donut } from './Donut';

const meta = {
  title: 'Data/Donut',
  component: Donut,
  args: {
    title: 'Sales by channel today',
    segments: [
      { label: 'Counter', value: 245400, formatted: 'GH₵ 2,454.00' },
      { label: 'Wholesale', value: 154100, formatted: 'GH₵ 1,541.00' },
      { label: 'Online', value: 65400, formatted: 'GH₵ 654.00' },
      { label: 'Quotes', value: 30000, formatted: 'GH₵ 300.00' },
    ],
    centre: (
      <span className="grid">
        <span className="font-semibold">GH₵ 4,949.00</span>
        <span className="text-xs text-fg-muted">today</span>
      </span>
    ),
  },
  parameters: { matrix: true },
} satisfies Meta<typeof Donut>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four states: several parts, one part, nothing sold yet, and five parts (every marker shape). */
export const SeveralParts: Story = {};
export const OnePart: Story = {
  args: { segments: [{ label: 'Counter', value: 245400, formatted: 'GH₵ 2,454.00' }] },
};
export const NothingYet: Story = {
  args: { segments: [{ label: 'Counter', value: 0, formatted: 'GH₵ 0.00' }], centre: undefined },
};
export const FiveParts: Story = {
  args: {
    title: 'Payments by method',
    centre: undefined,
    segments: [
      { label: 'Cash', value: 5, formatted: 'GH₵ 500.00' },
      { label: 'Mobile money', value: 4, formatted: 'GH₵ 400.00' },
      { label: 'Card', value: 3, formatted: 'GH₵ 300.00' },
      { label: 'Bank transfer', value: 2, formatted: 'GH₵ 200.00' },
      { label: 'Store credit', value: 1, formatted: 'GH₵ 100.00' },
    ],
  },
};
