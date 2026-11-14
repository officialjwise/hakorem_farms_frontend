# 0025. The Prism mock in a browser: a `/mock` path on the console's dev and preview servers

- Status: accepted
- Date: 2026-11-14
- Session: F3

## Context

F2 left one question for the first screen session (A-F2-03): how a console running in a browser uses the Prism mock. F2 believed Prism answers `Access-Control-Allow-Origin: *`, which a credentialed request refuses. Checked in F3 with curl, that is true only for a request with no `Origin` header, which is what F2's Node tests sent. Given an `Origin`, Prism echoes it, with `Access-Control-Allow-Credentials: true`, on preflights and on answers alike, so CORS is not the blocker.

The real blocker is the cookie. The contract describes no `Set-Cookie` header, so Prism never sets the staff cookie. Prism checks the security scheme on every staff operation, and the staff scheme is the cookie `__Host-hk_s_at`. A browser never holds it, so every staff operation answers 401 (`sl-violations: Invalid security scheme used`). Prism has no option to skip the security check.

## Decision

- `apps/console/vite.config.ts` adds a same-origin path, **`/mock`**, to both the dev server (`server.proxy`) and the preview server (`preview.proxy`). It forwards to `http://127.0.0.1:4010` (`pnpm dev:mock`), strips `/mock`, and adds `Cookie: __Host-hk_s_at=dev-mock` when the request carries no staff cookie. It matches `/mock` and `/mock/…` only, not `/mockery`.
- **It decides nothing.** A build talks to it only when `HK_API_BASE_URL=/mock`. `parseApiBaseUrl` already accepted a same-origin path for this purpose (ADR 0019). The production build is served by Caddy, which has no such path.
- Usage: `pnpm dev:mock`, then `HK_API_BASE_URL=/mock pnpm dev:console`. Checked through Vite: `/mock/auth/session` answers 200 with the contract's `SessionInfo` example, `/mock/iam/users` answers 200, and `Prefer: code=403` still reaches Prism.

## Consequences

- **Against the mock, the console is always signed in.** Prism keeps no state, and the proxy always presents the cookie, so the boot check finds the example session (Adwoa Darko, a cashier, with the contract's example permissions). Sign-in, TOTP, expiry and revocation cannot be exercised against Prism. They are exercised against the fake auth server instead (ADR 0026).
- **Prism's example session expired on 2026-11-13**, so every boot check sees an expired access token. That exposed an F1 bug: `AuthProvider` re-armed the silent refresh at once after each refresh, and a browser on the mock made 399 refreshes in 4 seconds. A real server would see the same storm from any device whose clock runs more than nine minutes ahead. `AuthProvider` now keeps silent refreshes at least `MIN_REFRESH_INTERVAL_MS` (30 s) apart. After the fix the same browser made one refresh in 4 seconds. A unit test pins the floor and fails when it is set to zero. This is the one change to `AuthProvider` in F3.
- The end-to-end build uses `HK_API_BASE_URL=/mock` too, behind `vite preview` (ADR 0026).
- A-F2-03 is resolved.
