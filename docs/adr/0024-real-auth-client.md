# 0024. The console signs in through the real auth client, on the generated API client

- Status: accepted
- Date: 2026-11-14
- Session: F3

## Context

F1 built the sign-in screens against a stub behind one seam, `apps/console/src/auth/client.ts` (ADR 0012). F2 gave the stub generated types and built the generated client and the 401 single flight (ADRs 0018 and 0021). F3 is where the console talks to the API for sign-in. B3, the backend's auth module, is not merged yet, so the client is built against the contract and the Prism mock, and the part of F3's gate that needs the real API moves to whenever B3 lands.

## Decision

- **`src/auth/apiAuthClient.ts`** implements the existing `AuthClient` interface. Each method is one contract operation, called through the generated client's `call()`: `loginStaff`, `verifyTotp`, `getCurrentSession`, `refreshSession`, `logout`, `changePassword`, `requestPasswordReset` (the client adds `realm: 'STAFF'`) and `resetPassword`. None of the eight requires an `Idempotency-Key` in contract 1.1.0. If one ever does, `call()` refuses to send without one, so a contract change surfaces as a type error.
- **It has its own `ApiClient`, and a 401 on it is an answer, not a refresh.** These operations are the session's own. A 401 from `getCurrentSession` on boot means "no session", and `AuthProvider` decides what follows: one refresh, then `anonymous`. With the data layer's 401 single flight (ADR 0021), a fresh visitor's boot check would refresh, have the refresh refused, and land on "your session ended". So this client's session hooks refuse every refresh and do nothing on expiry. `loginStaff`, `verifyTotp`, `refreshSession` and the reset operations are public anyway; the hooks matter for `getCurrentSession`, `logout` and `changePassword`.
- **CSRF:** the token is the one the last `SessionInfo` carried. That `SessionInfo` comes from `loginStaff` or `verifyTotp` when they authenticate, from `getCurrentSession` (so a reloaded tab can sign out), or from `refreshSession`. It is held in memory only and forgotten on logout, whatever the answer. Cookies are HttpOnly and travel by themselves (`credentials: 'include'`).
- **`client.ts` stays the seam.** It now creates the real client lazily, so a build without `HK_API_BASE_URL` fails at its first boot check or sign-in with the variable's name, as `data/api.ts` does (ADR 0019). Each method is async, so that failure arrives as a rejected promise.
- **The stub is gone.** `stub.ts`, `stub.test.ts` and `test/memoryStorage.ts` are deleted. The behaviour the stub's tests described now runs through the real client against a fake auth server at the HTTP boundary (ADR 0026): `apiAuthClient.test.ts` for unit tests, the end-to-end suite for the browser. The same eight operations run against the real Prism in `apiAuthClient.integration.test.ts`.
- `AuthProvider`, `DataProvider` and the data layer did not change.

## Consequences

- Switching to the real API, once B3 lands, needs no code change: `HK_API_BASE_URL` names it (ADR 0019).
- `seam.test.ts` now checks that `client.ts` builds the real client and that no app source imports test support, alongside the existing rules (only `main.tsx` imports `client.ts`, nothing calls `fetch`). `money.test.ts` no longer exempts `src/auth/`.
- CR-004 is still open: how the first-login password change authenticates. The real client calls `changePassword` as the contract describes it, with a session and a CSRF token. Until the backend answers, the forced change works only against the fake (assumption A-F1-04), not against Prism or the real API, if the server issues no restricted session for `PASSWORD_CHANGE_REQUIRED`.
- `TOTP_ENROLMENT_REQUIRED` and `VERIFICATION_REQUIRED` still show "this sign-in step is not available yet".
