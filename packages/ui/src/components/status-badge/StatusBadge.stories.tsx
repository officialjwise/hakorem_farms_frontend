import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDollarSign,
  CircleX,
  Clock,
  Hourglass,
  Lock,
  PackageX,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import { StatusBadge, type BadgeIcon, type BadgeTone } from './StatusBadge';

const meta = {
  title: 'Domain/StatusBadge',
  component: StatusBadge,
  args: { tone: 'good', icon: CircleCheck, label: 'In stock' },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone, subtle and strong. Strong exists only for the four statuses. */
export const Tones: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="good" icon={CircleCheck} label="Good" />
        <StatusBadge tone="warning" icon={TriangleAlert} label="Warning" />
        <StatusBadge tone="critical" icon={CircleX} label="Critical" />
        <StatusBadge tone="info" icon={Clock} label="Info" />
        <StatusBadge tone="violet" icon={Lock} label="Violet" />
        <StatusBadge tone="plum" icon={ShieldAlert} label="Plum" />
        <StatusBadge tone="clay" icon={Hourglass} label="Clay" />
        <StatusBadge tone="slate" icon={CircleDashed} label="Slate" />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="good" variant="strong" icon={CircleCheck} label="Sale synced" />
        <StatusBadge
          tone="warning"
          variant="strong"
          icon={TriangleAlert}
          label="Offline, 3 queued"
        />
        <StatusBadge tone="critical" variant="strong" icon={CircleX} label="Void needs approval" />
        <StatusBadge tone="info" variant="strong" icon={Clock} label="Mobile money pending" />
      </div>
    </div>
  ),
};

type Example = { label: string; tone: BadgeTone; icon: BadgeIcon };

/**
 * Example vocabulary agreed with the owner at the palette review. The real
 * mapping is made per screen from the API's state enums once the contract
 * defines them; these are illustrations, not a source of truth.
 */
const STOCK: Example[] = [
  { label: 'In stock', tone: 'good', icon: CircleCheck },
  { label: 'Low stock', tone: 'warning', icon: TriangleAlert },
  { label: 'Out of stock', tone: 'critical', icon: PackageX },
  { label: 'Expiring soon', tone: 'clay', icon: Hourglass },
  { label: 'Reserved', tone: 'violet', icon: Lock },
  { label: 'In transit', tone: 'info', icon: Truck },
  { label: 'Quarantined', tone: 'plum', icon: Snowflake },
  { label: 'Vet withdrawal hold', tone: 'plum', icon: ShieldAlert },
  { label: 'Sold or written off', tone: 'slate', icon: CircleDashed },
];

const PAYMENT: Example[] = [
  { label: 'Paid', tone: 'good', icon: CircleCheck },
  { label: 'Part paid', tone: 'warning', icon: CircleDollarSign },
  { label: 'Overdue', tone: 'critical', icon: CircleAlert },
  { label: 'Failed', tone: 'critical', icon: CircleX },
  { label: 'Awaiting confirmation', tone: 'info', icon: Clock },
  { label: 'Unpaid, not yet due', tone: 'slate', icon: CircleDashed },
  { label: 'Refunded', tone: 'violet', icon: RotateCcw },
  { label: 'Unallocated', tone: 'plum', icon: CircleAlert },
  { label: 'Voided', tone: 'slate', icon: Ban },
];

function List({ title, items }: { title: string; items: Example[] }) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((e) => (
          <li key={e.label}>
            <StatusBadge tone={e.tone} icon={e.icon} label={e.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every state carries its own icon, so two states that share a hue (Quarantined, Vet hold) still differ. */
export const StockAndPaymentExamples: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid gap-5 sm:grid-cols-2">
      <List title="Stock states" items={STOCK} />
      <List title="Payment states" items={PAYMENT} />
    </div>
  ),
};

/** Long labels truncate inside a narrow container rather than breaking the row. */
export const Truncation: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-40">
      <StatusBadge tone="plum" icon={ShieldAlert} label="Vet withdrawal hold until 21 Nov" />
    </div>
  ),
};
