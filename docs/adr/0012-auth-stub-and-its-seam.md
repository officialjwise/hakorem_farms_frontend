# 0012. Authentication runs against a stub behind one file

- Status: accepted; the stub was replaced in F3 as planned here (ADR 0024), and its rules moved to the test fake (ADR 0026). The seam stands.
- Date: 2026-11-14
- Session: F1

## Context

F1 needs login, TOTP, a forced password change, forgot and reset, and session expiry with silent refresh. The backend has no auth yet (B3). F3 switches to the real API. The owner's rule: that switch must be a one-file change, and no screen may import the stub.

## Options considered

1. **Screens call the stub directly.** Fast, and F3 would touch every screen.
2. **A mock service worker intercepting `fetch`.** Faithful at the network level, but there is no generated client yet (F2) and screens may not call `fetch` at all.
3. **An `AuthClient` interface, a stub implementing it, and one file that picks which.** Screens see only `useAuth()`.

## Decision

Option 3.

- `src/auth/types.ts`: a minimal local interface. Each method names its contract operation id (`loginStaff`, `verifyTotp`, `getCurrentSession`, `refreshSession`, `logout`, `changePassword`, `requestPasswordReset`, `resetPassword`). The types mirror `SessionInfo`, `LoginResult`, `GrantSummary`, `Error` and `ErrorDetail` from contract 1.1.0. **They are not generated and not a hand-written client. F2 replaces them with generated types.**
- `src/auth/stub.ts`: mimics the contract. Cookies `__Host-hk_s_at` (10 minutes) and `__Host-hk_s_rt` live in a simulated jar in `localStorage` that nothing outside the stub reads (the real ones are HttpOnly). An expired cookie is dropped. A refresh rotates the refresh token and a reused one revokes the session. Failed logins give one message and back off with 429. The TOTP challenge is single use. Logout and password change need the CSRF token of the last session response.
- `src/auth/client.ts`: **the seam.** The only file that imports `./stub`. It exports `authClient`, which `main.tsx` hands to `AuthProvider`. F3 replaces this file's two lines.
- `src/auth/AuthProvider.tsx`: holds the session and the status (`loading`, `anonymous`, `authenticated`, `expired`, `error`), runs the boot check, and refreshes silently a minute before `accessExpiresAt` (one refresh at a time, across tabs through Web Locks, because every refresh rotates the token and a racing second one would revoke the session).
- `src/auth/seam.test.ts` fails if any other file imports the stub, if anything but `main.tsx` imports `client.ts`, or if any source file calls `fetch`.
- The fixtures (users and the TOTP code `481205`, taken from the contract's own example) are development data. They are not secrets and nothing production reads them.

## Consequences

- The screens' behaviour is tested against the contract's rules before the backend exists.
- Three things the contract leaves open are written to `docs/CONTRACT_REQUESTS.md` as CR-004, and the stub takes the most conservative reading of each (assumptions A-F1-03 and A-F1-04).
- Revisit when F3 lands: delete `stub.ts` and `client.ts`'s stub import, keep the tests that describe behaviour and run them against the real client.
