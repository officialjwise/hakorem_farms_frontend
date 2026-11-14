---
name: hakorem-api-call
description: Use when touching data fetching or mutation in any app or hook, including calling an endpoint, writing a query, a mutation, an error handler or an idempotency key. Fires on any use of fetch, XMLHttpRequest, axios, an API type, or a TanStack Query key. Enforces the generated client only, the query key convention, an idempotency key on every mutation, error normalisation and never a direct fetch.
---

# Calling the API

**The OpenAPI contract is the only truth about the API.** Read `docs/BUILD_PROMPT.md` (F2 and "Two rules that matter more than they look") and `docs/SHARED_BRIEF.md` ("Repositories, workspace and the contract").

## What exists today

As of F2 everything below is built; the rules and numbers are in `docs/DATA_CONVENTIONS.md`.

- `packages/api-client`: generated types and operation table, `createApiClient().call(operationId, input, options)`, `ApiError`, `newIdempotencyKey()`, the 401 single flight.
- `packages/data`: `createApiHooks(api)` gives `useApiQuery` and `useApiMutation`. Each app wraps them in its own `data/api.ts`; a screen imports from there.
- `packages/ui`: `QueryBoundary` and `MutationFailure` for the four states.
- `pnpm dev:mock` (Prism on 4010), `pnpm sync-contract`, `pnpm test:integration`. `HK_API_BASE_URL` is the one variable that chooses mock or real.
- Not built: non-JSON request bodies (the file upload, F4), an infinite-scroll hook, the storefront's own client (F7).

## Rules

1. **Generated client only.** Never hand-write an API type, never guess a field name, never call an endpoint that is not in `contract/openapi.yaml`.
2. **Never call `fetch` directly** in a screen or hook. Everything goes through the generated client and the query layer, so a contract change surfaces as a type error, not a runtime surprise in front of a customer.
3. **Query keys derive from the contract's operation ids.** Settled conventions go in `docs/DATA_CONVENTIONS.md` (F2): stale times, optimistic updates, invalidation, retry.
4. **Every mutation sends a client-generated idempotency key**, so a retry on a flaky connection cannot double-charge or double-post.
5. **Normalise errors once.** Every non-2xx response is the contract's `Error` envelope: `{ error: { code, message, correlationId, details[] } }`. `details[].field` is a JSON pointer, used to map a server error onto a form field (the form system's `mapServerErrors`). Show `message` (safe for users) and `correlationId` (through `ErrorState reference`). Never show internal detail.
6. **Missing endpoint, not invented endpoint.** If the contract lacks what a screen needs, append to `docs/CONTRACT_REQUESTS.md` with the screen and the shape you want, then carry on against a local mock override. Read the contract before raising one (CR-002 was raised without doing so).
7. **No business calculation.** Totals, tax, margin and distributions come from the API. The one exception is the POS offline cart (skill `hakorem-pos-offline`).
8. **Cursor pagination.** `PageInfo` is `nextCursor`, `limit`, `hasMore`. There is no total and no page count, so use `Pagination` with Previous and Next only.
9. **Cost is not price.** Show cost fields as cost and price fields as price, never one in place of the other (`docs/CONTRACT_REQUESTS.md` CR-001).
10. **Build against the mock until the endpoint exists**, and say in the session report which screens moved to the real API.

## Correct

```tsx
const stock = useApiQuery('listStockOnHand', { query: { locationId } });
const adjust = useApiMutation('createStockAdjustment', { invalidates: ['listStockOnHand'] });

<QueryBoundary query={stock} labels={labels} isEmpty={(page) => page.data.length === 0}>
  {(page) => <StockTable rows={page.data} />}
</QueryBoundary>;

// In the confirmation's submit. The key was made when the dialog opened and survives "Try again".
adjust.mutate(input, { idempotencyKey: keyRef.current });
<MutationFailure error={adjust.error} labels={labels} onRetry={retry} />;
```

A form maps a failure with `mapServerErrors(error.envelope, form)`. The key is created once per user intent and reused on retry, not regenerated per attempt.

## Incorrect

```ts
// A direct fetch, a hand-written type, a guessed field, no idempotency key, and the error swallowed.
type Stock = { qty: number; price: number };
async function load(): Promise<Stock[]> {
  try {
    const res = await fetch('/api/v1/stockItems?page=2');
    return (await res.json()).rows;
  } catch {
    return [];
  }
}
```
