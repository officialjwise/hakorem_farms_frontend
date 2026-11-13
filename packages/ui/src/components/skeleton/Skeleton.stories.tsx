import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Skeleton } from './Skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One line, as a table cell or a label placeholder. */
export const Line: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="grid max-w-xs gap-2">
      <Skeleton />
      <Skeleton className="w-2/3" />
    </div>
  ),
};

/** A block, as an image or a card body. */
export const Block: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="max-w-xs">
      <Skeleton shape="block" className="h-32" />
    </div>
  ),
};

/** A circle, as an avatar. */
export const Circle: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="flex items-center gap-3">
      <Skeleton shape="circle" className="size-10" />
      <div className="grid w-40 gap-2">
        <Skeleton />
        <Skeleton className="w-1/2" />
      </div>
    </div>
  ),
};

/** One status announcement for the whole loading region, not one per bar. */
export const Announced: Story = {
  render: () => (
    <div className="grid max-w-xs gap-2">
      <Skeleton label="Loading animal register" />
      <Skeleton className="w-3/4" />
      <Skeleton className="w-1/2" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('status')).toHaveLength(1);
  },
};
