# 0020. Every failure is one ApiError carrying the contract's envelope, and every mutation carries a key

- Status: accepted
- Date: 2026-11-14
- Session: F2

## Context

`packages/ui` already maps server errors onto form fields (`mapServerErrors`, `ServerErrorEnvelope`, `isServerErrorEnvelope`). The data layer must produce that shape and not a second one. Separately, the contract requires `Idempotency-Key` (a UUID, `required: true`) on every state-changing operation, and says the same key with a different body is refused with 409.

## Decision

**Errors.** `@hakorem/api-client` exports `ApiError`. It carries `status`, `code`, `message`, `correlationId`, `details[]` and `retryAfter`, and `error.envelope` returns exactly `{ error: { code, message, correlationId, details } }`, the contract's `Error` schema, which `mapServerErrors` takes directly. A type test in `@hakorem/data` proves the generated `Error` and `packages/ui`'s `ServerErrorEnvelope` are assignable to each other, so the two cannot drift.

When no envelope came back, the client still produces an `ApiError`, with a code of its own, so a screen has one thing to handle:

| Situation                                         | status          | code                                   | correlationId                             |
| ------------------------------------------------- | --------------- | -------------------------------------- | ----------------------------------------- |
| No answer (offline, refused, dropped)             | 0               | `NETWORK_ERROR` (class `NetworkError`) | empty                                     |
| Longer than 30 s                                  | 0               | `TIMEOUT` (class `NetworkError`)       | empty                                     |
| An answer that is not the envelope (a proxy page) | the HTTP status | `INVALID_RESPONSE`                     | `X-Correlation-Id` if present, else empty |

The data layer holds no user-facing words. The server's `message` is "safe to show", and a screen passes its own translated strings for the three client codes. An empty correlation id means there is nothing to quote, so no reference is shown.

**Idempotency.** `newIdempotencyKey()` is `crypto.randomUUID()`. The generated manifest says which operations require a key, and the client's types make `idempotencyKey` required on exactly those and forbidden on the rest; a runtime guard throws before sending if it is missing. The key belongs to a user intent, not an attempt: `useApiMutation` creates it when the mutation starts and the same key is sent on every automatic retry; a screen that wants a retry button to reuse it holds the key itself (a `useRef` created when the confirmation opens) and passes it in.

## Consequences

- A form's catch block is `mapServerErrors(error.envelope, form)`.
- A 401 is never an error a screen sees as "expired": ADR 0021 handles it.
- A retry of a mutation cannot double-post: same key, same body. A different body under the same key is the server's 409.
