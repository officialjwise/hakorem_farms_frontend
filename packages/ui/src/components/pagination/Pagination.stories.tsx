import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Pagination } from './Pagination';

const meta = {
  title: 'Primitives/Pagination',
  component: Pagination,
  args: {
    label: 'Stock on hand pages',
    previousLabel: 'Previous',
    nextLabel: 'Next',
    hasPrevious: true,
    hasNext: true,
    onPrevious: fn(),
    onNext: fn(),
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First page: nothing before it. */
export const First: Story = {
  parameters: { matrix: true },
  args: { hasPrevious: false, summary: '25 items on this page' },
};

export const Middle: Story = {
  parameters: { matrix: true },
  args: { summary: '25 items on this page' },
};

/** Last page: the API said there is no more. */
export const Last: Story = {
  parameters: { matrix: true },
  args: { hasNext: false, summary: '9 items on this page' },
};

/** While the next page loads both buttons stay focusable and ignore clicks. */
export const Loading: Story = {
  parameters: { matrix: true },
  args: { loading: true, loadingLabel: 'Loading the next page', summary: '25 items on this page' },
};

export const KeyboardPath: Story = {
  args: { hasPrevious: false },
  play: async ({ canvasElement, args }) => {
    await userEvent.tab();
    const next = within(canvasElement).getByRole('button', { name: 'Next' });
    await expect(next).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onNext).toHaveBeenCalledTimes(1);
  },
};
