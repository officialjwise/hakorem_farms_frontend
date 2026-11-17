import { ApiError, apiBaseUrl, createApiClient, type ApiClient } from '@hakorem/api-client';
import { createApiHooks, createQueryClient } from '@hakorem/data';
import { inWords } from './refusals';
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
  // Every refusal leaves here in the console's words, where it has them (ADR 0038).
  call: (...args) =>
    getApi()
      .call(...args)
      .catch((error: unknown) => {
        throw error instanceof ApiError ? inWords(error) : error;
      }),
  callRequested: (...args) =>
    getApi()
      .callRequested(...args)
      .catch((error: unknown) => {
        throw error instanceof ApiError ? inWords(error) : error;
      }),
};

/**
 * The client for the one caller that is not a screen: the till's queue (ADR 0043), which sends records with
 * no screen open. Refusals in the console's words, as for the hooks.
 */
export const consoleApi: ApiClient = lazyApi;

/** The hooks every screen uses. Screens never import `@tanstack/react-query` or call `fetch`. */
export const { useApiQuery, useApiAllPages, useApiMutation } = createApiHooks(lazyApi);

/** The code `useApiAllPages` fails with past its hard cap (ADR 0028), for a screen to say in its own words. */
export { PAGE_CAP_EXCEEDED } from '@hakorem/data';
