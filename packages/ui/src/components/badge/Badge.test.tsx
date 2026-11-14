import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('shows exactly the text it is given, without formatting it', () => {
    render(<Badge>1,250</Badge>);
    expect(screen.getByText('1,250')).toBeInTheDocument();
  });

  it('defaults to neutral', () => {
    const { container } = render(<Badge>Goats</Badge>);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'neutral');
  });

  it('uses the accent tint for the accent tone', () => {
    const { container } = render(<Badge tone="accent">12</Badge>);
    expect(container.firstElementChild?.className).toContain('bg-accent-subtle');
  });

  it('truncates long text instead of overflowing', () => {
    render(<Badge>A very long category name that does not fit</Badge>);
    expect(screen.getByText(/A very long category/).className).toContain('truncate');
  });
});
