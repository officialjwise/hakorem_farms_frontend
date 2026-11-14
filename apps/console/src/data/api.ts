import { apiBaseUrl, createApiClient, type ApiClient } from '@hakorem/api-client';
import { createApiHooks, createQueryClient } from '@hakorem/data';
import { sessionHooks } from './session';

/** The one QueryClient (ADR 0022), mounted by `DataProvider`. */
export const queryClient = createQueryClient();

let client: ApiClient | undefined;

/**
 * The console's one API client. It is created on first use, so an app that has not been told where the API
 * is (`HK_API_BASE_URL`, ADR 0019) fails with that message at the first request, not at startup.
 */
export function getApi(): ApiClient {
  client ??= createApiClient({ baseUrl: apiBaseUrl(), session: sessionHooks });
  return client;
}

const lazyApi: ApiClient = {
  get baseUrl() {
    return getApi().baseUrl;
  },
  call: (...args) => getApi().call(...args),
};

/** The hooks every screen uses. Screens never import `@tanstack/react-query` or call `fetch`. */
export const { useApiQuery, useApiAllPages, useApiMutation } = createApiHooks(lazyApi);
