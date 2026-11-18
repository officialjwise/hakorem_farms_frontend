import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  ApiError,
  newIdempotencyKey,
  type ApiClient,
  type InputIsOptional,
  type MutationOperationId,
  type OperationData,
  type OperationId,
  type OperationInput,
  type QueryOperationId,
  type RequestedOperation,
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

/** Every row of a paged read. There is no partial answer: past the cap the read fails (`PageCapExceededError`). */
export interface AllPages<Item> {
  items: Item[];
}

/**
 * The most pages `useApiAllPages` reads. With the contract's maximum page size of 100 that is 500 rows,
 * enough for a reference list (273 permissions in contract 1.1.0) and a hard stop for one that is not.
 */
export const MAX_ALL_PAGES = 5;

/** The code a `PageCapExceededError` carries, for a screen to give it its own words. */
export const PAGE_CAP_EXCEEDED = 'PAGE_CAP_EXCEEDED';

/**
 * `useApiAllPages` was pointed at a list longer than `MAX_ALL_PAGES` pages: a list people browse (stock,
 * orders), not a reference list. It fails loudly instead of reading on, and is never retried (`isTransient`
 * is false: it is not a `NetworkError` and its status is not a busy one). `status` is 0 because no single
 * answer was wrong; the code is the client's own.
 */
export class PageCapExceededError extends ApiError {
  readonly operationId: string;

  constructor(operationId: string) {
    super({
      status: 0,
      code: PAGE_CAP_EXCEEDED,
      message: `${operationId} has more than ${MAX_ALL_PAGES} pages, which useApiAllPages does not read. A list this long is browsed with a cursor and Pagination (DATA_CONVENTIONS, ADR 0028).`,
      correlationId: '',
    });
    this.name = 'PageCapExceededError';
    this.operationId = operationId;
  }
}

export interface ApiHooks {
  useApiQuery: <Op extends QueryOperationId>(
    operation: Op,
    ...args: QueryArguments<Op>
  ) => UseQueryResult<OperationData<Op>, ApiError>;
  /**
   * Every page of a cursor-paged reference list, read one after another into ONE cache entry: for a short
   * list a screen must show whole, such as the permissions a role can hold. Not for browsing: a list
   * someone pages through uses `useApiQuery` with a cursor (DATA_CONVENTIONS, "Pagination"). Past
   * `MAX_ALL_PAGES` pages it fails with `PageCapExceededError` rather than read on.
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

/** The input of a requested read: its path and query, as `callRequested` takes them. */
export interface RequestedInput {
  path?: Record<string, string>;
  query?: Record<string, unknown>;
}

/** The key of a requested read, apart from every generated operation's (ADR 0052). */
export function requestedQueryKey(operation: RequestedOperation, input: RequestedInput) {
  return ['requested', operation.operationId, input] as const;
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
          if (cursor === null) return { items };
        }
        // The cap is hard: a list still going after MAX_ALL_PAGES is the wrong list for this hook.
        throw new PageCapExceededError(operation);
      },
      staleTime: STALE_TIME_MS[options.staleClass ?? DEFAULT_STALE_CLASS],
      enabled: options.enabled,
    });
  }

  return { useApiQuery, useApiAllPages, useApiMutation };
}

/**
 * A read a contract request asks for and the contract does not list yet (ADR 0046, ADR 0052), through
 * `callRequested`, with the same stale classes, retry and four states as `useApiQuery`. Only a module in
 * the console's `requested/` calls it, with `enabled` set by the request's switch; the answer is cast to
 * that module's type. Its key is `['requested', operationId, input]`, which no real operation shares. It is
 * built apart from `createApiHooks`, so an app that never reads a requested operation (the till) does not
 * carry it.
 */
export function createRequestedQuery(api: Pick<ApiClient, 'callRequested'>) {
  return function useRequestedQuery<Data>(
    operation: RequestedOperation,
    input: RequestedInput,
    options: QueryOptions = {},
  ): UseQueryResult<Data, ApiError> {
    return useQuery<Data, ApiError>({
      queryKey: requestedQueryKey(operation, input),
      queryFn: ({ signal }) => api.callRequested(operation, input, { signal }) as Promise<Data>,
      staleTime: STALE_TIME_MS[options.staleClass ?? DEFAULT_STALE_CLASS],
      enabled: options.enabled,
      refetchInterval: options.refetchInterval,
    });
  };
}

/** The input of a requested write: its path, query and body, as `callRequested` takes them. */
export interface RequestedWriteInput extends RequestedInput {
  body?: unknown;
}

export interface RequestedMutationOptions {
  /**
   * Reads to refetch after the write succeeds: generated operation ids, and requested operation ids,
   * which match a requested read's key (`['requested', operationId, input]`, ADR 0053).
   */
  invalidates?: readonly string[];
}

export interface RequestedMutation<Data> {
  mutateAsync: (input: RequestedWriteInput, intent?: CallIntent) => Promise<Data>;
  isPending: boolean;
  isError: boolean;
  error: ApiError | null;
  data: Data | undefined;
  reset: () => void;
}

/**
 * A write a contract request asks for and the contract does not list yet (ADR 0046, ADR 0053): the twin of
 * `createRequestedQuery`. It is `useApiMutation` through `callRequested`: the same idempotency key on every
 * automatic retry, the same normalised `ApiError`, and invalidation by operation id. Only a module in the
 * console's `requested/` builds it, and only a screen switched on for the request calls it. Built apart from
 * `createApiHooks`, so the till does not carry it.
 */
export function createRequestedMutation(api: Pick<ApiClient, 'callRequested'>) {
  return function useRequestedMutation<Data>(
    operation: RequestedOperation,
    options: RequestedMutationOptions = {},
  ): RequestedMutation<Data> {
    const queryClient = useQueryClient();
    const mutation = useMutation<
      Data,
      ApiError,
      { input: RequestedWriteInput; idempotencyKey: string }
    >({
      mutationFn: ({ input, idempotencyKey }) =>
        api.callRequested(operation, input, { idempotencyKey }) as Promise<Data>,
      onSuccess: async () => {
        const names = new Set<string>(options.invalidates ?? []);
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const [first, second] = query.queryKey;
            return first === 'requested' ? names.has(String(second)) : names.has(String(first));
          },
        });
      },
    });
    return {
      mutateAsync: (input, intent) =>
        mutation.mutateAsync({
          input,
          idempotencyKey: intent?.idempotencyKey ?? newIdempotencyKey(),
        }),
      isPending: mutation.isPending,
      isError: mutation.isError,
      error: mutation.error,
      data: mutation.data,
      reset: mutation.reset,
    };
  };
}
