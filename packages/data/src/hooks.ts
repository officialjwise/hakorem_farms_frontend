import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  newIdempotencyKey,
  type ApiClient,
  type ApiError,
  type InputIsOptional,
  type MutationOperationId,
  type OperationData,
  type OperationId,
  type OperationInput,
  type QueryOperationId,
} from '@hakorem/api-client';
import { isSameResource, queryKey } from './queryKeys';
import { STALE_TIME_MS, DEFAULT_STALE_CLASS, type StaleClass } from './staleness';

export interface QueryOptions {
  /** How long the answer stays fresh. Defaults to `live`; say which class when choosing a longer one. */
  staleClass?: StaleClass;
  /** False holds the query back, for example until a filter is chosen. */
  enabled?: boolean;
  /** Poll, in milliseconds. For a live board only. */
  refetchInterval?: number | false;
}

type QueryArguments<Op extends QueryOperationId> =
  InputIsOptional<Op> extends true
    ? [input?: OperationInput<Op>, options?: QueryOptions]
    : [input: OperationInput<Op>, options?: QueryOptions];

export interface MutationOptions<Op extends MutationOperationId> {
  /**
   * Reads to refetch after this write succeeds, besides every cached read about the same resource (the
   * hook already invalidates those; see `isSameResource`). Name the reads of another resource the write
   * changes, for example a goods receipt changing stock on hand.
   */
  invalidates?: readonly QueryOperationId[];
  onSuccess?: (data: OperationData<Op>, input: OperationInput<Op>) => void;
}

export interface CallIntent {
  /**
   * The key for this user intent. Leave it out and the hook creates one for the call, reused on every
   * automatic retry. Pass one to make a retry button reuse the first attempt's key: create it with
   * `newIdempotencyKey()` when the confirmation opens and keep it until the intent ends.
   */
  idempotencyKey?: string;
}

export interface ApiMutation<Op extends MutationOperationId> {
  mutate: (input: OperationInput<Op>, intent?: CallIntent) => void;
  mutateAsync: (input: OperationInput<Op>, intent?: CallIntent) => Promise<OperationData<Op>>;
  status: 'idle' | 'pending' | 'error' | 'success';
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** The normalised failure. Show it with `MutationFailure`, and leave it on screen until the next attempt. */
  error: ApiError | null;
  data: OperationData<Op> | undefined;
  reset: () => void;
}

/** The contract-typed `call` seen without its generics, for the two places that already hold a checked operation id. */
type LooseCall = (
  operation: OperationId,
  input: unknown,
  options: { signal?: AbortSignal; idempotencyKey?: string },
) => Promise<unknown>;

/** A read whose answer is a cursor page: `{ data: [...], page: { nextCursor, hasMore } }`. */
export type PagedOperationId = {
  [Op in QueryOperationId]: OperationData<Op> extends {
    data: readonly unknown[];
    page: { nextCursor: string | null; hasMore: boolean };
  }
    ? Op
    : never;
}[QueryOperationId];

/** One row of a paged read. */
export type PageItem<Op extends PagedOperationId> =
  OperationData<Op> extends { data: readonly (infer Item)[] } ? Item : never;

/** Every row of a paged read, and whether the page cap cut it short. */
export interface AllPages<Item> {
  items: Item[];
  /** True when more pages remained after `MAX_ALL_PAGES`. Say so on screen rather than look complete. */
  truncated: boolean;
}

/**
 * The most pages `useApiAllPages` reads. With the contract's maximum page size of 100 that is 500 rows,
 * enough for a reference list (273 permissions in contract 1.1.0) and a stop for one that is not.
 */
export const MAX_ALL_PAGES = 5;

export interface ApiHooks {
  useApiQuery: <Op extends QueryOperationId>(
    operation: Op,
    ...args: QueryArguments<Op>
  ) => UseQueryResult<OperationData<Op>, ApiError>;
  /**
   * Every page of a cursor-paged reference list, read one after another into ONE cache entry: for a short
   * list a screen must show whole, such as the permissions a role can hold. Not for browsing: a list
   * someone pages through uses `useApiQuery` with a cursor (DATA_CONVENTIONS, "Pagination").
   */
  useApiAllPages: <Op extends PagedOperationId>(
    operation: Op,
    ...args: QueryArguments<Op>
  ) => UseQueryResult<AllPages<PageItem<Op>>, ApiError>;
  useApiMutation: <Op extends MutationOperationId>(
    operation: Op,
    options?: MutationOptions<Op>,
  ) => ApiMutation<Op>;
}

/**
 * Builds the two hooks every screen uses, bound to an app's `ApiClient` (ADR 0022). The client is passed in
 * rather than read from a context: the app creates it once beside its one QueryClient, and there is no
 * second provider.
 */
export function createApiHooks(api: ApiClient): ApiHooks {
  const call = api.call as unknown as LooseCall;

  function useApiQuery<Op extends QueryOperationId>(
    operation: Op,
    ...args: QueryArguments<Op>
  ): UseQueryResult<OperationData<Op>, ApiError> {
    const [input, options = {}] = args as [
      OperationInput<Op> | undefined,
      QueryOptions | undefined,
    ];
    return useQuery<OperationData<Op>, ApiError>({
      queryKey: queryKey(operation, input),
      queryFn: ({ signal }) =>
        call(operation, input ?? {}, { signal }) as Promise<OperationData<Op>>,
      staleTime: STALE_TIME_MS[options.staleClass ?? DEFAULT_STALE_CLASS],
      enabled: options.enabled,
      refetchInterval: options.refetchInterval,
    });
  }

  function useApiMutation<Op extends MutationOperationId>(
    operation: Op,
    options: MutationOptions<Op> = {},
  ): ApiMutation<Op> {
    const queryClient = useQueryClient();
    const mutation = useMutation<
      OperationData<Op>,
      ApiError,
      { input: OperationInput<Op>; idempotencyKey: string }
    >({
      // The key rides in the variables, so every automatic retry of this call sends the same one.
      mutationFn: ({ input, idempotencyKey }) =>
        call(operation, input, { idempotencyKey }) as Promise<OperationData<Op>>,
      onSuccess: async (data, { input }) => {
        const extra = new Set<string>(options.invalidates ?? []);
        await queryClient.invalidateQueries({
          predicate: (query) =>
            isSameResource(operation, query.queryKey) || extra.has(String(query.queryKey[0])),
        });
        options.onSuccess?.(data, input);
      },
    });

    const withKey = (input: OperationInput<Op>, intent?: CallIntent) => ({
      input,
      idempotencyKey: intent?.idempotencyKey ?? newIdempotencyKey(),
    });

    return {
      mutate: (input, intent) => mutation.mutate(withKey(input, intent)),
      mutateAsync: (input, intent) => mutation.mutateAsync(withKey(input, intent)),
      status: mutation.status,
      isPending: mutation.isPending,
      isError: mutation.isError,
      isSuccess: mutation.isSuccess,
      error: mutation.error,
      data: mutation.data,
      reset: mutation.reset,
    };
  }

  function useApiAllPages<Op extends PagedOperationId>(
    operation: Op,
    ...args: QueryArguments<Op>
  ): UseQueryResult<AllPages<PageItem<Op>>, ApiError> {
    const [input, options = {}] = args as [
      OperationInput<Op> | undefined,
      QueryOptions | undefined,
    ];
    const base = (input ?? {}) as { query?: Record<string, unknown> };
    return useQuery<AllPages<PageItem<Op>>, ApiError>({
      // Its own key: the answer's shape differs from one page's, so it must not share that cache entry.
      // The first element is still the operation id, so a write to the resource invalidates it.
      queryKey: [...queryKey(operation, input), 'all-pages'],
      queryFn: async ({ signal }) => {
        const items: PageItem<Op>[] = [];
        let cursor: string | null = null;
        for (let read = 0; read < MAX_ALL_PAGES; read += 1) {
          const page = (await call(
            operation,
            { ...base, query: { ...base.query, ...(cursor === null ? {} : { cursor }) } },
            { signal },
          )) as { data: PageItem<Op>[]; page: { nextCursor: string | null; hasMore: boolean } };
          items.push(...page.data);
          cursor = page.page.hasMore ? page.page.nextCursor : null;
          if (cursor === null) return { items, truncated: false };
        }
        return { items, truncated: true };
      },
      staleTime: STALE_TIME_MS[options.staleClass ?? DEFAULT_STALE_CLASS],
      enabled: options.enabled,
    });
  }

  return { useApiQuery, useApiAllPages, useApiMutation };
}
