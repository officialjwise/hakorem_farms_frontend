import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toastLabels } from '../../test/toastLabels';
import { UIProvider } from '../ui-provider/UIProvider';
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

  it('numbers the pages reached, marks this one, and goes to another', async () => {
    const onGoTo = vi.fn();
    render(
      <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
        <Pagination
          label="Products pages"
          hasPrevious
          hasNext
          onPrevious={() => undefined}
          onNext={() => undefined}
          previousLabel="Previous"
          nextLabel="Next"
          page={2}
          reached={3}
          onGoTo={onGoTo}
          goToLabel="Go to page"
          pageLabel={(n) => `Page ${n}`}
        />
      </UIProvider>,
    );
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onGoTo).toHaveBeenCalledWith(3);
    expect(screen.getByRole('combobox', { name: 'Go to page' })).toBeInTheDocument();
  });

  it('offers no page numbers while only one page has been reached', () => {
    render(
      <Pagination
        label="Products pages"
        hasPrevious={false}
        hasNext
        onPrevious={() => undefined}
        onNext={() => undefined}
        previousLabel="Previous"
        nextLabel="Next"
        page={1}
        reached={1}
        onGoTo={() => undefined}
        goToLabel="Go to page"
        pageLabel={(n) => `Page ${n}`}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Page 1' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Go to page' })).toBeNull();
  });
});
