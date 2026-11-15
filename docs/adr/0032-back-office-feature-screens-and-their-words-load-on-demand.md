# 0032. Back office feature screens, and their words, load on demand

- Status: accepted (owner, 2026-11-15: "ADR 0032 and lazy loading" approved)
- Date: 2026-11-15
- Session: F4

## Context

The back office's initial load was 266.1 kB of its 300 kB budget after F3 (A-F3-17). F4 to F8 each add a feature area of screens and a catalogue namespace. Loaded eagerly, F4 alone took the initial load to 274.1 kB, most of it the `catalogue` words at boot, and four more areas would not fit. ADR 0031 settled the mechanism for the till (`lazyScreen`, a `Suspense` boundary with the loading state in words) and left the back office eager.

## Options considered

1. **Keep the back office eager and ask for a bigger budget.** Changing the budget is an owner decision, and every phase would ask again.
2. **Load each feature screen with the existing `lazyScreen`, and its namespace on first use.** No new mechanism: `LazyScreen`'s `Suspense` boundary also holds the screen while react-i18next loads a namespace that is not loaded yet, so the person sees "Loading the page" once, in words.

## Decision

Option 2, from F4 on.

- **Each feature screen F4 and later adds** to `apps/console/src/app/routes.tsx` is `element: lazyScreen(() => import(...))`.
- **Its namespace is not in `ENTRY_NAMESPACES['back-office']`.** It loads with the first screen that asks for it.
- **The shell, the sidebar, sign-in, and the F3 screens stay as they were** (eager, their namespaces at boot). Moving F3 is not part of this decision.
- **Nav labels and breadcrumbs stay in `shell`**, so the sidebar never waits for a feature's words.

## Consequences

- F4 left the back office at **269.2 kB** initial, with the F4 screens on demand.
- The first visit to an area waits for one small chunk and one namespace, behind the words "Loading the page".
- A test harness that mounts screens directly must load the namespace itself (`apps/console/src/test/harness.tsx` does).
- F13's service worker must precache these chunks and namespace files, as it must for the till's (`docs/DEPLOYMENT.md` section 2).
- If the owner prefers eager screens and a larger budget, the routes go back to plain elements; nothing else depends on this.
