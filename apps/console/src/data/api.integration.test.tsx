/**
 * The data layer against the REAL Prism mock (ADR 0019): the generated client, its error normalisation,
 * idempotent writes, the 401 single flight, and money and weight on the wire. Nothing here mocks fetch.
 */
import {
  ApiError,
  createApiClient,
  newIdempotencyKey,
  type ApiClient,
  type SessionHooks,
} from '@hakorem/api-client';
import { createApiHooks, createQueryClient, QueryClientProvider } from '@hakorem/data';
import {
  formatMoney,
  formatWeight,
  isServerErrorEnvelope,
  MoneyDisplay,
  WeightDisplay,
} from '@hakorem/ui';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const MOCK = 'http://127.0.0.1:4010';
/** A session as the console has one: a CSRF token to send, and nothing to refresh. */
const signedIn: SessionHooks = {
  refresh: async () => undefined,
  onExpired: () => undefined,
  getCsrfToken: () => 'c3f1a0b2e5d94c7f8a61b0e2d4c9f7a3',
};
const clientWith = (headers: Record<string, string> = {}, session?: SessionHooks): ApiClient =>
  createApiClient({ baseUrl: MOCK, headers, session });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('reads, typed from the contract', () => {
  it('lists products as the contract describes them', async () => {
    const page = await clientWith().call('listProducts', { query: { limit: 5 } });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.page).toMatchObject({ hasMore: expect.any(Boolean), limit: expect.any(Number) });
    // Newest first since 1.33.0, so the example's first row is the last product added.
    expect(page.data[0]).toMatchObject({
      id: expect.any(String),
      sku: 'EGG-0003',
      name: 'Eggs, big, crate of 30',
    });
  });
});

describe('every failure is the one envelope', () => {
  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [500, 'INTERNAL'],
  ])(
    'a %i from the mock becomes an ApiError that packages/ui accepts as is',
    async (status, code) => {
      const error = await failure(
        clientWith({ Prefer: `code=${status}` }).call('getProduct', {
          path: { id: '019a7a8d-137d-74bf-b9f8-54cda260cdab' },
        }),
      );
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(error.details).toEqual([]);
      expect(isServerErrorEnvelope(error.envelope)).toBe(true);
    },
  );

  it('keeps the field details of a validation failure for the form system', async () => {
    const error = await failure(
      clientWith({ Prefer: 'code=400' }).call('listProducts', { query: { limit: 5 } }),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details[0]).toMatchObject({ field: '/lines/0/weightKg', code: 'PATTERN' });
  });
});

describe('a write carries the idempotency key and the CSRF token the contract asks for', () => {
  it('is accepted by the mock, which validates required headers', async () => {
    const api = clientWith(
      {},
      {
        refresh: vi.fn(),
        onExpired: vi.fn(),
        getCsrfToken: () => 'c3f1a0b2e5d94c7f8a61b0e2d4c9f7a3',
      },
    );
    const product = await api.call(
      'archiveProduct',
      {
        path: { id: '019a7a8d-137d-74bf-b9f8-54cda260cdab' },
        body: { version: 3, reason: 'Discontinued' },
      },
      { idempotencyKey: newIdempotencyKey() },
    );
    expect(product.sku).toBe('LIV-0004');
  });

  it('a photograph goes up as multipart, which the mock validates against FileUpload (ADR 0037)', async () => {
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'G-0171.jpg', {
      type: 'image/jpeg',
    });
    const stored = await clientWith({}, signedIn).call(
      'uploadFile',
      { body: { file: photo, purpose: 'EVIDENCE' } },
      { idempotencyKey: newIdempotencyKey() },
    );
    // The contract's example: a stored file waiting for its malware scan.
    expect(stored.scanStatus).toBe('PENDING');
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is refused by the mock when the CSRF token is missing, so the header is not optional', async () => {
    const error = await failure(
      clientWith().call(
        'archiveProduct',
        { path: { id: '019a7a8d-137d-74bf-b9f8-54cda260cdab' }, body: { version: 3, reason: 'x' } },
        { idempotencyKey: newIdempotencyKey() },
      ),
    );
    expect(error.status).toBe(422);
  });

  it('through useApiMutation, invalidating the reads about the same resource', async () => {
    const hooks = createApiHooks(clientWith({}, signedIn));
    const queryClient = createQueryClient();
    let listCalls = 0;
    const realFetch = globalThis.fetch;
    const counting: typeof fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/products?limit=5')) listCalls += 1;
      return realFetch(input, init);
    };
    globalThis.fetch = counting;
    try {
      let archive: ReturnType<typeof hooks.useApiMutation<'archiveProduct'>> | undefined;
      function Screen() {
        const list = hooks.useApiQuery('listProducts', { query: { limit: 5 } });
        archive = hooks.useApiMutation('archiveProduct');
        return <p>{list.data ? `${list.data.data.length} products` : 'loading'}</p>;
      }
      render(
        <QueryClientProvider client={queryClient}>
          <Screen />
        </QueryClientProvider>,
      );
      await screen.findByText(/\d+ products/);
      expect(listCalls).toBe(1);
      await archive?.mutateAsync({
        path: { id: '019a7a8d-137d-74bf-b9f8-54cda260cdab' },
        body: { version: 3, reason: 'Discontinued' },
      });
      await waitFor(() => expect(listCalls).toBe(2));
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('the 401 single flight, against Prism', () => {
  it('refreshes once for concurrent 401s, then retries and succeeds', async () => {
    let refreshed = false;
    const refresh = vi.fn(async () => {
      refreshed = true;
    });
    const hooks: SessionHooks = { refresh, onExpired: vi.fn(), getCsrfToken: () => null };
    // Prism answers 401 (the contract's own example) until the refresh has happened, then 200.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const request = new Request(input, init);
      if (!refreshed) request.headers.set('Prefer', 'code=401');
      return realFetch(request);
    };
    try {
      const api = clientWith({}, hooks);
      const pages = await Promise.all(
        Array.from({ length: 5 }, () => api.call('listProducts', { query: { limit: 5 } })),
      );
      expect(pages).toHaveLength(5);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(hooks.onExpired).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('lands on session expiry when the server keeps refusing, with one refresh and no retry loop', async () => {
    const refresh = vi.fn(async () => undefined);
    const onExpired = vi.fn();
    const api = clientWith(
      { Prefer: 'code=401' },
      { refresh, onExpired, getCsrfToken: () => null },
    );
    const errors = await Promise.all(
      [1, 2, 3].map(() => failure(api.call('listProducts', { query: { limit: 5 } }))),
    );
    for (const error of errors) expect(error.status).toBe(401);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalled();
  });
});

describe('money and weight arrive as the contract says and are formatted only at the edge', () => {
  it('every amount is a safe integer of pesewas and every weight a three-place string', async () => {
    const page = await clientWith().call('listStockOnHand');
    expect(page.data.length).toBeGreaterThan(0);
    let amounts = 0;
    let weights = 0;
    const walk = (value: unknown, key = ''): void => {
      if (Array.isArray(value)) return value.forEach((item) => walk(item, key));
      if (value !== null && typeof value === 'object') {
        return Object.entries(value).forEach(([k, v]) => walk(v, k));
      }
      if (key.endsWith('Pesewas') && value !== null) {
        amounts += 1;
        expect(Number.isSafeInteger(value)).toBe(true);
      }
      if (/Kg$/.test(key) && value !== null) {
        weights += 1;
        expect(value).toMatch(/^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/);
      }
    };
    walk(page);
    expect(amounts).toBeGreaterThan(10);
    expect(weights).toBeGreaterThan(0);
  });

  it('shows the figures the server sent, to the pesewa and to the gram, through the formatters', async () => {
    const page = await clientWith().call('listStockOnHand');
    const row = page.data[0];
    if (row === undefined) throw new Error('The mock returned no stock rows.');
    const { container } = render(
      <p>
        <MoneyDisplay pesewas={row.valueAtCostPesewas} />
        {' | '}
        <WeightDisplay kilograms={row.onHandWeightKg} notApplicableLabel="Not applicable" />
      </p>,
    );
    expect(row.valueAtCostPesewas).toBe(61250);
    expect(row.onHandWeightKg).toBe('26.400');
    expect(container).toHaveTextContent('GH₵612.50 | 26.400 kg');
    expect(formatMoney(61250)).toBe('GH₵612.50');
    expect(formatWeight('26.400')).toBe('26.400 kg');
  });
});
