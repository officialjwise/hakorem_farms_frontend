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
 * - the end of a list: Prism answers every page with the same example, `hasMore: true` and the SAME
 *   `nextCursor`, whatever cursor it was asked with, so its lists never end. A page whose `nextCursor` is
 *   the cursor it was asked with is answered as the last page. Without this, `useApiAllPages` meets its
 *   hard cap on every read (ADR 0028). `endlessPages` turns it off, to show the cap.
 */
export const mock: {
  prefer: string | null;
  /** Only requests whose path starts with this get `prefer`; null for all of them. */
  preferPath: string | null;
  hold: Promise<void> | null;
  noRows: boolean;
  endlessPages: boolean;
} = { prefer: null, preferPath: null, hold: null, noRows: false, endlessPages: false };

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
// Nor ResizeObserver, which Radix Checkbox reads for its size (as packages/ui's stubResizeObserver says).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  mock.prefer = null;
  mock.preferPath = null;
  mock.hold = null;
  mock.noRows = false;
  mock.endlessPages = false;
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
  const cursor = url.searchParams.get('cursor');
  const mayEnd = !mock.endlessPages && cursor !== null;
  if ((!mock.noRows && !mayEnd) || request.method !== 'GET' || !response.ok) return response;
  const body = (await response.json()) as { data?: unknown; page?: Record<string, unknown> };
  const answer = (changed: unknown) =>
    Response.json(changed, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  if (!Array.isArray(body.data)) return answer(body);
  const lastPage = { ...body.page, nextCursor: null, hasMore: false };
  if (mock.noRows) return answer({ ...body, data: [], page: lastPage });
  if (body.page?.['nextCursor'] === cursor) return answer({ ...body, page: lastPage });
  return answer(body);
};
