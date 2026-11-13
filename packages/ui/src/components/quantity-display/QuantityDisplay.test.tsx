import { render, screen } from '@testing-library/react';
import { QuantityDisplay } from './QuantityDisplay';

describe('QuantityDisplay', () => {
  it.each([
    ['3.000', 'head', '3.000 head'],
    ['1250.5', 'crates', '1,250.500 crates'],
    ['0.000', 'head', '0.000 head'],
    ['-2.000', 'head', '-2.000 head'],
  ])('%s %s is %s', (quantity, unit, expected) => {
    render(<QuantityDisplay quantity={quantity} unit={unit} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders null as a hidden dash plus words', () => {
    const { container } = render(
      <QuantityDisplay quantity={null} unit="head" notApplicableLabel="No count" />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
    expect(screen.getByText('No count')).toHaveClass('sr-only');
  });

  it('throws on a blank unit', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<QuantityDisplay quantity="1.000" unit="  " />)).toThrow(/unit/);
    quiet.mockRestore();
  });

  it('refuses more than three places', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<QuantityDisplay quantity="1.2345" unit="head" />)).toThrow(TypeError);
    quiet.mockRestore();
  });
});
