import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BarChart, LineChart } from './Chart';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const cedis = (values: number[]) => values.map((v) => `GH₵ ${(v / 100).toFixed(2)}`);
const salesValues = [1820000, 2140000, 2650000, 3910000, 2980000, 3320000, 2410000];
const buyValues = [940000, 1210000, 1980000, 2860000, 1500000, 1720000, 1110000];
const SALES = { label: 'Sales', values: salesValues, formatted: cedis(salesValues) };
const BUYS = { label: 'Purchases', values: buyValues, formatted: cedis(buyValues) };
const common = {
  title: 'Sales and purchases',
  summary: 'Sales and purchases each day this week, Monday to Sunday.',
  categories: DAYS,
  formatTick: (v: number) => `${v / 100000}k`,
  tableLabel: 'Show the figures',
  categoryHeader: 'Day',
};

const meta = {
  title: 'Data/Chart',
  component: LineChart,
  args: { ...common, series: [SALES, BUYS] },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four states: two lines, grouped bars, bars by state, and the figures opened by keyboard. */
export const TwoLines: Story = {};
export const GroupedBars: Story = { render: (args) => <BarChart {...args} /> };
export const BarsByState: Story = {
  render: (args) => (
    <BarChart
      {...args}
      title="Stock health"
      summary="Products low on stock, available, and out of stock."
      categories={['Low', 'Available', 'Out']}
      series={[{ label: 'Products', values: [23, 214, 7], formatted: ['23', '214', '7'] }]}
      barTones={['warning', 'accent', 'critical']}
      formatTick={String}
      size="sm"
    />
  ),
};
export const KeyboardPath: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(within(canvasElement).getByRole('table')).toBeVisible();
  },
};
