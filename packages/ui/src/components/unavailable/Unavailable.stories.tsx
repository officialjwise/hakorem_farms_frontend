import type { Meta, StoryObj } from '@storybook/react-vite';
import { Unavailable } from './Unavailable';

const meta = {
  title: 'Feedback/Unavailable',
  component: Unavailable,
  args: { title: 'No data source yet' },
  parameters: { matrix: true },
} satisfies Meta<typeof Unavailable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};
export const WithReason: Story = {
  args: { description: 'Sales figures arrive with the sales and payments modules.' },
};
