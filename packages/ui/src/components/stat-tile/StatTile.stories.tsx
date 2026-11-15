import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banknote, PackageX } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { StatTile } from './StatTile';
import { SlotLink } from '../../test/SlotLink';

const meta = {
  title: 'Data/StatTile',
  component: StatTile,
  args: { label: 'Sales today', value: 'GH₵ 8,492.00', icon: Banknote },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** States: rising (good news), falling (bad news), unavailable, loading, and a link with focus. */
export const Rising: Story = {
  args: { trend: { direction: 'up', tone: 'good', label: '12.4% on yesterday' } },
};
export const Falling: Story = {
  args: {
    label: 'Low stock',
    value: '23 products',
    icon: PackageX,
    detail: '4 below minimum',
    trend: { direction: 'up', tone: 'critical', label: '5 more than yesterday' },
  },
};
export const Unavailable: Story = {
  args: { label: 'Animals on hand', unavailable: 'No data source yet' },
};
export const Loading: Story = { args: { loadingLabel: 'Loading sales today' } };
export const KeyboardPath: Story = {
  parameters: { matrix: false },
  args: {
    asChild: true,
    trend: { direction: 'flat', tone: 'neutral', label: 'Same as yesterday' },
    children: <SlotLink href="#sales" />,
  },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('link')).toHaveFocus();
  },
};
