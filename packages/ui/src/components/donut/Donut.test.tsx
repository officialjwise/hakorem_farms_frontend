import { render, screen, within } from '@testing-library/react';
import { Donut } from './Donut';

const SEGMENTS = [
  { label: 'Counter', value: 245400, formatted: 'GH₵ 2,454.00' },
  { label: 'Wholesale', value: 154100, formatted: 'GH₵ 1,541.00' },
  { label: 'Online', value: 65400, formatted: 'GH₵ 654.00' },
];

describe('Donut', () => {
  it('is a named figure whose legend lists every name with its figure, in order', () => {
    render(<Donut title="Sales by channel today" segments={SEGMENTS} centre="GH₵ 4,649.00" />);
    const figure = screen.getByRole('figure', { name: 'Sales by channel today' });
    const items = within(figure).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'CounterGH₵ 2,454.00',
      'WholesaleGH₵ 1,541.00',
      'OnlineGH₵ 654.00',
    ]);
    expect(figure).toHaveTextContent('GH₵ 4,649.00');
  });

  it('gives each legend entry its own marker shape, not only a hue', () => {
    const { container } = render(<Donut title="Split" segments={SEGMENTS} />);
    const shapes = [...container.querySelectorAll('li path')].map((p) => p.getAttribute('d'));
    expect(new Set(shapes).size).toBe(3);
  });

  it('draws no segment when every value is zero', () => {
    const { container } = render(
      <Donut title="Split" segments={[{ label: 'Counter', value: 0, formatted: 'GH₵ 0.00' }]} />,
    );
    expect(container.querySelectorAll('circle[data-segment]')).toHaveLength(0);
  });
});
