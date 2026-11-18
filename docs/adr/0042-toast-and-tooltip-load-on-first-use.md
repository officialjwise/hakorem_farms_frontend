# 0042. Toast and tooltip load on first use, and the storefront imports each component on its own

- Status: accepted (owner, 2026-11-16: "Load the toast and tooltip code only when first needed … in the shared provider so the console benefits too")
- Date: 2026-11-16
- Session: F8

## Context

F7 measured the listing page at 357 KB with its twelve photographs, against the brief's 300 KB, with 202 KB of script on the wire. It put the cause down to `UIProvider` (ADR 0006), whose Radix Toast and Tooltip loaded with every page although the storefront shows neither, and estimated 85 kB for them. The owner approved loading them on first use, in the shared provider, so the console gains as well.

F8 made that change and measured it: the listing's first-load script fell from 191 kB to 189 kB only. Reading the listing's chunks showed why. The page carried nearly every client component `@hakorem/ui` exports (Select, Popover, Dialog, Sheet, DatePicker, Combobox, Chart, Toast), because Next bundles the whole package index for a client boundary that imports from it. The provider was a small part of the weight; the index was the rest.

## Options considered

1. **The provider change alone.** What was approved. Worth 18.5 kB on the till and 4.6 kB on the back office, 2 kB on the listing. It does not bring the listing under budget.
2. **The provider change, and Next's `optimizePackageImports` for `@hakorem/ui`.** Next rewrites `import { X } from '@hakorem/ui'` to X's own module at build time, so a page carries only what it renders. One line of build configuration; no import in the storefront changes, and the package keeps its single index.
3. **Deep imports** (`@hakorem/ui/button`) everywhere in the storefront. The same effect, but it adds an export per component to the package and every import changes. Refused: option 2 gets there without either.

## Decision

Option 2.

- **Toast.** `UIProvider` keeps the queue and `useToast()` as they were. The Radix provider, the toast items and the viewport moved to `ToastLayer`, which the provider loads (`React.lazy`) the first time a toast is raised and keeps mounted from then on, so its region does not come and go. Before the first toast there is no notifications region.
- **Tooltip.** The provider no longer mounts Radix's tooltip provider. `Tooltip` loads its Radix half (`TooltipRadix`) the first time any tooltip mounts, one download for the page. Until it arrives the trigger renders on its own; if the trigger has focus when it arrives, focus is put back on it, so a keyboard user still gets the tooltip. Each tooltip carries its own Radix provider with the house delays (300 ms, skip 200 ms).
- **The storefront** sets `experimental.optimizePackageImports: ['@hakorem/ui']` in `next.config.ts`.

## Consequences

- **Measured** (F8; `docs/PERFORMANCE_BUDGET.md`, "F8"): the listing's first-load script 191 kB to 118 kB (`next build`); on the wire, script 202 KB to 136 KB and the page 244 KB to 178 KB without photographs, about 289 KB with its twelve. The till's initial script 209.3 kB to 190.8 kB, the back office's 278.5 kB to 273.9 kB.
- **The first toast waits for one chunk.** On a dead connection that chunk is not there until F13's service worker precaches every on-demand chunk (DEPLOYMENT.md, section 2), which already covers the till's screens. A toast is never the only record of a failure (ADR 0006), so a late one hides nothing.
- **Moving between tooltips** no longer skips the delay: each opens after 300 ms. Only the narrow back-office sidebar uses tooltips today.
- **A new storefront page** that imports `@hakorem/ui` gets only what it uses, with no rule to remember. A new package the storefront imports by its index needs the same line.

## Amendment (F10l, 2026-11-18): ErrorState's copy button

The same rule for one more leaf, nothing else reopened. `ErrorState` loads `CopyId` (and the `Button` and `cn` it brings) the first time it shows a reference, through `LazyCopyId`; until it arrives, the reference's eight characters are shown without the button. A storefront listing page renders `ErrorState` for its error state, so the static import put 2.8 kB of copy-button code in every listing's first load, `Button` and `cn` twice. The console waits for one small chunk on its first error with a reference; the error's words and reference are on screen before it.
