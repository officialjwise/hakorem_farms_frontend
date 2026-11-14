import { QueryClient } from '@tanstack/react-query';
import { DEFAULT_STALE_CLASS, STALE_TIME_MS } from './staleness';
import { retryDelay, shouldRetryMutation, shouldRetryQuery } from './retry';

/**
 * The one QueryClient an app creates (ADR 0022). Defaults, each explained in docs/DATA_CONVENTIONS.md:
 *
 * - `networkMode: 'always'`: a request is attempted even when the browser thinks it is offline, so a
 *   screen gets a `NetworkError` it can show in words instead of a skeleton that never ends.
 * - stale time `live` (0): data is refetched on mount and on window focus unless a screen opts into a
 *   longer class.
 * - retries only for "never got there" and busy-server failures, with backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS[DEFAULT_STALE_CLASS],
        networkMode: 'always',
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: 'always',
        retry: shouldRetryMutation,
        retryDelay,
      },
    },
  });
}
