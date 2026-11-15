import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banknote, Boxes, ReceiptText, TrendingUp } from 'lucide-react';
import { ReportTile } from './ReportTile';

const meta = {
  title: 'Data/ReportTile',
  component: ReportTile,
  args: {
    label: 'Total sales',
    value: 'GH₵ 9,700.00',
    detail: 'Total for the range',
    icon: Banknote,
  },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReportTile>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The report's figures arrive with the report: its loading, empty, error and denied states are the page's. */
export const Accent: Story = {};
export const Sand: Story = {
  args: { label: 'Tax', value: 'GH₵ 1,378.60', icon: ReceiptText, tone: 'sand' },
};
export const Info: Story = {
  args: { label: 'Stock value', value: 'GH₵ 78,117.30', icon: Boxes, tone: 'info' },
};
export const Good: Story = {
  args: { label: 'Net revenue', value: 'GH₵ 14,700.00', icon: TrendingUp, tone: 'good' },
};
