---
name: hakorem-api-call
description: Use when touching data fetching or mutation in any app or hook, including calling an endpoint, writing a query, a mutation, an error handler or an idempotency key. Fires on any use of fetch, XMLHttpRequest, axios, an API type, or a TanStack Query key. Enforces the generated client only, the query key convention, an idempotency key on every mutation, error normalisation and never a direct fetch.
---

# Calling the API

**The OpenAPI contract is the only truth about the API.** Read `docs/BUILD_PROMPT.md` (F2 and "Two rules that matter more than they look") and `docs/SHARED_BRIEF.md` ("Repositories, workspace and the contract").

## What exists today, and what does not

Be exact about this. As of F0c:

- `contract/openapi.yaml` is synced (a plain copy, contract 1.1.0).
- **Not built yet, arrive in F2:** `scripts/sync-contract.sh`, the generated `packages/api-client`, the Prism mock (`pnpm dev:mock`), TanStack Query, `docs/DATA_CONVENTIONS.md`, and the idempotency-key helper. Until F2, do not build a screen that fetches. If you must prototype, read the contract and write the request in `docs/CONTRACT_REQUESTS.md`.

## Rules (they hold from F2 onward)

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

## Correct (shape, once the F2 client exists)

```ts
// Names follow the contract's operation ids. The client and hook below are F2 work.
const adjust = useMutation({
  mutationFn: (input: StockAdjustmentInput) =>
    client.POST('/stock/adjustments', { body: input, headers: { 'Idempotency-Key': key } }),
  onError: (error) => setFormErrors(mapServerErrors(error.details)),
});
```

The key is created once per user intent (when the confirmation opens) and reused on retry, not regenerated per attempt.

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
