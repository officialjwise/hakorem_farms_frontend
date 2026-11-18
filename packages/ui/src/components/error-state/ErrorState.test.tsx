import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('shows a request reference by its last eight characters, and copies all of it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ErrorState
        title="Stock could not be loaded"
        reference="019a7b1d-f4de-751c-aa55-5aa0965fd37e"
        referenceLabel="Quote this reference to support:"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
      />,
    );
    expect(screen.getByText('965f d37e')).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('019a7b1d');
    // The copy button loads with the first reference shown (LazyCopyId); the reference is there before it.
    await user.click(await screen.findByRole('button', { name: 'Copy the full reference' }));
    expect(writeText).toHaveBeenCalledWith('019a7b1d-f4de-751c-aa55-5aa0965fd37e');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('shows nothing for a blank reference', () => {
    render(
      <ErrorState
        title="Stock could not be loaded"
        reference=""
        referenceLabel="Quote this reference to support:"
        referenceCopy={{
          copy: 'Copy the full reference',
          copied: 'Copied',
          failed: 'Could not copy',
        }}
      />,
    );
    expect(screen.queryByText(/Quote this reference/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
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
