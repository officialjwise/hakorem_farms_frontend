# Storefront performance budget

Recorded in F0c so every later session inherits it. It is **not enforced yet**, because `apps/storefront` does not exist. F1 builds the first page and F13 wires `lhci autorun` into CI against the real storefront and against staging. Until then the numbers live here and in `lighthouse/`, and a unit test (`packages/ui/src/test/budgets.test.ts`) fails if they drift from the shared brief.

## The numbers

| Target                            | Budget                     | Source                                          |
| --------------------------------- | -------------------------- | ----------------------------------------------- |
| Largest contentful paint          | under 2.5 s                | Shared brief, NFR "Storefront load"             |
| Listing page, compressed transfer | under 300 KB               | Shared brief, NFR "Catalogue page weight"       |
| Accessibility category            | 100 (axe findings fail CI) | Shared brief, NFR "Accessibility" (WCAG 2.2 AA) |
| Script, of that 300 KB            | under 120 KB               | Set here (assumption A-F0-06)                   |
| Fonts, of that 300 KB             | under 20 KB                | Set here (assumption A-F0-06)                   |
| Stylesheets, of that 300 KB       | under 30 KB                | Set here (assumption A-F0-06)                   |

The remaining 130 KB or more is for images, which are the point of a photo-heavy catalogue and must be responsive and lazy (shared brief, low-bandwidth discipline).

## The simulated connection

Lighthouse's `simulate` throttling at **300 ms round trip, 700 Kbps down, 4x CPU slowdown**, on a **360 px** wide mobile viewport. That is a slow 3G link on a cheap Android phone, the floor the brief names. Three runs per URL, median taken.

## How it is run (F13)

F13 adds the `pnpm lighthouse` script and installs `@lhci/cli`. It runs:

```bash
lhci autorun --config=lighthouse/lighthouserc.json --collect.url=<storefront listing page>
```

- `lighthouse/budget.json` is Lighthouse's budget format, read through `assert.budgetsFile`.
- A URL is passed at run time, because the storefront does not exist yet and no URL is invented here.

## What costs bytes in `packages/ui` today

- The cedi glyph face is 1.3 KB and downloads only when `GH₵` appears (ADR 0007).
- UI type is the system font stack, so there are no web fonts (ADR 0001).
- Components are tree-shakeable named exports. The storefront must import only what a page uses, and server components stay the default (F1).
