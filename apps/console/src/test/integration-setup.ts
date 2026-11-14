import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

/**
 * A cookie jar for Node's fetch. Prism checks the contract's security scheme, and the staff scheme is a
 * cookie (`__Host-hk_s_at`) that a browser sends by itself because it holds it. Node's fetch has no jar, so
 * requests to the mock get the cookie added here. Prism only checks that it is present. The response is
 * still Prism's own, from the contract: nothing here answers a request.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const request = new Request(input, init);
  if (new URL(request.url).port === '4010' && !request.headers.has('Cookie')) {
    request.headers.set('Cookie', '__Host-hk_s_at=integration-test');
  }
  return realFetch(request);
};
