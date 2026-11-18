# 0053. A back-office screen writes a requested operation through `useRequestedMutation`

- Status: accepted
- Date: 2026-11-17
- Session: F10j
- Extends: ADR 0046, ADR 0052

## Context

ADR 0052 gave a back-office screen a requested read and said a requested write still went through `callRequested` directly, "none is needed in the back office yet". Credit control needs one: the seller asks for a credit override with a reason (`requestCreditOverride`, CR-047), which the contract does not list. Calling the client from a click handler would drop what `useApiMutation` guarantees: one idempotency key for the intent and every automatic retry, the normalised error a screen shows with `MutationFailure`, and the refetch of what the write changed (here the order's requested credit check, a requested read whose key no generated operation shares).

## Options considered

1. **`callRequested` in the screen's click handler.** No retry key, no pending or error state for `MutationFailure`, and the credit check stays stale.
2. **`createRequestedMutation(api)` in `packages/data`, the twin of `createRequestedQuery`.** The same `useMutation`, the key carried in the variables, invalidation by operation id, including a requested read's.

## Decision

Option 2.

- `createRequestedMutation(api)` gives `useRequestedMutation<Data>(operation, { invalidates })`, returning `mutateAsync`, `isPending`, `error`, `data` and `reset`, as `useApiMutation` does. A `CallIntent` key is reused, or one is made per call.
- `invalidates` names operation ids. A generated read matches on its first key element; a requested read on its second (`['requested', operationId, input]`, ADR 0052), which answers ADR 0052's "revisit" note.
- Only a module in `apps/console/src/requested/` builds it, from `consoleApi`, and a screen calls it only in a build switched on for the request. It sits apart from `createApiHooks`, so the till does not carry it.

## Consequences

- A requested write has the same key, retry and failure words as any other. When CR-047 lands, `landed.ts` fails, `requested/creditControl.ts` is deleted, and the screen calls `useApiMutation('requestCreditOverride', …)`.
- No new provider, context or stylesheet.
