import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('announces its label as a status', () => {
    render(<Spinner label="Loading stock" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading stock');
  });

  it('is hidden from assistive technology when decorative', () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container).toHaveTextContent('');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('throws on a blank label rather than render silently', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Spinner label="   " />)).toThrow(/label/);
    quiet.mockRestore();
  });

  it.each([
    ['sm', 'size-icon-sm'],
    ['md', 'size-icon-md'],
    ['lg', 'size-icon-lg'],
  ] as const)('size %s follows the density token', (size, cls) => {
    const { container } = render(<Spinner decorative size={size} />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(cls);
  });
});
