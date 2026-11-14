import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * How the next requests to the mock should be answered, for a screen's four states. Prism answers every
 * one of them from the contract: `Prefer: code=...` returns the contract's own example for that status.
 * Two things Prism cannot do are done here, and say so:
 *
 * - `hold`: the response is held back until released, so the loading state can be seen.
 * - `noRows`: a list's rows are dropped from a successful answer, because contract 1.1.0 has no empty
 *   example and Prism cannot return an empty list (CR-005). The page info says there is no more.
 */
export const mock: {
  prefer: string | null;
  /** Only requests whose path starts with this get `prefer`; null for all of them. */
  preferPath: string | null;
  hold: Promise<void> | null;
  noRows: boolean;
} = { prefer: null, preferPath: null, hold: null, noRows: false };

/** Holds every response to the mock until the returned function is called. */
export function holdResponses(): () => void {
  let release: () => void = () => undefined;
  mock.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}

// jsdom lacks the pointer and scroll APIs Radix Select uses (as packages/ui's Select test says).
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

afterEach(() => {
  cleanup();
  mock.prefer = null;
  mock.preferPath = null;
  mock.hold = null;
  mock.noRows = false;
});

/**
 * A cookie jar for Node's fetch. Prism checks the contract's security scheme, and the staff scheme is a
 * cookie (`__Host-hk_s_at`) that a browser sends by itself because it holds it. Node's fetch has no jar, so
 * requests to the mock get the cookie added here. Prism only checks that it is present. The response is
 * still Prism's own, from the contract: nothing here answers a request.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.port !== '4010') return realFetch(request);
  if (!request.headers.has('Cookie'))
    request.headers.set('Cookie', '__Host-hk_s_at=integration-test');
  if (
    mock.prefer !== null &&
    (mock.preferPath === null || url.pathname.startsWith(mock.preferPath))
  ) {
    request.headers.set('Prefer', mock.prefer);
  }
  const response = await realFetch(request);
  if (mock.hold !== null) await mock.hold;
  if (!mock.noRows || request.method !== 'GET' || !response.ok) return response;
  const body = (await response.json()) as { data?: unknown; page?: Record<string, unknown> };
  if (!Array.isArray(body.data)) return Response.json(body, { status: response.status });
  return Response.json(
    { ...body, data: [], page: { ...body.page, nextCursor: null, hasMore: false } },
    { status: response.status, headers: { 'Content-Type': 'application/json' } },
  );
};
