import { render, screen } from '@testing-library/react';
import { MoneyDisplay } from './MoneyDisplay';

describe('MoneyDisplay', () => {
  it.each([
    [123450, 'interface', 'GH₵1,234.50'],
    [123450, 'document', 'GHS 1,234.50'],
    [0, 'interface', 'GH₵0.00'],
    [100000000, 'interface', 'GH₵1,000,000.00'],
  ] as const)('%d pesewas in %s is %s', (pesewas, context, expected) => {
    render(<MoneyDisplay pesewas={pesewas} context={context} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('accepts bigint', () => {
    render(<MoneyDisplay pesewas={9007199254740993n} />);
    expect(screen.getByText('GH₵90,071,992,547,409.93')).toBeInTheDocument();
  });

  it('shows a minus for an outgoing amount, from the flag and not the number', () => {
    render(<MoneyDisplay pesewas={123450} negative />);
    expect(screen.getByText('-GH₵1,234.50')).toBeInTheDocument();
  });

  it('shows no minus on a negative zero', () => {
    render(<MoneyDisplay pesewas={0} negative />);
    expect(screen.getByText('GH₵0.00')).toBeInTheDocument();
  });

  it('renders null as a hidden dash plus words for screen readers', () => {
    const { container } = render(<MoneyDisplay pesewas={null} notApplicableLabel="Not set" />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
    expect(screen.getByText('Not set')).toHaveClass('sr-only');
  });

  it('throws on null without words', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // @ts-expect-error null needs notApplicableLabel
    expect(() => render(<MoneyDisplay pesewas={null} />)).toThrow(/notApplicableLabel/);
    quiet.mockRestore();
  });

  it('refuses a float rather than rounding it', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<MoneyDisplay pesewas={12.5} />)).toThrow();
    quiet.mockRestore();
  });
});
