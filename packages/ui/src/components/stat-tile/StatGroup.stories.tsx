import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banknote, Boxes, HandCoins, Wallet } from 'lucide-react';
import { SlotLink } from '../../test/SlotLink';
import { StatGroup } from './StatGroup';
import { StatTile } from './StatTile';

const meta = {
  title: 'Data/StatGroup',
  component: StatGroup,
  args: { label: 'Today at a glance', children: null },
  parameters: { matrix: true, matrixLayout: 'stack' },
} satisfies Meta<typeof StatGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four figures in one card, divided by rules; it wraps to two columns, then one, as it narrows. */
export const Figures: Story = {
  render: (args) => (
    <StatGroup {...args}>
      <StatTile
        variant="cell"
        label="Sales today"
        icon={Banknote}
        value="GH₵ 16,223.00"
        trend={{ direction: 'up', tone: 'good', label: 'Yesterday GH₵ 14,980.00' }}
      />
      <StatTile
        variant="cell"
        label="Stock value"
        icon={Boxes}
        iconTone="info"
        value="GH₵ 78,117.30"
        detail="At cost"
        asChild
      >
        <SlotLink href="#stock" />
      </StatTile>
      <StatTile
        variant="cell"
        label="Owed by customers"
        icon={HandCoins}
        iconTone="warning"
        value="GH₵ 12,400.00"
        detail="GH₵ 1,200.00 overdue"
      />
      <StatTile variant="cell" label="Cash" icon={Wallet} iconTone="good" value="GH₵ 94,410.00" />
    </StatGroup>
  ),
};

/** While the figures load: the same card, a skeleton in each cell. */
export const Loading: Story = {
  render: (args) => (
    <StatGroup {...args}>
      {['Sales today', 'Stock value', 'Owed by customers'].map((label) => (
        <StatTile key={label} variant="cell" label={label} loadingLabel="Loading today's figures" />
      ))}
    </StatGroup>
  ),
};
