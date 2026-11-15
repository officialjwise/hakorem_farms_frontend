import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('interrupts for critical and warning, waits for good and info', () => {
    const { rerender } = render(<Alert severity="critical" title="Transfer not received" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Transfer not received');
    rerender(<Alert severity="warning" title="Two lines short" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<Alert severity="good" title="Posted" />);
    expect(screen.getByRole('status')).toHaveTextContent('Posted');
    rerender(<Alert severity="info" title="Counting" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows severity by an edge and an icon as well as colour', () => {
    const { container } = render(<Alert severity="critical" title="Refused" />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-severity', 'critical');
    expect(root?.className).toContain('border-s-4');
    expect(root?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries a body and actions', () => {
    render(
      <Alert
        severity="critical"
        title="Not posted"
        actions={<button type="button">Try again</button>}
      >
        Reference ab12
      </Alert>,
    );
    expect(screen.getByText('Reference ab12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('refuses a blank title', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const blank: string = ' ';
    expect(() => render(<Alert severity="info" title={blank} />)).toThrow(/non-empty title/);
    spy.mockRestore();
  });
});
