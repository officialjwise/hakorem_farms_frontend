import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sparkline } from './Sparkline';

const meta = {
  title: 'Data/Sparkline',
  component: Sparkline,
  args: { values: [6100, 7400, 6900, 8800, 7210, 8492], label: 'Sales over the last 6 days' },
  parameters: { matrix: true },
} satisfies Meta<typeof Sparkline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {};
export const Flat: Story = {
  args: { values: [40, 40, 40], label: 'Animals on hand, last 3 days' },
};
/** One point is not a trend: nothing is drawn. */
export const TooShort: Story = { args: { values: [40], label: 'Animals on hand today' } };
