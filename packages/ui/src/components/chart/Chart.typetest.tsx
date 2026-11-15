import { LineChart } from './Chart';

const s = { label: 'Sales', values: [1], formatted: ['1'] };
const base = {
  summary: 's',
  categories: ['Mon'],
  formatTick: String,
  tableLabel: 'Show',
  categoryHeader: 'Day',
};
// @ts-expect-error A chart must have a title.
export const blank = <LineChart {...base} title="" series={[s]} />;
// @ts-expect-error Three series would need a second accent.
export const three = <LineChart {...base} title="Sales" series={[s, s, s]} />;
