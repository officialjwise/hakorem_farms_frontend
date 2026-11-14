# 0030. The till and the back office are two documents with their own entries

- Status: accepted (owner, 2026-11-14: "split them into separate entries now, then set an explicit console budget and record it")
- Date: 2026-11-14
- Session: F3 (after the report, on the owner's answers)

## Context

At the end of F3 the console built one 871 kB chunk (253 kB gzipped), and Vite warned that it was over 500 kB. The owner's reading: the 500 kB figure is Vite's default, not our budget. The real problem is that the POS and the back office share one bundle, so a till downloads every users, roles, sessions and audit screen before it can scan an item, and every back office session after F3 makes the till heavier. The POS shell was already a lazy chunk (ADR 0014), but the router that loaded it imported every back office screen.

## Options considered

1. **Lazy routes in one document.** Each back office area becomes a `lazy()` chunk. The till stops downloading the screens, but the one router and its route table are still shared. Keeping the till light then depends on every later session remembering to make its screens lazy.
2. **Two documents, two entries.** `index.html` boots the back office and `pos.html` boots the till, each with its own route table. Neither route table imports the other's screens, so the bundler keeps them apart. Moving between them is a page load.
3. **Two apps.** A separate till app. This is the cleanest separation, but it would duplicate the shell, auth, the PWA and the e2e setup that F1 to F3 built once.

## Decision

Option 2.

- **Entries.** Vite builds two inputs: `main` from `apps/console/index.html` (`src/main.tsx`) and `pos` from `apps/console/pos.html` (`src/pos/main.tsx`). Both call `boot()` in `src/app/boot.tsx`, which mounts the same providers and service worker. Each entry passes its own routes and only the catalogue namespaces it uses. The till's are `common`, `shell` and `auth`.
- **Which document owns a path.** `entryFor` in `src/app/entries.ts` is the one rule: `/pos` and `/pos/...` belong to `pos.html`, and every other route to `index.html`. The dev and preview servers serve by it (the `hakorem-entry-documents` plugin in `vite.config.ts`), and so must the production host (F13).
- **Shared frame.** `appRoutes()` in `src/app/appRoutes.tsx` builds the root layout, the public sign-in routes and the session gate for both. The back office's protected routes are in `src/app/routes.tsx`, and the till's in `src/pos/routes.tsx`. `routes.test.ts` checks that each table declares only its own document's paths.
- **Crossing.** A path the current document does not own renders `OtherDocument`. It replaces the history entry with a full load of the same address, so Back still works. The back office routes `pos/*` there. The till routes `*` there: "Back office", "Go to the start page", and any back office address. If the document was served for that very address, the server routed it wrongly; `OtherDocument` then says so in words and does not reload in a loop.
- **Sign-in on the till.** The till renders the sign-in screens in place. A cashier who signs out and in again stays on the till's code. A reload of `/login` serves the back office document, as before.
- **What both load.** The code both documents use is one chunk named `shared` (React, the router, the forms, the data layer, the generated client, i18next and `packages/ui`). The stylesheet is one file named `styles`.
- **Budget.** Vite's 500 kB warning is switched off, and the console's own budget replaces it. It is per document and gzipped, recorded in `docs/PERFORMANCE_BUDGET.md` ("Console") and enforced by `pnpm budget:console` in CI after the console build. That check also fails if `pos.html` ever loads the back office's entry chunk.

## Consequences

- At the split, the till's document loads 229.6 kB of gzipped script and the back office's 253.2 kB. The till no longer loads the back office's 25.9 kB entry chunk, its screens, or the `iam` and `audit` words. `e2e/specs/console/entries.spec.ts` proves this from the requests a fresh till makes.
- Most of either document is the `shared` chunk (229.5 kB gzipped). The split does not shrink the foundation. Making the till lighter from here means trimming what the shared code pulls in. The largest parts are `react-dom`, `react-router`, `zod`, `react-hook-form` and the generated operation table.
- Moving between the back office and the till is a full page load, not an in-app transition. It happens a few times a shift.
- A production host must route `/pos` and `/pos/...` to `pos.html`. A host that sends `index.html` for everything shows the "this page could not be opened" state on the till instead of the till. That is carried to F13 with the hosting work.
- A new back office screen goes in `src/app/routes.tsx` and counts against the back office's budget. When that budget gets close, each area loads on demand, and that is a later decision. A new till screen goes in `src/pos/routes.tsx`.
- Revisit if the till becomes its own installable app, or if the service worker's caching (F13) needs one document.
