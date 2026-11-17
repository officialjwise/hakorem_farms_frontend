# 0052. A back-office screen reads a requested operation through `useRequestedQuery`

- Status: accepted (owner, 2026-11-17: "CR + build behind switch" for the supplier balance, CR-042)
- Date: 2026-11-17
- Session: F10g

## Context

ADR 0046 builds against a contract request behind `HK_REQUESTED_CONTRACT`, through `ApiClient.callRequested`. Until now only the till did, from its own queue, which is not a screen (ADR 0043). The supplier's account screen needs a requested read (CR-042, the balance), and a screen never imports `@tanstack/react-query` or writes a query key (DATA_CONVENTIONS). The data layer had no hook for a requested operation, so the screen could either call the client itself in an effect, which would lose the cache, the retry rules and the four states, or the data layer could offer one.

## Options considered

1. **The screen calls `callRequested` in an effect.** A second way to read data, with no retry, no stale time, and its own loading and error state instead of `QueryBoundary`.
2. **`useRequestedQuery` in `packages/data`, beside `useApiQuery`.** The same `useQuery`, stale classes and retry, through `callRequested`; the requested module in `apps/console/src/requested/` gives the operation row and the answer's type, and decides whether it runs.

## Decision

Option 2.

- **`useRequestedQuery<Data>(operation, input, options)`** in `createApiHooks`, through the app's `callRequested`, so a refusal comes back in the console's words (ADR 0038). Its query key is `['requested', operationId, input]`: never the generated key shape, so it cannot collide with a real operation, and `isSameResource` never matches it. It is `live` by default like every read; a screen that shows it reads it on mount, so it is not stale after a write elsewhere.
- **The requested module wraps it** (`useSupplierBalance` in `requested/supplierBalance.ts`) and passes `enabled: requestedOn('CR-042')`. With the switch off no request is made, and the screen says in words what waits for the server, as ADR 0046 requires.
- **Types** stay in the requested module, cited to the request, as ADR 0046 says; the hook only casts the answer to the module's type, as `callRequested`'s callers already do.
- **Nothing else changes**: no new provider, context or stylesheet. Mutations against a requested operation still go through `callRequested` directly, as the till's do; none is needed in the back office yet.

## Consequences

- A requested read on a screen has the same four states, retry and cache as any other, and goes with its request: when CR-042 lands, `landed.ts` fails, the module is deleted and the screen calls `useApiQuery('getSupplierBalance', …)`.
- The hook is in the shared data layer, so a storefront switch could use it later; the storefront still has no switch mechanism (ADR 0049's consequences).
- Revisit if a requested read must be invalidated by a write on the same screen: the key would then need its resource root.
