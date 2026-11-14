import { createApiClient, type ApiClient } from '@hakorem/api-client';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createApiHooks, type ApiHooks } from './hooks';
import { createQueryClient } from './queryClient';

export const envelope = (code: string, message = 'A safe sentence.', correlationId = 'c-1') => ({
  error: { code, message, correlationId, details: [] },
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export type Handler = (request: Request, attempt: number) => Response | Promise<Response>;

/** A data layer over a function that plays the network, with retries made instant. For unit tests only. */
export function testData(handler: Handler): {
  api: ApiClient;
  hooks: ApiHooks;
  queryClient: QueryClient;
  requests: Request[];
  wrapper: (props: { children: ReactNode }) => ReactNode;
} {
  const requests: Request[] = [];
  const api = createApiClient({
    baseUrl: 'http://api.test/v1',
    fetch: async (request) => {
      requests.push(request.clone());
      return handler(request, requests.length);
    },
  });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
    mutations: { ...queryClient.getDefaultOptions().mutations, retryDelay: 0 },
  });
  return {
    api,
    hooks: createApiHooks(api),
    queryClient,
    requests,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}
