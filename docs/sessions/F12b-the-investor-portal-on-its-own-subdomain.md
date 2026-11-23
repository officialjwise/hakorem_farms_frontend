# F12b: the investor portal as its own build, on its own subdomain

- **Session:** F12b, on branch `claude/modest-brahmagupta-mxegzm`, from `main` at `66b1be7` (F12, PR #37).
- **Date:** 2026-11-23
- **Ran beside:** another session on the till. Nothing under `apps/console/src/pos/`, the till's specs or its fixtures was touched.
  - Shared files changed, small: `boot.tsx` (one option), `entries.ts` (the portal taken out), the console's `vite.config.ts` (the mock proxy moved to `vite.shared.ts`), `check-budget.ts`, `e2e/support/fakeApi.ts` (a jar per host), `playwright.config.ts`, the root `package.json` (the e2e builds), CI (one step), `CLAUDE.md` (one row, two commands), the ignore lists, and one row each in `DEPLOYMENT.md`'s section 1 and `ASSUMPTIONS.md`.
- **Numbers taken:** no new CR or ADR (ADR 0058 was amended, as asked). One assumption, **A-F12-04**, the next free on `main`.
- **Screenshots:** none were taken, opened or committed. The portal is checked by its spec: 360 px, no sideways scroll, axe, in both themes.

## What the owner asked

1. **ADR 0058, approved with one change:** the portal is its own build, served on its own subdomain, with its own host-only session cookie, never under the console's address. Record the subdomain in DEPLOYMENT.md for F13, and update the ADR.
2. **Measure the till's and the back office's first loads before and after.** The till should get back its lost headroom.
3. **Wire CR-059 to CR-062 as the backend lands them in B12.**

## 1. The portal on its own

- **Its own build.** `apps/console/vite.investor.config.ts` builds `investor.html` into `apps/console/dist-investor/` (`pnpm build:investor`).
  - It shares the console's source (the design system, the data layer, the sign-in screens, `boot()`), not its build.
  - The console's build (`dist/`) now holds `index.html` and `pos.html` only.
  - `pnpm budget:console` reads both manifests. It fails if the console's build holds `investor.html`, or if the portal's holds a second entry or one of the console's.
- **Its routes sit at the root of its host.** The router has no `/investor` base any more: the summary is `/`, the sign-in `/login`, and the shared sign-in screens serve it unchanged. `entryFor` no longer knows the portal, so `/investor` on the console is the back office's address like any other. The console's dev server also refuses to serve `/investor.html`.
- **Its own cookie.** Each build's `/mock` proxy adds only its own host's cookie (`vite.shared.ts`): the console the staff cookie, the portal the investor's. In production the API sits under `/api` on the portal's host too, so `loginInvestor`'s `__Host-` cookies are set on that host alone.
- **No service worker.** `boot()` takes `serviceWorker: false`. The portal registers none and takes none of the console's public files, only the two icons its document links to.
- **The wrong-realm words stay** as a second line (`SessionGate`, unit tested). A browser can no longer carry a session across, so the e2e suite now proves that instead.
- **Dev and preview:** `pnpm dev:investor` on 5174, `vite preview --config vite.investor.config.ts` on 4174.

### The subdomain (DEPLOYMENT.md section 7, A-F12-04)

`https://investors.hakoremfarms.com` in production, and a host of its own beside the staging console's. Section 7 sets out what F13 needs:

- DNS and TLS for the host.
- The build's variables: `HK_API_BASE_URL=/api/v1`, never `HK_REQUESTED_CONTRACT`, no `HK_SHOP_URL`.
- `dist-investor` shipped on its own.
- A Caddy block for the owner to relay to the backend: `/api` to the API, every other address that is not a file to `/investor.html`.
- The portal's origin in the API's allowed origins.
- No `Domain` on any session cookie.
- The smoke checks.

The owner named no subdomain, so `investors.` is an assumption to confirm before F13 points the DNS.

### The e2e suite

- **Two hosts.** The portal runs from its own build on `127.0.0.1:4174`, a host name of its own, beside the console on `localhost:4173` (`e2e/support/hosts.ts`).
- **One cookie jar per host.** The fake keeps one jar per host, as a browser does for host-only cookies. `api.jar` is still the console's, so the session spec is unchanged.
- **`e2e/specs/investor/portal.spec.ts`** (was `console/investor-portal.spec.ts`), in its own Playwright project:
  1. An investor signs in at `/login` and reads all five pages at 360 px in both themes. Only the investor operations are called, and every request goes to the portal's host. No console script loads, and no service worker registers.
  2. Each host answers only its own document. `/`, `/login`, `/capital`, `/documents`, `/pos` and `/users` on the portal are the portal. `/investor`, `/investor/login` and `/investor.html` on the console are the console.
  3. Each host keeps its own session. With the owner signed in on the console, the portal asks for an investor's sign-in, and "signed in as staff" never shows. With the investor then signed in, the console still holds only the owner, and the portal still holds the investor.
  4. An investor who opens the console meets the staff sign-in, which refuses them, and the refusal stays on screen.
  5. The portal's sign-in refuses staff.

## 2. The first loads, before and after

`pnpm budget:console` with CI's switches (`HK_API_BASE_URL=/mock`, `HK_REQUESTED_CONTRACT=CR-033,CR-059`), gzipped initial load, 1 kB = 1,000 bytes:

| Document                  | Before (`main`, F12) | After (F12b) | Change   | Headroom          |
| ------------------------- | -------------------- | ------------ | -------- | ----------------- |
| The till, `pos.html`      | 247.4 kB             | **244.9 kB** | −2.5 kB  | 2.6 → **5.1 kB**  |
| Back office, `index.html` | 291.6 kB             | **287.4 kB** | −4.2 kB  | 8.4 → **12.6 kB** |
| Investor portal           | 225.2 kB             | **213.3 kB** | −11.9 kB | 24.8 → 36.7 kB    |

- **The till has its 2.5 kB back.** Its figure is exactly F12's "without the portal" comparison, and so is the back office's.
- **Styles** are 12.7 kB in each, unchanged.
- **On demand:** the till's is unchanged (80.4 kB in 34 chunks); the back office's falls from 294.7 kB in 159 chunks to 293.8 kB in 156; the portal's is 54.8 kB in 8 chunks.
- **No chunk merging.** F12's other lever, merging small shared chunks, was not needed and was not tried.

Recorded in PERFORMANCE_BUDGET.md, "F12b".

## 3. CR-059 to CR-062: B12 has not landed

- `pnpm sync-contract:github` (backend `a851f1a`) brings **2.31.0**. It carries none of the four:
  - no `reviewException`, and no `ExceptionItem.review`;
  - no `rpt.exceptions.review`;
  - no `VAT_RETURN`, `DAILY_EXCEPTIONS` or egg report codes.
  - Its changelog names B12 only as the phase that will build the report.
- `landed.ts` still holds both CR-059 checks, so the type check will fail the day the backend lands it.
- **Nothing was wired**, and nothing needs to be for CR-060 to CR-062. The reports run once `listReportDefinitions` lists their codes.
- **The 2.31.0 sync was not committed.** It breaks the e2e fixtures of other sessions' screens:
  - `driver.ts`: `orderLineId`;
  - `fulfilment.ts`: `fulfilments`, `pendingConsent` and the pick line's tolerance fields;
  - `quotes.ts`: `subjectToStock`, `markupPercent` and `links`;
  - `shopApi.ts`: `subjectToStock`.
  - 2.31.0 also moves the driver's cash hand-in onto the till's shift (`handInDriverCash`). That is the till session's to sync, as F12 left 2.17.0 to F10n. `main` stays on 2.17.0.

## Contract

- **Moved from the mock to the real API: none.** Every investor operation still runs against the mock until a backend report says it is live.
- **Contract requests added: none.**

## Decisions recorded

- **ADR 0058, accepted with the owner's change**, renamed `0058-the-investor-portal-is-its-own-build-on-its-own-subdomain.md`.
- **A-F12-01 resolved.**
- **A-F12-02** stays open, with the new figure.
- **A-F12-04:** the subdomain is `investors.hakoremfarms.com`.
- The F12 rows in ASSUMPTIONS.md had lost their last three columns; they have them again.

## Gates, each run on its own

| Check                                                     | Exit | Count                                                                                                 |
| --------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck` (every package)       | 0    |                                                                                                       |
| `sync-contract:check`                                     | 0    | 2.17.0, unchanged                                                                                     |
| `test:unit`                                               | 0    | console 352, ui 901, storefront 42, data 33, api-client 30, i18n 6                                    |
| `test:integration`                                        | 0    | console 280 (the portal's 4, at its root routes), storefront 20                                       |
| `build:console`, `build:investor`, `budget:console`       | 0    | till 244.9 of 250 kB, back office 287.4 of 300 kB, portal 213.3 of 250 kB                             |
| `test:e2e`, full run                                      | 0    | 354 of 354 in 8.6 minutes, first run (F12's 352, less the old portal spec's 4, plus the new spec's 6) |
| `tokens:check`, `fonts:check`, `icons:check`, `test:a11y` | n/r  | not run: no token, font, icon or `packages/ui` change                                                 |

**Fixed while getting here:** the portal's preview server first answered `/mock/...` with its document. The middleware that sends every page to `investor.html` now lets `/mock` through to Prism.

## For the owner

1. **The subdomain (A-F12-04).** `investors.hakoremfarms.com` is written into DEPLOYMENT.md section 7. Say if you want another name before F13 sets up the DNS.
2. **Relay one Caddy block to the backend track** (DEPLOYMENT.md section 7): the portal's host, its `/api` path, and its origin in the API's allowed origins. The API must set no `Domain` on a session cookie.
3. **Contract 2.31.0 is waiting on `main`.** It breaks fixtures in the driver's, the fulfilment and the quotes specs, and it carries the till's driver cash hand-in. The till session should take it.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F12b-the-investor-portal-on-its-own-subdomain.md.
Read ADR 0046, 0053 and 0058. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after the version on main.
   - CR-059 landed (landed.ts fails): delete requested/exceptionReview.ts and its id, call
     useApiMutation('reviewException'), and read ExceptionItem.review from the generated type; delete
     rpt.exceptions.review from REQUESTED in fakeRoles.test.ts; drop CR-059 from HK_REQUESTED_CONTRACT in
     package.json and ci.yml.
   - CR-060, CR-061, CR-062 landed: nothing to switch. The reports run once listReportDefinitions lists
     their codes; check each code's columns in its named example.
   - B12 seeded: delete the rpt.* lines in NOT_SEEDED as they fail.
2. The owner's answer on the portal's subdomain (A-F12-04).
3. F13, as BUILD_PROMPT says, with DEPLOYMENT.md section 7: the portal is its own build and host, and the
   smoke suite opens https://investors.<domain>/ and expects the portal's sign-in.
```
