# 0026. Tests answer sign-in from a fake auth server at the HTTP boundary, and send the rest to Prism

- Status: accepted
- Date: 2026-11-14
- Session: F3

## Context

With the stub gone from the app (ADR 0024), the console's tests still need a server that behaves like the contract's auth: sessions that expire and rotate, a reused refresh token that revokes the session, lockout, single-use TOTP challenges, CSRF on logout, the forced first-login change, and several users with different permissions. Prism answers from fixed examples and keeps no state, so it cannot play any of these. ADR 0012 said the stub's tests should be kept and run against the real client.

## Decision

- **One fake, two users of it.** `apps/console/src/test/fakeAuthServer.ts` is a pure function of a request (`method`, `path`, `headers`, parsed `body`) and a cookie jar. It answers the eight auth operations and returns `null` for anything else. It carries the stub's rules, users and fixtures unchanged:
  - the cashier, manager (TOTP), storekeeper and temporary-password users
  - TOTP code `481205`
  - reset code `738204`
  - five failures, then 30 s of 429 with `Retry-After`
  - a 10-minute access token and a 12-hour session

  It is test support: nothing in the app imports it, and `seam.test.ts` fails if anything does.

- **Unit tests** (`src/test/fakeFetch.ts`) give the real auth client a `fetch` that answers from the fake. Every screen, routing, `AuthProvider` and `DataProvider` test now runs the client the app ships.
- **End to end** (`e2e/support/fakeApi.ts`, installed by an auto fixture in `e2e/support/test.ts`; every spec imports `test` from there). The e2e build uses `HK_API_BASE_URL=/mock` (`pnpm test:e2e`, and the CI build step). `context.route('**/mock/**')` sees every API request:
  1. **Auth:** the fake answers it.
  2. **Otherwise** the request's operation is looked up in the generated `operationManifest` by method and path template. The most literal template wins.
  3. **Public operation:** it goes on to Prism through the `/mock` proxy (ADR 0025).
  4. **No live session** behind this browser's jar: Prism with `Prefer: code=401`, so the contract's own 401 comes back.
  5. **The session lacks the operation's `x-permission`:** Prism with `Prefer: code=403`, the contract's own 403. A server-side refusal is seen end to end, not only the route gate's. Permissions written as a sentence ("the approving permission named by the approval policy") are not checked here.
  6. **Otherwise:** on to Prism, which answers from the contract's examples.
- **The cookie jar is the fake's**, one per test (one browser context). The specs do not depend on how Chromium treats `Set-Cookie` on a fulfilled response, and they can read the jar the way a developer reads the cookie panel. A reload keeps it.
- **One clock for both sides.** `api.installClock(page, time)` and `api.fastForward(page, ms)` move Playwright's clock and the fake's together. The server's moves first, so a timer the jump fires is answered at the new time.
- Playwright starts Prism (`pnpm dev:mock`) beside the two app servers, reusing one already running outside CI.
- The service worker has no `fetch` handler (ADR 0013), so it never takes a request away from `context.route`. The PWA spec still checks that it registers. If F13 gives it a fetch handler, revisit this.

## Consequences

- `api-boundary.spec.ts` checks the boundary from a real page:
  - a 401 without a session
  - a cashier's `listUsers` refused with the contract's 403
  - a manager's answered by Prism
  - sign-in answered entirely by the fake
- **What the fake proves is the client and the screens against the contract's rules as the frontend reads them, not the backend's behaviour.** When B3 lands, the same flows run against the real API (`test:e2e:staging`, F13), and anything the fake got wrong shows there.
- A test that opens its own browser context must install its own `FakeApi`, or use `test.use()` options on the default context. The dark-device POS test now does the latter.
- The quarantined session spec (issue #4) runs on the fake too, and keeps its tag.
