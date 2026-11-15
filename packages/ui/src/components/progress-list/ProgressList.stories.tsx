import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ProgressList } from './ProgressList';

const ITEMS = [
  { id: '1', label: 'Live goats', value: 156, formatted: '156 head', href: '#stock-goats' },
  { id: '2', label: 'Broilers', value: 1226, formatted: '1,226 head', href: '#stock-broilers' },
  { id: '3', label: 'Beef packs', value: 45, formatted: '45 packs', href: '#stock-beef' },
  { id: '4', label: 'Eggs', value: 621, formatted: '621 crates', href: '#stock-eggs' },
];

const meta = {
  title: 'Data/ProgressList',
  component: ProgressList,
  args: { label: 'Stock by category', items: ITEMS },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four states: links, plain rows, a row at zero, and the keyboard path. */
export const Links: Story = {};
export const PlainRows: Story = {
  args: { items: ITEMS.map((item) => ({ ...item, href: undefined })) },
};
export const WithZero: Story = {
  args: { items: [...ITEMS, { id: '5', label: 'Rabbits', value: 0, formatted: '0 head' }] },
};
export const KeyboardPath: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('link', { name: 'Live goats' })).toHaveFocus();
  },
};
