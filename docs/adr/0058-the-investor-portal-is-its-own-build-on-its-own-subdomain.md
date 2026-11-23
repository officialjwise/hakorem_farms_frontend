# 0058. The investor portal is a third console document, `investor.html`, under `/investor`

- Status: proposed (F12, 2026-11-22). The owner confirms; built on it meanwhile as the cheapest to reverse (A-F12-01).
- Date: 2026-11-22
- Session: F12
- Extends: ADR 0030 (two documents, one build), ADR 0012 and ADR 0024 (the auth seam)

## Context

The F12 brief: "an investor signs in and sees only their own capital, share, distributions and statements. They never see another investor's figures or any operational data."

The contract has the investor realm already:

- `loginInvestor` (`POST /auth/investor/login`) sets `__Host-hk_i_at`, the investor cookie.
- `getCurrentSession`, `refreshSession`, `logout`, `changePassword` and the TOTP operations serve all three realms.
- The investor reads only `/investor/*`: `getMyInvestorSummary`, `listMyCapitalTransactions`, `listMyDistributions`, `getMyInvestorStatement`, `listMyInvestorDocuments` and `downloadMyInvestorDocument`, each under `investorSession` and no permission. The server decides whose figures they are from the session.

The question is where the portal lives and how it signs in. The server already refuses an investor any staff operation. The frontend's part is to make sure an investor's browser never downloads the back office's screens, words or routes, and that a staff session never reads as an investor's, or an investor's as a staff member's.

## Options considered

1. **Routes in the back office document** (`/investor/...` beside `/reports`). The investor's browser downloads the back office shell, its sidebar and the code of every lazy screen it could name. The staff sign-in form would sign an investor in as staff (`loginStaff`).
2. **Pages in the storefront.** The storefront is server rendered for the shop, with the customer realm. The investor realm has no server-side session there, and the portal would need its own data layer next to F2's.
3. **A third console document, `investor.html`**, by ADR 0030's rule: its own entry script and routes, a router with `basename: '/investor'`, and the same `boot()`, `AuthProvider`, data layer and design system.

## Decision

Option 3.

- **Which document.** `entryFor` sends `/investor` and anything under it to `investor.html`. The dev and preview servers route by it, and a production host must too (DEPLOYMENT.md section 7). The investor document imports nothing from the back office's or the till's routes.
- **Its routes** sit under the router's `basename`, so the shared sign-in screens serve it unchanged:
  - `/investor/login`, its TOTP step, password change and reset;
  - the summary, contributions and withdrawals, distributions, the statement for a period, and documents.
- **Signing in.** `AuthProvider` takes a `realm` (`STAFF` by default). In the investor document it signs in with `loginInvestor`, and a password reset is asked for in the investor realm. `AuthClient` gains `loginInvestor`. No new provider or context.
- **The wrong realm.** `SessionGate` shows a session of another realm in words, with "Sign out", and renders nothing behind it:
  - an investor's session in the back office or the till;
  - a staff session in the portal.
- **No permissions.** The portal's routes declare `permission: null`. The investor operations name none, and the server scopes every figure to the session's investor.
- **The mock.** The dev and preview servers' `/mock` proxy, and the integration setup, add the investor cookie beside the staff one when a request carries neither, as ADR 0025 does for staff. Prism checks only that the cookie is there.
- **The e2e fake** signs an investor in (`loginInvestor`) and holds an investor session. An investor operation from a staff session, or a staff operation from an investor's, gets the contract's 401, as the real API's cookie check gives it.

## Consequences

- An investor's browser loads the portal, the sign-in screens and the shared design system. `pnpm budget:console` counts the third document's initial load.
- A production host needs one more rewrite: `/investor` and `/investor/...` serve `investor.html`.
- If the owner prefers the portal elsewhere, the screens move as they are: they read only the investor operations.
