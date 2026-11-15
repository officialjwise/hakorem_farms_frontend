import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleX, Hourglass, PackageX, TriangleAlert } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { StatusBadge } from '../status-badge/StatusBadge';
import { AlertRow } from './AlertRow';
import { SlotLink } from '../../test/SlotLink';

const meta = {
  title: 'Data/AlertRow',
  component: AlertRow,
  args: {
    icon: TriangleAlert,
    tone: 'warning',
    title: 'Eggs, big',
    meta: 'Shop floor · 4 crates left',
    status: <StatusBadge tone="warning" icon={TriangleAlert} label="Low stock" />,
  },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AlertRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four states: low stock, expiring, expired, and a link with focus. */
export const LowStock: Story = {};
export const Expiring: Story = {
  args: {
    icon: Hourglass,
    tone: 'clay',
    title: 'Goat meat, 15 kg pack',
    meta: 'LOT-2026-0412 · Cold room',
    status: <StatusBadge tone="clay" icon={Hourglass} label="Expires in 3 days" />,
  },
};
export const Expired: Story = {
  args: {
    icon: PackageX,
    tone: 'critical',
    title: 'Chicken wings, 15 kg pack',
    meta: 'LOT-2026-0398 · Cold room',
    status: <StatusBadge tone="critical" icon={CircleX} label="Expired 18 Nov" />,
  },
};
export const KeyboardPath: Story = {
  parameters: { matrix: false },
  args: { asChild: true, children: <SlotLink href="#lot" /> },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('link')).toHaveFocus();
  },
};
