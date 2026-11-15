# F5c: the closer pass against the reference

- **Session:** F5c, on branch `claude/compassionate-goodall-ymhd6k`, from `main` after the merges below.
- **Date:** 2026-11-15
- **Gate:** every screen re-shot beside the reference until only the content and the accent differ.
  - **Met for layout, shape, type and density.** The differences left are listed per screen below. Each is content (a figure or a feature the API does not carry yet), the accent, or a choice made on purpose.

## Merged first

The owner's merge rule: merge only once each pull request's CI is green.

- **F4** ([officialjwise/hakorem_farms_frontend#6](https://github.com/officialjwise/hakorem_farms_frontend/pull/6)): green, merged.
- **F5** ([officialjwise/hakorem_farms_frontend#7](https://github.com/officialjwise/hakorem_farms_frontend/pull/7)): green, retargeted from `f04-catalogue` to `main`, merged.
- **F5b** ([officialjwise/hakorem_farms_frontend#9](https://github.com/officialjwise/hakorem_farms_frontend/pull/9), opened this session):
  - The first CI run failed in `test:integration`. The suite passed locally twice, once on two CPUs; the CI log could not be downloaded here.
  - Re-running the failed job went green, and it was merged.
  - This looks like the cold-screen timing flake F5b described.
- **Not merged:** [officialjwise/hakorem_farms_frontend#8](https://github.com/officialjwise/hakorem_farms_frontend/pull/8) (contract requests). It was not part of the instruction, and F5b already carried the same requests to `main`, so #8 may now conflict.

## The owner's decisions, and what each changed

### Typeface: Plus Jakarta Sans (ADR 0001, amended)

- **The pick.** Figtree, Plus Jakarta Sans and Outfit were set beside the reference's own type on the same card. Plus Jakarta Sans broke every line where the reference does; the other two set narrower.
- **What ships.**
  - One variable WOFF2: weight 400 to 700, Latin only, subset by the existing fonts script from the OFL package and checked in CI (`fonts:check`).
  - `font-display: swap` over the system stack, so text shows at once on 3G.
  - The face lacks U+20B5, so the existing cedi face stays first in the stack and draws GH₵.
  - Tabular figures survive the subset (checked).
- **Measured weight: 17,860 bytes (17.9 KB).** Four static weights would have been 48.6 KB. It is not JavaScript, so the bundle budget does not count it.
- **Where.** The console and Storybook. The storefront keeps the system stack, as its performance rules require (A-F5c-01).

### The page title moves into the top bar

- The page's `h1` renders into a slot in the top bar (a portal); the breadcrumbs lead the page area.
- On a phone the title takes its own line beneath the tools.
- To make room:
  - the search and branch picker are narrower;
  - the till button shows its words from 80rem;
  - the account shows its name from 96rem;
  - a settings gear joins the top bar.

## The closer pass, item by item

1. **Light grey page, white cards, both themes (ADR 0001, amended).**
   - The light page is `#F2F4F3` and cards `#FFFFFF`; in dark, the page is darker than the cards.
   - The dark control border lifted to `#878070`, so a hovered row keeps 3.66:1.
   - The contrast matrix reruns clean: 219 pairs.
   - The tightest pairs are in the ADR.
2. **The stat row is one card.**
   - `StatGroup` divides its cells with hairlines in any column count. Five figures fit in a row at 1280.
   - The fourteen figures with no data source collapse into one strip, "Figures still to come from the server". It names each and says they arrive with the server's next dashboard update, never as a number.
   - A figure leaves the strip when its field is wired in `figures.ts`.
3. **The table card (ADR 0036).**
   - **One card per list:** a single-line pill toolbar (search, date range, filter, Columns, Sort by, Export), sortable sentence-case headers, and pagination at the foot.
   - **Only what the API honours.** A list shows search, dates or a filter only where its operation takes them.
   - **Columns and Sort work on the page on screen, and say so.** The contract has no sort parameter.
   - **Export.** Every card offers "This page as CSV", with values as formatted on screen. Reports add the API's XLSX and PDF.
   - **Status pills** are dotted.
   - **Icon chips** sit beside rows with no image: products by accounting group (the thumbnail covers it when one loads), lots by tracking, suppliers, tills, branches, roles, sessions, categories by product line. Users get avatars.
   - **Every list moved onto it:** fourteen screens plus the reports and system settings.
4. **Tiles.**
   - `StatTile` shows its icon on a tinted chip and draws a `Sparkline` from a series the API sends. Contract 1.17.0 sends none, so no sparkline shows yet; none is invented.
   - Report pages use `ReportTile`: a tinted corner wedge and the icon on a solid diamond, an icon by column type.
5. **Modals.**
   - `Dialog` takes an icon chip and a `requiredNote`.
   - `DialogActions` is the footer: a rule across the dialog, Cancel with its X on the left, the primary action with its icon on the right.
   - Required fields in modals show a red asterisk, explained by "* Required field" under the title (A-F5c-06).
   - All eighteen console dialogs and `ConfirmChanges` take the shape.
6. **"Go to page", and a settings section.**
   - **Pagination:**
     - `useCursorPages` keeps every cursor reached;
     - `Pagination` numbers those pages, with at most seven buttons;
     - a "Go to page" picker appears once a second page is reached (A-F5c-04).
   - **`/settings`:**
     - Display (theme, menu width) is anyone's.
     - The business profile (`getBusinessProfile`) and the system settings (`listSettings`, searched by key prefix, scoped to the header's branch) need `aud.setting.read`. Both are read-only (A-F5c-05).
     - Branches, users, roles and sessions are linked.
7. **Side by side.** Every screen was shot at 1280 and 360 and paired with the reference at 1280; see below.

## Side by side

- **Where the pairs are.** The pairs show the reference's pages, and the template's licence and the first brief say its files are not copied into the repository. So the pairs (ours on the left, the reference on the right) were sent to the owner with this report and are not committed.
- **What is committed.** Only our own shots, below. The reference was captured from its public demo with Playwright, for comparison only.

| Ours                     | Paired with the reference's |
| ------------------------ | --------------------------- |
| `dashboard`              | `index`                     |
| `dashboard-dark`         | `index`                     |
| `products`               | `medicines`                 |
| `products-columns-menu`  | `medicines`                 |
| `products-sort-menu`     | `medicines`                 |
| `products-page-2`        | `medicines`                 |
| `product`                | `—`                         |
| `product-new`            | `—`                         |
| `categories`             | `categories`                |
| `units`                  | `units`                     |
| `species`                | `manufacturers`             |
| `price-lists`            | `racks`                     |
| `stock-on-hand`          | `low-stock`                 |
| `lots`                   | `batch-management`          |
| `movements`              | `inventory-logs`            |
| `stock-takes`            | `expiry-tracking`           |
| `adjustments`            | `stock-adjustment`          |
| `transfers`              | `stock-transfer`            |
| `goods-receipts`         | `purchases`                 |
| `suppliers`              | `vendors`                   |
| `registers`              | `cash-register`             |
| `branches`               | `branches-settings`         |
| `branch`                 | `branches-settings`         |
| `branch-new-modal`       | `categories (Add modal)`    |
| `branch-close-modal`     | `categories (Add modal)`    |
| `labels`                 | `expiry-reports`            |
| `reports`                | `reports`                   |
| `report-sales`           | `sales-reports`             |
| `report-stock-valuation` | `stock-valuation`           |
| `report-profit-and-loss` | `profit-loss-reports`       |
| `users`                  | `user-settings`             |
| `roles`                  | `roles-settings`            |
| `sessions`               | `user-settings`             |
| `audit`                  | `inventory-reports`         |
| `settings`               | `business-settings`         |
| `settings-business`      | `business-settings`         |
| `settings-system`        | `profile-settings`          |

### What still differs, after the passes

**Throughout:**

- **The accent and the menu's tone.** Pine & Sand against the reference's blue, purple and near-black teal. This is the accent, as agreed.
- **The page header's refresh and full-screen buttons.** Only the dashboard has a refresh; no screen asked for full screen.
- **Totals.** "Showing 1–10 of 1200" needs a total the API does not give. Our foot says "Page n".
- **No footer line.**
- **The account shows an icon, not a photo.** There is no photo in the contract, and initials failed axe (`label-content-name-mismatch`).

**Content, waiting on the API:**

- **Dashboard.** The chart, stock health, stock by category, the alert lists, near expiry, invoices and recent transactions all wait on CR-013. So do the sparklines and the trend pills against last month.
- **Products and the other lists.** The reference's stat tiles with sparklines above the table need counts and series the API does not give.
- **Lots.** The reference groups batches by product in folding sections; ours is a flat list.
- **Reports.** The last breadcrumb reads "Report", not the report's name (the trail comes from route handles).

**Settings:** the reference's business settings is an editable form with tabs; ours reads the profile (A-F5c-05).

**Modals:** the reference's title chip is solid; ours is tinted, as every chip in the system is.

## Screenshots

Production build on the mock, signed in as the owner, light theme unless named dark. Every figure is the contract's example (Prism). No screen moved to the real API this session.

**Dashboard: the stat row as one card of five figures, the missing fourteen in one strip, then the panels with data.**

![dashboard at 1280](../screenshots/F05c/dashboard-1280.png) ![dashboard at 360](../screenshots/F05c/dashboard-360.png)

**Dashboard, dark theme: the page darker than the cards.**

![dashboard-dark at 1280](../screenshots/F05c/dashboard-dark-1280.png) ![dashboard-dark at 360](../screenshots/F05c/dashboard-dark-360.png)

**Products: the pill toolbar, an icon chip by accounting group, dotted status pills.**

![products at 1280](../screenshots/F05c/products-1280.png) ![products at 360](../screenshots/F05c/products-360.png)

**Columns: a checkbox per column; the product column stays.**

![products-columns-menu at 1280](../screenshots/F05c/products-columns-menu-1280.png) ![products-columns-menu at 360](../screenshots/F05c/products-columns-menu-360.png)

**Sort by: a column or as listed, a direction, and what it sorts.**

![products-sort-menu at 1280](../screenshots/F05c/products-sort-menu-1280.png) ![products-sort-menu at 360](../screenshots/F05c/products-sort-menu-360.png)

**Page 2: numbered pages and "Go to page".**

![products-page-2 at 1280](../screenshots/F05c/products-page-2-1280.png) ![products-page-2 at 360](../screenshots/F05c/products-page-2-360.png)

**A product, retrofitted.**

![product at 1280](../screenshots/F05c/product-1280.png) ![product at 360](../screenshots/F05c/product-360.png)

**New product, retrofitted.**

![product-new at 1280](../screenshots/F05c/product-new-1280.png) ![product-new at 360](../screenshots/F05c/product-new-360.png)

**Categories: a chip by product line.**

![categories at 1280](../screenshots/F05c/categories-1280.png) ![categories at 360](../screenshots/F05c/categories-360.png)

**Units.**

![units at 1280](../screenshots/F05c/units-1280.png) ![units at 360](../screenshots/F05c/units-360.png)

**Species, grades and bands.**

![species at 1280](../screenshots/F05c/species-1280.png) ![species at 360](../screenshots/F05c/species-360.png)

**Price lists, with the kind filter.**

![price-lists at 1280](../screenshots/F05c/price-lists-1280.png) ![price-lists at 360](../screenshots/F05c/price-lists-360.png)

**Stock on hand: the location filter, the API's total at the card's foot.**

![stock-on-hand at 1280](../screenshots/F05c/stock-on-hand-1280.png) ![stock-on-hand at 360](../screenshots/F05c/stock-on-hand-360.png)

**Lots and expiry: search, filter, chips by tracking.**

![lots at 1280](../screenshots/F05c/lots-1280.png) ![lots at 360](../screenshots/F05c/lots-360.png)

**Stock movements: the date range pill.**

![movements at 1280](../screenshots/F05c/movements-1280.png) ![movements at 360](../screenshots/F05c/movements-360.png)

**Stock takes.**

![stock-takes at 1280](../screenshots/F05c/stock-takes-1280.png) ![stock-takes at 360](../screenshots/F05c/stock-takes-360.png)

**Adjustments.**

![adjustments at 1280](../screenshots/F05c/adjustments-1280.png) ![adjustments at 360](../screenshots/F05c/adjustments-360.png)

**Transfers.**

![transfers at 1280](../screenshots/F05c/transfers-1280.png) ![transfers at 360](../screenshots/F05c/transfers-360.png)

**Goods receipts: the received-date range.**

![goods-receipts at 1280](../screenshots/F05c/goods-receipts-1280.png) ![goods-receipts at 360](../screenshots/F05c/goods-receipts-360.png)

**Suppliers: search and the status filter.**

![suppliers at 1280](../screenshots/F05c/suppliers-1280.png) ![suppliers at 360](../screenshots/F05c/suppliers-360.png)

**Cash registers.**

![registers at 1280](../screenshots/F05c/registers-1280.png) ![registers at 360](../screenshots/F05c/registers-360.png)

**Branches and locations.**

![branches at 1280](../screenshots/F05c/branches-1280.png) ![branches at 360](../screenshots/F05c/branches-360.png)

**A branch.**

![branch at 1280](../screenshots/F05c/branch-1280.png) ![branch at 360](../screenshots/F05c/branch-360.png)

**New branch: icon chip, asterisks with their note, Cancel left, primary right.**

![branch-new-modal at 1280](../screenshots/F05c/branch-new-modal-1280.png) ![branch-new-modal at 360](../screenshots/F05c/branch-new-modal-360.png)

**Closing a branch: the change, the consequence, the danger chip.**

![branch-close-modal at 1280](../screenshots/F05c/branch-close-modal-1280.png) ![branch-close-modal at 360](../screenshots/F05c/branch-close-modal-360.png)

**Labels.**

![labels at 1280](../screenshots/F05c/labels-1280.png) ![labels at 360](../screenshots/F05c/labels-360.png)

**Reports.**

![reports at 1280](../screenshots/F05c/reports-1280.png) ![reports at 360](../screenshots/F05c/reports-360.png)

**Sales report: tinted-corner tiles with the diamond, the period pill, XLSX and PDF in Export.**

![report-sales at 1280](../screenshots/F05c/report-sales-1280.png) ![report-sales at 360](../screenshots/F05c/report-sales-360.png)

**Stock valuation.**

![report-stock-valuation at 1280](../screenshots/F05c/report-stock-valuation-1280.png) ![report-stock-valuation at 360](../screenshots/F05c/report-stock-valuation-360.png)

**Profit and loss.**

![report-profit-and-loss at 1280](../screenshots/F05c/report-profit-and-loss-1280.png) ![report-profit-and-loss at 360](../screenshots/F05c/report-profit-and-loss-360.png)

**Users: avatars, search, the status filter.**

![users at 1280](../screenshots/F05c/users-1280.png) ![users at 360](../screenshots/F05c/users-360.png)

**Roles.**

![roles at 1280](../screenshots/F05c/roles-1280.png) ![roles at 360](../screenshots/F05c/roles-360.png)

**Sessions.**

![sessions at 1280](../screenshots/F05c/sessions-1280.png) ![sessions at 360](../screenshots/F05c/sessions-360.png)

**The audit log: dates in the pill, area, action and record type in the filter.**

![audit at 1280](../screenshots/F05c/audit-1280.png) ![audit at 360](../screenshots/F05c/audit-360.png)

**Settings: display.**

![settings at 1280](../screenshots/F05c/settings-1280.png) ![settings at 360](../screenshots/F05c/settings-360.png)

**Settings: the business profile.**

![settings-business at 1280](../screenshots/F05c/settings-business-1280.png) ![settings-business at 360](../screenshots/F05c/settings-business-360.png)

**Settings: system settings and switches.**

![settings-system at 1280](../screenshots/F05c/settings-system-1280.png) ![settings-system at 360](../screenshots/F05c/settings-system-360.png)

## Data

- **Sync was not possible.**
  - Attaching `officialjwise/hakorem_farms_backend` was refused again by the session's permission classifier, so there is no `../backend` to sync from.
  - The contract stays at 1.17.0, and `getOwnerDashboard` carries the fields F5b wired.
  - When the backend's dashboard lands: run `pnpm sync-contract` and wire each new field in `apps/console/src/dashboard/figures.ts`. Its tile then leaves the strip, and Prism's examples fill the mock shots.
- **No number is put into the UI by hand.** Sparklines, trends and totals come only from the API.

## Gates

Each check was run on its own, at the tip.

| Check                                                               | Exit | Result                                                                                                                               |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                                                      |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    | Icons regenerated for the grey page's manifest colour                                                                                |
| `test:unit`                                                         | 0    | ui 802, console 154, data 28, api-client 24, storefront 14, i18n 6                                                                   |
| `test:a11y` (every story, axe)                                      | 0    | 290                                                                                                                                  |
| `test:integration`                                                  | 0    | 186 (adds 6 for settings)                                                                                                            |
| `test:e2e` (axe on every route, 360 px, no sideways scroll)         | 0    | 201                                                                                                                                  |
| Contrast matrix                                                     | 0    | 219 pairs, both themes                                                                                                               |
| `build:console`, `budget:console`                                   | 0    | back office 269.7 of 300 kB initial script (282.3 before; the F3 screens now load on demand, ADR 0032 amended); till 202.4 of 250 kB |
| UI font                                                             |      | 17.9 KB, one WOFF2, console only                                                                                                     |
| `pnpm screenshots` (F05c)                                           | 0    | 74 shots                                                                                                                             |

**The first-load mark.**

- After the table card it went to 292.2 kB, because the F3 screens were still eager and now share the card.
- Moving them onto `lazyScreen`, as F4 and F5 already are, brought it to 269.7 kB.

## Assumed this session

A-F5c-01 to 07 in `docs/ASSUMPTIONS.md`:

- the font is console only;
- the grey page reaches the storefront;
- sort and export act on the page on screen;
- "Go to page" covers the pages reached;
- the settings section is read-only;
- asterisks appear in modals only;
- the stock lists' extra contract filters are not added.

## ADRs

- **0001:** two amendments, the typeface and the grey page.
- **0032:** amended; the F3 screens load on demand.
- **0036:** new, proposed. Table cards with a pill toolbar, `IconChip`, the stat group and tiles, and the modal shape.

## Not verified, and said plainly

- **Nothing against a real API:** no backend could be attached.
- **The font on a real 3G phone.** It is swap over the system stack, measured at 17.9 KB, but not timed on a device.
- **CI on this branch.** It has not run; no pull request was asked for.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F05c-closer-pass.md. ADR 0036 is proposed and
stands until the owner answers.

Attach officialjwise/hakorem_farms_backend as ../backend, run pnpm sync-contract and read the changelog
after 1.17.0. Wire the new getOwnerDashboard fields in apps/console/src/dashboard/figures.ts (each leaves
the "still to come" strip), pass any series to StatTile's `series`, and re-shoot the dashboard. Then F6 as
BUILD_PROMPT describes.
```
