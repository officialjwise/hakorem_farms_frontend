# Performance budgets

Two budgets: the storefront's (below, first) and the console's ("Console", at the end).

## Storefront

Recorded in F0c so every later session inherits it. **These numbers are provisional, not confirmed** (owner, 2026-11-14): a budget set before a page exists is a guess. F7 builds the real catalogue listing page, so **F7 re-measures against it and adjusts the budget there** (assumption A-F0-06 stays open until then). It is also **not enforced yet**, because `apps/storefront` does not exist. F1 builds the first page and F13 wires `lhci autorun` into CI against the real storefront and against staging. Until then the numbers live here and in `lighthouse/`, and a unit test (`packages/ui/src/test/budgets.test.ts`) fails if they drift from the shared brief.

### The numbers

| Target                            | Budget                     | Source                                          |
| --------------------------------- | -------------------------- | ----------------------------------------------- |
| Largest contentful paint          | under 2.5 s                | Shared brief, NFR "Storefront load"             |
| Listing page, compressed transfer | under 300 KB               | Shared brief, NFR "Catalogue page weight"       |
| Accessibility category            | 100 (axe findings fail CI) | Shared brief, NFR "Accessibility" (WCAG 2.2 AA) |
| Script, of that 300 KB            | under 120 KB               | Set here (assumption A-F0-06)                   |
| Fonts, of that 300 KB             | under 20 KB                | Set here (assumption A-F0-06)                   |
| Stylesheets, of that 300 KB       | under 30 KB                | Set here (assumption A-F0-06)                   |

The remaining 130 KB or more is for images, which are the point of a photo-heavy catalogue and must be responsive and lazy (shared brief, low-bandwidth discipline).

### The simulated connection

Lighthouse's `simulate` throttling at **300 ms round trip, 700 Kbps down, 4x CPU slowdown**, on a **360 px** wide mobile viewport. That is a slow 3G link on a cheap Android phone, the floor the brief names. Three runs per URL, median taken.

### How it is run (F13)

F13 adds the `pnpm lighthouse` script and installs `@lhci/cli`. It runs:

```bash
lhci autorun --config=lighthouse/lighthouserc.json --collect.url=<storefront listing page>
```

- `lighthouse/budget.json` is Lighthouse's budget format, read through `assert.budgetsFile`.
- A URL is passed at run time, because the storefront does not exist yet and no URL is invented here.

### What costs bytes in `packages/ui` today

- The cedi glyph face is 1.3 KB and downloads only when `GH₵` appears (ADR 0007).
- UI type is the system font stack, so there are no web fonts (ADR 0001).
- Components are tree-shakeable named exports. The storefront must import only what a page uses, and server components stay the default (F1).

### First measurement (F1, 2026-11-14)

`next build` of `apps/storefront`, first-load JavaScript, gzipped: **103 kB shared** by every page (React 19 and the Next runtime) and **181 kB** on the home, category and checkout pages, which carry the one `UIProvider` with its Radix toast, tooltip and dialog code and the cart Sheet. That is about 60 kB over the provisional 120 KB script sub-budget (A-F0-06). Nothing is enforced before F13, and a Lighthouse run against a listing page is the real test. Levers, in order: load the cart drawer on first use, split the toast viewport so a page that never toasts does not pay for it, and review what the Radix packages pull in. The 300 KB listing page total is not measured yet.

## Console

Set on 2026-11-14 when the till and the back office became two documents (ADR 0030). The numbers were confirmed by the owner the same day (A-F3-17, resolved), and changing one is an owner decision. Vite's 500 kB chunk warning is the bundler's default, not this budget, and it is switched off.

### The rule: the till loads its sale screen and nothing else

The till's **initial load is its shell and the sale screen** (the `/pos` index route). Every other till route is loaded on demand with `lazyScreen(...)` in `apps/console/src/pos/routes.tsx`. That includes the sign-in screens today, and in F9: hold and recall, returns, shift open and close, and anything else that is not needed to ring up an item. Set by the owner on 2026-11-14, while the till had one screen (ADR 0031).

- **The budget does not grow to fit F9.** F9 fills the till with routes, not with initial load.
- **A feature inside the sale screen** that is not needed for the first item (split tender, for example) is a candidate for loading on first use too. F9 decides that per feature, against the number below.
- **Enforced twice:**
  - `apps/console/src/routing/routes.test.ts` fails if any till route other than the sale screen and the hand-off is not a `LazyScreen`.
  - `pnpm budget:console` budgets the initial load only, so an eager screen shows up as initial bytes.
- **Offline:** an on-demand chunk must still open with the network off. The service worker precaches all of them (F13; `docs/DEPLOYMENT.md` section 2).

### The numbers

Gzipped, for each document's **initial load**: what the browser must fetch before the first screen renders. That is the entry chunk, every chunk it imports statically, the catalogue namespaces it loads at boot (`ENTRY_NAMESPACES` in `apps/console/src/app/entries.ts`) and its stylesheet. 1 kB is 1,000 bytes. What loads on demand is reported beside it, not budgeted.

| Document                  | Script budget | Style budget | Measured (initial script, style; on demand) |
| ------------------------- | ------------- | ------------ | ------------------------------------------- |
| The till, `pos.html`      | 250 kB        | 15 kB        | 195.8 kB, 10.7 kB; 42.8 kB in 7 chunks      |
| Back office, `index.html` | 300 kB        | 15 kB        | 266.1 kB, 10.7 kB; none                     |

And one rule that is not a number: **the till's initial load never contains the back office's entry chunk.**

How the measurement got here:

- **At the split** (whole document, namespaces not counted), the till was 229.6 kB and the back office 253.2 kB.
- **The till fell to 195.8 kB** once its sign-in screens became lazy. They took the form libraries (`zod`, `react-hook-form`) and the sign-in screens out of its initial load.
- **The back office reads higher, 266.1 kB.** It now counts the namespaces it loads at boot (about 8 kB). The shared code is also split into smaller chunks, which compress slightly less well.

Not counted: the service worker and the icons.

### How it is enforced

`pnpm budget:console`, after `pnpm build:console`, in CI and by hand.

- **What it reads:** `apps/console/dist/.vite/manifest.json`, the chunk graph Vite writes with `build.manifest`.
- **What it does:** walks each document's static imports, adds the boot namespaces, gzips the files, and prints the initial load against the budget, with the on-demand total beside it.
- **When it fails:** exit 1 if an initial load is over budget, or if the till's initial load contains the back office's entry chunk.
- **Where the numbers live:** `CONSOLE_BUDGET` in `apps/console/scripts/check-budget.ts` and the table above. Change both together.
- **On the wire:** `e2e/specs/console/entries.spec.ts` checks the same rules from the requests a fresh till makes. It never requests the back office's chunk or its words, a signed-in till never fetches the sign-in chunk, and signing out fetches it.

### Where the bytes are

Most of either initial load is the foundation both documents share. The largest parts, by source size, are `react-dom`, `react-router`, `@tanstack/query-core`, the generated operation table in `packages/api-client`, `tailwind-merge` and `i18next`. The form libraries now sit only in the back office's initial load and in the till's on-demand sign-in chunk.

- **The till has 54 kB of headroom.** It is for whatever the sale screen itself needs in F9. Past that, look at the shared code first.
- **The back office has 34 kB.** It is for F4 to F6. When it gets close, each back office area loads on demand rather than the budget rising.
