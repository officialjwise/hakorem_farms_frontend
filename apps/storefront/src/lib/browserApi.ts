import { apiBaseUrl, createApiClient, type ApiClient } from '@hakorem/api-client';
import { createApiHooks } from '@hakorem/data';

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
