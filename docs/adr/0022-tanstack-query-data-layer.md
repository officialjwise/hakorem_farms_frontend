# 0022. Server state lives in TanStack Query, behind two hooks, with one QueryClientProvider

- Status: accepted (owner's brief for F2, 2026-11-14: TanStack Query and its `QueryClientProvider` are the one new provider F2 may add)
- Date: 2026-11-14
- Session: F2

## Context

Every screen from F3 reads and writes server state. Without one layer, each screen would choose its own loading flags, cache lifetime, retry and invalidation, and a stale stock figure would be a matter of who remembered. The brief names TanStack Query. The house rule is that a new provider is a stop and a question, and the owner has allowed exactly this one.

## Options considered

1. **A hook per screen over `useEffect`.** What the skills forbid; no cache, no retry policy.
2. **SWR.** Comparable, but the mutation and invalidation story is thinner.
3. **TanStack Query v5.**

## Decision

Option 3, `@tanstack/react-query` 5.105.0 (2026-10-26; 5.105.1 is younger than the two-week floor), in a new package `@hakorem/data`.

- **One provider.** Each app mounts `QueryClientProvider` once, beside the one `UIProvider`, and adds no other provider. There is **no API context**: `createApiHooks(api)` returns `useApiQuery` and `useApiMutation` bound to the app's `ApiClient`, which the app creates once in a module of its own, so the dependency is explicit and testable.
- **Keys derive from operation ids.** `queryKey('listProducts', input)` is `['listProducts', input]`. Nobody types a key. `[operationId]` invalidates every call of an operation.
- **Invalidation is derived too.** After a write succeeds, every cached read under the same first path segment (`/products/{id}/archive` and `/products`) is invalidated, plus any reads the call names in `invalidates`. It errs toward refetching.
- **Defaults** (`createQueryClient`): stale time `live` (0), `networkMode: 'always'` so a lost connection becomes a `NetworkError` a screen can show instead of a skeleton that never ends, reads retry twice with backoff for no-answer and 429, 502, 503 and 504 only, writes retry twice only for no-answer and those busy statuses, never a 4xx and never a 500. The reasons and the rules for optimistic updates are in `docs/DATA_CONVENTIONS.md`.
- **A mutation owns its key.** `useApiMutation` creates the idempotency key when `mutate` is called and carries it in the TanStack variables, so every automatic retry sends the same key (ADR 0020).
- **Failures are `ApiError`** (ADR 0020), so `query.error` and `mutation.error` are the one normalised shape.

## Consequences

- A screen is `useApiQuery` plus `QueryBoundary` (ADR 0023) and never touches `fetch`, a key or a retry.
- Default `live` means a screen that wants cached data must say so (`staleClass: 'working' | 'reference' | 'immutable'`). Assumption A-F2-04.
- Optimistic updates are not offered by the hooks. They are allowed only where DATA_CONVENTIONS says, and never for money or stock.
- Server components in the storefront (F7) will call `ApiClient` directly on the server, and hydrate through TanStack's own hydration if a page needs it. That is F7's decision.
