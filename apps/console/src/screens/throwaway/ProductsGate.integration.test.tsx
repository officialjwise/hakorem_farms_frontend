/**
 * THROWAWAY (deleted with the screen). Runs ProductsGate against the REAL Prism mock: every row on screen
 * came over HTTP from `prism mock contract/openapi.yaml`, through the generated client and TanStack Query.
 */
import { createApiClient } from '@hakorem/api-client';
import { createApiHooks, createQueryClient, QueryClientProvider } from '@hakorem/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import { UIProvider } from '@hakorem/ui';
import { describe, expect, it } from 'vitest';
import { ProductsGate } from './ProductsGate';

const MOCK = 'http://127.0.0.1:4010';

/** A data layer against the mock. `prefer` asks Prism for the contract's own example for a status. */
function mockData(headers: Record<string, string> = {}) {
  const hooks = createApiHooks(createApiClient({ baseUrl: MOCK, headers }));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  return { hooks, queryClient };
}

function mount(data: ReturnType<typeof mockData>, props: { showEmpty?: boolean } = {}) {
  return render(
    <QueryClientProvider client={data.queryClient}>
      <UIProvider
        theme="light"
        density="compact"
        toastLabels={{ region: 'Notifications', announcement: 'Notification', close: 'Close' }}
      >
        <ProductsGate hooks={data.hooks} {...props} />
      </UIProvider>
    </QueryClientProvider>,
  );
}

describe('ProductsGate against the Prism mock: the four states on demand', () => {
  it('loading, then the products the mock served', async () => {
    mount(mockData());
    expect(screen.getByRole('status')).toHaveTextContent('Loading products');
    expect(await screen.findByText('Goat')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('LIV-GOAT')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('empty', async () => {
    mount(mockData(), { showEmpty: true });
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error, with the correlation id from the contract example for a 500', async () => {
    mount(mockData({ Prefer: 'code=500' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Products could not be loaded');
    expect(alert).toHaveTextContent('019a7b1e-32bc-78e3-8e1c-970f89c10fed');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('permission denied, in words, for a 403', async () => {
    mount(mockData({ Prefer: 'code=403' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('You do not have access to products'),
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
