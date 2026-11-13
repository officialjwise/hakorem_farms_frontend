import { render, screen } from '@testing-library/react';
import { WeightDisplay } from './WeightDisplay';

describe('WeightDisplay', () => {
  it.each([
    ['38.400', 'interface', '38.400 kg'],
    ['1250.5', 'document', '1,250.500 kg'],
    ['0.000', 'interface', '0.000 kg'],
    ['1234567.000', 'interface', '1,234,567.000 kg'],
  ] as const)('%s in %s is %s', (kilograms, context, expected) => {
    render(<WeightDisplay kilograms={kilograms} context={context} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders null as a hidden dash plus words', () => {
    const { container } = render(
      <WeightDisplay kilograms={null} notApplicableLabel="Not weighed" />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
    expect(screen.getByText('Not weighed')).toHaveClass('sr-only');
  });

  it('refuses more than three places rather than rounding', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<WeightDisplay kilograms="38.4001" />)).toThrow(TypeError);
    quiet.mockRestore();
  });

  it('throws on null without words', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // @ts-expect-error null needs notApplicableLabel
    expect(() => render(<WeightDisplay kilograms={null} />)).toThrow(/notApplicableLabel/);
    quiet.mockRestore();
  });
});
