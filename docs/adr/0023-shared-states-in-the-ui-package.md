# 0023. QueryBoundary and MutationFailure live in packages/ui and know nothing about the data layer

- Status: accepted
- Date: 2026-11-14
- Session: F2

## Context

The brief asks for loading, empty, error and permission-denied components "wired directly to query and mutation states", composed from `Skeleton`, `EmptyState` and `ErrorState`, so no screen builds them by hand. They could live in `packages/data` or in `packages/ui`. ADR 0010 says a component added to `packages/ui` ships a story per state, and `packages/ui` is translation free and imports nothing from the apps.

## Decision

- `QueryBoundary` and `MutationFailure` go in `packages/ui`, with a story per state (ready, loading, empty, error with reference, no connection, permission denied, denied by session) and axe through `pnpm test:a11y`. They compose `Skeleton`, `EmptyState`, `ErrorState` (with the lock for denied) and `Button`. They add no stylesheet, context, provider or variant mechanism.
- They are typed **structurally** (`QueryLike`, `FailureLike`): a TanStack `useQuery` result and an `ApiError` satisfy them as they are, but `packages/ui` does not import TanStack Query or the data layer. `packages/data` has a test that renders them against real query results and `ApiError`s.
- A 403 is permission denied. Any other failure is an error with the server's safe message (or the screen's own `errorDescription` for the client's own codes: `NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE`), the correlation id when there is one, and a retry. The words are passed in as props, already translated (ADR 0008). A test keeps the UI package's list of client codes in step with `CLIENT_ERROR_CODES`.
- `MutationFailure` leaves an alert on screen until the next attempt, because a toast alone fails review (ADR 0006).

## Consequences

- Stories give every state a visual and an axe check without a server.
- A screen that needs a loading placeholder of its own shape (table rows) passes `loadingFallback`; it still does not build the other three states.
- Revisit if a fifth state appears (stale, offline queue) when F9 lands.
