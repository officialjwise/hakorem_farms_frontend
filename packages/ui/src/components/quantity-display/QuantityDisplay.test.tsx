import { render, screen } from '@testing-library/react';
import { QuantityDisplay } from './QuantityDisplay';

describe('QuantityDisplay', () => {
  it.each([
    ['3.000', 'head', 0, '3 head'],
    ['0.000', 'head', 0, '0 head'],
    ['-2.000', 'head', 0, '-2 head'],
    ['12500.000', 'crates', 0, '12,500 crates'],
    ['1250.5', 'kg', 3, '1,250.500 kg'],
    ['0.000', 'kg', 3, '0.000 kg'],
    ['2.500', 'crates', 0, '2.5 crates'],
    ['2.050', 'packs', 0, '2.05 packs'],
  ] as const)('%s %s at %i places is %s', (quantity, unit, places, expected) => {
    render(<QuantityDisplay quantity={quantity} unit={unit} places={places} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders null as a hidden dash plus words', () => {
    const { container } = render(
      <QuantityDisplay quantity={null} unit="head" places={0} notApplicableLabel="No count" />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
    expect(screen.getByText('No count')).toHaveClass('sr-only');
  });

  it('throws on a blank unit', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<QuantityDisplay quantity="1.000" unit="  " places={0} />)).toThrow(/unit/);
    quiet.mockRestore();
  });

  it('refuses more than three places', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<QuantityDisplay quantity="1.2345" unit="head" places={0} />)).toThrow(
      TypeError,
    );
    quiet.mockRestore();
  });
});
