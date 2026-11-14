# F3 authentication, users, roles, sessions and the audit log

- **Session:** F3, on branch `f03-auth-users`, stacked on `f02-data-layer` (PR base `f02-data-layer`). The PRs for F0 (#1), F1 (#2) and F2 (#3) are open and unmerged.
- **Date:** 2026-11-14
- **Gate:** **met against the mock. The real-API half is deferred until B3 lands.**
  - A wrong-role user sees the permission-denied state, not a broken page, at both levels. `e2e/specs/console/wrong-role.spec.ts` proves it in both themes, in three full runs.
  - "Login against the real API" cannot be run. The owner said B3 is building the real auth in parallel and is not merged, so F3 ran against the Prism mock. The console signs in through the real auth client, built on the generated API client. Only its server is still a fake.

## Phase, scope and gate (as confirmed at the start)

- **Phase:** F3, the console's authentication, users, roles, permissions, sessions and audit viewer, built against the mock.
- **Scope:**
  - First, quarantine the intermittent session spec and open an issue for it.
  - Replace the auth stub with a client on the generated client.
  - Settle the mock in a browser (A-F2-03).
  - Wire `useDirtyGuard` to `useBlocker`.
  - Build the users, roles, permissions, sessions and audit screens, each with four states and a Playwright spec per primary flow.
- **Gate:** a wrong-role user sees the permission-denied state, not a broken page. The part that needs the real API moves to whenever B3 lands; everything else applies now.

## First: the flaky session spec, quarantined (issue #4)

`e2e/specs/console/session.spec.ts` ("when the server ends the session the screen says so…") failed about one loaded full run in six. **Its cause was not obvious, so it was quarantined rather than fixed** (commit `4c96347`).

- **The mechanism:** it is tagged `@quarantine`, with the issue URL as a Playwright annotation. `pnpm test:e2e` and CI pass `--grep-invert @quarantine`, and `pnpm test:e2e:quarantine` runs it alone. It is not skipped, not deleted and not retried.
- **Rewritten, still quarantined:** it now runs against the real client and the fake auth server, with the revocation done through the fake. It keeps its tag.
- **Its runs since the rewrite:**
  - part A: 10 of 10 alone with `--repeat-each 10`
  - this session's tip: 1 of 1 alone

  It has not had a loaded repeat run inside full suites. That run is the exit condition written in the issue.

- **The issue:** https://github.com/officialjwise/hakorem_farms_frontend/issues/4. It records the most likely mechanism: a reboot of the app after the revocation, where the boot path ends `anonymous` and the silent refresh path ends `expired`.

## Built

### Part A: the real auth client, the mock in a browser, the e2e fake (ADRs 0024 to 0026)

- **`auth/apiAuthClient.ts`, the real client (ADR 0024).** It implements the `AuthClient` interface over its own `createApiClient`.
  - On that client a 401 is an answer, never a refresh. Otherwise the boot check would show "your session ended" to a fresh visitor.
  - The CSRF token is the one from the last session response, held in memory.
  - `client.ts` remains the only seam. `stub.ts` and its test are deleted.
  - The stub's behavioural tests now run against the real client over a fake fetch. Part A added 6 integration tests that call the auth operations on the real Prism.
- **`/mock` on the console's Vite dev and preview servers (ADR 0025, settles A-F2-03).**
  - It proxies to Prism and adds the staff cookie.
  - F2's note was wrong: Prism echoes `Origin` with `Allow-Credentials: true`. The real blocker is that the contract describes no `Set-Cookie`.
  - Usage: `HK_API_BASE_URL=/mock pnpm dev:console`. Against the mock you are always signed in, as the contract's example cashier (A-F3-03).
- **`e2e/support/fakeApi.ts` and `test.ts` (ADR 0026).** One fake per test, with its own cookie jar and clock. It works like this:
  - **The auth operations:** the fake auth server answers them. It was eight; this session added `stepUp`, so it is now nine.
  - **Any other operation:** found in the generated manifest.
    - No session: Prism with `Prefer: code=401`.
    - A missing `x-permission`: Prism with `Prefer: code=403`.
    - Step-up missing: the fake's own 403 `STEP_UP_REQUIRED` (added this session).
    - Otherwise: through to Prism.
- **A refresh storm found and fixed.** Prism's example session expires on 2026-11-13, so `AuthProvider` refreshed hundreds of times a second. There is now a 30 s floor between silent refreshes (A-F3-04). A test with the floor at zero fails.

### Part B: the screens

The route permission is each operation's `x-permission`, read from the generated manifest; `routes.test.ts` checks every one.

| Route        | Screen                                                                                                  | Permission (from the operation)      | Reads                                                                           | Writes                   |
| ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------ |
| `/users`     | Users: status filter, search, cursor pages                                                              | `iam.user.read` (`listUsers`)        | `listUsers`                                                                     |                          |
| `/users/new` | New user. The first form screen: dirty guard plus `useBlocker`. The temporary password is shown once    | `iam.user.create` (`createUser`)     | `listRoles`, `listBranches`                                                     | `createUser` (step-up)   |
| `/users/:id` | User: facts, profile edit, account actions, roles at branches                                           | `iam.user.read` (`getUser`)          | `getUser`, `listGrants`, and, in the add dialog, `listRoles` and `listBranches` | See below                |
| `/roles`     | Roles                                                                                                   | `iam.role.read` (`listRoles`)        | `listRoles`                                                                     |                          |
| `/roles/:id` | Role: every permission grouped by area; editable with `iam.role.manage`, read-only otherwise            | `iam.role.read` (`getRole`)          | `getRole`, `listPermissions` (all pages)                                        | `updateRole` (step-up)   |
| `/roles/new` | New role                                                                                                | `iam.role.manage` (`createRole`)     | `listPermissions` (all pages)                                                   | `createRole` (step-up)   |
| `/sessions`  | Sessions: signed in now or all; this device marked; ended sessions stay listed                          | `iam.session.read` (`listSessions`)  | `listSessions`                                                                  | `revokeSession` (reason) |
| `/audit`     | Audit log: area, action, record type and date filters; cursor pages; the tamper check                   | `aud.audit.read` (`listAuditEvents`) | `listAuditEvents`, `getAuditIntegrity`                                          |                          |
| `/audit/:id` | Audit event: facts, the exact UTC instant, before and after field by field (stacks at 360 px), metadata | `aud.audit.read` (`getAuditEvent`)   | `getAuditEvent` (`immutable`)                                                   |                          |

The writes on the user screen:

- **Profile edit:** `updateUser`, with `version`. A 409 means someone else changed the record: the screen offers a reload and lets the person decide.
- **Account actions:** `disableUser`, `enableUser`, `unlockUser` and `resetUserPassword`, each behind a reason dialog. The reset needs step-up and shows the temporary password once.
- **Roles at branches:** `createGrant` and `revokeGrant`, both with step-up.

What every screen and write does:

- **States:** every screen has four (loading, empty, error with its reference, permission denied) through `QueryBoundary`. A record screen shows a 404 as "not found", not as an error.
- **Failed writes:** a failure leaves words on screen. Forms use `FormError` with field mapping; confirmations use `MutationFailure`.
- **Idempotency keys:** one per intent (`useIntentKey`). The same body gets the same key, so "Try again" and a step-up repeat are the same intent; a changed body gets a new key.
- **Navigation:** the sidebar gains Roles, Sessions and Audit log, each shown only with its permission. Users lost its placeholder.
- **Strings:** all go through `t()`, in the new `iam` and `audit` namespaces, plus shared `common` keys.
- **No 202:** none of the F3 operations can return `ApprovalPending` in contract 1.1.0, so there is no maker-checker state to show.

### Shared pieces this session added

All are in the console unless the package is named.

- **`useLeaveGuard` and `LeaveGuardDialog`:** `useDirtyGuard` wired to React Router's `useBlocker`. A dirty form asks before an in-app navigation, with Stay as the first button; the browser asks before the tab closes. Unit-tested on a memory router; e2e on `/users/new`.
- **`useStepUp` (ADR 0029):**
  - On 403 `STEP_UP_REQUIRED` it opens a code dialog, calls `AuthProvider.stepUp`, and repeats the same write with the same key.
  - `shownFailure` keeps that 403 from reading as "permission denied".
  - `AuthClient` and `AuthProvider` gain `stepUp`. That is the one addition to `AuthProvider`.
- **`ReasonDialog`, `useWriteFailure` and `WriteFailureView`, `useCursorPages`, `bothQueries`, `uniqueById`, `useStateLabels`.**
- **In `packages/data`: `useApiAllPages` (ADR 0028).** It reads every page of a short reference list into one cache entry, at most 5 pages, and reports `truncated`. The role screen needs all 273 permissions, and `listPermissions` returns at most 100 a page.
- **In `packages/ui`: `formatDateTime` (ADR 0027).** It shows `YYYY-MM-DD HH:mm` in Accra time, without Intl. It is an addition to the existing format module, not a new component.
- **No new `packages/ui` component**, and no new stylesheet, provider, context or variant mechanism.

## The gate: how `wrong-role.spec.ts` proves both levels

Both tests run in light and dark, at 360 px, through the real auth client.

- **(a) The route.**
  - **The test:** a cashier opens all nine F3 addresses directly: `/users`, `/users/new`, `/users/:id`, `/roles`, `/roles/new`, `/roles/:id`, `/sessions`, `/audit` and `/audit/:id`.
  - **Each page must:**
    - show the denied state in words, naming the permission
    - stay on the same URL
    - keep the shell, with a "Go to the start page" link
    - be axe clean, with no sideways scroll
  - **The run must:**
    - raise no page error and no console error
    - send no API request for any F3 operation, which shows the route decided without asking the server for something it would refuse
- **(b) The server.**
  - **The test:** the manager holds `iam.user.read` but not `iam.grant.read`, and opens a user.
  - **Must pass:**
    - The account and its facts render.
    - The "Roles at branches" region shows the server's 403 in words, with no retry and no add button.
    - The fake's log shows `getUser` passed through to Prism, and `listGrants` was refused with the contract's own 403.
    - Nothing the manager cannot do is offered: no profile form and no disable button.
    - axe is clean, with no sideways scroll.
    - Then `/users` works for the manager, and `/audit` is denied in words on the same URL (FR-AUD-005).

At page level, the integration tests show the server's 403 as the denied state on all eight data screens, against the real Prism.

## Checks at the tip (`1e3090d`)

Each check was run on its own and its exit code recorded.

| Check                                     | Exit | Result                                                                                  |
| ----------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| `lint`                                    | 0    | no suppressions                                                                         |
| `format:check`                            | 0    |                                                                                         |
| `typecheck`                               | 0    | every package and app, `e2e`, every `.typetest`                                         |
| `tokens:check`                            | 0    |                                                                                         |
| `fonts:check`                             | 0    |                                                                                         |
| `icons:check`                             | 0    |                                                                                         |
| `sync-contract:check`                     | 0    | the committed client matches contract 1.1.0                                             |
| `test:unit`                               | 0    | 6 i18n, 24 api-client, 708 ui, 27 data, 14 storefront, 130 console                      |
| `test:integration`                        | 0    | 60 on the real Prism (26 before, plus 34: four states × eight screens, plus two writes) |
| `test:a11y`                               | 0    | 231 story tests in Chromium with axe                                                    |
| `build-storybook`                         | 0    |                                                                                         |
| `build:console` (`HK_API_BASE_URL=/mock`) | 0    | one chunk over Vite's 500 kB warning (see below)                                        |
| `build:storefront`                        | 0    | 182 kB first load, unchanged                                                            |
| `test:e2e`, full run 1                    | 0    | 76 passed                                                                               |
| `test:e2e`, full run 2                    | 0    | 76 passed                                                                               |
| `test:e2e`, full run 3                    | 0    | 76 passed                                                                               |
| `test:e2e:quarantine` (spec alone)        | 0    | 1 passed                                                                                |

The 76 end-to-end tests are part A's 64 plus 12 new:

- `wrong-role`: 2 tests × 2 themes
- the owner's axe walk of every F3 screen: 2 themes
- `users`: 3
- roles, sessions and audit: 3

**During the session,** before the three runs above:

- One run found the audit page 13 px too wide at 360 px. A one-sentence `StatusBadge` would not wrap, so the badge is now one word and the explanation sits beside it (`cb8c6e3`).
- Two spec runs timed out choosing an option with the pointer from a Radix Select inside a dialog. Those steps now use the keyboard, which is also the keyboard path (see "Not verified").

## Decided in this session

ADRs 0024 to 0029:

| ADR  | Decision                                                                         |
| ---- | -------------------------------------------------------------------------------- |
| 0024 | The real auth client: its 401 is an answer, and its CSRF token is held in memory |
| 0025 | `/mock` on the dev and preview servers, plus the refresh floor                   |
| 0026 | The fake auth server at the HTTP boundary                                        |
| 0027 | Timestamps in Accra time through `formatDateTime`                                |
| 0028 | `useApiAllPages` for short reference lists                                       |
| 0029 | Step-up on the server's 403, repeating the same write                            |

## Assumed (docs/ASSUMPTIONS.md, all dated 2026-11-14)

| Id      | Assumption                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------ |
| A-F3-01 | A 401 on the auth client is an answer                                                                  |
| A-F3-02 | CSRF token held in memory                                                                              |
| A-F3-03 | Always signed in against the mock                                                                      |
| A-F3-04 | 30 s refresh floor                                                                                     |
| A-F3-05 | How the e2e fake decides                                                                               |
| A-F3-06 | Forced password change only on the fake (CR-004)                                                       |
| A-F3-07 | Step-up on the 403, with the e2e list kept by hand (CR-007)                                            |
| A-F3-08 | Numeric Accra timestamps                                                                               |
| A-F3-09 | The grants section asks the server instead of hiding by session permissions (grants are branch scoped) |
| A-F3-10 | STAFF realm only                                                                                       |
| A-F3-11 | The profile sends changed fields only; there is no way to remove an email or phone                     |
| A-F3-12 | Revoking your own session shows the ended screen                                                       |
| A-F3-13 | TOTP enrolment not built (CR-006, plus a QR dependency decision)                                       |
| A-F3-14 | Approvals, approval policies and API credentials are not F3 screens                                    |
| A-F3-15 | The console checked in its one density, compact                                                        |
| A-F3-16 | Against the mock, the role screen shows "the permission list is longer than the screen can load"       |

A-F2-03 is resolved.

## For the owner's review

1. **The real-API half of the gate.** It runs when B3 lands; see the opening message below.
2. **Issue #4** stays quarantined until a loaded repeat run is green.
3. **TOTP enrolment** (A-F3-13) needs two answers: CR-006 from the backend, and your decision on a QR code library, which is a new dependency.
4. **The e2e fixture key `owner` was renamed `manager`.** It was always Kwabena, with the Manager role. A real Owner, Ama Mensah with every F3 permission, joins the fixtures.
5. **Vite warns that one console chunk is over 500 kB minified.** The F3 screens are in the main chunk; the POS is still its own. No budget covers the console. Splitting the back office routes is cheap whenever you want it.
6. **CR-006, CR-007 and CR-008** are new, for the backend.

## Not verified, and said plainly

- **No login against the real API.** B3 is not merged. The client is the real one, but no request reached a real server, so cookies, CORS, `__Host-` cookies and the CSRF origin check against the real API are untested.
- **Step-up against the real API.** The flow is proved against the fake's own `STEP_UP_REQUIRED`, and the six operations that need it are a hand-written list (CR-007).
- **No visual review.** Screens were checked by axe, by "no sideways scroll at 360 px" in both themes, and through the accessibility tree. Nobody looked at them.
- **Pointer selection in a Radix Select inside a dialog at 360 px.** Playwright could not scroll an option into view; Radix scrolls its own list. The keyboard path is proven, but touch and mouse were not checked by a test.
- **The audit log against real data.** `before` and `after` were tested with the contract's examples and unit fixtures, not with real erased or redacted payloads.
- **Prism ignores filters.** `listGrants?principalId=…` returns every grant in the example, so a user's page lists six people's roles against the mock. The real API filters.
- **CI has not run remotely** on this branch.

## Contract

- **Synced:** `./scripts/sync-contract.sh` at the start made no change. The contract is still 1.1.0, the backend changelog has nothing after 1.1.0, and the backend's latest report is still B02.
- **Screens moved from the mock to the real API:** none. No backend module is live.
- **Added to `docs/CONTRACT_REQUESTS.md`:**
  - **CR-006:** how TOTP enrolment authenticates during first sign-in.
  - **CR-007:** an `x-requires-step-up: true` extension, so the operation table carries step-up.
  - **CR-008:** the `listBranches` example repeats its three rows with the same ids.
- **Still open:** CR-001, CR-003, CR-004 and CR-005.

## Carried to F4

- **When B3 lands:**
  1. Sync the contract, then point `HK_API_BASE_URL` at the B3 API.
  2. Sign in for real as an owner and a cashier, and run F3's deferred gate half: log into the real API, and confirm the wrong-role cashier still sees the denied state.
  3. Rewrite the end-to-end suite's auth against staging, or keep the fake for CI and add `test:e2e:staging`.
  4. Check step-up and the CSRF origin rule against the real server.
- **Issue #4:** with B3 in place, rewrite the spec against the real refresh, run 10 loaded full suites with traces kept, and take it out of quarantine only if all are green.
- **TOTP enrolment,** once CR-006 is answered and the QR dependency is decided.
- **CR-004 and CR-006** shape the forced password change and enrolment.

## Opening message for F4

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F4 row of the screen sessions table in
docs/BUILD_PROMPT.md (plus its "How to run this prompt" rules at the top). Read
docs/DATA_CONVENTIONS.md in full. List docs/sessions/ and read only the most recent report
(F03-auth-users.md). Do not reopen decisions in docs/adr/ (0001 to 0029).

You are on a branch created off f03-auth-users. F3 (auth, users, roles, sessions, audit) is
finished against the mock and its stacked pull request is open and unmerged, as are F0's,
F1's and F2's.

Run ./scripts/sync-contract.sh, read ../backend/docs/CONTRACT_CHANGELOG.md for anything after
1.1.0, and read the backend's latest session report in ../backend/docs/sessions/ for which
modules went live.

First, before any F4 screen: if B3 (auth) has landed, switch the console's auth to the real
API (HK_API_BASE_URL at the B3 API; apps/console/src/auth/client.ts is already the real
client) and run the deferred half of F3's gate: log into the real API as an owner and as a
cashier, and confirm the cashier still meets the permission-denied state in words on /users,
/roles, /sessions and /audit. Check step-up and the CSRF origin rule against the real server.
Then work issue #4 (the quarantined session expiry spec): rewrite it against the real refresh,
run 10 loaded full suites with traces kept, and take it out of quarantine only if all are
green; otherwise leave it quarantined and update the issue. If B3 has not landed, say so,
leave both, and carry on.

Then F4: products, categories, units, grades, weight bands, and price lists with effective
dates. The gate: a price list change can be previewed before it activates. Read CR-001,
CR-003, CR-005 and CR-007 for what the backend answered.

Button, Table, StatusBadge, UIProvider and Field are the approved references. A new mechanism
(stylesheet, provider, variant system) is a stop and a question. Screens use useApiQuery,
useApiMutation and QueryBoundary; nothing calls fetch. Writes that the contract marks
"Requires step-up" go through useStepUp (ADR 0029).

Confirm in three lines: the phase, its scope, and its gate. Then execute F4 only.
```
