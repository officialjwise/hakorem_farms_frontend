import { describe, expect, it, vi } from 'vitest';
import { createApiClient, type ApiClientOptions } from './client';
import { ApiError, NetworkError } from './errors';
import type { SessionHooks } from './singleFlight';

const KEY = '019a7b1d-1c55-7fe4-b51c-071c42887ffa';
const envelope = (code: string, message = 'A safe sentence.') => ({
  error: { code, message, correlationId: '019a7b1d-3b44-79c8-8f00-a553bc391e31', details: [] },
});
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Expected item ${index}, found ${items.length}.`);
  return item;
}

type Handler = (request: Request, attempt: number) => Response | Promise<Response>;

/** A client whose network is a function, plus the requests it saw. */
function harness(handler: Handler, extra: Partial<ApiClientOptions> = {}) {
  const seen: Request[] = [];
  const client = createApiClient({
    baseUrl: 'http://api.test/v1',
    fetch: async (request) => {
      seen.push(request.clone());
      return handler(request, seen.length);
    },
    ...extra,
  });
  return { client, seen };
}

function session(overrides: Partial<SessionHooks> = {}): SessionHooks & {
  refresh: ReturnType<typeof vi.fn>;
  onExpired: ReturnType<typeof vi.fn>;
} {
  let token = 'csrf-1';
  return {
    refresh: vi.fn(async () => {
      token = 'csrf-2';
    }),
    onExpired: vi.fn(),
    getCsrfToken: () => token,
    ...overrides,
  } as SessionHooks & { refresh: ReturnType<typeof vi.fn>; onExpired: ReturnType<typeof vi.fn> };
}

describe('building the request from the contract', () => {
  it('puts path and query parameters where the contract says and sends no key on a read', async () => {
    const { client, seen } = harness(() =>
      json({ data: [], page: { nextCursor: null, limit: 25, hasMore: false } }),
    );
    await client.call('listProducts', { query: { q: 'goat', limit: 25 } });
    const request = nth(seen, 0);
    expect(request.method).toBe('GET');
    expect(request.url).toBe('http://api.test/v1/products?q=goat&limit=25');
    expect(request.headers.has('Idempotency-Key')).toBe(false);
    expect(request.credentials).toBe('include');

    await client.call('getProduct', { path: { id: 'abc/def' } });
    expect(nth(seen, 1).url).toBe('http://api.test/v1/products/abc%2Fdef');
  });

  it('sends the idempotency key, the CSRF token and a JSON body on a mutation', async () => {
    const hooks = session();
    const { client, seen } = harness(() => json({ id: 'p1' }), { session: hooks });
    await client.call(
      'archiveProduct',
      { path: { id: 'p1' }, body: { version: 3, reason: 'Discontinued' } },
      { idempotencyKey: KEY },
    );
    const request = nth(seen, 0);
    expect(request.method).toBe('POST');
    expect(request.headers.get('Idempotency-Key')).toBe(KEY);
    expect(request.headers.get('X-CSRF-Token')).toBe('csrf-1');
    expect(await request.json()).toEqual({ version: 3, reason: 'Discontinued' });
  });

  it('refuses a mutation with no idempotency key instead of sending it', async () => {
    const { client, seen } = harness(() => json({}));
    const call = client.call as unknown as (
      op: string,
      input: object,
      options: object,
    ) => Promise<unknown>;
    await expect(call('archiveProduct', { path: { id: 'p1' }, body: {} }, {})).rejects.toThrow(
      /needs an idempotency key/,
    );
    expect(seen).toHaveLength(0);
  });

  it('resolves undefined for a 204', async () => {
    const { client } = harness(() => new Response(null, { status: 204 }), { session: session() });
    await expect(client.call('logout')).resolves.toBeUndefined();
  });

  it('adds the extra headers it was given to every request', async () => {
    const { client, seen } = harness(() => json({}), { headers: { Cookie: '__Host-hk_s_at=x' } });
    await client.call('getCurrentSession');
    expect(nth(seen, 0).headers.get('Cookie')).toBe('__Host-hk_s_at=x');
  });
});

describe('error normalisation (one envelope)', () => {
  it('turns a non-2xx envelope into an ApiError carrying status, code, message and correlation id', async () => {
    const { client } = harness(() => json(envelope('FORBIDDEN'), 403));
    const error = await client.call('listProducts').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.status).toBe(403);
    expect(api.code).toBe('FORBIDDEN');
    expect(api.correlationId).toBe('019a7b1d-3b44-79c8-8f00-a553bc391e31');
    expect(api.envelope).toEqual(envelope('FORBIDDEN'));
  });

  it('keeps field details so a form can map them', async () => {
    const body = {
      error: {
        ...envelope('VALIDATION_FAILED').error,
        details: [{ field: '/lines/0/weightKg', code: 'PATTERN', message: 'Three places.' }],
      },
    };
    const { client } = harness(() => json(body, 400));
    const error = (await client.call('listProducts').catch((e: unknown) => e)) as ApiError;
    expect(error.details).toEqual(body.error.details);
    expect(error.envelope.error.details).toEqual(body.error.details);
  });

  it('reads Retry-After on a 429', async () => {
    const { client } = harness(() => json(envelope('RATE_LIMITED'), 429, { 'Retry-After': '12' }));
    const error = (await client.call('listProducts').catch((e: unknown) => e)) as ApiError;
    expect(error.retryAfter).toBe(12);
  });

  it('turns a reply that is not the envelope into INVALID_RESPONSE, keeping the status and any correlation header', async () => {
    const { client } = harness(
      () =>
        new Response('<html>Bad gateway</html>', {
          status: 502,
          headers: { 'X-Correlation-Id': 'abc' },
        }),
    );
    const error = (await client.call('listProducts').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.correlationId).toBe('abc');
  });

  it('turns a failed connection into a NetworkError with status 0 and an empty correlation id', async () => {
    const { client } = harness(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = (await client.call('listProducts').catch((e: unknown) => e)) as NetworkError;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.envelope.error.correlationId).toBe('');
  });

  it('turns a request that takes too long into a TIMEOUT', async () => {
    const { client } = harness(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
      { timeoutMs: 20 },
    );
    const error = (await client.call('listProducts').catch((e: unknown) => e)) as NetworkError;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.code).toBe('TIMEOUT');
  });

  it('lets a caller cancel without turning the cancellation into a NetworkError', async () => {
    const controller = new AbortController();
    const { client } = harness(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = client
      .call('listProducts', undefined, { signal: controller.signal })
      .catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});

describe('the 401 single flight', () => {
  /** 401 until the refresh has run, then 200. */
  const stale =
    (hooks: { refresh: ReturnType<typeof vi.fn> }): Handler =>
    () =>
      hooks.refresh.mock.calls.length === 0
        ? json(envelope('UNAUTHENTICATED'), 401)
        : json({ ok: true });

  it('runs exactly one refresh for any number of concurrent 401s, then retries each request once', async () => {
    const hooks = session();
    const { client, seen } = harness(stale(hooks), { session: hooks });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => client.call('getCurrentSession')),
    );
    expect(results).toHaveLength(6);
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(hooks.onExpired).not.toHaveBeenCalled();
    // six first tries, each refused, then six retries.
    expect(seen).toHaveLength(12);
  });

  it('retries a mutation with the same idempotency key and the refreshed CSRF token', async () => {
    const hooks = session();
    const { client, seen } = harness(stale(hooks), { session: hooks });
    await client.call(
      'archiveProduct',
      { path: { id: 'p1' }, body: { version: 1, reason: 'x' } },
      { idempotencyKey: KEY },
    );
    expect(seen).toHaveLength(2);
    expect(nth(seen, 0).headers.get('X-CSRF-Token')).toBe('csrf-1');
    expect(nth(seen, 1).headers.get('X-CSRF-Token')).toBe('csrf-2');
    expect(nth(seen, 1).headers.get('Idempotency-Key')).toBe(KEY);
    expect(await nth(seen, 1).json()).toEqual({ version: 1, reason: 'x' });
  });

  it('lands on session expiry once when the refresh is refused, and every caller gets the 401', async () => {
    const hooks = session({
      refresh: vi.fn(async () => {
        throw new ApiError({
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'Please log in again.',
          correlationId: 'c',
        });
      }),
    });
    const { client, seen } = harness(() => json(envelope('UNAUTHENTICATED'), 401), {
      session: hooks,
    });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => client.call('getCurrentSession').catch((e: unknown) => e)),
    );
    for (const result of results) {
      expect(result).toBeInstanceOf(ApiError);
      expect((result as ApiError).status).toBe(401);
    }
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(hooks.onExpired).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(4); // no retry after a refused refresh
  });

  it('expires the session when a refreshed session is still refused, and does not loop', async () => {
    const hooks = session();
    const { client, seen } = harness(() => json(envelope('UNAUTHENTICATED'), 401), {
      session: hooks,
    });
    const error = (await client.call('getCurrentSession').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(401);
    expect(seen).toHaveLength(2);
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(hooks.onExpired).toHaveBeenCalledTimes(1);
  });

  it('does not expire the session when the refresh could not reach the server', async () => {
    const hooks = session({
      refresh: vi.fn(async () => {
        throw new NetworkError();
      }),
    });
    const { client } = harness(() => json(envelope('UNAUTHENTICATED'), 401), { session: hooks });
    const error = await client.call('getCurrentSession').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(hooks.onExpired).not.toHaveBeenCalled();
  });

  it('does not refresh on a 401 from an operation that needs no session (a wrong password)', async () => {
    const hooks = session();
    const { client, seen } = harness(() => json(envelope('INVALID_CREDENTIALS'), 401), {
      session: hooks,
    });
    const error = (await client
      .call('loginStaff', { body: { identifier: 'a', password: 'b' } })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(hooks.refresh).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });

  it('does not refresh again for a 401 that arrives after the refresh it raced with has finished', async () => {
    const hooks = session();
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    // The first request is refused at once and starts the refresh. The second was sent with the old
    // cookie and its refusal arrives only after the refresh has finished.
    const { client, seen } = harness(
      async (_request, attempt) => {
        if (attempt === 2) await slow;
        return hooks.refresh.mock.calls.length === 0 || attempt === 2
          ? json(envelope('UNAUTHENTICATED'), 401)
          : json({ ok: true });
      },
      { session: hooks },
    );
    const first = client.call('getCurrentSession');
    const second = client.call('getCurrentSession');
    await first;
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    release();
    await second;
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(4); // two refused, two retried
  });

  it('can refresh again later: the single flight is per flight, not per page load', async () => {
    let expiries = 0;
    const hooks = session();
    const { client } = harness(
      () => (expiries++ % 2 === 0 ? json(envelope('UNAUTHENTICATED'), 401) : json({ ok: true })),
      { session: hooks },
    );
    await client.call('getCurrentSession');
    await client.call('getCurrentSession');
    expect(hooks.refresh).toHaveBeenCalledTimes(2);
  });
});

describe('a file upload (multipart/form-data, ADR 0037)', () => {
  it('sends the fields as form data with the file named, its key and the CSRF token, and no JSON type', async () => {
    const stored = {
      id: '019a7a94-915f-79d6-9f0f-a63d1b3e1f1b',
      originalName: 'G-0171.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 4,
      purpose: 'EVIDENCE',
      classification: 'INTERNAL',
      scanStatus: 'PENDING',
      createdAt: '2026-11-13T09:41:00Z',
    };
    const { client, seen } = harness(() => json(stored, 201), { session: session() });
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'G-0171.jpg', {
      type: 'image/jpeg',
    });
    const answer = await client.call(
      'uploadFile',
      { body: { file: photo, purpose: 'EVIDENCE' } },
      { idempotencyKey: KEY },
    );
    expect(answer.id).toBe(stored.id);
    const request = nth(seen, 0);
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/v1/files');
    expect(request.headers.get('Idempotency-Key')).toBe(KEY);
    expect(request.headers.get('X-CSRF-Token')).toBe('csrf-1');
    expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
    const form = await request.formData();
    expect(form.get('purpose')).toBe('EVIDENCE');
    const file = form.get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('G-0171.jpg');
    expect((file as File).size).toBe(4);
  });

  it('a JSON operation still sends JSON', async () => {
    const { client, seen } = harness(() => json({}, 200));
    await client.call(
      'archiveProduct',
      { path: { id: 'p1' }, body: { version: 1, reason: 'x' } },
      { idempotencyKey: KEY },
    );
    expect(nth(seen, 0).headers.get('Content-Type')).toBe('application/json');
  });
});
