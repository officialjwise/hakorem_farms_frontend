export { createQueryClient } from './queryClient';
export {
  createApiHooks,
  MAX_ALL_PAGES,
  PAGE_CAP_EXCEEDED,
  PageCapExceededError,
  requestedQueryKey,
  type RequestedInput,
  type AllPages,
  type ApiHooks,
  type PageItem,
  type PagedOperationId,
  type ApiMutation,
  type CallIntent,
  type MutationOptions,
  type QueryOptions,
} from './hooks';
export { isSameResource, queryKey, resourceRoot, type ApiQueryKey } from './queryKeys';
export {
  isTransient,
  MAX_MUTATION_RETRIES,
  MAX_QUERY_RETRIES,
  retryDelay,
  shouldRetryMutation,
  shouldRetryQuery,
} from './retry';
export { DEFAULT_STALE_CLASS, STALE_TIME_MS, type StaleClass } from './staleness';
export { QueryClientProvider } from '@tanstack/react-query';
