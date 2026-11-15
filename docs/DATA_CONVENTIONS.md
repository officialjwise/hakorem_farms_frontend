# Data conventions

How every screen reads and writes server state. Settled in F2 (ADRs 0018 to 0023); change a rule here by writing an ADR first. The skill `hakorem-api-call` is the short form of this file.

## The layers

| Layer            | Where                    | Does                                                                                                                                                                  |
| ---------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract         | `contract/openapi.yaml`  | The only truth about the API. Synced, never edited.                                                                                                                   |
| Generated client | `packages/api-client`    | `schema.ts` (types), `operations.ts` (one row per operation id), `createApiClient().call(operationId, input, options)`. The only code that calls `fetch` for the API. |
| Data layer       | `packages/data`          | `createQueryClient()`, `createApiHooks(api)` giving `useApiQuery` and `useApiMutation`, query keys, stale times, retry, invalidation.                                 |
| Shared states    | `packages/ui`            | `QueryBoundary` and `MutationFailure`: loading, empty, error, permission denied.                                                                                      |
| App module       | `apps/console/src/data/` | The app's one `ApiClient`, its `useApiQuery` and `useApiMutation`, `DataProvider` (the one `QueryClientProvider`) and the session seam.                               |

A screen imports `useApiQuery` and `useApiMutation` from its app's `data/api` and `QueryBoundary` from `@hakorem/ui`. It never imports `@tanstack/react-query`, never calls `fetch`, never writes a query key, a retry or a header.

## Which API: one variable

`HK_API_BASE_URL` is the base URL every request goes to, read in one place (`packages/api-client/src/baseUrl.ts`). Nothing else decides mock or real.

```bash
pnpm dev:mock                                          # Prism on http://127.0.0.1:4010
HK_API_BASE_URL=/mock pnpm dev:console                 # the console in a browser against the mock (ADR 0025)
HK_API_BASE_URL=https://api.staging.hakoremfarms.com/v1 pnpm dev:console
```

Unset, the app fails at its first request with a message naming the variable. There is no default and no `NODE_ENV` check. Vite (`define`) and Next (`env`) inline it at build time.

## Calling an operation

```ts
const products = useApiQuery('listProducts', { query: { status: 'ACTIVE', limit: 25 } });
const archive = useApiMutation('archiveProduct');
archive.mutate({ path: { id }, body: { version: p.version, reason } });
```

The input is `{ path?, query?, body? }`, typed from the contract. The client adds `Idempotency-Key` and `X-CSRF-Token` itself. A reply is the 2xx body (`undefined` for a 204; a 202 `ApprovalPending` is part of the type, so handle it). Anything else throws an `ApiError`.

## Branch scope

The header's branch (ADR 0034) reaches a screen only through `useBranchScope()`. A read whose operation takes `branchId` spreads `scope.query` into its input, so its query key changes with the choice and it re-reads; "all branches" sends no `branchId`. A list whose operation has no `branchId` (CR-015) shows `BranchScopeNote` under its title instead of pretending to be narrowed. Location pickers (`useLocations`) are scoped the same way.

## Query keys

`[operationId, input]`, derived by `queryKey(operationId, input)`, never typed. `['listProducts']` invalidates every call of the operation. Two screens asking the same question share one cache entry.

## Stale times, by class of data

| Class                | Stale time | Use for                                                                                                       |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `live` (the default) | 0          | Money, stock, shifts, approvals, carts, anything an operator acts on. Refetched on mount and on window focus. |
| `working`            | 30 s       | Lists people browse and filter: products, customers, orders, suppliers. Never a figure someone will act on.   |
| `reference`          | 10 min     | Units, categories, tax categories, grades, weight bands, roles.                                               |
| `immutable`          | never      | A record that cannot change once written: an issued document, a closed period.                                |

The default is `live`, not `working`: a screen opts into a longer class by naming it (`{ staleClass: 'reference' }`) and says why in a comment. Cache time (garbage collection) is TanStack's default of five minutes. When the session ends, signed out or expired, the whole cache is cleared (`DataProvider`).

`networkMode` is `always`: a request is attempted even when the browser thinks it is offline, so the screen gets a `NetworkError` in words, not a skeleton that never ends. The POS has its own offline queue (F9).

## Retry

|       | Retries | Which failures                                                    | Backoff                                                                                    |
| ----- | ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Read  | 2       | no answer (`NetworkError`, including timeout), 429, 502, 503, 504 | 1 s, 2 s, then 4 s, capped at 8 s; `Retry-After` when the server sends it (capped at 30 s) |
| Write | 2       | the same                                                          | the same                                                                                   |

Never retried: any other 4xx (400, 401, 403, 404, 409, 422: a person must act) and a 500 (the server may have done part of it). A write's retry carries **the same idempotency key and body**, so it cannot double-post. A request times out after 30 s.

## Mutations and idempotency

- The contract requires an `Idempotency-Key` (a UUID, `required: true`) on every state-changing operation that lists it. The client's types make `idempotencyKey` required on exactly those, and it refuses to send without one.
- `useApiMutation` creates the key when `mutate` is called and every automatic retry reuses it.
- **A key belongs to a user intent, not an attempt.** For a "Try again" button that should repeat the same intent, create the key when the confirmation opens (`newIdempotencyKey()` in a `useRef`), pass it as `mutate(input, { idempotencyKey })` each time, and make a new one only when the user changes what they are asking for. The same key with a different body is the server's 409.
- A write to money or stock opens a confirmation showing the exact amounts first, and a failure leaves an alert on screen (`MutationFailure`), not only a toast.

## Invalidation

After a write succeeds, every cached read about the same resource is invalidated (the same first path segment: a write to `/products/{id}/archive` refetches `listProducts` and `getProduct`). Name the reads of another resource the write changes in `useApiMutation(op, { invalidates: ['listStockOnHand'] })`, for example a goods receipt changing stock on hand. The rule errs toward refetching. The mutation stays pending until the refetch finishes, so the screen never shows a stale row beside a success.

## Optimistic updates

The hooks do not offer them. They are allowed only when all of these hold: the change is the user's own presentation state or a reversible label (a saved filter, a pinned view, marking a notification read); nobody else's figure depends on it; it carries no money or stock and no `Idempotency-Key`; it would not appear in the audit trail; and a failure can be shown by putting the old value back with words. **Never for money or stock**, never for a status change with side effects, a permission or role, a 202 `ApprovalPending`, or anything that posts to the ledger. When unsure, wait for the server.

## Errors: one envelope

Every failed call is an `ApiError`: `status`, `code`, `message` (safe to show), `correlationId`, `details[]`, `retryAfter`, and `error.envelope`, which is exactly the contract's `{ error: { code, message, correlationId, details } }` and the shape `mapServerErrors` takes.

| Situation                       | status          | code               | correlationId               |
| ------------------------------- | --------------- | ------------------ | --------------------------- |
| The contract's envelope         | the HTTP status | the contract's     | the contract's              |
| No answer                       | 0               | `NETWORK_ERROR`    | empty                       |
| Longer than 30 s                | 0               | `TIMEOUT`          | empty                       |
| Not the envelope (a proxy page) | the HTTP status | `INVALID_RESPONSE` | `X-Correlation-Id` or empty |

- **A form:** `catch (error) { if (error instanceof ApiError) mapServerErrors(error.envelope, form) }`. `details[].field` is a JSON pointer onto a form field.
- **403** is permission denied, in words, on the same URL (`QueryBoundary` does it). **404** on a record is "not found", not an error page. **409** on a versioned write means the record changed: reload it and let the user decide. **422** is a business refusal with a stable `code`: show its `message`.
- **401** is never shown to a screen as "expired": see the next section.
- The data layer holds no words. The three client codes get the screen's own translated text (`errorDescription`), and with an empty `correlationId` no reference is shown.

## The 401 single flight

A 401 from an operation that needs a session refreshes once, in the client: any number of concurrent 401s share one refresh, then each request is retried once with the same idempotency key and the new CSRF token. A refused refresh calls `onExpired`, which puts the console on the session expiry screen. A request sent before a refresh finished and refused after it is retried, not refreshed again (a second refresh in a row would be read as token reuse). `loginStaff` and `refreshSession` are exempt (`security: []`). The console's `AuthProvider` owns the refresh, so its silent timer and a 401 share one.

## The four states

Every screen is `useApiQuery` plus `QueryBoundary`:

```tsx
const query = useApiQuery('listStockOnHand', { query: { locationId } });
<QueryBoundary query={query} labels={labels} isEmpty={(page) => page.data.length === 0} loadingFallback={<TableLoadingRows … />}>
  {(page) => <StockTable rows={page.data} />}
</QueryBoundary>;
```

`labels` come from `t()`. A screen that already knows from the session that the user lacks the permission passes `denied`. A write shows `MutationFailure error={mutation.error}` beside its form and `onRetry` reuses the key.

## Pagination

Cursor pages: `PageInfo` is `nextCursor`, `limit`, `hasMore`; there is no total. A screen keeps the cursor in state (`useCursorPages` in the console keeps the visited cursors, so Previous returns to the exact page) and passes it as `query.cursor`, so each page is its own cache entry, and uses `Pagination` with Previous and Next only.

A short reference list a screen must show whole (the permissions a role can hold) uses `useApiAllPages(operationId, input)` instead (ADR 0028): it follows the cursors into one cache entry, at most `MAX_ALL_PAGES` (5) pages, and answers `{ items }`. The cap is hard: a list still going after five pages fails with `PageCapExceededError` (code `PAGE_CAP_EXCEEDED`, never retried), and the screen says so in its own words with no retry. There is no partial answer. Never use it for a list people browse: pointed at one, it fails loudly at once. An infinite-scroll hook is still not built.

## Money, weight, quantity

Integer pesewas and three-place kilogram strings in and out, formatted only at the edge (`MoneyDisplay`, `WeightDisplay`, `formatMoney`, `formatWeight`). The client does not parse, convert or round: `listStockOnHand` is checked against the real mock to carry safe integers in every `...Pesewas` and `^\d+\.\d{3}$` in every `...Kg`. `money.test.ts` fails the build if any source file uses `parseFloat`, `toFixed`, `toLocaleString`, `Intl.NumberFormat`, `* 100`, `/ 100` or `Math.round`. Totals come from the API.

## Prism, the mock

- `pnpm dev:mock` runs the pinned Prism against `contract/openapi.yaml` on port 4010. It serves all 600 operations from the contract's examples.
- Prism checks the security scheme: the staff scheme is a cookie, so a request must carry `Cookie: __Host-hk_s_at=<anything>` (the integration setup adds it, as a browser would). Customer and investor realms use `__Host-hk_c_at` and `__Host-hk_i_at`, the POS adds `X-Device-Credential`.
- It validates required headers: a write without `X-CSRF-Token` or `Idempotency-Key` is refused with 422.
- `Prefer: code=401|403|404|500` returns the contract's own example for that status. This is how a screen is seen in its error and permission-denied states.
- **Prism cannot return an empty list** (each list has one example with rows): CR-005. Until it lands, an empty state is shown from a successful answer with no rows.
- It keeps no state: a write does not change what a later read returns.
- **In a browser, use `HK_API_BASE_URL=/mock`** (ADR 0025). The console's Vite dev and preview servers forward `/mock/…` to Prism and add the staff cookie, which the contract gives no way to set. CORS is not the problem: given an `Origin`, Prism echoes it with `Access-Control-Allow-Credentials: true` (it answers `*` only to a request without one, which is what Node sends). Against the mock the console is always signed in as the contract's example cashier; sign-in, TOTP and expiry are exercised against the fake auth server (ADR 0026).

## Tests

| Layer       | Where                   | Against                                                                                                             |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit        | `pnpm test:unit`        | a function standing in for the network, for the client's own rules (headers, retry, single flight, error shapes)    |
| Integration | `pnpm test:integration` | the real Prism mock, started by the suite; a failure to start is a failure, not a skip                              |
| End to end  | `pnpm test:e2e`         | production builds in Chromium at 360 px, auth answered by the fake auth server, everything else by Prism (ADR 0026) |

A screen's integration test mounts the screen with its `QueryClientProvider` and asserts all four states: `Prefer: code=500` and `code=403` for error and denied, a held response for loading.
