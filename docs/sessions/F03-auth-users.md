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

| Check                                              | Exit | Result                                                                                  |
| -------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| `lint`                                             | 0    | no suppressions                                                                         |
| `format:check`                                     | 0    |                                                                                         |
| `typecheck`                                        | 0    | every package and app, `e2e`, every `.typetest`                                         |
| `tokens:check`                                     | 0    |                                                                                         |
| `fonts:check`                                      | 0    |                                                                                         |
| `icons:check`                                      | 0    |                                                                                         |
| `sync-contract:check`                              | 0    | the committed client matches contract 1.1.0                                             |
| `test:unit`                                        | 0    | 6 i18n, 24 api-client, 708 ui, 27 data, 14 storefront, 130 console                      |
| `test:integration`                                 | 0    | 60 on the real Prism (26 before, plus 34: four states × eight screens, plus two writes) |
| `test:a11y`                                        | 0    | 231 story tests in Chromium with axe                                                    |
| `build-storybook`                                  | 0    |                                                                                         |
| `build:console` (`HK_API_BASE_URL=/mock`)          | 0    | one chunk over Vite's 500 kB warning (see below)                                        |
| `build:storefront`                                 | 0    | 182 kB first load, unchanged                                                            |
| `test:e2e`, full run 1 (part B, before the split)  | 0    | 76 passed                                                                               |
| `test:e2e`, full run 2 (part B, before the split)  | 0    | 76 passed                                                                               |
| `test:e2e`, full run 3 (part B, before the split)  | 0    | 76 passed                                                                               |
| `test:e2e:quarantine` (spec alone)                 | 0    | 1 passed                                                                                |
| independent check: full run, default workers       | 1    | 75 passed, 1 timed out (see below)                                                      |
| independent check: two full runs, default workers  | 1, 1 | 87 of 92 and 90 of 92, every failure a timeout, under a load average near 40            |
| after the split: three full runs, 2 workers (CI's) | 0    | 122 passed each time (3.3, 1.8 and 1.5 minutes)                                         |
| after the split: one full run, default workers     | 1    | 121 passed; `users.spec.ts:62` waited more than 5 s for "Role added" (below)            |
| `users.spec.ts:62` alone, `--repeat-each 10`       | 0    | 10 passed, eight at a time, 9 to 11 s each                                              |

**What the independent check found, and what changed.** Re-running the suite myself, the machine was shared with a Docker VM using about two cores (the backend session, by all appearances), and the load average ran from 14 to 40 on 8 cores. Every failure was a time budget running out, never a wrong page:

- **Three tests walked seven to nine routes in one 30 s budget:** the owner's axe walk of the F3 screens, the back office axe walk, and the gate's part (a), which took 16 s even unloaded. Each now runs one test per route, with every assertion kept (the gate's "no request for a refused operation" and "no page error" are checked per route). That is why the count went from 76 to 122. No timeout was raised and no retry was added.
- **One write can outlast a 5 s wait under load:** `users.spec.ts:62`, where step-up, the repeated `createGrant` and the refetch it waits for all have to land before "Role added" shows. The snapshot showed the dialog still submitting, not stuck. It passed every time with CI's two workers and 10 of 10 alone. It is not quarantined, but it is the first test to watch if CI goes red (see "For the owner's review").

The 76 end-to-end tests before the split were part A's 64 plus 12 new:

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
7. **End-to-end timing under load.** On a loaded machine with Playwright's default worker count, `users.spec.ts:62` can exceed its 5 s wait for "Role added" (see "Checks at the tip"). With CI's two workers it was green in every run. If it goes red in CI, it gets an issue and the quarantine tag, like #4, rather than a longer timeout.

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

## After the report: the owner's six answers (2026-11-14)

| #   | Answer                                                                                     | What was done                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The deferred real-API gate is accepted, as a required first task in F4's opening message   | The opening message below makes it task 1, with what passes. If B3 has not landed, F4 stops and asks before any F4 screen.                                                                                  |
| 2   | TOTP QR: no new dependency; the backend returns the QR as a data URI (asked of B3, CR-006) | CR-006 point 2 records the field and how the screen uses it. A-F3-13 updated. Nothing built: enrolment still waits on CR-006 point 1.                                                                       |
| 3   | Step-up approved as built. `useApiAllPages` approved with a hard page cap that throws      | ADR 0029 marked approved. Past 5 pages the hook throws `PageCapExceededError` (not retried, no partial answer). The role screen says so in words with no retry. ADR 0028 amended; DATA_CONVENTIONS updated. |
| 4   | Split POS and back office into separate entries, then set and record a console budget      | ADR 0030: `index.html` and `pos.html`, with their own route tables. A budget per document, enforced by `pnpm budget:console` in CI (PERFORMANCE_BUDGET "Console", A-F3-17).                                 |
| 5   | CR-006 to CR-008: B3 is answering them                                                     | CR-006 marked as with the backend.                                                                                                                                                                          |
| 6   | `users.spec.ts:62` stays as it is; if CI fails it, quarantine it with an issue             | Unchanged. It passed in both runs below.                                                                                                                                                                    |

### The page cap, and the mock

Prism answers every page with the same example, `hasMore: true` and **the same `nextCursor` whatever cursor it is asked with** (checked with curl). Its lists never end, so the throwing cap would fail the role screen on every read.

- **Both test harnesses** answer a page whose `nextCursor` equals the cursor it was asked with as the last page: `apps/console/src/test/integration-setup.ts` and `e2e/support/fakeApi.ts`.
- **In a browser on `/mock`** nothing changes the answer. The role screen there shows "The permission list is longer than this screen can load" and no permissions (A-F3-16). **If you look at `/roles/:id` through `pnpm dev:mock`, that is what you will see.** Against the real API the list is three pages.
- **Two new integration tests:** the list read to its end, and the cap's words with no retry, no checkbox and no Save. Writing them showed the integration setup lacked a `ResizeObserver` stub, which Radix Checkbox needs. The old "ready" test passed without one because it only read the heading.

### The split, measured

| Chunk (gzipped)                    | Before | After |
| ---------------------------------- | ------ | ----- |
| One chunk, both documents          | 253.3  |       |
| `shared` (React, router, forms, …) |        | 229.5 |
| `main`, the back office's own      |        | 25.9  |
| `pos`, the till's own              |        | 2.2   |
| What the till loads (budget 250)   | 253.3  | 229.6 |
| What the back office loads (300)   | 253.3  | 253.2 |

The till no longer downloads any back office screen or the `iam` and `audit` words, which is what the split was for. It is only about 10% lighter, because most of both documents is the shared foundation. Trimming that foundation is the next lever (PERFORMANCE_BUDGET "Where the bytes are").

How the documents meet:

- `/pos` and below serve `pos.html`, in dev, in preview and (F13) on the production host.
- The back office's POS button and "Back office" on the till are full page loads, and Back works.
- The till renders sign-in in place, so signing out and in again keeps it on its own code.
- A host that routes `/pos` to the wrong document gets words, not a reload loop.

`e2e/specs/console/entries.spec.ts` (3 tests) proves:

- a fresh till requests the `pos` chunk and never `main`, `iam` or `audit`;
- the crossing both ways, and Back;
- that sign-in stays on the till.

### Checks after the answers

Each was run on its own.

| Check                                       | Exit | Result                                                                   |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `lint`, `format:check`, `typecheck`         | 0    |                                                                          |
| `test:unit`                                 | 0    | data 28 (was 27), console 136 (was 130); the other packages unchanged    |
| `test:integration`                          | 0    | 62 (was 60)                                                              |
| `build:console` (`HK_API_BASE_URL=/mock`)   | 0    | two documents, no warning                                                |
| `budget:console`                            | 0    | till 229.6 of 250 kB, back office 253.2 of 300 kB; style 10.7 of 15 each |
| `budget:console` with the till's set to 200 | 1    | "over budget", so the check fails when it should                         |
| `test:e2e`, default workers (load near 18)  | 0    | 125 passed (122 plus 3)                                                  |
| e2e again, 2 workers (CI's)                 | 0    | 125 passed                                                               |

Not re-run after the answers, because nothing they read changed: `test:a11y`, `build-storybook`, `build:storefront` (rebuilt by `test:e2e`) and the token, font, icon and contract checks.

## After the report, second round: the owner's four answers (2026-11-14)

| #   | Answer                                                                                                                                                    | What was done                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F4's gate: do not stop dead. Attempt it; if unavailable, record it unmet, carry on with F4, and carry it to F5 as task 1                                  | F4's opening message below says exactly that.                                                                                                                                                                                                                             |
| 2   | TOTP correct as recorded                                                                                                                                  | Nothing to change.                                                                                                                                                                                                                                                        |
| 3   | Step-up and `useApiAllPages` approved as built                                                                                                            | Nothing to change.                                                                                                                                                                                                                                                        |
| 4   | Budgets confirmed (A-F3-17 resolved). Split routes inside the till now: initial load the sale screen alone, everything else lazy; budget the initial load | ADR 0031: every till route but the sale screen is `lazyScreen(...)`, enforced by `routes.test.ts`. `budget:console` reads Vite's manifest and budgets the initial load, reporting on-demand chunks beside it. The rule is in PERFORMANCE_BUDGET "Console".                |
| —   | Write the `/pos` → `pos.html` hosting rule into the deployment document                                                                                   | New `docs/DEPLOYMENT.md`, with the exact Caddy change and its smoke check. BUILD_PROMPT F13's deploy step now points to it. **The backend's `docs/DEPLOYMENT.md` section 5.1 still says `try_files {path} /index.html` and must change; this repository cannot edit it.** |

Measured after the till's split, initial load gzipped:

- **The till:** 195.8 kB of 250. It was 229.6, and the sign-in screens took the form libraries with them. Another 42.8 kB in 7 chunks loads on demand.
- **The back office:** 266.1 kB of 300. It was 253.2, because it now counts its boot namespaces and the shared code is in smaller chunks.

**One consequence for F13:** a till that has never opened a lazy route cannot open it offline. The service worker must precache the till's on-demand chunks (`docs/DEPLOYMENT.md` section 2).

## Opening message for F4

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F4 row of the screen sessions table in
docs/BUILD_PROMPT.md (plus its "How to run this prompt" rules at the top). Read
docs/DATA_CONVENTIONS.md in full. List docs/sessions/ and read only the most recent report
(F03-auth-users.md, including "After the report"). Do not reopen decisions in docs/adr/
(0001 to 0031).

You are on a branch created off f03-auth-users, or off main if the owner has merged the stack.

Run ./scripts/sync-contract.sh, read ../backend/docs/CONTRACT_CHANGELOG.md for anything after
1.1.0, and read the backend's latest session report in ../backend/docs/sessions/ for which
modules went live and what B3 answered on CR-004, CR-006, CR-007 and CR-008.

TASK 1 (REQUIRED, first, before any F4 screen): the deferred real-API half of F3's gate.
A gate is never skipped, and a session is never wasted waiting for one.
- Point HK_API_BASE_URL at the B3 API. apps/console/src/auth/client.ts is already the real
  client.
- Sign in through the console against the real API as an owner and as a cashier.
- As the cashier, confirm the permission-denied state in words, on the same URL, on /users,
  /roles, /sessions and /audit.
- Check step-up (a write that needs it asks for the code and then succeeds) and the CSRF
  origin rule against the real server.
- Record each result in the F4 report as a check with its outcome. A failure is fixed or
  raised before F4 screens start.
If B3 has not landed, or the real API cannot be reached, attempt it anyway and record what you
tried: the gate is UNMET, not skipped. Then carry on with F4's own work, and write this task,
unchanged, as task 1 of F5's opening message.

TASK 2, only if task 1 passed: issue #4, the quarantined session expiry spec. Rewrite it against
the real refresh, run 10 loaded full suites with traces kept, and take it out of quarantine only
if all are green; otherwise leave it quarantined and update the issue.

Then F4: products, categories, units, grades, weight bands, and price lists with effective
dates. The gate: a price list change can be previewed before it activates. Read CR-001,
CR-003, CR-005 and CR-007 for what the backend answered.

Button, Table, StatusBadge, UIProvider and Field are the approved references. A new mechanism
(stylesheet, provider, variant system) is a stop and a question. Screens use useApiQuery,
useApiMutation and QueryBoundary; nothing calls fetch. Writes that the contract marks
"Requires step-up" go through useStepUp (ADR 0029). useApiAllPages is for short reference lists
only and throws past five pages (ADR 0028). The console is two documents (ADR 0030): back office
screens go in apps/console/src/app/routes.tsx, and after build:console run budget:console. Every till
route but the sale screen is lazyScreen(...) (ADR 0031). Hosting rules go in docs/DEPLOYMENT.md.

Confirm in three lines: the phase, its scope, and its gate. Then do task 1, then F4.
```
