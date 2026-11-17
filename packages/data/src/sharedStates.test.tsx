import { ApiError, CLIENT_ERROR_CODES, NetworkError } from '@hakorem/api-client';
import {
  isServerErrorEnvelope,
  mapServerErrors,
  QueryBoundary,
  type QueryBoundaryLabels,
} from '@hakorem/ui';
import { render, screen, waitFor } from '@testing-library/react';
import { envelope, json, testData } from './testing';

const labels: QueryBoundaryLabels = {
  loading: 'Loading products',
  emptyTitle: 'No products yet',
  errorTitle: 'Products could not be loaded',
  errorDescription: 'Check the connection.',
  retry: 'Try again',
  reference: 'Reference:',
  referenceCopy: { copy: 'Copy the full reference', copied: 'Copied', failed: 'Could not copy' },
  deniedTitle: 'No access to products',
};

function Harness({ hooks }: { hooks: ReturnType<typeof testData>['hooks'] }) {
  const result = hooks.useApiQuery('listProducts');
  return (
    <QueryBoundary query={result} labels={labels} isEmpty={(page) => page.data.length === 0}>
      {(page) => <p>{page.data.length} products</p>}
    </QueryBoundary>
  );
}

const page = (n: number) => ({
  data: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })),
  page: { nextCursor: null, limit: 25, hasMore: false },
});

describe('the shared states, wired to a real query', () => {
  it('goes loading, then content', async () => {
    const { hooks, wrapper: Wrapper } = testData(() => json(page(2)));
    render(<Harness hooks={hooks} />, { wrapper: Wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
    await waitFor(() => expect(screen.getByText('2 products')).toBeInTheDocument());
  });

  it('shows empty for an empty page', async () => {
    const { hooks, wrapper: Wrapper } = testData(() => json(page(0)));
    render(<Harness hooks={hooks} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('No products yet')).toBeInTheDocument());
  });

  it('shows permission denied for a 403 and the reference for a 500', async () => {
    const denied = testData(() => json(envelope('FORBIDDEN'), 403));
    const first = render(<Harness hooks={denied.hooks} />, { wrapper: denied.wrapper });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No access to products'),
    );
    first.unmount();

    const broken = testData(() =>
      json(envelope('INTERNAL', 'Something went wrong.', 'ref-77'), 500),
    );
    render(<Harness hooks={broken.hooks} />, { wrapper: broken.wrapper });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Reference: ref7 7'));
  });
});

describe('one error shape', () => {
  it('produces the envelope packages/ui checks for and maps onto a form', () => {
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some fields are not valid.',
      correlationId: 'c-1',
      details: [{ field: '/reason', code: 'REQUIRED', message: 'Say why.' }],
    });
    expect(isServerErrorEnvelope(error.envelope)).toBe(true);
    const setError = vi.fn();
    const failure = mapServerErrors(error.envelope, {
      setError,
      getValues: (() => ({ reason: '' })) as never,
    });
    expect(setError).toHaveBeenCalledWith(
      'reason',
      { type: 'server', message: 'Say why.' },
      { shouldFocus: true },
    );
    expect(failure.correlationId).toBe('c-1');
  });

  it('keeps the UI package list of client codes in step with the client', () => {
    const codes = Object.values(CLIENT_ERROR_CODES);
    for (const code of codes) {
      const status = code === 'INVALID_RESPONSE' ? 502 : 0;
      const error =
        status === 0
          ? new NetworkError(code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR')
          : new ApiError({ status, code, message: 'English fallback.', correlationId: '' });
      const view = render(
        <QueryBoundary
          query={{ status: 'error', data: undefined, error, refetch: vi.fn() }}
          labels={labels}
          isEmpty={() => false}
        >
          {() => null}
        </QueryBoundary>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Check the connection.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('English fallback.');
      view.unmount();
    }
  });
});
