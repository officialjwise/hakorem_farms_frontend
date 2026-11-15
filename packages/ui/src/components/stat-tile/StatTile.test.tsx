import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatTile } from './StatTile';
import { SlotLink } from '../../test/SlotLink';

describe('StatTile', () => {
  it('says what the figure is, the figure, and how it moved in words', () => {
    render(
      <StatTile
        label="Sales today"
        value="GH₵ 8,492.00"
        trend={{ direction: 'up', tone: 'good', label: '12.4% on yesterday' }}
      />,
    );
    expect(screen.getByText('Sales today')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 8,492.00')).toBeInTheDocument();
    const trend = screen.getByText('12.4% on yesterday');
    expect(trend).toHaveAttribute('data-trend', 'up');
    expect(trend).toHaveAttribute('data-tone', 'good');
    // The arrow is a shape cue, hidden from assistive technology because the words carry the meaning.
    expect(trend.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps direction and tone apart: a rise can be bad news', () => {
    render(
      <StatTile
        label="Purchases today"
        value="GH₵ 4,524.00"
        trend={{ direction: 'up', tone: 'critical', label: '30% on yesterday' }}
      />,
    );
    const trend = screen.getByText('30% on yesterday');
    expect(trend).toHaveAttribute('data-trend', 'up');
    expect(trend).toHaveAttribute('data-tone', 'critical');
  });

  it('shows a labelled skeleton while the figure loads', () => {
    render(<StatTile label="Stock value at cost" loadingLabel="Loading stock value" />);
    expect(screen.getByText('Loading stock value')).toBeInTheDocument();
    expect(
      screen.getByText('Stock value at cost').closest('[data-slot="stat-tile"]'),
    ).toHaveAttribute('aria-busy', 'true');
  });

  it('becomes one link, reachable by keyboard, with the label and figure as its name', async () => {
    render(
      <StatTile asChild label="Low stock" value="23 products">
        <SlotLink href="/stock/alerts" />
      </StatTile>,
    );
    await userEvent.tab();
    const link = screen.getByRole('link');
    expect(link).toHaveFocus();
    expect(link).toHaveAccessibleName(/Low stock\s*23 products/);
  });

  it('says a figure with no data source is unavailable, in words, and shows no number', () => {
    render(<StatTile label="Animals on hand" value="0" unavailable="No data source yet" />);
    const tile = screen.getByText('Animals on hand').closest('[data-slot="stat-tile"]');
    expect(tile).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByText('No data source yet')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('refuses a blank label', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blank: string = '';
    expect(() => render(<StatTile label={blank} value="1" />)).toThrow(/non-empty label/);
    spy.mockRestore();
  });
});
