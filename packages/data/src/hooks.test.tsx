import { ApiError, NetworkError } from '@hakorem/api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MAX_ALL_PAGES } from './hooks';
import { envelope, json, testData } from './testing';

const page = {
  data: [{ id: 'p1', name: 'Goat' }],
  page: { nextCursor: null, limit: 25, hasMore: false },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('useApiQuery', () => {
  it('fetches by operation id, with the key derived from it', async () => {
    const { hooks, wrapper, queryClient, requests } = testData(() => json(page));
    const { result } = renderHook(
      () => hooks.useApiQuery('listProducts', { query: { q: 'goat' } }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]?.url).toBe('http://api.test/v1/products?q=goat');
    expect(queryClient.getQueryData(['listProducts', { query: { q: 'goat' } }])).toEqual(page);
  });

  it('shares one cache entry between two screens asking the same question', async () => {
    const { hooks, wrapper, requests } = testData(() => json(page));
    const { result } = renderHook(
      () => [hooks.useApiQuery('listProducts'), hooks.useApiQuery('listProducts')] as const,
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current[0].isSuccess && result.current[1].isSuccess).toBe(true),
    );
    expect(requests).toHaveLength(1);
  });

  it('surfaces a failure as the normalised ApiError, without retrying a 403', async () => {
    const { hooks, wrapper, requests } = testData(() => json(envelope('FORBIDDEN'), 403));
    const { result } = renderHook(() => hooks.useApiQuery('listProducts'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(403);
    expect(requests).toHaveLength(1);
  });

  it('retries a lost connection twice with backoff, then shows the error', async () => {
    const { hooks, wrapper, requests } = testData(() => {
      throw new TypeError('Failed to fetch');
    });
    const { result } = renderHook(() => hooks.useApiQuery('listProducts'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NetworkError);
    expect(requests).toHaveLength(3);
  });

  it('stays fresh for the class it was given, and refetches on mount by default (live)', async () => {
    const live = testData(() => json(page));
    const first = renderHook(() => live.hooks.useApiQuery('listProducts'), {
      wrapper: live.wrapper,
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    renderHook(() => live.hooks.useApiQuery('listProducts'), { wrapper: live.wrapper });
    await waitFor(() => expect(live.requests).toHaveLength(2));

    const reference = testData(() => json(page));
    const a = renderHook(
      () => reference.hooks.useApiQuery('listProducts', undefined, { staleClass: 'reference' }),
      { wrapper: reference.wrapper },
    );
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    a.unmount();
    const b = renderHook(
      () => reference.hooks.useApiQuery('listProducts', undefined, { staleClass: 'reference' }),
      { wrapper: reference.wrapper },
    );
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(reference.requests).toHaveLength(1);
  });
});

describe('useApiMutation: idempotency', () => {
  const body = { version: 1, reason: 'Discontinued' };
  const input = { path: { id: 'p1' }, body };

  it('sends a UUID key chosen once per call, and a different one for the next call', async () => {
    const { hooks, wrapper, requests } = testData(() => json({ id: 'p1' }));
    const { result } = renderHook(() => hooks.useApiMutation('archiveProduct'), { wrapper });
    await act(() => result.current.mutateAsync(input));
    await act(() => result.current.mutateAsync(input));
    const keys = requests.map((r) => r.headers.get('Idempotency-Key'));
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toMatch(UUID);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('reuses the same key and body when a lost connection is retried automatically', async () => {
    const { hooks, wrapper, requests } = testData((_request, attempt) => {
      if (attempt < 3) throw new TypeError('Failed to fetch');
      return json({ id: 'p1' });
    });
    const { result } = renderHook(() => hooks.useApiMutation('archiveProduct'), { wrapper });
    await act(() => result.current.mutateAsync(input));
    expect(requests).toHaveLength(3);
    const keys = new Set(requests.map((r) => r.headers.get('Idempotency-Key')));
    expect(keys.size).toBe(1);
    for (const request of requests) expect(await request.json()).toEqual(body);
  });

  it('lets a retry button reuse the first attempt key by passing it in', async () => {
    const { hooks, wrapper, requests } = testData((_request, attempt) =>
      attempt === 1 ? json(envelope('STOCK_UNIT_ON_HOLD'), 422) : json({ id: 'p1' }),
    );
    const { result } = renderHook(() => hooks.useApiMutation('archiveProduct'), { wrapper });
    const key = '019a7b1d-1c55-7fe4-b51c-071c42887ffa';
    await act(() =>
      result.current.mutateAsync(input, { idempotencyKey: key }).catch(() => undefined),
    );
    await act(() => result.current.mutateAsync(input, { idempotencyKey: key }));
    expect(requests.map((r) => r.headers.get('Idempotency-Key'))).toEqual([key, key]);
  });

  it('does not retry a refused business rule or a 500, and leaves the normalised error on the mutation', async () => {
    for (const status of [422, 500]) {
      const { hooks, wrapper, requests } = testData(() =>
        json(envelope('STOCK_UNIT_ON_HOLD', 'On hold.', 'r-9'), status),
      );
      const { result } = renderHook(() => hooks.useApiMutation('archiveProduct'), { wrapper });
      act(() => result.current.mutate(input));
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(requests).toHaveLength(1);
      expect(result.current.error?.envelope.error).toMatchObject({
        code: 'STOCK_UNIT_ON_HOLD',
        correlationId: 'r-9',
      });
    }
  });
});

describe('useApiMutation: invalidation', () => {
  it('refetches reads about the same resource after a write, and leaves others cached', async () => {
    const { hooks, wrapper, requests } = testData((request) =>
      request.method === 'GET'
        ? json(request.url.includes('/products') ? page : {})
        : json({ id: 'p1' }),
    );
    const { result } = renderHook(
      () => ({
        list: hooks.useApiQuery('listProducts'),
        session: hooks.useApiQuery('getCurrentSession', undefined, { staleClass: 'immutable' }),
        archive: hooks.useApiMutation('archiveProduct'),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.list.isSuccess && result.current.session.isSuccess).toBe(true),
    );
    const before = requests.length;
    await act(() =>
      result.current.archive.mutateAsync({ path: { id: 'p1' }, body: { version: 1, reason: 'x' } }),
    );
    const urls = requests.slice(before).map((r) => `${r.method} ${new URL(r.url).pathname}`);
    expect(urls).toContain('POST /v1/products/p1/archive');
    expect(urls).toContain('GET /v1/products');
    expect(urls).not.toContain('GET /v1/auth/session');
  });

  it('also refetches the reads named in invalidates, which are about another resource', async () => {
    const { hooks, wrapper, requests } = testData((request) =>
      request.method === 'GET' ? json({}) : json({ id: 'p1' }),
    );
    const { result } = renderHook(
      () => ({
        session: hooks.useApiQuery('getCurrentSession', undefined, { staleClass: 'immutable' }),
        archive: hooks.useApiMutation('archiveProduct', { invalidates: ['getCurrentSession'] }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.session.isSuccess).toBe(true));
    await act(() =>
      result.current.archive.mutateAsync({ path: { id: 'p1' }, body: { version: 1, reason: 'x' } }),
    );
    expect(requests.filter((r) => new URL(r.url).pathname === '/v1/auth/session')).toHaveLength(2);
  });
});

describe('useApiAllPages', () => {
  const permission = (code: string) => ({
    code,
    module: code.split('.')[0],
    description: code,
    requiresStepUp: false,
  });
  const pageOf = (codes: string[], nextCursor: string | null) => ({
    data: codes.map(permission),
    page: { nextCursor, limit: 100, hasMore: nextCursor !== null },
  });

  it('reads every page in turn, passing each cursor, into one answer', async () => {
    const { hooks, wrapper, requests, queryClient } = testData((request) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      if (cursor === null) return json(pageOf(['iam.user.read'], 'c2'));
      if (cursor === 'c2') return json(pageOf(['iam.role.read'], 'c3'));
      return json(pageOf(['aud.audit.read'], null));
    });
    const { result } = renderHook(
      () => hooks.useApiAllPages('listPermissions', { query: { limit: 100 } }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.map((p) => p.code)).toEqual([
      'iam.user.read',
      'iam.role.read',
      'aud.audit.read',
    ]);
    expect(result.current.data?.truncated).toBe(false);
    expect(requests.map((r) => new URL(r.url).search)).toEqual([
      '?limit=100',
      '?limit=100&cursor=c2',
      '?limit=100&cursor=c3',
    ]);
    // Its own cache entry: one page of the same read is a different shape and must not collide.
    expect(
      queryClient.getQueryData(['listPermissions', { query: { limit: 100 } }]),
    ).toBeUndefined();
  });

  it(`stops after ${MAX_ALL_PAGES} pages and says the list was cut short`, async () => {
    const { hooks, wrapper, requests } = testData(() => json(pageOf(['iam.user.read'], 'again')));
    const { result } = renderHook(() => hooks.useApiAllPages('listPermissions'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests).toHaveLength(MAX_ALL_PAGES);
    expect(result.current.data?.truncated).toBe(true);
  });

  it('fails as a whole when any page fails, with the normalised error', async () => {
    const { hooks, wrapper } = testData((_request, attempt) =>
      attempt === 1 ? json(pageOf(['iam.user.read'], 'c2')) : json(envelope('FORBIDDEN'), 403),
    );
    const { result } = renderHook(() => hooks.useApiAllPages('listPermissions'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
  });
});
