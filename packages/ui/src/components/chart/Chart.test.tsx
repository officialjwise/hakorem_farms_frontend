import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart, LineChart } from './Chart';
import { columnCentre, heightOf, niceMax, ticks } from './scale';

const DAYS = ['Mon', 'Tue', 'Wed'];
const SALES = {
  label: 'Sales',
  values: [120000, 340000, 250000],
  formatted: ['GH₵ 1,200.00', 'GH₵ 3,400.00', 'GH₵ 2,500.00'],
};
const BUYS = {
  label: 'Purchases',
  values: [80000, 90000, 300000],
  formatted: ['GH₵ 800.00', 'GH₵ 900.00', 'GH₵ 3,000.00'],
};
const common = {
  title: 'Sales and purchases',
  summary: 'Daily sales and purchases this week.',
  categories: DAYS,
  formatTick: (v: number) => String(v / 100),
  tableLabel: 'Show the figures',
  categoryHeader: 'Day',
} as const;

describe('chart geometry', () => {
  it('rounds the axis up to a readable maximum', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(340000)).toBe(500000);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(2100)).toBe(2500);
    expect(ticks(400)).toEqual([0, 100, 200, 300, 400]);
  });
  it('places columns at their centres and heights within the plot', () => {
    expect(columnCentre(0, 4)).toBe(12.5);
    expect(heightOf(50, 200)).toBe(25);
    expect(heightOf(900, 200)).toBe(100);
    expect(heightOf(-5, 200)).toBe(0);
  });
});

describe('LineChart', () => {
  it('is a named figure with a summary, and every figure is one disclosure away', async () => {
    render(<LineChart {...common} series={[SALES, BUYS]} />);
    const figure = screen.getByRole('figure', { name: 'Sales and purchases' });
    expect(figure).toHaveTextContent('Daily sales and purchases this week.');
    await userEvent.click(screen.getByText('Show the figures'));
    const table = within(figure).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Purchases' })).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: /Tue GH₵ 3,400.00 GH₵ 900.00/ }),
    ).toBeInTheDocument();
  });

  it('tells two series apart by line style and marker shape, not hue alone', () => {
    const { container } = render(<LineChart {...common} series={[SALES, BUYS]} />);
    const second = container.querySelector('svg g[data-series="2"] path[fill="none"]');
    expect(second).toHaveAttribute('stroke-dasharray', '6 4');
    const firstMarker = container.querySelector('svg g[data-series="1"] path[stroke-linecap]');
    const secondMarker = container.querySelector('svg g[data-series="2"] path[stroke-linecap]');
    expect(firstMarker).toHaveAttribute('stroke-linecap', 'round');
    expect(secondMarker).toHaveAttribute('stroke-linecap', 'square');
    expect(screen.getByText('Purchases', { selector: 'li span' }).closest('li')).toHaveAttribute(
      'data-series',
      '2',
    );
  });

  it('opens the figures by keyboard', async () => {
    render(<LineChart {...common} series={[SALES]} />);
    await userEvent.tab();
    const toggle = screen.getByRole('button', { name: 'Show the figures' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toBeVisible();
  });
});

describe('BarChart', () => {
  it('hatches the second series', () => {
    const { container } = render(<BarChart {...common} series={[SALES, BUYS]} />);
    const hatched = container.querySelectorAll('svg g[data-series="2"] rect[fill^="url(#"]');
    expect(hatched).toHaveLength(3);
    expect(container.querySelectorAll('svg g[data-series="1"] rect[fill^="url(#"]')).toHaveLength(
      0,
    );
  });

  it('gives each bar its own tone when one series holds states', () => {
    const { container } = render(
      <BarChart
        {...common}
        categories={['Low', 'Available', 'Out']}
        series={[{ label: 'Products', values: [5, 40, 2], formatted: ['5', '40', '2'] }]}
        barTones={['warning', 'accent', 'critical']}
      />,
    );
    const bars = container.querySelectorAll('svg g[data-series="1"] rect');
    expect(bars[0]?.getAttribute('class')).toContain('fill-warning');
    expect(bars[2]?.getAttribute('class')).toContain('fill-critical');
  });
});
