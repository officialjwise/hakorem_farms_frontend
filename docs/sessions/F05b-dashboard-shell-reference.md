# F5b: the dashboard, branches, the shell, shared patterns, labels and reports, matched to the reference

- **Session:** F5b, on branch `claude/busy-ritchie-af3qd6`, stacked on `f05-stock` (which carries F4 and F5, both unmerged).
- **Date:** 2026-11-15
- **Gate:** someone who has never seen the system opens the dashboard and can say what kind of business it is and how it is doing today.
  - **Met against the mock.** `e2e/specs/console/f05b.spec.ts` ("the F5b gate", light and dark, 360 px, axe clean) checks:
    - the business in words ("Livestock, meat and produce trading at HaKorem Farms, Dodowa"), and its best sellers (goat, eggs, beef);
    - sales today against yesterday, stock value at cost, money owed and where the cash is;
    - one `getOwnerDashboard` read;
    - every figure with no data source shown in words, never as a number.
  - **Not against the real API:** the backend could not be attached (see "Not verified").
- **Contract requests went to `main` straight away**, as the owner asked: [officialjwise/hakorem_farms_frontend#8](https://github.com/officialjwise/hakorem_farms_frontend/pull/8) carries CR-009 to CR-018 (CR-009 to CR-012 had been stranded on the F4 and F5 branches).

## The owner's messages, and what each changed

| When        | Asked                                                                                                                                                            | Done                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start       | Five screenshots; layout and density from them, Pine & Sand; tune the accent if AA holds                                                                         | Accent tuned brighter (later reverted, below); panel and sand series tokens; patterns, dashboard, branches, shell, labels                                                                                 |
| Mid-session | Dashboard on **one** `getOwnerDashboard` call; unavailable figures shown as unavailable; branch close refusals from the API; contract requests to `main` at once | `dashboard/figures.ts` names each tile's source. The close refusal is shown in the confirmation. PR #8                                                                                                    |
| Late        | A close copy of the reference: capture it with Playwright first. Accent `#0D5C55` / `#3DBE98`. Add Reports                                                       | Captured 27 screens of the public demo (scratchpad only, not committed). Restyled controls, cards, tables, modals, sidebar and page header (ADR 0035). Accent reverted. Reports section with five reports |

## Task 1: the test fake's roles

- **Real seed not readable:** attaching `hakorem_farms_backend` was refused by the session's permission classifier. So the fake is aligned only on what F5's real-API run proved: the seeded **Cashier holds `iam.session.read` and `iam.session.revoke`** (`0f486e6`).
- **The wrong-role gate:** it no longer expects a cashier to be denied `/sessions`, and a new test checks the cashier opens it.
- **Screens did not move off the mock:** CI and e2e still build against `/mock`, and a full alignment needs the seed (A-F5b-01).

## Built

| Route                                             | Screen                                                                                                                                                                                                                                                          | Permission                                                                      | Reads / writes                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                                               | **Dashboard**: stat row, sales and purchases with comparison cards, stock health on the deep teal panel, needs attention, best sellers, sales by channel (donut), where the cash is, stock by category, invoices, alert lists, near expiry, recent transactions | any signed-in user; content needs `rpt.dashboard.owner`                         | `getOwnerDashboard` only (plus unit names for best sellers)                                          |
| `/branches`, `/branches/:id`                      | **Branches and locations**: list, create, edit, close and reopen (refusal shown in the API's words), locations in the branch, add a location                                                                                                                    | `mdm.branch.read`, `.create`, `.update`; `mdm.location.create`                  | `listBranches`, `getBranch`, `createBranch`, `updateBranch`, `listLocations`, `createLocation`       |
| header                                            | **Branch switcher** that scopes every screen (ADR 0034)                                                                                                                                                                                                         | from session grants                                                             | `branchId` on the 21 reads that take it; `BranchScopeNote` where a list cannot be narrowed (CR-015)  |
| `/labels`                                         | **Labels**: product and lot labels with Code 128 barcodes, copies, a print sheet                                                                                                                                                                                | `mdm.product.read` (lots: `inv.stock.read`)                                     | `listProducts`, `listStockUnits`; drawn in the browser (CR-016)                                      |
| `/reports`, `/reports/:report`                    | **Reports**: sales, purchases, stock valuation, expiry, profit and loss. Each has a date range, a summary row from the API's totals, a table and Export (XLSX, PDF)                                                                                             | `rpt.report.read` (export `rpt.report.export`; P&L `fin.report.read`)           | `runReport` (SCREEN, XLSX, PDF), `getProfitAndLoss`                                                  |
| `/lots`, `/movements`, `/suppliers`, `/registers` | **Lots and expiry, stock movements, suppliers, cash registers**: read-only lists                                                                                                                                                                                | `inv.stock.read`, `inv.movement.read`, `mdm.supplier.read`, `pos.register.read` | `listStockUnits` (with `expiringWithinDays`), `listStockMovements`, `listSuppliers`, `listRegisters` |

**The shell** (ADR 0034, ADR 0035):

- **Sidebar.** The dark teal panel, grouped by job: overview, selling, stock, catalogue, business, reports, people and access. Each group folds; the menu narrows to icons with tooltips; the current item is an outlined pill with its icon on an accent square.
- **Top bar.** Search with Ctrl K, the branch, the till, a theme toggle (system, light, dark), today's exceptions from `listExceptions`, and the account menu with sign out.
- **Page header.** The title, breadcrumbs beneath it, and the primary actions on the right.

**Shared patterns in `packages/ui`** (ADR 0033), each with stories per state and unit tests:

- **Data:** StatTile with trend and unavailable states; LineChart and BarChart (two series, told apart by line style, marker shape or hatching as well as hue, with a figures table); Donut (a marker shape per legend entry); ProgressList; AlertRow.
- **Feedback:** Alert (one severity table shared with Toast); Unavailable; ConfirmChanges (before and after, consequence, failure kept inside, Cancel left and primary right).
- **Layout:** PageHeader with a breadcrumbs slot.
- **Domain:** Barcode (Code 128 B, encoder unit-tested).

**Retrofit of F3, F4 and F5:**

- Every back office page now opens with the new page header and breadcrumbs.
- Success notices are Alerts, and every stock confirmation is ConfirmChanges.
- Controls, cards, tables and modals take the reference's shapes (pill controls, shadowed cards, sentence-case table headers).

**Transfer receiving** (owner's decision): while you type, a line says, for example, "0.400 Kilogram fewer than sent" or "more than sent". This is input feedback only, exact on thousandths (`gapBetween`, unit-tested). The posted variance is still the API's.

## The reference, and what was matched

The owner's latest message asked for a close copy of a commercial pharmacy POS template.

- **Capture.** 27 screens of its public demo were captured with Playwright at 1280 px: dashboard, inventory list, categories with a modal, batch management, stock adjustment and transfer, expiry tracking, low stock, inventory logs, POS, customers, invoices, payments, expenses, bank accounts, cash register, users, roles, the reports hub, sales, purchase, stock valuation, expiry and profit and loss reports, business and branch settings.
  - Reaching it needed the environment to allow `dreamspos.dreamstechnologies.com`; the owner approved that change.
  - The captures are in the session scratchpad, not the repository.
- **Matched:**
  - card and tile shape (border, soft shadow, about 10 px radius, bold figure, tinted trend pill);
  - table card (toolbar inside the card, sunken sentence-case header, roomy rows, pill badges with a dot);
  - pill buttons and inputs; modal header, body and footer;
  - the dark full-height sidebar with outlined active pill; the page header with breadcrumbs beneath.
- **Not copied:** code, icons, fonts, images or copy (the first brief, and the template's licence). Blue and purple became `accent` and `series-2`.
- **Not matched yet:**
  - the stat tiles' sparklines (no series from the API, CR-013);
  - the toolbar's Columns and Sort by menus;
  - "Go to page" pagination;
  - an icon well in each modal title;
  - a settings section (out of this phase).

## Menus: added and rejected

- **Added:**
  - lots and expiry (batch management and expiry tracking together);
  - stock movements (inventory logs);
  - suppliers; cash registers;
  - branches and locations; labels;
  - reports.
- **Already ours:** stock transfer, stock adjustment, roles and permissions.
- **Deferred:**
  - sales returns: F9, with returns against a receipt;
  - expenses: no contract operation, so finance in F8 or F12;
  - bank accounts and customers: their phases.
- **Rejected:** prescriptions, prescription verification and doctors (not a farm's).

## FilePurpose's new EXPORT value

- **Checked:** nothing in the console reads `FilePurpose`, and the generated client validates no response at run time. So EXPORT itself breaks nothing.
- **Found:** every status badge indexed a `Record` with the server's enum, so any value this build does not know would have given `undefined` and crashed the screen on `.tone`.
- **Fixed** (`b51c9a6`): `lib/lookup.ts` answers an unknown value with a slate badge, a question mark and the raw code. It is unit-tested with EXPORT, and now used by every status badge and the new screens.

## Palette (ADR 0001, two amendments)

- **Accent:** first tuned to `#0A7468` / `#2EC4A6`, the brightest AA allowed. Then, at the owner's explicit instruction, **reverted to `#0D5C55` / `#3DBE98`**.
- **New tokens:**
  - `panel` (`#0C3A35`), a dark-theme island checked in the dark theme only;
  - `series-2` (sand, `#9A6418` / `#DDAA5E`), so there is still one accent;
  - two decorative area tints.
- **Contrast:** 219 tests pass. The panel carries no bordered control (`border-strong` is 2.6:1 on it).

## Assumed this session

A-F5b-01 to 09 in `docs/ASSUMPTIONS.md`:

- the seed was not readable;
- the dashboard reads one endpoint;
- the sales arrow compares two API integers and computes no percentage;
- the dashboard is everyone's start page;
- the branch choices come from the session's grants, per browser;
- the test owner holds the farm, KAS and KNU;
- labels are drawn in the browser;
- the menus added and rejected;
- receiving shows the gap as input feedback.

## Checks at the tip

Each run on its own, exit code recorded.

| Check                                                               | Exit            | Result                                                                                                            |
| ------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0               |                                                                                                                   |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0               | icons regenerated for the palette; contract 1.17.0                                                                |
| `test:unit`                                                         | 0               | ui 776, console 152, data 28, api-client 24, storefront 14, i18n 6                                                |
| `test:a11y` (every story, axe)                                      | 0               | 272                                                                                                               |
| `test:integration`                                                  | 0 after the fix | 180. Before the fix 3 failed: the first case per file waited longer than 1 s for a cold screen; it now allows 5 s |
| `build:console`, `budget:console`                                   | 0               | back office 282.3 of 300 kB initial (was 270.6); till 201.0 of 250 kB                                             |
| `test:e2e`                                                          | see below       |                                                                                                                   |
| `pnpm screenshots` (F05b)                                           | 0               | 52 shots                                                                                                          |

## Screenshots

Production build on the mock, signed in as the owner, light theme unless named dark.

**Which dashboard tiles were live when shot:** none. Every figure in these shots is the contract's mock example (Prism). The tiles that show a number are the ones contract 1.17.0 carries:

- sales today and yesterday;
- sales this month;
- stock value at cost;
- receivables;
- cash;
- sales by channel;
- best sellers;
- alerts and exceptions.

**Every other tile is shown unavailable**, because 1.17.0 does not carry its field (CR-013):

- purchases today; low stock; animals on hand;
- the series and purchases this month;
- stock health; stock by category;
- the three alert lists and near expiry;
- invoices;
- recent transactions and the payment split.

The owner says stock value, animals on hand, low stock and the purchases series are live in B05x. They will show once that contract is synced, which this session could not do.

**Reports on the mock:** Prism answers every report code with its one example (mortality by pen), so each report shows those columns until CR-018 gives each code an example.

**Dashboard: the gate. The business in words, best sellers, sales against yesterday, stock, money owed, cash; unavailable figures in words.**

![dashboard at 1280](../screenshots/F05b/dashboard-1280.png) ![dashboard at 360](../screenshots/F05b/dashboard-360.png)

**Dashboard, dark theme: the deep teal panel holds.**

![dashboard-dark at 1280](../screenshots/F05b/dashboard-dark-1280.png) ![dashboard-dark at 360](../screenshots/F05b/dashboard-dark-360.png)

**Branches and locations: status in words.**

![branches at 1280](../screenshots/F05b/branches-1280.png) ![branches at 360](../screenshots/F05b/branches-360.png)

**A branch: facts, close or reopen, its locations.**

![branch at 1280](../screenshots/F05b/branch-1280.png) ![branch at 360](../screenshots/F05b/branch-360.png)

**New branch: the reference's modal shape: bold title, round close, labels above pill fields.**

![branch-new-modal at 1280](../screenshots/F05b/branch-new-modal-1280.png) ![branch-new-modal at 360](../screenshots/F05b/branch-new-modal-360.png)

**Closing a branch: exactly what changes, the server may refuse; Cancel left, primary right.**

![branch-close-modal at 1280](../screenshots/F05b/branch-close-modal-1280.png) ![branch-close-modal at 360](../screenshots/F05b/branch-close-modal-360.png)

**Reports: the five reports.**

![reports at 1280](../screenshots/F05b/reports-1280.png) ![reports at 360](../screenshots/F05b/reports-360.png)

**Sales report: summary row from the API's totals, range toolbar inside the table card, export (mock answers with its one example).**

![report-sales at 1280](../screenshots/F05b/report-sales-1280.png) ![report-sales at 360](../screenshots/F05b/report-sales-360.png)

**Stock valuation (STOCK_ON_HAND).**

![report-stock-valuation at 1280](../screenshots/F05b/report-stock-valuation-1280.png) ![report-stock-valuation at 360](../screenshots/F05b/report-stock-valuation-360.png)

**Profit and loss from the ledger.**

![report-profit-and-loss at 1280](../screenshots/F05b/report-profit-and-loss-1280.png) ![report-profit-and-loss at 360](../screenshots/F05b/report-profit-and-loss-360.png)

**Labels: products and lots to choose from.**

![labels at 1280](../screenshots/F05b/labels-1280.png) ![labels at 360](../screenshots/F05b/labels-360.png)

**Labels: the print sheet with Code 128 barcodes.**

![labels-sheet at 1280](../screenshots/F05b/labels-sheet-1280.png) ![labels-sheet at 360](../screenshots/F05b/labels-sheet-360.png)

**Lots and expiry: the reference's table card.**

![lots at 1280](../screenshots/F05b/lots-1280.png) ![lots at 360](../screenshots/F05b/lots-360.png)

**Stock movements (the inventory log).**

![movements at 1280](../screenshots/F05b/movements-1280.png) ![movements at 360](../screenshots/F05b/movements-360.png)

**Suppliers.**

![suppliers at 1280](../screenshots/F05b/suppliers-1280.png) ![suppliers at 360](../screenshots/F05b/suppliers-360.png)

**Cash registers, scoped to the header's branch.**

![registers at 1280](../screenshots/F05b/registers-1280.png) ![registers at 360](../screenshots/F05b/registers-360.png)

**Receiving a transfer: the gap shown while typing.**

![transfer-receive-gap at 1280](../screenshots/F05b/transfer-receive-gap-1280.png) ![transfer-receive-gap at 360](../screenshots/F05b/transfer-receive-gap-360.png)

**Stock on hand, retrofitted.**

![stock-on-hand at 1280](../screenshots/F05b/stock-on-hand-1280.png) ![stock-on-hand at 360](../screenshots/F05b/stock-on-hand-360.png)

**Stock takes, retrofitted.**

![stock-takes at 1280](../screenshots/F05b/stock-takes-1280.png) ![stock-takes at 360](../screenshots/F05b/stock-takes-360.png)

**Transfers, retrofitted, with the branch note (CR-015).**

![transfers at 1280](../screenshots/F05b/transfers-1280.png) ![transfers at 360](../screenshots/F05b/transfers-360.png)

**Goods receipts, retrofitted.**

![goods-receipts at 1280](../screenshots/F05b/goods-receipts-1280.png) ![goods-receipts at 360](../screenshots/F05b/goods-receipts-360.png)

**Products, retrofitted.**

![products at 1280](../screenshots/F05b/products-1280.png) ![products at 360](../screenshots/F05b/products-360.png)

**Price lists, retrofitted.**

![price-lists at 1280](../screenshots/F05b/price-lists-1280.png) ![price-lists at 360](../screenshots/F05b/price-lists-360.png)

**Users, retrofitted.**

![users at 1280](../screenshots/F05b/users-1280.png) ![users at 360](../screenshots/F05b/users-360.png)

**Roles, retrofitted.**

![roles at 1280](../screenshots/F05b/roles-1280.png) ![roles at 360](../screenshots/F05b/roles-360.png)

**Sessions, retrofitted.**

![sessions at 1280](../screenshots/F05b/sessions-1280.png) ![sessions at 360](../screenshots/F05b/sessions-360.png)

## Not verified, and said plainly

- **Nothing against a real API.** `hakorem_farms_backend` could not be attached, so no sync past 1.17.0 and no B05x dashboard shape. No screen moved off the mock.
- **No real phone or printer:** labels were checked on screen, not printed or scanned.
- **The two-series charts are built, tested and in Storybook, but not on the dashboard yet:** their series come with CR-013.
- **A real refusal code for closing a branch:** the mock's 422 is a generic example (CR-017).
- **CI has not run remotely.**

## Contract

- **Synced:** not possible (no `../backend`). Contract 1.17.0.
- **Screens moved from the mock to the real API:** none.
- **Added to `docs/CONTRACT_REQUESTS.md`,** and to `main` through PR #8:
  - CR-013 (dashboard figures and their `unavailable` list);
  - CR-014 (moving a location between branches);
  - CR-015 (`branchId` on seven lists);
  - CR-016 (product and lot labels);
  - CR-017 (branch close refusal codes);
  - CR-018 (report codes and examples).
- **Still open:** CR-005, CR-009 to CR-018.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F05b-dashboard-shell-reference.md. Do not reopen
docs/adr/ (0033 to 0035 are proposed and stand until the owner answers).

Attach officialjwise/hakorem_farms_backend as ../backend, run ./scripts/sync-contract.sh and read the
changelog after 1.17.0. Then:
1. Wire the B05x getOwnerDashboard fields into apps/console/src/dashboard/figures.ts and read the
   response's unavailable list; re-shoot the dashboard and name which tiles were live.
2. Align apps/console/src/test/fakeAuthServer.ts with the real seeded roles in full.
3. Then F6 as BUILD_PROMPT describes.
```
