import { render, screen } from '@testing-library/react';
import { Lock } from 'lucide-react';
import { Button } from '../button/Button';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('is announced as an alert', () => {
    render(<ErrorState title="Stock could not be loaded" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Stock could not be loaded');
  });

  it('shows the correlation reference with its label', () => {
    render(
      <ErrorState
        title="Stock could not be loaded"
        reference="3f2a9c1e"
        referenceLabel="Quote this reference to support:"
      />,
    );
    expect(screen.getByText('3f2a9c1e')).toBeInTheDocument();
    expect(screen.getByText(/Quote this reference/)).toBeInTheDocument();
  });

  it('shows its action', () => {
    render(<ErrorState title="Failed" action={<Button>Try again</Button>} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('accepts another icon, as for permission denied, and hides it from assistive technology', () => {
    const { container } = render(<ErrorState title="You cannot view this" icon={Lock} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('throws on a blank title', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // @ts-expect-error an empty title is a compile error; this proves the render check too
    expect(() => render(<ErrorState title="" />)).toThrow(/title/);
    quiet.mockRestore();
  });
});
