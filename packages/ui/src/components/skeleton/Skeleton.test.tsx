import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is decorative without a label', () => {
    const { container } = render(<Skeleton />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('announces its label once as a status', () => {
    render(<Skeleton label="Loading stock on hand" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading stock on hand');
  });

  it.each(['line', 'block', 'circle'] as const)('renders the %s shape', (shape) => {
    const { container } = render(<Skeleton shape={shape} />);
    expect(container.querySelector('[data-slot="skeleton"]')).toHaveAttribute('data-shape', shape);
  });

  it('stops pulsing under reduced motion', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('[data-slot="skeleton"]')?.className).toContain(
      'motion-reduce:animate-none',
    );
  });
});
