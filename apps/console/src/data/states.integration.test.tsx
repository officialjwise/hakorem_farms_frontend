/**
 * A screen composed the way every screen is (useApiQuery, then QueryBoundary), run against the REAL Prism
 * mock in each of the four states. The screen is a test fixture, not a route: the real screens arrive from
 * F3, and each of them ships this same set of four.
 *
 * Prism returns the contract's own example for a status (`Prefer: code=...`). It cannot return an empty
 * list from this contract (every list has one example, with rows), so the empty state is shown from a
 * successful answer with no rows. CR-005 asks for a named empty example so Prism can serve it.
 */
import { createApiClient } from '@hakorem/api-client';
import { createApiHooks, createQueryClient, QueryClientProvider } from '@hakorem/data';
import {
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableLoadingRows,
  TableRow,
  UIProvider,
  type QueryBoundaryLabels,
} from '@hakorem/ui';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const labels: QueryBoundaryLabels = {
  loading: 'Loading products',
  emptyTitle: 'No products yet',
  errorTitle: 'Products could not be loaded',
  errorDescription: 'Check the connection and try again.',
  retry: 'Try again',
  reference: 'Quote this reference to support:',
  referenceCopy: { copy: 'Copy the full reference', copied: 'Copied', failed: 'Could not copy' },
  deniedTitle: 'You do not have access to products',
};

function mount(headers: Record<string, string> = {}, emptyPage = false) {
  const hooks = createApiHooks(createApiClient({ baseUrl: 'http://127.0.0.1:4010', headers }));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  function Screen() {
    const result = hooks.useApiQuery('listProducts', { query: { limit: 5 } });
    const query =
      emptyPage && result.data !== undefined
        ? {
            status: 'success' as const,
            data: { ...result.data, data: [] },
            error: null,
            refetch: result.refetch,
          }
        : result;
    return (
      <QueryBoundary
        query={query}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label="Products">
            <Table>
              <TableBody>
                <TableLoadingRows columns={2} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <TableContainer aria-label="Products">
            <Table>
              <TableBody>
                {page.data.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell label="Name">{product.name}</TableCell>
                    <TableCell label="SKU">{product.sku}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <UIProvider
        theme="light"
        density="compact"
        toastLabels={{ region: 'Notifications', announcement: 'Notification', close: 'Close' }}
      >
        <Screen />
      </UIProvider>
    </QueryClientProvider>,
  );
}

describe('a screen against the Prism mock, in its four states', () => {
  it('loading, then the rows the mock served', async () => {
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
    expect(await screen.findByText('LIV-0004')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('empty', async () => {
    mount({}, true);
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error, quoting the correlation id the mock sent', async () => {
    mount({ Prefer: 'code=500' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Products could not be loaded');
    // The last eight characters, grouped; the button copies the whole reference (ADR 0051).
    expect(alert).toHaveTextContent('Quote this reference to support: 89c1 0fed');
    expect(alert).not.toHaveTextContent('019a7b1e-32bc-78e3-8e1c-970f89c10fed');
    // The copy button loads with the first reference shown (LazyCopyId, ADR 0042).
    expect(
      await screen.findByRole('button', { name: 'Copy the full reference' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('permission denied, in words and with no retry', async () => {
    mount({ Prefer: 'code=403' });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('You do not have access to products'),
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
