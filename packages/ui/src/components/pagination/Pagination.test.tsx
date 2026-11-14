import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

const labels = { label: 'Stock pages', previousLabel: 'Previous', nextLabel: 'Next' };

describe('Pagination', () => {
  it('calls onNext and onPrevious', async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<Pagination {...labels} hasPrevious hasNext onNext={onNext} onPrevious={onPrevious} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('disables a direction that has nothing', async () => {
    const onPrevious = vi.fn();
    render(
      <Pagination
        {...labels}
        hasPrevious={false}
        hasNext
        onNext={vi.fn()}
        onPrevious={onPrevious}
      />,
    );
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous).toBeDisabled();
    await userEvent.click(previous);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('names the landmark and shows the summary', () => {
    render(
      <Pagination
        {...labels}
        hasPrevious
        hasNext
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        summary="25 animals on this page"
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Stock pages' })).toBeInTheDocument();
    expect(screen.getByText('25 animals on this page')).toBeInTheDocument();
  });

  it('ignores clicks while loading, keeps focus, and announces the loading label', async () => {
    const onNext = vi.fn();
    render(
      <Pagination
        {...labels}
        hasPrevious
        hasNext
        onNext={onNext}
        onPrevious={vi.fn()}
        loading
        loadingLabel="Loading the next page"
      />,
    );
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading the next page');
  });

  it('is reachable by keyboard and activates with Enter', async () => {
    const onNext = vi.fn();
    render(
      <Pagination {...labels} hasPrevious={false} hasNext onNext={onNext} onPrevious={vi.fn()} />,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
