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

### Re-measured in F7, against the real listing page (2026-11-16)

`/c/meat` at 360 px in Chromium on the Prism mock, a first visit, transfer as encoded on the wire:

| Part                                                                      | Before F7's cuts | After      | Budget               |
| ------------------------------------------------------------------------- | ---------------- | ---------- | -------------------- |
| Script                                                                    | 231 KB           | 202 KB     | 120 KB (provisional) |
| Document (HTML with its inline data)                                      | 31 KB            | 31 KB      |                      |
| Stylesheet                                                                | 11 KB            | 11 KB      | 30 KB                |
| Font (the cedi glyph only)                                                | 2 KB             | 2 KB       | 20 KB                |
| **Without photographs**                                                   | 275 KB           | **246 KB** |                      |
| Photographs: twelve `thumb` WebPs, at the API's declared 9,214 bytes each | 111 KB           | 111 KB     |                      |
| **The page**                                                              | 386 KB           | **357 KB** | **300 KB**           |

Twelve photographs load at once although they are `loading="lazy"`: on a slow connection Chrome fetches lazy images well below the fold, and a phone listing is three screens tall.

**The largest paint is under 2.5 s** on the 3G profile (300 ms, 700 Kbps, 4x CPU): the e2e spec asserts it on `/c/meat`. The paint is the page's own text, which arrives with the HTML; the script does not block it.

**F7's cuts** (ADR 0041): the data layer loads with the basket, not with every page (about 30 kB gzipped), and product links do not prefetch.

**What is left, and whose decision it is.** `next build` reports 191 kB of first-load script on a listing: 103 kB is Next and React, and nearly all of the rest is the `UIProvider` (ADR 0006), whose Radix toast and tooltip load with every page, about 85 kB with their shared Radix code and icons. The storefront shows no toast and no tooltip. Loading them on first use is a change to UIProvider, one of the reference components, so it is the owner's (CLAUDE.md). With it, the listing's script would fall to about 120 kB and the page to about 270 KB with its photographs. The other levers, smaller: a listing page of eight products instead of twelve (about 37 KB of photographs), and the generated operation table split per surface (about 12 kB, only once the basket loads).

### Re-measured in F8, after the owner's lever (2026-11-16)

The owner approved loading toast and tooltip on first use (ADR 0042). That change alone moved the listing's first-load script from 191 kB to 189 kB, because the weight was not the provider: Next bundled the whole `@hakorem/ui` index into the listing's client script. `optimizePackageImports` for `@hakorem/ui` fixed that (ADR 0042). `/c/meat` at 360 px in Chromium on the Prism mock, a first visit, measured as F7 did:

| Part                                            | F7         | F8, provider only | F8         | Budget     |
| ----------------------------------------------- | ---------- | ----------------- | ---------- | ---------- |
| First-load script, `next build`                 | 191 kB     | 189 kB            | **118 kB** | 120 kB     |
| Script, on the wire                             | 202 KB     |                   | **136 KB** |            |
| Document                                        | 31 KB      |                   | 31 KB      |            |
| Stylesheet                                      | 11 KB      |                   | 11 KB      | 30 KB      |
| **Without photographs**                         | 244 KB     |                   | **178 KB** |            |
| Photographs: twelve `thumb` WebPs (as declared) | 111 KB     |                   | 111 KB     |            |
| **The page**                                    | **357 KB** |                   | **289 KB** | **300 KB** |

The home and search pages fell the same way (`/` 176 KB without photographs). A product page's first-load script is 151 kB (was 220 kB) and the checkout's 200 kB (was 205 kB); neither is a listing.

**The console** (the same build, `pnpm budget:console`): the till's initial script 209.3 kB to **190.8 kB**, the back office's 278.5 kB to **273.9 kB**. Vite already tree-shook the package index, so the console's gain is the provider change alone.

A-F0-06 can now be judged on a page under budget: the provisional 120 kB script sub-budget holds on the listing with 2 kB to spare.

### Per route, checked in CI (F10i, 2026-11-18)

The owner's decision (2026-11-18): the two quote pages are accepted at their size, under **their own budget of 170 kB**, checked in CI; the **120 kB** target stays for listing pages. And (2026-11-18, on F10i): the listing pages do not fail CI at 120 kB yet; they are **ratcheted**, so CI fails above today's 121.7 kB and they cannot grow. The next storefront session trims them under 120 kB and then sets the limit to 120.

`pnpm budget:storefront` (`apps/storefront/scripts/check-budget.ts`) runs after `next build` in CI. It measures what `next build` reports as a route's first-load JavaScript: the page entry's files in `.next/app-build-manifest.json`, the 103 kB every page shares included, gzipped, in kilobytes of 1,000 bytes. The root layout's own chunks are printed beside it and not counted, as `next build` does not count them either.

| Route                                          | First-load script | Budget | Enforced in CI |
| ---------------------------------------------- | ----------------- | ------ | -------------- |
| `/quote`, the request-for-quote form           | 157.2 kB          | 170 kB | yes            |
| `/q/[token]`, the quote by its link            | 169.3 kB          | 170 kB | yes            |
| `/`, `/c/[slug]`, `/search`, the listing pages | 108.5 kB          | 120 kB | yes            |
| `/p/[slug]`                                    | 152.1 kB          | none   | no             |
| `/checkout`                                    | 202.8 kB          | none   | no             |

- **The quote link page has 0.7 kB left.** Anything added to it, or to what it shares, needs the budget first.
- **The listing pages are under 120 kB, enforced from F10l** (was a ratchet at 121.7 kB). Three changes in `packages/ui`:
  - `ErrorState` loads its copy button (`CopyId`) when it first shows a reference (`LazyCopyId`, as the toaster in ADR 0042). A listing page renders `ErrorState` for its error state, so the static import put `CopyId`, `Button` and `cn` in every listing's first load, and `Button` and `cn` a second time beside the layout's copies.
  - `cn` reads the colour names from `color-names.json`, not the whole token manifest.
  - `PhotoImage` takes no `className`, so it needs no `cn`.
- **What moved, and what went.** A listing page's first load, its layout's own chunks included, fell from 126.9 kB to 124.3 kB: 2.6 kB is gone. The budgeted figure fell further, from 121.7 kB to 108.5 kB, because tailwind-merge (8.7 kB), the icons' base and Radix Slot are now counted under the layout, which needs them for the header's basket button; the layout's own chunks rose from 5.2 kB to 15.8 kB. This budget counts the page entry, as `next build` does, so the layout is printed beside it and not budgeted. Whether the 120 kB should cover the layout too is the owner's.

### The whole first load, from F10m (2026-11-18)

The owner's decision (2026-11-18, on F10l): **the 120 kB limit covers the whole first load, the layout's scripts included.** `pnpm budget:storefront` now counts every file of the route's page entry and of the root layout, each once, and prints the page's share (`next build`'s figure) beside it. Counted that way the quote link page is over its 170 kB as well, so both are held at exactly the bytes of F10m's first build until they are under their limits, and CI fails above them:

| Route                                          | Whole first load     | Limit  | In CI                |
| ---------------------------------------------- | -------------------- | ------ | -------------------- |
| `/`, `/c/[slug]`, `/search`, the listing pages | 124,315 B (124.3 kB) | 120 kB | ratchet at 124,315 B |
| `/q/[token]`, the quote by its link            | 174,360 B (174.4 kB) | 170 kB | ratchet at 174,360 B |
| `/quote`, the request-for-quote form           | 166,901 B (166.9 kB) | 170 kB | yes                  |

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

- **F9: the till grew from 190.8 kB to 240.2 kB** (`pnpm budget:console`, 2026-11-16), 9.8 kB under its budget. The sale screen now sells: the offline store, queue and sync, the cart arithmetic and hash, the `pos` words, and the sale's own dialogs (an item's weight and price, payment, hold and recall), which bring Radix Select and the money and weight inputs into the initial load. They load with the document on purpose: the sale must complete with the network off even if the connection drops a second after the till starts, before anything could be fetched on demand. The till's other screens (setup, shift, the queue, returns) load on demand, 68.1 kB in 26 chunks, and are fetched once the till is ready (ADR 0043). The next till feature that adds to the sale screen should look here first: the headroom is small.
- **F10j: the till fell from 247.1 kB to 241.8 kB** (`pnpm budget:console`, 2026-11-18), with the same build switches as CI. The refusal words (`refusals`, 12 kB of sentences, out of `common`) and the shift screens' words (`posShift`, out of `pos`) are namespaces of their own, fetched with the till's other screens once the sale screen is up (`TILL_NAMESPACES` in `apps/console/src/pos/routes.tsx`). A refusal that arrives before then waits for its words. The back office loads `refusals` at boot, 279.8 kB to 281.0 kB. The shift screens on 2.5.0 then added 0.3 kB to the till's queue, which must load with it (a fresh cash movement sent alone, a refused open let go): **242.1 kB**, 7.9 kB under budget. The shift screens themselves load on demand.

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
