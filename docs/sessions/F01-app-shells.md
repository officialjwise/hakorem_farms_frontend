# F1 app shells (the three surfaces)

- Session: F1, on branch `f01-app-shells`, stacked on `f00-design-system` (PR base `f00-design-system`)
- Date: 2026-11-14
- Run: unattended overnight
- Gate: **met.** The storefront and both console shells run, route and navigate, the auth screens work against a stub, and the required barcode and Dialog proof passes in Chromium against the real shell. Every check is green, each run on its own.

## Phase, scope and gate (as confirmed at the start)

- **Phase:** F1, the three surfaces. F0 is finished and its PR #1 is open and unmerged.
- **Scope:** `apps/storefront` (Next.js 15), `apps/console` (React 19 and Vite, installable PWA, back office and POS shells), role-aware routing, auth screens against a stub behind one seam, a global error boundary, toasts, a POS offline indicator, and the required POS barcode and Dialog proof. No business screens.
- **Gate:** all three shells run and route, auth works against the stub, and the barcode focus trap and an open Dialog are proved together in Chromium against the real trap.

## Built

### `apps/console` (Vite 8, React 19.3.1, React Router 7.18.5)

- **Two shells, one build.** `BackOfficeShell`: header, a sidebar on wide screens that becomes a `Sheet` menu below 64rem, breadcrumbs from route handles, a skip link, compact density. `PosShell`: full screen, no sidebar, `lg` touch targets, light theme, lazy loaded as its own chunk.
- **Role-aware routing (ADR 0016).** Each route behind sign-in declares `handle: { permission, shell, crumb }`. `SessionGate` owns loading, error with retry, expired (in words, with a sign-in link that remembers the page) and anonymous (redirect to sign-in with `?next=`, in-app paths only). `PermissionGate` renders `ErrorState` with a lock, words and the permission code on the same URL; a route with no handle is denied. A test walks the route table.
- **Auth screens:** login, TOTP challenge, forced password change, forgot password, reset password, and the session expiry screen. All built from `Form`, `FormField`, `Input`, `FormError`, `Card`; errors map by code to the `auth` catalogue; a field detail from the server lands on its field. Silent refresh runs a minute before `accessExpiresAt`, one refresh at a time and across tabs through Web Locks.
- **Stub auth behind one seam (ADR 0012).** `auth/stub.ts` mimics cookies `__Host-hk_s_at` (10 minutes) and `__Host-hk_s_rt`, rotation with reuse detection, one message for any failed login with 429 backoff, a single use TOTP challenge, and CSRF on logout and password change. `auth/client.ts` is the only file that imports it. `auth/seam.test.ts` enforces that, and that no source file calls `fetch`. Types are a minimal local interface naming the contract operation ids; **F2 replaces them with generated types.**
- **POS barcode trap (ADR 0014).** `pos/useBarcodeTrap.ts`, with the barcode field in the shell. It does not override Radix: it acts after Radix's focus return. It is not a keyboard trap (Tab leaves the page).
- **PWA (ADR 0013).** Manifest, SVG and PNG icons (192, 512, maskable) generated from the colour tokens by `scripts/build-icons.ts` with `icons:check` in CI, and a minimal service worker (installs, claims, caches nothing) registered in production only.
- **Global error boundary** (`app/ErrorBoundary.tsx`, plus the router's `errorElement`) with a logged reference, **one `UIProvider`** at the root route with `toastLabels` from `t()`, and the **offline indicator** (icon and words) with a persistent line while offline.

### `apps/storefront` (Next.js 15.5.28, ADR 0015)

- Public layout, header with category navigation (plain anchors), footer, home, `/c/[slug]` category routes (pre-rendered), `/p/[slug]` product route (404 until a catalogue exists), `/checkout` skeleton (noindex), a cart drawer (`Sheet`, the one client leaf besides `Providers` and `error.tsx`), `not-found`, `error`, and `loading` states.
- Metadata from the start: title template, description, canonical, Open Graph and Twitter tags, `sitemap.xml`, `robots.txt`.
- `data-theme` and `data-density` set on `<html>` on the server from the `hk_theme` cookie.
- Server side translation with `getT()`; comfortable density.

### Shared

- **`@hakorem/i18n`:** namespaces `shell`, `auth` and `storefront`, typed. `common` is unchanged. Toast labels live in `shell`. `packages/ui` is still translation free.
- **`packages/ui`:** 28 files gained a `'use client'` first line (components and hooks that use hooks, context or Radix). Behaviour is unchanged; 690 unit tests and 219 story tests pass.
- **Workspace:** `apps/*` and the new `e2e` package. Every dependency is pinned exactly; nothing needed `allowBuilds` (`sharp` arrives prebuilt). Root scripts `dev:storefront`, `dev:console`, `build:storefront`, `build:console`, `icons:check`, `test:e2e`.
- **CI:** icons check, both builds and the Playwright suite added to `.github/workflows/ci.yml`.

### Tests

| Layer            | What                                                                                                                                                                                                                                                                                                                                                                                                                  | Count |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Unit, console    | stub cookie, expiry, refresh, rotation, revocation, CSRF, rate limit, TOTP; `AuthProvider` silent refresh, expiry, network retry, single flight; route guard (four session states, denied, deny by default, not found, forced change); each auth screen's states; barcode trap; route table; seam                                                                                                                     | 75    |
| Unit, storefront | sitemap, robots, category and product routes, metadata, cart drawer, server theme                                                                                                                                                                                                                                                                                                                                     | 14    |
| Unit, i18n       | catalogue and typed keys                                                                                                                                                                                                                                                                                                                                                                                              | 6     |
| End to end       | Chromium at 360 px: sign in, deep link, wrong password, keyboard only, TOTP, forced change, forgot and reset, sign out, silent refresh and expiry, permission denied, **POS barcode with a Dialog**, offline indicator, light default on a dark device, PWA manifest and service worker, storefront shell, cart drawer keyboard, metadata, sitemap, theme on the first byte, **axe on every route in light and dark** | 61    |

## The required F1 story (ADR 0004)

`e2e/specs/console/pos-barcode-dialog.spec.ts`, Chromium, the production build, the real `PosShell`, the real `useBarcodeTrap`, and the real `@hakorem/ui` Dialog (the POS sign-out confirmation). It asserts that focus is inside the Dialog on open, that a typed scan does not reach the field behind it, that Tab and Shift+Tab (six each) never leave it, and that on Escape, on "Stay signed in" and on the close button focus returns to the barcode field and not to the button that opened it, after which a scan lands. It also walks the keyboard-only path. A jsdom test covers the hook's rules; it is not the gate.

## Checks at the tip

Each run on its own, exit status recorded.

| Check              | Exit | Result                                                                  |
| ------------------ | ---- | ----------------------------------------------------------------------- |
| `tokens:check`     | 0    | up to date                                                              |
| `fonts:check`      | 0    | up to date                                                              |
| `icons:check`      | 0    | up to date                                                              |
| `lint`             | 0    | ESLint with `hakorem/token-usage`, jsx-a11y, Stylelint; no suppressions |
| `format:check`     | 0    |                                                                         |
| `typecheck`        | 0    | all four workspace packages and `e2e`, every `.typetest`                |
| `test:unit`        | 0    | 6 i18n, 690 ui, 14 storefront, 75 console                               |
| `test:a11y`        | 0    | 219 story tests in Chromium with axe, WCAG 2.2 AA                       |
| `test:e2e`         | 0    | 61 Playwright tests (builds both apps first)                            |
| `build-storybook`  | 0    |                                                                         |
| `build:console`    | 0    | `tsc` then Vite                                                         |
| `build:storefront` | 0    | Next.js 15.5.28                                                         |

An audit of `apps/*/src`, `e2e` and `scripts` finds no raw hex, no `fetch(`, no `toLocaleString` or `parseFloat`, and no `eslint-disable`, `ts-ignore` or `ts-nocheck`. One scoped config change: `eslint.config.js` and `.prettierignore` skip `**/next-env.d.ts` and `**/.next/**` (generated files; reason in ADR 0015).

## Decided in this session

ADRs 0011 to 0017: the console router (React Router 7.18.5, because 8.5.1 needs Node 22.22), the auth stub and its seam, the PWA approach, the POS shell and barcode trap, the storefront (Next 15.5.28, theme cookie, server translation, `'use client'` in the UI package), permissions declared in route handles, and the end to end setup.

## Assumed (docs/ASSUMPTIONS.md, all dated 2026-11-14)

A-F1-01 router version; A-F1-02 theme cookie; A-F1-03 sign in again after a forced change; A-F1-04 the stub's reading of two gaps in the contract; A-F1-05 compact density and theme defaults; A-F1-06 placeholder icon glyph; A-F1-07 the five category slugs; A-F1-08 sign out forgets the page, expiry keeps it; A-F1-09 e2e storefront on port 3100.

## For the owner's review

1. **First storefront measurement against A-F0-06.** 103 kB shared and **181 kB** first-load JavaScript (gzipped) on pages with the cart drawer, against the provisional 120 KB script sub-budget. The cause is the one `UIProvider` (ADR 0006) with its Radix toast, tooltip and dialog code, plus the cart Sheet. Nothing enforces it before F13. Decide whether to keep the 120 KB figure, raise it, or have F7 cut the payload (lazy cart drawer, split toast viewport).
2. **ADR 0015, decision 4:** `'use client'` was added to 28 files in `packages/ui`. It is not a new mechanism and changes no behaviour, but it touches F0's package. Confirm.
3. **Soft 404** on unknown category and product URLs: they show a not-found page with `noindex` but the status line is 200, because the routes stream behind `loading.tsx`. F7 fixes it when the lookups become real.
4. **CR-004** needs a backend answer before F3: how the first-login password change authenticates, what follows it, and the error code for a bad reset token.

## Not verified, and said plainly

- **No visual review.** No screenshots were taken or looked at. Axe, contrast pairs, 360 px overflow checks and the structure of each page are tested; how a layout looks is not. Run `pnpm dev:console` and `pnpm dev:storefront` and look.
- **No real device and no scanner.** Nothing ran on an Android phone, a touch screen or with a hardware barcode scanner. A scan is simulated as fast typing.
- **No screen reader pass** (VoiceOver, TalkBack). That is F13.
- **The dev servers were not run interactively.** Production builds were (Playwright runs `vite preview` and `next start`).
- **CI has not run remotely yet.** The workflow is extended and every step passes locally; the first run is on the pull request.
- **Offline boot is not covered.** The POS shell's offline indicator and banner are tested with the network off after load. Booting the console with the network off needs the F13 service worker.
- **English only.** One language ships, so a second language's layout (longer strings, right to left) is untested.
- **Process slips:** three `git push` calls were piped to `tail`, which hides an exit code. Each succeeded and was confirmed from the output. Every `git add`, `git commit` and `git push` was a separate command.
- Docker held port 3000 on this machine. The storefront dev script still uses 3000; the e2e config uses 3100.

## Contract

- **Synced:** nothing new. `contract/openapi.yaml` is byte for byte the backend's (1.1.0). The backend changelog has nothing after 1.1.0. B01's report is the latest.
- **Read for shapes:** `loginStaff`, `verifyTotp`, `refreshSession`, `getCurrentSession`, `logout`, `changePassword`, `requestPasswordReset`, `resetPassword`, `LoginResult`, `SessionInfo`, `GrantSummary`, `Error`, `ErrorDetail`, the `staffSession` scheme, and `x-permission` codes.
- **Screens moved from the mock to the real API:** none. F1 has no data screens and no mock server; the auth screens run on the local stub.
- **Added to `docs/CONTRACT_REQUESTS.md` this session:** **CR-004**, three clarifications on the staff sign-in flow (the first-login password change's authentication, what follows it, and the code for a bad reset token). None is a breaking change. CR-001 and CR-003 remain open.

## Carried to F2

- Replace `apps/console/src/auth/types.ts` with generated types, and let the generated client back `auth/client.ts` only when F3 lands (F2 keeps the stub behind the seam).
- Wire `useDirtyGuard` to React Router's `useBlocker` in the first form screen (F3).
- The category list and the product route read from the generated client and the mock in F2 and F7.
- Port the `AuthProvider` expiry and refresh behaviour onto the data layer's 401 handling, so a 401 on any request triggers the same single flight refresh.

## Opening message for F2

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F2 section of docs/BUILD_PROMPT.md.
List docs/sessions/ and read only the most recent report (F01-app-shells.md).
Do not reopen decisions in docs/adr/ (0001 to 0017).

You are on a branch created off f01-app-shells. F1 (the three surfaces) is finished and its
stacked pull request is open and unmerged.

Run the contract sync (scripts/sync-contract.sh is F2 work: build it), read the backend's
CONTRACT_CHANGELOG.md for anything after 1.1.0, and read the backend's latest session report.

Button, Table, StatusBadge, UIProvider and Field are the approved references. A new
mechanism (stylesheet, provider, variant system) is a stop and a question. TanStack Query and
the generated client are the two new dependencies F2 is expected to add: record each in an ADR
starting at 0018.

Carry from F1: replace the local auth types with generated ones behind apps/console/src/auth
(the stub stays behind client.ts until F3), add the Prism mock and dev:mock, settle
docs/DATA_CONVENTIONS.md, and put the 401 refresh single flight in the data layer.

Confirm in three lines: the phase, its scope, and its gate.
Then execute F2 only. Stop at the gate and write the session report.
```
