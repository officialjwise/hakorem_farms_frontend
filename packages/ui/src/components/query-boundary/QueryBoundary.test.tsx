import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MutationFailure,
  QueryBoundary,
  type FailureLike,
  type QueryBoundaryLabels,
  type QueryLike,
} from './QueryBoundary';

const labels: QueryBoundaryLabels = {
  loading: 'Loading products',
  emptyTitle: 'No products yet',
  emptyDescription: 'Add the first product.',
  errorTitle: 'Products could not be loaded',
  errorDescription: 'Check the connection.',
  retry: 'Try again',
  reference: 'Reference:',
  deniedTitle: 'No access to products',
  deniedDescription: 'Ask the owner.',
};

const pending = (): QueryLike<string[]> => ({
  status: 'pending',
  data: undefined,
  error: null,
  refetch: vi.fn(),
});
const success = (data: string[]): QueryLike<string[]> => ({
  status: 'success',
  data,
  error: null,
  refetch: vi.fn(),
});
const failed = (error: FailureLike): QueryLike<string[]> => ({
  status: 'error',
  data: undefined,
  error,
  refetch: vi.fn(),
});

function renderBoundary(query: QueryLike<string[]>, extra: { denied?: boolean } = {}) {
  return render(
    <QueryBoundary
      query={query}
      labels={labels}
      isEmpty={(d) => d.length === 0}
      emptyAction={<button type="button">Add a product</button>}
      {...extra}
    >
      {(data) => <p>{data.join(', ')}</p>}
    </QueryBoundary>,
  );
}

describe('QueryBoundary', () => {
  it('announces loading once, and never renders the happy path', () => {
    renderBoundary(pending());
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
  });

  it('shows the screen content when there is data', () => {
    renderBoundary(success(['Goat', 'Hen']));
    expect(screen.getByText('Goat, Hen')).toBeInTheDocument();
  });

  it('shows the empty state with its action, and no alert', () => {
    renderBoundary(success([]));
    expect(screen.getByText('No products yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a product' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error with the server message, the reference and a working retry', async () => {
    const query = failed({
      status: 500,
      code: 'INTERNAL',
      message: 'Something went wrong on our side.',
      correlationId: 'abc-123',
    });
    renderBoundary(query);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Products could not be loaded');
    expect(alert).toHaveTextContent('Something went wrong on our side.');
    expect(alert).toHaveTextContent('Reference: abc-123');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('uses the screen own words, and shows no reference, when there was no answer', () => {
    renderBoundary(
      failed({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'The server could not be reached.',
        correlationId: '',
      }),
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Check the connection.');
    expect(alert).not.toHaveTextContent('Reference');
    expect(alert).not.toHaveTextContent('The server could not be reached.');
  });

  it('treats a 403 as permission denied, with a lock, words and no retry', () => {
    const { container } = renderBoundary(
      failed({ status: 403, code: 'FORBIDDEN', message: 'No.', correlationId: 'x' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No access to products');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows denied without a query result when the screen already knows', () => {
    renderBoundary(pending(), { denied: true });
    expect(screen.getByRole('alert')).toHaveTextContent('No access to products');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('MutationFailure', () => {
  it('renders nothing while there is no failure', () => {
    const { container } = render(<MutationFailure error={null} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the words and the reference on screen, with a retry that reuses the intent', async () => {
    const onRetry = vi.fn();
    render(
      <MutationFailure
        error={{
          status: 422,
          code: 'STOCK_UNIT_ON_HOLD',
          message: 'Goat G-0163 is on hold.',
          correlationId: 'r-1',
        }}
        labels={labels}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Goat G-0163 is on hold.');
    expect(screen.getByRole('alert')).toHaveTextContent('Reference: r-1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows permission denied for a 403', () => {
    render(
      <MutationFailure
        error={{ status: 403, code: 'FORBIDDEN', message: 'No.', correlationId: 'x' }}
        labels={labels}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No access to products');
  });
});
