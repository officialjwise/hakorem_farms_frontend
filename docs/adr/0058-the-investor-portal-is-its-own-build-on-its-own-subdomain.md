# 0058. The investor portal is its own build, on its own subdomain, with its own session cookie

- Status: accepted (owner, 2026-11-23), with one change to the proposal: the portal is its own build, served on its own subdomain with its own host-only session cookie, never under the console's address. Proposed in F12 as a third console document under `/investor` (A-F12-01); changed in F12b.
- Date: 2026-11-22, amended 2026-11-23
- Session: F12, amended in F12b
- Extends: ADR 0030 (the console's documents), ADR 0012 and ADR 0024 (the auth seam), ADR 0025 (the mock in a browser)

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
3. **A third console document, `investor.html`, under `/investor`** on the console's host (F12's proposal). One build: the bundler splits the code the three documents share into more, smaller chunks, which cost the till 2.5 kB and the back office 4.2 kB (PERFORMANCE_BUDGET.md, F12). The investor's and the staff cookies sit on the same host, so the frontend has to tell the realms apart in words.
4. **Its own build, on its own subdomain** (the owner's change): the same source as option 3, built on its own into its own output, served on a host of its own, with its own host-only cookie.

## Decision

Option 4.

- **Its own build.** `vite.investor.config.ts` builds `investor.html` into `apps/console/dist-investor/` (`pnpm build:investor`). It shares the console's source (the design system, the data layer, the sign-in screens and `boot()`), not its build. The console's build (`pnpm build:console`, `dist/`) holds only `index.html` and `pos.html`, and how the portal's code is split changes nothing in the till's or the back office's. `pnpm budget:console` fails if the console's build holds the portal's document, or the portal's build an entry of the console's.
- **Its own subdomain.** Production serves it at `https://investors.hakoremfarms.com` (A-F12-04), staging on a host of its own. Every address there that is not a file is answered with `investor.html`. The console's host never serves the portal: `/investor` there is the back office's, like any other address. DEPLOYMENT.md section 7 has the host's rules.
- **Its own cookie.** The API sits under `/api` on the portal's host too (DEPLOYMENT.md section 4), so `loginInvestor` sets `__Host-hk_i_at` on the portal's host only. The `__Host-` prefix makes it host-only: it is never sent to the console's host, and the staff cookies are never sent to the portal's.
- **Its routes** sit at the root of its host. The shared sign-in screens serve it unchanged:
  - `/login`, its TOTP step, password change and reset;
  - the summary (`/`), contributions and withdrawals, distributions, the statement for a period, and documents.
- **Signing in.** `AuthProvider` takes a `realm` (`STAFF` by default). In the portal it signs in with `loginInvestor`, and a password reset is asked for in the investor realm. `AuthClient` gains `loginInvestor`. No new provider or context.
- **The wrong realm**, kept as a second line. With the cookies on separate hosts a browser cannot carry a session to the other side, but `SessionGate` still shows a session of the other realm in words, with "Sign out", and renders nothing behind it.
- **No service worker.** The console's is for the till and the back office (ADR 0013); the portal registers none and takes none of the console's public files, only the two icons its document links to.
- **No permissions.** The portal's routes declare `permission: null`. The investor operations name none, and the server scopes every figure to the session's investor.
- **The mock.** Each build's dev and preview servers add only their own host's cookie to `/mock` (ADR 0025): the console's the staff cookie, the portal's the investor's (`vite.shared.ts`). The portal's dev server is on port 5174 (`pnpm dev:investor`) and its preview on 4174. The integration setup, in Node, still adds both.
- **The e2e suite** serves the portal from its own build on a host name of its own (`127.0.0.1:4174`, the console on `localhost:4173`). The fake keeps one cookie jar per host, as the browser would for host-only cookies, and refuses an investor operation to a staff session, and a staff operation to an investor's, with the contract's 401.

## Consequences

- An investor's browser loads the portal, the sign-in screens and the shared design system, all from the portal's host. `pnpm budget:console` counts the portal's initial load from its own build.
- The till's and the back office's first loads go back to what they were before F12 added the third document (PERFORMANCE_BUDGET.md, F12b).
- A deploy builds and ships two console outputs and needs one more host: its DNS name, its TLS certificate, its static files, its `/api` path and its origin in the API's allowed origins (DEPLOYMENT.md section 7).
- A link from the console to the portal, or back, is an address on another host. None exists today.
