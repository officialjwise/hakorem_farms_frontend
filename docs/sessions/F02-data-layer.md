# F2 contract, client and the data layer

- Session: F2, on branch `f02-data-layer`, stacked on `f01-app-shells` (PR base `f01-app-shells`). F0's PR #1 and F1's PR #2 are open and unmerged.
- Date: 2026-11-14
- Run: unattended overnight
- Gate: **met.** The generated client is in use, the real Prism mock serves all 600 operations, and the data patterns are settled in `docs/DATA_CONVENTIONS.md`. A throwaway screen listed products from the mock in loading, empty, error and permission denied. **It was deleted: it lived in commit `15511ff`, and `01a3d74` removes it.**

## Phase, scope and gate (as confirmed at the start)

- **Phase:** F2, contract, client and data layer.
- **Scope:** `scripts/sync-contract.sh` and the generated `packages/api-client`, Prism and `pnpm dev:mock`, one variable for the API base URL, TanStack Query with operation-id keys, idempotency keys, shared states, money and weight at the edge, the 401 single flight, integration tests on the real mock. Plus the F1 carries: generated auth types behind `apps/console/src/auth`, `docs/DATA_CONVENTIONS.md`.
- **Gate:** the generated client in use, the mock serving every planned screen, the data patterns settled, proved by a throwaway products screen in all four states, then deleted.

## Prism was not refused

The permission classifier that refused Prism and mermaid-cli earlier did not refuse it here. `pnpm add -w -D @stoplight/prism-cli@5.16.0`, `pnpm exec prism mock contract/openapi.yaml ...` and the integration suite's own spawn of it all ran. Nothing was worked around and no fake server exists.

## Built

### `packages/api-client` (ADR 0018, 0019, 0020, 0021)

- `scripts/generate.ts` writes `src/generated/schema.ts` (openapi-typescript 7.13.0, about 90,000 lines) and `src/generated/operations.ts`, a table of all 600 operation ids with method, path, `x-permission`, whether `Idempotency-Key` is required, the `X-CSRF-Token` rule, and whether the operation is public (`security: []`). `--check` regenerates in memory and fails if the committed files differ.
- `createApiClient().call(operationId, input, options)` over `openapi-fetch` 0.17.0, used through one file and typed by the contract: an unknown operation, a missing path parameter, a missing idempotency key, a wrong body and a key on a read are compile errors (`client.typetest.ts`). It is the only code that calls `fetch` for the API.
- `HK_API_BASE_URL` is read in one module (`baseUrl.ts`). No default, no `NODE_ENV`, no mock flag.
- `ApiError` carries `status`, `code`, `message`, `correlationId`, `details`, `retryAfter`, and `error.envelope` is exactly the contract's envelope that `mapServerErrors` takes. No answer is a `NetworkError` (status 0, `NETWORK_ERROR` or `TIMEOUT`); a reply that is not the envelope is `INVALID_RESPONSE`.
- The 401 single flight: concurrent 401s share one refresh, each request is retried once with the same key and the refreshed CSRF token, a refused refresh calls `onExpired` once, an unreachable refresh is a `NetworkError` and not an expiry, public operations are exempt. **The real-Prism test found a bug the unit tests had not:** a request sent before a refresh finished and refused after it started a second refresh in a row, which the server would read as token reuse. Each request now notes the refresh generation when it is sent; a unit test pins it (ADR 0021, point 5).

### `scripts/sync-contract.sh`

Copies `../backend/contract/openapi.yaml`, regenerates, then runs `pnpm typecheck` across every package and app and exits non-zero with a message if anything no longer compiles. `--check` (CI, `pnpm sync-contract:check`) copies nothing, regenerates and diffs, then type checks. Proven to fail on a stale file. CI runs it before lint.

### `packages/data` (ADR 0022)

`createQueryClient()`, `createApiHooks(api)` giving `useApiQuery` and `useApiMutation`, keys derived from operation ids, same-resource invalidation derived from the contract's paths, stale-time classes (`live` is the default), retry policy, and a mutation that owns its idempotency key. One `QueryClientProvider` per app, beside the one `UIProvider`; no API context and no other provider.

### `packages/ui` (ADR 0023)

`QueryBoundary` (loading, empty, error with reference and retry, permission denied for a 403) and `MutationFailure` (a persistent alert for a failed write), composed from `Skeleton`, `EmptyState`, `ErrorState` and `Button`, typed structurally so the package imports nothing from the data layer. A story per state, a `KeyboardPath` story, axe through `test:a11y`.

### Apps

- **Console:** the local auth types are gone; `auth/types.ts` takes every schema from the generated client, request bodies from the operations themselves, and `ApiError` and `NetworkError` from the data layer. The stub still sits behind `auth/client.ts`. `DataProvider` mounts the one `QueryClientProvider`, hands a 401 to `AuthProvider`'s own refresh (so its silent timer and a 401 share one), and clears the whole cache when the session ends. `AuthProvider` gained `refreshSession` and `expire`.
- **Storefront:** `Providers` mounts the one `QueryClientProvider` (a client per mount, because it also renders on the server). Next replaces `HK_API_BASE_URL` at build time. It has no API module yet (F7). First-load JavaScript is 182 kB against 181 kB before (A-F2-06).

### Mock and integration tests (ADR 0019)

`pnpm dev:mock` runs the pinned Prism on 4010. `pnpm test:integration` starts the same Prism, reuses one already running, and fails (never skips) if it cannot start. 20 tests against the real mock:

| File                               | Proves                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/mock.integration.test.ts`    | all 600 operations have a route; every read answers with JSON from the contract (234 answer 200, 16 need a query parameter and give the contract's own 400)                                                                                                                                                                                                                                                                       |
| `data/states.integration.test.tsx` | a screen built the way every screen is, in loading, empty, error (with the mock's correlation id) and permission denied                                                                                                                                                                                                                                                                                                           |
| `data/api.integration.test.tsx`    | typed reads; 401, 403, 404, 500 and 400 become `ApiError`s that `packages/ui` accepts; a write is accepted with its key and CSRF token and refused by the mock without them; `useApiMutation` refetches the list; five concurrent 401s make one refresh; a server that keeps refusing lands on expiry; every `...Pesewas` is a safe integer, every `...Kg` a three-place string, and the figures on screen equal the figures sent |

### Money and weight

Integer pesewas and three-place kilogram strings in and out, formatted only at the edge. `money.test.ts` fails the build if any source in the apps or the data layer uses `parseFloat`, `toFixed`, `toLocaleString`, `Intl.NumberFormat`, `* 100`, `/ 100` or `Math.round` (the auth stub's time arithmetic is exempt, with a comment, and goes with the stub in F3); a self-test shows the rule fires. The behavioural half is in the integration tests above.

### The gate's throwaway screen

`ProductsGate` listed products from Prism through `useApiQuery` and `QueryBoundary`. Loading, error (500, with the mock's correlation id `019a7b1e-32bc-78e3-8e1c-970f89c10fed`) and permission denied (403) came from the real mock; **empty is shown from a successful answer with no rows, because Prism cannot return an empty list from contract 1.1.0** (every list has one example with rows). That is CR-005. The screen and its test lived in `15511ff` and were deleted in `01a3d74`. The same four-state test now lives on as a fixture in `states.integration.test.tsx`.

## Checks at the tip

Each run on its own, exit status recorded.

| Check                 | Exit | Result                                                                                     |
| --------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `tokens:check`        | 0    | up to date                                                                                 |
| `fonts:check`         | 0    | up to date                                                                                 |
| `icons:check`         | 0    | up to date                                                                                 |
| `lint`                | 0    | no suppressions                                                                            |
| `format:check`        | 0    |                                                                                            |
| `typecheck`           | 0    | all seven workspace projects and `e2e`, every `.typetest`                                  |
| `test:unit`           | 0    | 24 api-client, 24 data, 6 i18n, 702 ui, 14 storefront, 89 console                          |
| `test:a11y`           | 0    | 231 story tests in Chromium with axe                                                       |
| `test:integration`    | 0    | 20 tests on the real Prism                                                                 |
| `test:e2e`            | 0    | 61 Playwright tests on the final run; three earlier full runs failed on the flaky spec below |
| `build-storybook`     | 0    |                                                                                            |
| `build:console`       | 0    |                                                                                            |
| `build:storefront`    | 0    | 182 kB first load on pages with the cart drawer                                            |
| `sync-contract:check` | 0    | the committed client matches the committed contract                                        |

## An intermittent end to end failure, not caused by F2 and not fixed

`e2e/specs/console/session.spec.ts:43` ("when the server ends the session the screen says so") fails roughly one full-suite run in six: the page shows the sign-in screen instead of the "Your session ended" alert. It passes alone (60 of 60 in a repeat run) and in the console project alone (18 of 18 runs). **It also fails with F2's `DataProvider` removed (1 failure in 12 full runs on that build), so it is an F1 race that load exposes, not a regression from this session.** I did not retry, skip or loosen it. Most likely cause: the expiry path races the fake clock and the stub's simulated latency under load. It needs an owner decision on whether F3, which replaces the stub, should fix it or the test should be rewritten against the real client. A flaky test is a failing test; this one is open.

## Decided in this session

ADRs 0018 to 0023: the generated client and sync script, Prism and the one base-URL variable, error normalisation and idempotency, the 401 single flight, TanStack Query and its one provider, the shared state components in `packages/ui`.

## Assumed (docs/ASSUMPTIONS.md, all dated 2026-11-14)

A-F2-01 openapi-fetch as the wrapper; A-F2-02 the variable's name and no default; A-F2-03 the mock from a browser dev server is not set up; A-F2-04 default stale class `live`; A-F2-05 retry numbers and the 30 s timeout; A-F2-06 the storefront has the provider but no API module; A-F2-07 `@scarf/scarf` denied; A-F2-08 Prism pinned and reused if running; A-F2-09 the integration setup's cookie jar; A-F2-10 empty states until CR-005; A-F2-11 the cache is cleared when the session ends.

## For the owner's review

1. **The flaky session spec above.** Decide who fixes it.
2. **A-F2-04, default `live`.** It is safe and costs a request per mount on a slow link. The storefront will likely choose `reference` for the public catalogue in F7.
3. **A-F2-03.** Using the mock from a browser dev server needs a same-origin proxy that adds the cookie. It was not built because this session could not look at a browser. F3's first real screen settles it.
4. **The `@scarf/scarf` denial** in `pnpm-workspace.yaml` is a new line in a supply-chain file. It stops a telemetry install script and nothing else.
5. **CR-005** is for the backend: a named `empty` example on list responses.

## Not verified, and said plainly

- **No browser run of the data layer.** Everything ran in Node (jsdom) against Prism, and in Chromium only for stories and the existing end to end suite. Nothing called the mock from a real page, so CORS, cookies and the dev proxy (A-F2-03) are untested.
- **No visual review** of `QueryBoundary` or `MutationFailure`. Axe and the structure are tested, how they look is not.
- **The 401 flow against a real session.** The unit tests, the Prism tests and the `DataProvider` test cover it; the real `refreshSession` arrives in F3.
- **Prism's behaviour is not the backend's.** It keeps no state, validates only what the contract describes, and cannot return an empty list.
- **CI has not run remotely** since F2 added `sync-contract:check` and `test:integration`; both pass locally.
- **Generated-file hygiene:** a commit briefly held a Prettier-reformatted client (Prettier run inside the package ignores the root `.prettierignore`); `sync-contract:check` caught it and `fd7a327` fixed it. Run Prettier from the repository root.

## Contract

- **Synced:** nothing new. `contract/openapi.yaml` is byte for byte the backend's 1.1.0. The backend changelog has nothing after 1.1.0, and B02's report says the contract is unchanged (it is now generated, with the 600 hand-written operations moved to `contract/planned/`).
- **Screens moved from the mock to the real API:** none. No business screen exists yet, and no backend module is live. The console's auth screens still run on the local stub behind `auth/client.ts`.
- **Added to `docs/CONTRACT_REQUESTS.md` this session:** **CR-005**, a named `empty` example on every list response, so the mock can serve empty states. Additive, not breaking. CR-001, CR-003 and CR-004 remain open.

## Carried to F3

- Replace `auth/stub.ts` and `auth/client.ts`'s stub import with a client built on the generated client (`loginStaff`, `verifyTotp`, `getCurrentSession`, `refreshSession`, `logout`, `changePassword`, `requestPasswordReset`, `resetPassword`), and delete `auth/seam.test.ts`'s stub rule with it. The data layer, `DataProvider` and `AuthProvider` do not change.
- Wire `useDirtyGuard` to React Router's `useBlocker` in the first form screen.
- Settle A-F2-03 (the mock in a browser) with the first real screen.
- Fix or rewrite the flaky `session.spec.ts:43`.
- CR-004 needs a backend answer before F3's login.

## Opening message for F3

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F3 section of docs/BUILD_PROMPT.md (plus its
"How to run this prompt" rules at the top). Read docs/DATA_CONVENTIONS.md in full: it is how
every screen reads and writes. List docs/sessions/ and read only the most recent report
(F02-data-layer.md). Do not reopen decisions in docs/adr/ (0001 to 0023).

You are on a branch created off f02-data-layer. F2 (the contract, client and data layer) is
finished and its stacked pull request is open and unmerged, as are F0's and F1's.

Run ./scripts/sync-contract.sh, read ../backend/docs/CONTRACT_CHANGELOG.md for anything after
1.1.0, and read the backend's latest session report in ../backend/docs/sessions/ for which
modules went live. Move any F3 screens whose module is live from the mock to the real API.

Button, Table, StatusBadge, UIProvider and Field are the approved references. A new mechanism
(stylesheet, provider, variant system) is a stop and a question. Screens use useApiQuery,
useApiMutation and QueryBoundary; nothing calls fetch.

Carry from F2: replace the auth stub with a client on the generated client behind
apps/console/src/auth/client.ts, settle the mock in a browser dev server (A-F2-03), wire
useDirtyGuard to useBlocker in the first form, fix or rewrite the flaky
e2e/specs/console/session.spec.ts:43, and read CR-004 and CR-005 for what the backend answered.

Confirm in three lines: the phase, its scope, and its gate. Then execute F3 only.
```
