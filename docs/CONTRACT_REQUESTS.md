# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status                   |
| ------ | ---------- | ------------------------ |
| CR-001 | 2026-11-13 | Closed                   |
| CR-002 | 2026-11-13 | Closed                   |
| CR-003 | 2026-11-14 | Answered (1.7.0, 1.16.0) |
| CR-004 | 2026-11-14 | Answered (1.2.0, 1.11.0) |
| CR-005 | 2026-11-14 | Open                     |
| CR-006 | 2026-11-14 | Answered (1.2.0, 1.4.0)  |
| CR-007 | 2026-11-14 | Answered (1.3.0)         |
| CR-008 | 2026-11-14 | Answered (1.3.0)         |
| CR-009 | 2026-11-15 | Open                     |
| CR-010 | 2026-11-15 | Open                     |
| CR-011 | 2026-11-15 | Open                     |
| CR-012 | 2026-11-15 | Open                     |
| CR-013 | 2026-11-15 | Open                     |
| CR-014 | 2026-11-15 | Open                     |
| CR-015 | 2026-11-15 | Open                     |
| CR-016 | 2026-11-15 | Open                     |
| CR-017 | 2026-11-15 | Open                     |
| CR-018 | 2026-11-15 | Open                     |
| CR-019 | 2026-11-15 | Open                     |
| CR-020 | 2026-11-15 | Open                     |
| CR-021 | 2026-11-15 | Answered (1.26.0)        |
| CR-022 | 2026-11-15 | Open                     |
| CR-023 | 2026-11-15 | Open                     |
| CR-024 | 2026-11-15 | Open                     |
| CR-025 | 2026-11-15 | Open                     |
| CR-026 | 2026-11-15 | Open                     |

## CR-001. Stock valuation is at cost, and cost and price are never the same field

- **Raised by:** frontend F0, from the Table reference story; owner review
- **Needed by:** F5 stock on hand, goods receipt and stock take; F12 owner dashboard (stock value) and reports
- **What happened:** the F0 Table story labelled its footer "Stock value at cost", but its figures were retail selling prices. The story fixture is now corrected. The same mistake must not be possible in the API.

**Request**

1. Every stock-on-hand line and every stock valuation figure carries its **cost** explicitly, in integer pesewas, under a name that says cost.
   - `unitCostPesewas`: specific identification for serialised animals, weighted average cost for lots and countable units.
   - `valueAtCostPesewas`: unit cost times on-hand quantity, computed by the backend.
2. Any **selling price** the same screen needs (a price band, a list price, a resolved price) comes in separately named fields, for example `listPricePesewas` or a `priceBand` object. Cost and price are never the same field, and never one field whose meaning depends on context.
3. Totals such as "Stock value at cost" come from the API as their own field, for example `totalValueAtCostPesewas` on the list response. The frontend never sums rows, per the no-business-calculation rule.
4. The response states the valuation basis and its as-of time, for example `valuationMethod: "weighted_average" | "specific_identification"` per line and `asOf` as a UTC timestamp, so the screen can label the figure honestly.

**Until this lands:** F5 screens build against a local mock override with exactly these field names. They switch to the real API once the contract carries them.

**Found in F5 (2026-11-15):** contract 1.1.0 already carries all four points: `StockOnHandLine.unitCostPesewas`, `valueAtCostPesewas`, `valuationMethod` and a separate `priceBand`; `StockOnHandPage.totalValueAtCostPesewas` and `asOf`. No override was needed. The owner may close this.

## CR-002. Money as integer pesewas, weight as kilogram decimal strings

- **Raised by:** frontend F0, from `formatMoney` and `formatWeight` (frontend ADR 0007)
- **Needed by:** every screen that shows money or weight, from F4 onward
- **Closed 2026-11-13 by the owner: answered before it was raised.** No contract change was needed.

**Answer.** Contract 1.0.0 already had both shapes, and 1.1.0 still does. 1.1.0 is now in `contract/openapi.yaml`, copied from backend `f437489`; the contract last changed at `bb63f93`. The backend changelog lists this request under "Requests answered without a change".

- **`Kilograms`:** `type: string` with pattern `^(0|[1-9][0-9]{0,6})\.[0-9]{3}$`, exactly three places. Its description says it is never a JSON number.
- **`Pesewas`:** `type: integer`, `format: int64`, from 0 to 9007199254740991, never a float. No amount exceeds 2^53 − 1, so no field needs a string form.
- **Values that do not apply:** `anyOf: [<schema>, { type: "null" }]`.

**Why it was raised.** The frontend had no copy of the contract at the time. This request was written from ADR 0007 without checking the contract. Read `contract/openapi.yaml` before raising a request.

**What the frontend takes from the answer** (none of it needs a change to the formatters):

- **Weight shape:** `Kilograms` always has exactly three places and no sign. `formatWeight` accepts that and more (one to three places, a leading minus).
- **Money sign:** `Pesewas` is never negative, and direction travels in a separate field. A negative amount on screen comes from that field, never from the number.
- **Null:** a null does not always mean "does not apply". Some fields give it a meaning; for example, a null `thresholdPesewas` means approval is always needed. Read the field's description before rendering null as an en dash.

**Original request**

**Request**

1. **Money** is serialised as integer pesewas in a JSON number, for example `123450` for GHS 1,234.50. It never appears as a decimal or a pre-formatted string. If any amount can exceed 2^53 − 1 pesewas, that field is a decimal-digit string such as `"123450"`, and the contract says so per field.
2. **Weight** is serialised as a kilogram decimal string with at most three places, matching `NUMERIC(10,3)`, for example `"38.400"` or `"38.4"`. It is never a JSON float, which cannot represent most three-place values exactly. The capture source (scale, manual or estimate) travels alongside it, as the shared brief requires.
3. **Nulls:** a value that does not apply is `null`, not `0` and not an empty string. The frontend renders `null` as an en dash and `0` as zero.

**Why:** the frontend formats without float arithmetic or locale lookup. `formatMoney` refuses non-integers and `formatWeight` refuses anything but a decimal string, so a contract that sends floats fails loudly in the frontend's tests rather than showing a rounded figure.

## CR-003. A unit of measure declares its display precision

- **Raised by:** frontend F0c, from the owner's quantity decision (frontend ADR 0007, 2026-11-14)
- **Needed by:** F5 stock on hand, goods receipt, transfers and stock take; F7 storefront quantities; F12 reports
- **Contract read first:** `Uom` (`#/components/schemas/Uom`) is `{ code, name, kind }`, with `kind` one of COUNT, WEIGHT, VOLUME. It has no decimal places. `Quantity` and `SignedQuantity` are always three-place strings, and the stock schemas (`StockUnit`, `StockOnHandLine`) carry `uom` as a plain code string such as `HEAD` or `KG`, not as a `Uom` object.

**Request**

1. Add `displayDecimals` to `Uom`: an integer from 0 to 3, the number of decimal places a quantity in that unit is shown with. Zero for countable units (head, crates, tubers, packs), three for weight and volume. Required, so a unit cannot omit it.
2. Make it reachable from a stock line without a second lookup, for example by returning the `Uom` object (or `uomDisplayDecimals`) beside the `uom` code on `StockUnit`, `StockOnHandLine`, and any other schema that carries a `Quantity` and a `uom`. A list screen should not fetch the unit list just to format a column.

**Why:** the frontend formats and never decides business rules. Precision follows the unit, so the unit has to say what it is. The wire format keeps three places regardless.

**Until this lands:** screens pass `places` to `QuantityDisplay` from a local mock override: 0 for a COUNT unit, 3 for WEIGHT or VOLUME. That mapping lives in the mock and in the screen's adapter, never in `packages/ui`, which takes `places` as a required prop. The guard in `formatQuantity` means a value with a stray fraction still shows it, so a wrong override cannot hide a half crate.

## CR-004. Three gaps in the staff sign-in flow (clarifications, not breaking changes)

- **Raised by:** frontend F1, from building the auth screens against a stub
- **Needed by:** F3 (login against the real API)
- **Contract read first:** `loginStaff`, `verifyTotp`, `refreshSession`, `changePassword`, `resetPassword`, `LoginResult`, `SessionInfo`, `ErrorBody`, and `backend/docs/API.md` sections 3.1, 3.3, 3.4 and 10.3.

**1. How the first-login password change authenticates.** `LoginResult.status = PASSWORD_CHANGE_REQUIRED` says "anything other than AUTHENTICATED needs one more step before a session exists" and returns a `challengeToken`. API.md 3.1 says the client "asks for a new password and calls `POST /auth/password/change`". But `changePassword` is secured by `staffSession` and needs `X-CSRF-Token`, and its request has no `challengeToken`. With no session, a client has nothing to authenticate that call with. Please state which it is: (a) a restricted session and cookies are issued for this status (and `SessionInfo.mustChangePassword` is true), or (b) `changePassword` also accepts a `challengeToken`. The stub takes (b) (assumption A-F1-04). The 403 `PASSWORD_CHANGE_REQUIRED` code in API.md 10.3 suggests (a).

**2. What follows a successful change.** `changePassword` answers 204. Say whether the caller is signed in afterwards (new cookies) or must sign in again. The frontend assumes sign in again (A-F1-03).

**3. An invalid or expired reset code.** `resetPassword` lists only the generic 422 `BusinessRuleViolation`. Name the `ErrorBody.code` for a wrong, used or expired reset token, so the screen can say which. Until then the screen shows the server's own safe message for any code it does not know.

**Not a request, noted:** `TOTP_ENROLMENT_REQUIRED` and `VERIFICATION_REQUIRED` are handled by F3 and F7. The stub never returns them, and the console shows "this sign-in step is not available yet" if the real API does first.

**Until this lands:** the stub's behaviour above, behind `apps/console/src/auth/client.ts`.

## CR-005. Every list response gets a named empty example (additive, not breaking)

- **Raised by:** frontend F2, the data layer and its integration tests
- **Needed by:** every screen session from F3: each screen ships an empty state, and the mock is how it is seen and tested before the backend module is live
- **Checked:** `contract/openapi.yaml` 1.1.0 gives every list operation (for example `listProducts`) a single `example` with five or more rows, and no operation has an `examples` map. Prism answers a request with that one example whatever the query, and `Prefer: example=<name>` only works for a named example. So the mock cannot return an empty list, and the empty state of a screen cannot be exercised against it.

**Request**

For each list operation's 200 response, replace the single `example` with an `examples` map holding the current rows under `default` and an `empty` example with `data: []` and `page: { nextCursor: null, limit: <the default limit>, hasMore: false }`. The first screens need it for `listProducts`, `listCategories`, `listUsers`, `listRoles` and `listStockOnHand`; the rest can follow with each module.

- **Not breaking:** an `examples` map is documentation. No schema or field changes, so this is a patch or minor version.
- **Until this lands:** the F2 integration test (`apps/console/src/data/states.integration.test.tsx`) shows the empty state from a successful answer with no rows, and says so in its header. The frontend can then call Prism with `Prefer: example=empty`, and the test is simplified.

## CR-006. How TOTP enrolment authenticates during first sign-in (clarification)

- **Raised by:** frontend F3, from `TOTP_ENROLMENT_REQUIRED`
- **Needed by:** the TOTP enrolment screen (deferred from F3, A-F3-13)
- **Contract read first:** `LoginResult` (`TOTP_ENROLMENT_REQUIRED`, `challengeToken`, `session: null`), `startTotpEnrolment` and `confirmTotpEnrolment` (both `staffSession` and `X-CSRF-Token`, neither takes a challenge token), and API.md 3.4 ("needs a session or, during first login, the challenge").

**Request:**

1. Say which it is. (a) `TOTP_ENROLMENT_REQUIRED` issues a restricted session and cookies, so the two calls work as written; or (b) both calls accept the `challengeToken` (for example in the body), with no CSRF token because there is no session yet. This is the same question as CR-004 point 1 for the forced password change, and one answer can cover both.
2. **Return the QR code as a data URI in the enrolment response** (added 2026-11-14, owner decision: the frontend takes no QR code dependency). `TotpEnrolment` gains a field beside `otpauthUri` and `secretBase32`, for example `qrCodeDataUri`, holding an image of `otpauthUri` (`data:image/svg+xml;base64,…` or `data:image/png;base64,…`), with an example. The screen shows it in an `<img>` with a text alternative, and keeps `secretBase32` on screen for a phone that cannot scan. Additive. The owner has asked B3 for it.

**Status:** answered by the contract (option b: `startTotpEnrolment` and `confirmTotpEnrolment` take the `challengeToken` in the body during sign-in, and `TotpEnrolment.qrCodeDataUri` carries the QR image). **Built in F6b:** `/login/enrol`, in both documents, on demand.

## CR-007. Mark step-up operations in a machine-readable way (additive)

- **Raised by:** frontend F3, from the users, roles and grants screens
- **Needed by:** every screen that writes through a step-up operation (F3 now, F8, F12 and others later)
- **Contract read first:** step-up is stated only in prose, as "Requires step-up: a TOTP code entered within the last five minutes on this session" in an operation's `description`.

**Request:** add `x-requires-step-up: true` beside `x-permission` on each operation whose description says it requires step-up. The generated operation table will then carry it, so a screen can ask for the code before the write instead of after a 403 `STEP_UP_REQUIRED`, and the frontend's test fake can stop listing the six F3 operations by hand. Additive: no schema changes.

**Until this lands:** screens send the write first and handle the 403 (A-F3-07).

## CR-008. Example rows repeat their ids (example fix)

- **Raised by:** frontend F3, the new-user and add-role forms
- **Checked:** the `listBranches` 200 example lists the three branches (DDW, TST, KSI) twice, with the same ids.

**Request:** give each example row its own id, or drop the repeats. A real answer never repeats a row, but the mock serves the example as the answer, and a choice list built from it shows each branch twice. Example only; nothing changes for a generated client.

**Until this lands:** option lists are made unique by id (`uniqueById`), which costs nothing against the real API.

## CR-009. Preview a draft price list version against the one in force (additive)

- **Raised by:** frontend F4, the price list version screen (the F4 gate)
- **Needed by:** `/price-list-versions/:id` for any list longer than 500 lines
- **Contract read first:** `getPriceListVersion`, `listPriceListEntries` (cursor pages, at most 100 a page), `submitPriceListVersion`, `resolvePrices` (its `at` defaults to now and it walks active versions only; it cannot price from a draft).

**Request:** `GET /price-list-versions/{id}/preview` (permission `mdm.price_list.read`), answering cursor pages of lines with `kind` (`ADDED`, `CHANGED`, `REMOVED`, `UNCHANGED`), `current` (a `PriceListEntry` or null) and `proposed` (a `PriceListEntry` or null), plus `counts` for the four kinds and the `PriceListVersionSummary` it was compared against. Optionally, `resolvePrices` could accept a `priceListVersionId` so a sample basket can be priced as the draft would price it.

**Why:** the screen now reads both versions whole (at most five pages of 100 each, ADR 0028) and lines them up by product, grade, band and quantity break. Past 500 lines it shows words and no preview, because a partial one would show a missing line as a dropped price (A-F4-02). The server already knows the identity rule.

**Until this lands:** the screen's comparison, `apps/console/src/pricing/preview.ts`, which compares and never computes.

## CR-010. Price list examples contradict each other (example fix)

- **Raised by:** frontend F4
- **Checked:** the `getPriceList` example gives `activeVersion.id` `019a7aa3-e9f0-…`, which the `listPriceListVersions` and `getPriceListVersion` examples give as version 5, status `DRAFT`, the same list's `draftVersionId`. Every version's entries example is the same eight lines.

**Request:** make `getPriceList.activeVersion` version 4 (`019a7aa4-46bd-…`, the example's ACTIVE one), and if possible give the draft's entries a changed price, so the mock alone shows a preview with a change. Example only.

**Until this lands:** against the mock the preview says no version is in force and every line is new; the end-to-end gate rewrites the two answers for its test only (`api.rewrite` in `e2e/support/fakeApi.ts`).

## CR-011. Units of measure: conversions, and a way to add one (question)

- **Raised by:** frontend F4, the units screen
- **Contract read first:** `listUnitsOfMeasure` and `Uom` (`code`, `name`, `kind`). There is no create, update or conversion operation, and no conversion on any schema.
- **The brief says:** "units of measure with conversions" (MDM).

**Request:** say whether units are seeded only (then the screen stays read only, as now), and how a conversion is represented, for example a crate of 30 eggs, or a pack's nominal kilograms. If conversions exist, list them on `Uom` or a `listUomConversions` operation. CR-003 (`displayDecimals`) is still open on the same schema.

**Until this lands:** `/units` is a read-only list (A-F4-05).

## CR-012. The counting stock take's lines show the expected quantity (example fix)

- **Raised by:** frontend F5, the stock take screen
- **Checked:** `StockTakeLine.expectedQty` says "Null while counting: the count is blind", but the `listStockTakeLines` example, served for the `getStockTake` example in status COUNTING, gives every line an `expectedQty`.

**Request:** give the counting example's lines `expectedQty: null` (and `varianceQty`, `varianceValuePesewas`, `varianceDirection` null), or say in the description which statuses carry it. Example only.

**Until this lands:** the screen never shows `expectedQty` while counting, whatever the API sends (A-F5-02).

## CR-013. The owner dashboard's figures, in one response, saying which have no data source yet (additive)

- **Raised by:** frontend F5b, the dashboard (`/`)
- **Contract read first (1.17.0):** `getOwnerDashboard` returns `salesTodayPesewas`, `salesYesterdayPesewas`, `salesMonthToDatePesewas`, `salesByChannel`, `cash`, `stockValueAtCostPesewas`, `receivablesOutstandingPesewas`, `receivablesOverduePesewas`, `topMovers`, `alerts`, `exceptionsToday`. Nothing else the dashboard shows is in it.
- **The owner's rule (2026-11-15):** the dashboard makes **one** call, `getOwnerDashboard`, not one per tile. The response names the figures that have no data source yet, and the screen shows those as unavailable, never as zero. The backend is bringing this forward into B05x; when B8, B9a and B9b go live the contract does not change, only the list of unavailable figures shrinks.

**Request:** add to `OwnerDashboard`, with a `period` query parameter (`WEEK` for the last seven days, `MONTH` for the last thirty, default `WEEK`):

| Field                                                | Shape                                                                                                                            | Tile                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `unavailable`                                        | array of `DashboardFigure`, an enum of the field names below plus the 1.17.0 ones                                                | every tile: listed means "no data source yet", shown in words         |
| `purchasesTodayPesewas`, `purchasesYesterdayPesewas` | `Pesewas`                                                                                                                        | purchases today                                                       |
| `change`                                             | object keyed by figure: `{ direction: UP \| DOWN \| FLAT, percent: string \| null, comparedWith: YESTERDAY \| PREVIOUS_PERIOD }` | the arrow and words on each stat tile (the client computes no change) |
| `animalsOnHand`                                      | `{ count: integer, bySpecies: [{ species: SpeciesRef, count }] }`                                                                | animals on hand                                                       |
| `stockHealth`                                        | `{ lowStockCount, availableCount, outOfStockCount }`, product counts                                                             | low stock tile and the stock health panel                             |
| `stockByCategory`                                    | `[{ category: CategoryRef, productCount, valueAtCostPesewas }]`                                                                  | stock by category bars                                                |
| `series`                                             | `[{ date, salesPesewas, purchasesPesewas }]` for the period, one row per day                                                     | sales and purchases chart                                             |
| `periodTotals`                                       | `{ salesPesewas, purchasesPesewas }` with `change` as above                                                                      | the two comparison cards under the chart                              |
| `stockAlerts`, `expiringLots`, `expiredLots`         | the first five `StockAlert` rows each, plus `count`                                                                              | the three alert lists (each row links to its record)                  |
| `nearExpiryByMonth`                                  | `[{ month: "YYYY-MM", lotCount, valueAtCostPesewas }]`, the next four months                                                     | near-expiry chart                                                     |
| `invoices`                                           | `{ total, paid, overdue }`, each `{ count, grossPesewas }`                                                                       | the three invoice tiles                                               |
| `recentPayments`                                     | the last five `Payment` rows (or a summary: `paymentNo`, `method`, `amountPesewas`, `customer`, `receivedAt`)                    | recent transactions                                                   |
| `paymentMethodSplit`                                 | `[{ method: PaymentMethodRef, amountPesewas, count }]` for today                                                                 | the payment method split                                              |

Field names are a suggestion; the frontend will read whatever B05x names them. What matters is one response, a figure per tile, and the `unavailable` list.

**Until this lands:** the dashboard calls `getOwnerDashboard` once. Each tile names its field in one table (`apps/console/src/dashboard/figures.ts`). A tile whose field is not in the contract yet shows the unavailable state ("No data source yet"), never a number. When the contract carries the fields and `unavailable`, wiring a tile is one line in that table.

## CR-014. A location can move to another branch, or the contract says it cannot (question)

- **Raised by:** frontend F5b, branch management (`/branches/:id`, "Locations in this branch")
- **Contract read first:** `LocationCreate` takes `branchId`; `LocationUpdate` (`version`, `name`, `parentId`, `isSellable`, `tempMinC`, `tempMaxC`, `capacityHead`) does not.

**Request:** add `branchId` to `LocationUpdate`, refused with a 422 code while the location holds stock, or say in its description that a location never changes branch.

**Until this lands:** the branch screen assigns locations by creating them in the branch (`createLocation` with `branchId`). It does not offer to move an existing location.

## CR-015. A branch filter on the lists the header's branch switcher must scope (additive)

- **Raised by:** frontend F5b, the branch switcher in the console header, which scopes every screen to one branch (selling points at Kasoa and KNUST beside the farm)
- **Contract read first:** 21 reads take `branchId` (`getOwnerDashboard`, `listStockOnHand`, `listStockAlerts`, `listLocations`, `listExceptions` and others). These do not: `listStockTransfers`, `listStockAdjustments`, `listGoodsReceipts`, `listStockTakes`, `listPayments`, `listBillingDocuments`, `listAuditEvents`.

**Request:** an optional `branchId` query parameter on each, matching the 21 that have one. A transfer matches when either end is in the branch.

**Until this lands:** those lists show every branch the user may see, and say so under the title ("All branches: this list cannot be narrowed to one branch yet"). Their new-document forms offer only the chosen branch's locations, from `listLocations?branchId=`.

## CR-016. Labels for products and lots, not only packs (additive)

- **Raised by:** frontend F5b, the labels screen (`/labels`), for the POS counter and the cold room
- **Contract read first:** `printPackLabels` (`POST /processing-orders/{id}/labels`, `LabelPrintRequest` with `packIds` and `format`, answered with a `SignedUrl`) prints packs made by a processing order. `Product.barcode` and `StockUnit.identifier` exist; nothing prints a label for a product or a received lot.

**Request:** `POST /labels` with `{ productIds?, stockUnitIds?, copies, format }`, answered with a `SignedUrl` to a PDF, so label printing is server rendered, archived and audited like every other document.

**Until this lands:** the labels screen draws each label in the browser from `Product.barcode` (or `sku`) and `StockUnit.identifier` as a Code 128 barcode, and prints with the browser's print dialog. Nothing is written to the API.

## CR-017. Name the refusals for closing a branch (clarification)

- **Raised by:** frontend F5b, closing a branch (`/branches/:id`)
- **Contract read first:** `updateBranch` with `status: CLOSED` answers 422 with the generic `BusinessRuleViolation` example (a goat on a withdrawal hold). No code is named for closing a branch.
- **The owner's rule (2026-11-15):** closing can be refused, for example when it is the last active branch. The client must not pre-empt that; it shows the server's refusal.

**Request:** list the 422 codes `updateBranch` returns when closing, such as `LAST_ACTIVE_BRANCH`, `BRANCH_HAS_OPEN_SHIFTS` and `BRANCH_HOLDS_STOCK`, each with an example, so the mock can show the real refusal.

**Until this lands:** the confirmation shows whatever the server sends, its `message` and its reference. Nothing is checked in the client.

## CR-018. Report codes for the five owner reports (additive)

- **Raised by:** frontend F5b, the reports section (`/reports`)
- **Contract read first:** `runReport` (`POST /reports/{code}/run`) runs any report by code, with SCREEN, PDF or XLSX output and a `TabularResult` carrying the API's own `totals`. The `listReportDefinitions` example names STOCK_ON_HAND, AGEING_STOCK, EXPIRING_LOTS, MORTALITY_RATE, FEED_CONVERSION, DELIVERY_PERFORMANCE, SALES_BY_CASHIER and CUSTOMER_LIST. It has no sales summary and no purchases report. Profit and loss is `getProfitAndLoss`.

**Request:**

- Define a `SALES_SUMMARY` report (sales by day, channel and payment method, with totals) and a `PURCHASES` report (goods received and supplier invoices in a period, with totals).
- Confirm that STOCK_ON_HAND and EXPIRING_LOTS take `from`, `to` and `branchId`.
- Give `runReport` an example per code, so the mock shows each report's own columns. Today every code answers with the MORTALITY_RATE example.

**Until this lands:** sales uses SALES_BY_CASHIER and purchases asks for PURCHASES. Against the mock, every report shows the mortality example's columns, and the report says nothing it does not have.

## CR-019. Server-side sort on products, stock on hand, lots and movements (additive)

- **Raised by:** frontend F5c, the table card's Sort menu (ADR 0036), on the owner's instruction
- **Contract read first:**
  - `listProducts`, `listStockOnHand`, `listStockUnits` and `listStockMovements` take filters, `cursor` and `limit`, and no sort parameter.
  - Their order is the server's own: newest first for movements, unstated for the others.
  - No list operation in 1.17.0 takes a sort.
- **What happens today:**
  - Sort by orders only the page on screen, and the menu says so: "Sorts the rows on this page. Search and filters reach the whole list."
  - With more than one page, a sorted page is not the start of the sorted list. The owner accepts that only while the label says it.

**Request:** on these four operations, `sort` (a field name from a fixed, documented list per operation) and `direction` (`asc` or `desc`), applied before paging, so cursors walk the sorted list.

| Operation            | Fields worth sorting by                                            |
| -------------------- | ------------------------------------------------------------------ |
| `listProducts`       | `name`, `sku`, `category`, `status`, `updatedAt`                   |
| `listStockOnHand`    | product `name`, location `name`, `onHandQty`, `valueAtCostPesewas` |
| `listStockUnits`     | product `name`, `identifier`, `expiresOn`, `valueAtCostPesewas`    |
| `listStockMovements` | `occurredAt`, product `name`, `valuePesewas`                       |

- **Errors:** an unknown field is a 400 with a code, not silently ignored.
- **Examples:** each operation's example shows the default order it uses when `sort` is absent.

**Until this lands:**

- Sort stays on the page on screen, with its label.
- When a sort parameter appears in a synced contract, the Sort menu sends it for that list and the label goes.

## CR-020. A named in-review example for a stock take's lines (examples only)

- **Raised by:** frontend F6, the F5 stock take gate (`e2e/specs/console/stock.spec.ts`), after syncing 1.24.0
- **Contract read first:**
  - Since CR-012 (1.20.0), `listStockTakeLines` has one example: the take of `getStockTake`'s example while it is counting, so `expectedQty`, `varianceQty`, `varianceValuePesewas` and `varianceDirection` are null, as a blind count shows them. That was the right fix.
  - No example shows the same lines once counting has closed, so nothing in the contract shows what the review screen reads.
- **What happens today:** the e2e gate serves the review values itself once counting closes, from 1.17.0's example (yam 40 expected, 34 counted, a loss of 12,000 pesewas, and so on).

**Request:** a second named example on `listStockTakeLines`, `inReview` (the default stays the counting one), with the same six lines and their expected quantities and variances filled, agreeing with `getStockTake`'s gain and loss totals for the take in `REVIEW`. No shape change.

**Until this lands:** the gate keeps its table of review values, marked with this request.

## CR-021. Find a live animal by its tag, for the roles that record at the pen (additive)

- **Raised by:** frontend F6, weighing one animal and reporting a death, as the Farm hand
- **Contract read first:**
  - `recordWeights`, `reportMortality` and `recordHealthEvent` take a `stockUnitId`.
  - The only way to find one by its tag is `listAnimals` (`q`), which needs `liv.animal.read`.
  - The 1.24.0 changelog says the Farm hand reads only weights, so it cannot turn a tag into an id. No lookup by tag or barcode exists.
- **What happens today:** the animal picker tells a person without `liv.animal.read`, in words, that their role cannot look animals up. They can weigh, treat or feed a whole pen, but not one animal.

**Request:** `GET /animals/by-tag/{tagNo}` (or a `lookupStockUnit` by identifier), allowed with any of `liv.weight.record`, `liv.health.record` or `liv.mortality.report`. It would answer the live animal's `id`, `tagNo`, `species` and `currentLocation` only: no cost, no price. Unknown or not alive answers 404.

**Until this lands:** the picker's words stay, and the Farm hand records by pen.

**Status:** answered by 1.26.0. `listCareAnimals` (`liv.care.read`, `q`) is the Farm hand's cost-free register. **Built in F6b:** the animal picker searches it for a role without `liv.animal.read`.

## CR-022. A death's photograph: its purpose, its scan, and who may open it (clarification)

- **Raised by:** frontend F6b, `/report-death` and the approvals inbox (ADR 0037, ADR 0039)
- **Contract read first:**
  - `MortalityRecordCreate.photoFileId` says "Required above the value threshold".
  - `uploadFile` lists the purposes and their allow-lists. Images are allowed for photographs, signatures, proof of delivery and evidence. No purpose names a death.
  - `attachProductImage` says its file must be `CLEAN` (`FILE_NOT_CLEAN`). `reportMortality` says nothing about the scan.
  - `createFileSignedUrl` and `getFile` need `platform.file.read.any` for "a file someone else uploaded".
- **What the frontend does today:**
  - It uploads the photograph with purpose `EVIDENCE`, straight after it is taken, and reports with its id while the scan may still be `PENDING`.
  - The approver opens it through `getFile`, then `createFileSignedUrl` once it is `CLEAN`.

**Request:** say, in `reportMortality`'s and `reportCareMortality`'s descriptions:

1. Which purpose a death's photograph takes. `EVIDENCE` is assumed; if it should be a new `MORTALITY_PHOTO`, add it.
2. Whether a `PENDING` file is accepted at report time, and whether a submit with an `INFECTED` or `FAILED` photograph is refused, and with which code.
3. That the roles which report deaths (the Farm hand, the Manager) hold `platform.file.upload`.
4. That the roles which approve `MORTALITY_WRITE_OFF` (holding `liv.mortality.approve`) can open the reporter's upload: `platform.file.read.any`, or a rule that the approver of a request may read its `evidenceFileId`.

**Until this lands:** the assumptions above (A-F6b-02). An approver refused the photograph is told in words that it cannot be shown, and the rest of the evidence is still on screen.

## CR-023. Publish the seeded role matrix, and confirm the Farm hand's (clarification)

- **Raised by:** frontend F6b, aligning the test fake's roles with the real seed. The owner has told the backend.
- **Contract read first:**
  - The `listRoles` example shows four permissions each for the Cashier, Manager, Accountant, Storekeeper, Driver and Investor, and no Farm hand.
  - The livestock writes say "the Farm hand, who holds the write but not the read, uses `<care twin>`" (1.26.0): `liv.health.record`, `liv.feed.record`, `liv.mortality.report` (which covers the submit, `submitCareMortalityRecord`), `liv.animal.update`, `liv.animal.move`, `liv.batch.create` and `liv.batch.update`.
  - 1.24.0 says the role reads weights; 1.25.0 says it "holds the edits, moves, batches, growth and breeding"; 1.26.0 adds `liv.care.read`.
  - Nothing says whether it holds `mdm.reason_code.read`, `mdm.location.read`, `mdm.product.read` or `platform.file.upload`, which a death report, a pen treatment and a feed issue need.
- **What the frontend does today:** the fake is built from those sentences (`fakeAuthServer.ts`). The four reads and the upload are assumptions (A-F6-02, A-F6b-02). Without the reason codes, the Farm hand cannot report a death, and the page says so in words.

**Request:**

1. **The role matrix in the contract.** Either a `listRoles` example listing every seeded role with its full permissions, or an `x-seeded-roles` extension on `components`. The fake and the route gates can then be checked against it in CI.
2. **Confirm the Farm hand's role** holds `liv.mortality.report`, `mdm.reason_code.read` (or a care read of the mortality reasons), `mdm.location.read`, `mdm.product.read` and `platform.file.upload`. Any it should not hold is a gap in the death report, and the report needs another door.

**Until this lands:** the fake keeps its assumptions, each named in its comment.

## CR-024. A reporter's own deaths and culls, without the value (additive)

- **Raised by:** frontend F6b, `/report-death` (ADR 0039)
- **Contract read first:**
  - The Farm hand reports and submits through `reportCareMortality` and `submitCareMortalityRecord`.
  - There is no `listCareMortalityRecords` and no `getCareMortalityRecord`. `listMortalityRecords` and `getMortalityRecord` need `liv.mortality.read`, which the role does not hold.
- **What happens today:**
  - A report whose submit does not get through, on a weak signal, is remembered in the device's storage and offered again with "Send it again".
  - On another phone, or after storage is cleared, the record stays `REPORTED` with no page from which to send it.

**Request:** `listCareMortalityRecords` and `getCareMortalityRecord` under `liv.care.read`, in the `CareMortalityRecord` shape (no value), limited to the records the caller reported. A `status` filter lets the page ask for `REPORTED`.

**Until this lands:** the device keeps the reminder, and a lost phone's unsent report needs a manager to find it in the deaths list.

## CR-025. Should reversing a completed processing order need a second person? (question)

- **Raised by:** frontend F6b, the approvals inbox. The owner listed "processing reversals" among what an approver sees.
- **Contract read first:**
  - `cancelProcessingOrder` on a `COMPLETED` order reverses it at once for a caller with `prc.order.reverse` (the Owner and the Manager). It has no 202 and names no approval kind.
  - `ApprovalKind` has `STOCK_REVERSAL`, which `reverseStockMovement` uses.
  - The brief's separation of duties lists stock write-offs, refunds, price list activation, manual journals, supplier payments and investor distributions.
- **What the frontend does today:**
  - The order's page reverses a completed order after a confirmation naming its cost and outputs.
  - The inbox shows `STOCK_REVERSAL` and every other kind, but no processing reversal reaches it, because none waits.

**Request:** decide, and say it in `cancelProcessingOrder`'s description. Either a reversal answers 202 with `STOCK_REVERSAL`, or a new `PROCESSING_REVERSAL` with a `PROCESSING_ORDER` subject, for a different person to approve. Or it stays a single-person action, and the description says why. The screen handles a 202 either way.

**Until this lands:** a reversal is immediate, as the contract says.

## CR-026. The approval examples name the wrong subject (example fix)

- **Raised by:** frontend F6b, the approvals inbox, which links each request to its record by `subject.docType`
- **Contract read first:**
  - The 202 examples name these subjects:
    - `submitPurchaseOrder` and `submitSupplierPayment`: `docType: STOCK_ADJUSTMENT`;
    - `resolveStockException` (a held transfer shortfall written off): `STOCK_ADJUSTMENT` as well.
  - The `listApprovalPolicies` example gives `PURCHASE_ORDER` a threshold of 500,000 pesewas. `submitPurchaseOrder` says the seed is 200,000.
  - The example has no `SUPPLIER_PAYMENT` policy, so no approving permission is named for it.

**Request:**

1. **Each 202 example names its own subject:** `PURCHASE_ORDER`, `SUPPLIER_PAYMENT`, and for the transfer write-off either `STOCK_EXCEPTION` or a sentence saying the write-off's subject is the adjustment it posts.
2. **The policy example agrees** with the seeded threshold, and lists the `SUPPLIER_PAYMENT` policy with its `approverPermission`.

**Until this lands:** the inbox shows these requests with their summary and amount, and links only the subjects it has a screen for. The purchase order and the supplier payment have no screen yet.
