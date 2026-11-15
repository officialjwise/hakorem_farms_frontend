import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/Button';
import { Alert } from './Alert';

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  args: { severity: 'info', title: 'Counting is open at the cold room' },
  parameters: { matrix: true },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One story per severity, the four states of an alert. */
export const Info: Story = {};
export const Good: Story = { args: { severity: 'good', title: 'Goods receipt posted' } };
export const Warning: Story = {
  args: {
    severity: 'warning',
    title: 'Two lines arrived short',
    children: 'Each short line needs a reason before the transfer can be received.',
  },
};
export const Critical: Story = {
  args: {
    severity: 'critical',
    title: 'The transfer was not received',
    children: 'Nothing has moved. Reference 7f3c-91aa.',
    actions: (
      <Button size="sm" variant="secondary">
        Try again
      </Button>
    ),
  },
};
