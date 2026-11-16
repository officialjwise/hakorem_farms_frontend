import { apiBaseUrl, createApiClient, type ApiClient } from '@hakorem/api-client';
import { createApiHooks, createQueryClient } from '@hakorem/data';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The storefront's API in the browser, for the cart and the checkout only (ADR 0022). Those operations
 * are anonymous: a guest cart is proved by the `__Host-hk_guest` cookie the API sets on `createCart`, which
 * the browser sends with every call (`credentials: 'include'`) and the storefront's server never holds.
 * There is no session and no CSRF token (contract 1.32.0). Created on first use, so a build that was not
 * told where the API is says so at the first request (ADR 0019).
 */
let client: ApiClient | undefined;
function browserApi(): ApiClient {
  client ??= createApiClient({ baseUrl: apiBaseUrl() });
  return client;
}

const lazyApi: ApiClient = {
  get baseUrl() {
    return browserApi().baseUrl;
  },
  call: (...args) => browserApi().call(...args),
};

/** The hooks the cart and checkout use. Components never import TanStack Query or call `fetch`. */
export const { useApiQuery, useApiMutation } = createApiHooks(lazyApi);

let queryClient: QueryClient | undefined;

/**
 * The storefront's one QueryClient (ADR 0022, ADR 0041). Each island that reads or writes the basket mounts
 * it through `ShopData`, so the basket count, the drawer, "Add to basket" and the checkout share one cache,
 * and a page with no basket never loads the data layer. In the browser it is one client for the page; on the
 * server, where these islands also render once, each call gets its own, so no visitor shares another's.
 */
export function shopQueryClient(): QueryClient {
  if (typeof window === 'undefined') return createQueryClient();
  queryClient ??= createQueryClient();
  return queryClient;
}
