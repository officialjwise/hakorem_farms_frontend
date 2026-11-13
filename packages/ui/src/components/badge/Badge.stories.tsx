import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'Goats' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { parameters: { matrix: true } };

export const Accent: Story = {
  parameters: { matrix: true },
  args: { tone: 'accent', children: 'New' },
};

/** A count arrives already formatted. */
export const Count: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex items-center gap-3 text-fg">
      <span>Pending approvals</span>
      <Badge tone="accent">3</Badge>
      <span>Low stock</span>
      <Badge>99+</Badge>
    </div>
  ),
};

/** Long text truncates inside its parent's width. */
export const LongText: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-40">
      <Badge>Boer cross, 9 to 12 months, ready for sale</Badge>
    </div>
  ),
};
