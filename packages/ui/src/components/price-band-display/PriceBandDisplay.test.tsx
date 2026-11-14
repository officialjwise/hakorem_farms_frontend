import { render, screen } from '@testing-library/react';
import { PriceBandDisplay } from './PriceBandDisplay';

const labels = { basisLabel: 'per head', toLabel: 'to', listPriceLabel: 'List price' } as const;
const goat = { floorPricePesewas: 12000, ceilingPricePesewas: 195000, listPricePesewas: 85000 };

describe('PriceBandDisplay', () => {
  it('shows floor, ceiling, basis and the list price', () => {
    const { container } = render(<PriceBandDisplay band={goat} {...labels} />);
    expect(container).toHaveTextContent('GH₵120.00 –to GH₵1,950.00 per head');
    expect(container).toHaveTextContent('List price GH₵850.00');
  });

  it('hides the dash from screen readers and reads the word instead', () => {
    const { container } = render(<PriceBandDisplay band={goat} {...labels} />);
    expect(screen.getByText('to')).toHaveClass('sr-only');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
  });

  it('shows one price when floor equals ceiling', () => {
    const { container } = render(
      <PriceBandDisplay
        band={{ floorPricePesewas: 22000, ceilingPricePesewas: 22000, listPricePesewas: 22000 }}
        {...labels}
      />,
    );
    expect(screen.queryByText('to')).toBeNull();
    expect(container).toHaveTextContent('GH₵220.00 per head');
  });

  it('renders null as a hidden dash plus words', () => {
    render(<PriceBandDisplay band={null} notApplicableLabel="Quote only" {...labels} />);
    expect(screen.getByText('Quote only')).toHaveClass('sr-only');
  });

  it('throws on a blank basis label', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(<PriceBandDisplay band={goat} {...labels} basisLabel={' ' as string} />),
    ).toThrow(/basisLabel/);
    quiet.mockRestore();
  });
});
