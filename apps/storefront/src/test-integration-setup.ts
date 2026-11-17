/**
 * How the next requests to the Prism mock are answered (ADR 0019): `Prefer: code=404` returns the
 * contract's own example for that status, for the not-found and error states. Nothing here answers a
 * request; every response is Prism's, from the contract. Prism checks only that a guest cart carries a
 * cookie it cannot set, so none is needed.
 */
export const mock: { prefer: string | null; preferPath: string | null } = {
  prefer: null,
  preferPath: null,
};

beforeEach(() => {
  mock.prefer = null;
  mock.preferPath = null;
});

// jsdom has no ResizeObserver, which Radix Checkbox reads for its size (as the console's setup says).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (
    url.port === '4010' &&
    mock.prefer !== null &&
    (mock.preferPath === null || url.pathname.startsWith(mock.preferPath))
  ) {
    request.headers.set('Prefer', mock.prefer);
  }
  return realFetch(request);
};
