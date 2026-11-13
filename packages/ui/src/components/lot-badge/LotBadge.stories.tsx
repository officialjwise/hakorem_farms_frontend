import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheck, Clock, OctagonX } from 'lucide-react';
import { LotBadge } from './LotBadge';

const meta = {
  title: 'Domain/LotBadge',
  component: LotBadge,
  args: { batchNo: 'LOT-2026-0412' },
} satisfies Meta<typeof LotBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A fresh lot: the screen passes the state it got from the API. */
export const Default: Story = {
  parameters: { matrix: true },
  render: () => (
    <LotBadge
      batchNo="LOT-2026-0412"
      expiry={{ label: 'Fresh, 12 days left', tone: 'good', icon: CircleCheck }}
    />
  ),
};

/** Expiring soon. */
export const Expiring: Story = {
  parameters: { matrix: true },
  render: () => (
    <LotBadge
      batchNo="LOT-2026-0409"
      expiry={{ label: 'Expires in 3 days', tone: 'clay', icon: Clock }}
    />
  ),
};

/** Expired. */
export const Expired: Story = {
  parameters: { matrix: true },
  render: () => (
    <LotBadge
      batchNo="LOT-2026-0301"
      expiry={{ label: 'Expired', tone: 'critical', icon: OctagonX }}
    />
  ),
};

/** No expiry state, and a long batch number that truncates visually. */
export const NoExpiry: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid w-48 gap-3">
      <LotBadge batchNo="LOT-2026-0412" />
      <LotBadge batchNo="LOT-2026-CHICKEN-BACKS-COLD-ROOM-0412" />
    </div>
  ),
};
