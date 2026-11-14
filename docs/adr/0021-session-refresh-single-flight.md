# 0021. A 401 refreshes the session once, in the data layer, and then retries

- Status: accepted
- Date: 2026-11-14
- Session: F2

## Context

F1's `AuthProvider` refreshes a minute before the access token expires, one refresh at a time and across tabs through Web Locks. It cannot cover a 401 that arrives first (a laptop that slept, a clock that drifted). Every refresh rotates the refresh token, and a second concurrent refresh is read as token reuse and revokes the session (API.md 3.3). F1 carried this to F2.

## Decision

`createApiClient({ session })` takes `SessionHooks`: `refresh()`, `onExpired()` and `getCsrfToken()`. A 401 from an operation that needs a session (`public: false` in the manifest) is handled once, in the client, never in a screen:

1. **Single flight.** However many requests get a 401 at the same moment, one `refresh()` runs and they all await it. A request that starts while a refresh is running waits for it first.
2. **Retry once.** Each refused request is sent again with the same `Idempotency-Key`, and with the refreshed session's CSRF token (a refresh rotates it).
3. **A refused refresh lands on session expiry.** `onExpired()` is called once, and every waiting request fails with its original 401 `ApiError`. If a refreshed session is still refused, the same.
4. **Unreachable is not expired.** If the refresh could not reach the server, the request fails as a `NetworkError` and the session is left alone.
5. **A 401 that raced a finished refresh does not refresh again.** Each request notes the refresh generation when it is sent. If a refresh finished while it was in flight, its cookie was already stale: it is retried with that refresh's result. Without this, five parallel requests whose 401s arrive a few milliseconds apart start five refreshes in a row, and the second is read as token reuse. The real-Prism integration test found this; a unit test pins it.
6. **Public operations are exempt.** A 401 from `loginStaff` is a wrong password, not an expired session; `refreshSession` is public so it cannot recurse.

The console wires the hooks in `src/data/`: `refresh` calls `AuthProvider`'s own `refresh` (which keeps the Web Locks cross-tab lock and its one-at-a-time rule, so the timer and a 401 share one refresh), `onExpired` puts the provider in `expired`, and `getCsrfToken` reads the session's. The stub stays behind `auth/client.ts` until F3.

## Consequences

- The timer-based silent refresh stays as the quiet path; the 401 path is the safety net, and both use one refresh.
- Tests: `client.test.ts` covers six concurrent 401s (one refresh, twelve requests), retry headers, a refused refresh (one expiry, no retry), a still-refused session, an unreachable refresh, a public operation, and a second flight later.
- A retry re-sends a request that was not processed (the 401 came first), and carries the same key, so it cannot double-post.
