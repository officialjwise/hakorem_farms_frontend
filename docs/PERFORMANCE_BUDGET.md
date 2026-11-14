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

Set on 2026-11-14, on the owner's instruction, when the till and the back office became two documents (ADR 0030). Vite's 500 kB chunk warning is the bundler's default, not this budget, and it is switched off. The numbers are this session's choice (assumption A-F3-17), and changing one is an owner decision.

### The numbers

Gzipped, for what each document makes the browser fetch before anything renders: its entry script, every `modulepreload` and every stylesheet. 1 kB is 1,000 bytes.

| Document                  | Script budget | Style budget | Measured at the split (script, style) |
| ------------------------- | ------------- | ------------ | ------------------------------------- |
| The till, `pos.html`      | 250 kB        | 15 kB        | 229.6 kB, 10.7 kB                     |
| Back office, `index.html` | 300 kB        | 15 kB        | 253.2 kB, 10.7 kB                     |

And one rule that is not a number: **the till's document never loads the back office's entry chunk.**

Not counted: the catalogue namespaces loaded at boot (1 to 3 kB each), the service worker and the icons.

### How it is enforced

`pnpm budget:console`, after `pnpm build:console`, in CI and by hand. It reads `apps/console/dist/index.html` and `pos.html`, gzips what each one loads, prints the sizes against the budget, and exits 1 if a document is over or if the till loads the back office's entry chunk. The numbers live in `apps/console/scripts/check-budget.ts` (`CONSOLE_BUDGET`) and in the table above. Change both together. `e2e/specs/console/entries.spec.ts` checks the same rule from the requests a fresh till makes.

### Where the bytes are

At the split, 229.5 kB of either document is the `shared` chunk both load. The largest parts, by source size, are `react-dom`, `react-router`, `zod`, `react-hook-form`, `@tanstack/query-core`, the generated operation table in `packages/api-client`, `tailwind-merge` and `i18next`. The back office's own chunk is 25.9 kB, and the till's is 2.2 kB.

- **The till's 20 kB of headroom** is for F9's sale screens. Past that, look at the shared chunk first.
- **The back office's 47 kB** is for F4 to F6. When it gets close, each back office area loads on demand rather than the budget rising.
