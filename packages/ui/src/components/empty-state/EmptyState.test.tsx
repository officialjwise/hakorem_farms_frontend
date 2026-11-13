import { render, screen } from '@testing-library/react';
import { Button } from '../button/Button';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows the title, description and action, and is not an alert', () => {
    render(
      <EmptyState
        title="No animals in this pen"
        description="Move an animal here to see it."
        action={<Button>Move animal</Button>}
      />,
    );
    expect(screen.getByText('No animals in this pen')).toBeInTheDocument();
    expect(screen.getByText('Move an animal here to see it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move animal' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides its icon from assistive technology', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes less room when compact', () => {
    const { container } = render(<EmptyState title="Nothing here" compact />);
    expect(container.firstElementChild?.className).toContain('py-4');
  });

  it('throws on a blank title rather than render a silent box', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<EmptyState title="  " />)).toThrow(/title/);
    quiet.mockRestore();
  });
});
