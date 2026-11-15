import { render, screen } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('draws the series as a named picture, oldest point on the left', () => {
    render(<Sparkline values={[100, 300, 200]} label="Sales over the last 3 days" />);
    const svg = screen.getByRole('img', { name: 'Sales over the last 3 days' });
    const line = svg.querySelectorAll('path')[1]?.getAttribute('d');
    // Lowest value at the bottom, highest at the top.
    expect(line).toBe('M2 34 L48 2 L94 18');
  });

  it('draws nothing from fewer than two points, never an invented line', () => {
    const { container } = render(<Sparkline values={[100]} label="Sales" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws a flat series as a flat line', () => {
    render(<Sparkline values={[5, 5]} label="Stock" />);
    expect(screen.getByRole('img').querySelectorAll('path')[1]?.getAttribute('d')).toBe(
      'M2 34 L94 34',
    );
  });
});
