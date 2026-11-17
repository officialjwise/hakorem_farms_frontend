# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status                   |
| ------ | ---------- | ------------------------ |
| CR-001 | 2026-11-13 | Closed                   |
| CR-002 | 2026-11-13 | Closed                   |
| CR-003 | 2026-11-14 | Answered (1.7.0, 1.16.0) |
| CR-004 | 2026-11-14 | Answered (1.2.0, 1.11.0) |
| CR-005 | 2026-11-14 | Answered (1.53.0)        |
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
| CR-022 | 2026-11-15 | Closed                   |
| CR-023 | 2026-11-15 | Answered (1.53.0)        |
| CR-024 | 2026-11-15 | Closed                   |
| CR-025 | 2026-11-15 | Answered (1.31.0), built |
| CR-026 | 2026-11-15 | Answered (1.40.0)        |
| CR-027 | 2026-11-16 | Answered (1.53.0)        |
| CR-028 | 2026-11-16 | Answered (1.54.0)        |
| CR-029 | 2026-11-16 | Answered (1.46.0)        |
| CR-030 | 2026-11-16 | Answered (1.43.0)        |
| CR-031 | 2026-11-16 | Planned shape (1.45.0)   |
| CR-032 | 2026-11-16 | Open (pack part planned) |
| CR-033 | 2026-11-16 | Open                     |
| CR-034 | 2026-11-17 | Open (B09q)              |
| CR-035 | 2026-11-17 | Open                     |
| CR-036 | 2026-11-17 | Open                     |

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

**Status:** closed 2026-11-16. The owner says the backend confirmed `EVIDENCE` is the intended purpose for a death's photograph. The owner also approved a photograph on every death report, and the backend is being asked to enforce it for Farm hand reports (A-F6b-03). Points 2 to 4 stay open questions for the backend to answer in the contract's descriptions.

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

**Status:** closed 2026-11-16, accepted by the owner as a known gap. If a phone is lost with an unsent report, the missing animal shows up at the next stock take. The device's reminder (ADR 0039) stays.

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

**Status:** answered by the owner 2026-11-16. A reversal at or above the threshold will need a second approver, and the backend is adding it in B06r. When the contract carries it, the order page handles the 202 and the inbox shows the kind, its subject linked to the order.

**Answered by 1.31.0 and built in F7:** `cancelProcessingOrder` answers 202 `PROCESSING_REVERSAL` at or above the threshold. The order page says the reversal waits, shows `pendingReversal` (who asked, why, its value against the threshold, a link to the request) and stops offering the reversal while it waits; a posted reversal names `approvedBy`. The inbox names the kind. Its subject is the reversal, not the order, so it is not linked yet (CR-027).

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

**Status:** answered by 1.40.0. `submitPurchaseOrder` and `submitSupplierPayment` name `PURCHASE_ORDER` and `SUPPLIER_PAYMENT`; `resolveStockException` says its write-off's subject is the stock adjustment it posts, which the inbox already links; `listApprovalPolicies` shows the seeded purchase order threshold and the supplier payment policy. Nothing to build until the purchase order and supplier payment screens exist (`documentHref` links a kind once its screen does).

## CR-027. A processing reversal's approval names its order (additive)

- **Raised by:** frontend F7, the approvals inbox, which links each request to its record by `subject`.
- **Contract read first:** the 202 example of `cancelProcessingOrder` names `subject: { docType: PROCESSING_REVERSAL, id: <the reversal's id> }`. `ProcessingOrder.pendingReversal.id` is that id, but no read finds an order by its reversal: `listProcessingOrders` filters by status, dates and yield variance only, and there is no `getProcessingReversal`.
- **What the frontend does today:** the inbox shows the request's kind, summary (which names the animal's tag) and amount, with no link. The order page links to the request, so the path works one way only.

**Request:** one of these, whichever is cheapest:

1. the request's `subject` is the order (`docType: PROCESSING_ORDER`, the order's id), as a stock adjustment's is the adjustment; or
2. `ApprovalRequest` gains an optional `relatedDocument` (`DocumentRef`) naming the order; or
3. `listProcessingOrders` takes `reversalId`.

**Until this lands:** no link from the inbox to the order for this kind.

## CR-028. The shop's contact details, readable by anyone (additive)

- **Raised by:** frontend F7, the product page of a live animal and the footer.
- **Contract read first:** a live animal is `REQUEST_TO_BUY`, and `addCartLine` refuses it with `REQUEST_TO_BUY_ONLY` ("open a quote request instead"). There is no anonymous request-for-quote operation yet (F10), and no anonymous read of the business's name, phone, WhatsApp number, address or opening hours: the business profile is staff-only.
- **What the frontend does today:** the product page says live animals are sold by request and that asking online opens soon, "until then, visit the farm or call the shop", with no number, because none can be read and none is invented.

**Request:** `getShopProfile` (`GET /shop/profile`, anonymous, cacheable): the trading name, a phone and a WhatsApp number in E.164, the farm's address and directions, and opening hours. The footer and every "call us" line read it.

**Until this lands:** no phone number on the storefront.

**Status:** the owner says (2026-11-16) the backend is adding a public read of the business's phone and WhatsApp numbers. When it lands, live animal pages show them, with a WhatsApp link. Not in 1.41.0 (F8 read it); still open.

## CR-029. A cart at checkout says which checkout it is in (additive)

- **Raised by:** frontend F7, the checkout page.
- **Contract read first:** `startCheckout` moves the cart to `CHECKOUT` and answers the `Checkout`. `Cart` has no field naming that checkout, and no operation finds the open checkout of a cart. A cart at checkout refuses changes (409 `CART_NOT_ACTIVE`).
- **What the frontend does today:** the checkout id is remembered on the device that started it. Another tab after a cleared storage, or a second device with the same cookie, sees a cart it cannot change and a checkout it cannot open, until the 15-minute hold lapses.

**Request:** `Cart.checkoutId` (uuid or null): the open checkout while `status` is `CHECKOUT`, null otherwise.

**Until this lands:** the device that started a checkout is the only one that can finish it; elsewhere the hold lapses within 15 minutes and the cart is active again.

## CR-030. The billing examples contradict their operations (example fix)

- **Raised by:** frontend F8, the document viewer, the credit and debit notes, against Prism.
- **Contract read first (1.41.0):**
  1. `reprintBillingDocument` has one example, `channel: THERMAL` with `pdfBase64: null`. A request for `PDF` gets the same answer from the mock, so the screen correctly says no PDF came back. There is no `PDF` example.
  2. `issueCreditNote`'s 202 example names `subject: { docType: STOCK_ADJUSTMENT }`. A credit note waiting for approval is a billing document (`listBillingDocuments` lists it as a `DRAFT`), so the inbox cannot link it.
  3. `issueDebitNote`'s 201 example answers a `RECEIPT` (`RCP-2026-DDW-T1-018834`), not a `DEBIT_NOTE` naming the original as `originalDocument`.
  4. `getArchivedDocument`'s `sha256` (`4f2ae8c1…`) is not `getBillingDocument`'s `contentHash` (`4f2ac1d2…`), while the description says they are equal; its `businessDocument.id` is not the billing document's id either.
  5. `getBillingDocument` says `reprintCount: 1` while `listBillingDocumentReprints` lists five copies, and `reprintBillingDocument` answers copy 2, which the list already has.
  6. `listReasonCodes` has no `BILLING_ADJUSTMENT` reason (`UNDERCHARGED`, `CHARGE_OMITTED`) and one `REFUND`, no `RETURN`: the debit note's reason list is empty on the mock.
- **What the frontend does today:** builds to the descriptions. The e2e spec rewrites the reprint (a PDF) and the reason list; the inbox shows a credit note request without a link.

**Request:**

1. A named `PDF` example for `reprintBillingDocument` (`pdfBase64` set, `escPosBase64` null), so Prism answers it with `Prefer: example=pdf`.
2. The 202 example's `subject` names the draft credit note: `docType: CREDIT_NOTE` with its id. The console links `CREDIT_NOTE`, `INVOICE`, `RECEIPT`, `PROFORMA` and `DEBIT_NOTE` to the document viewer.
3. A `DEBIT_NOTE` 201 example with `originalDocument` set.
4. The archive example's `sha256` and `businessDocument` agree with the billing document's.
5. The reprint examples agree: the count, the history and the next copy number.
6. The reason example lists the seeded `REFUND`, `RETURN` and `BILLING_ADJUSTMENT` codes.

**Until this lands:** nothing is blocked. The mock shows the debit note form with no reason to choose.

## CR-031. The offline pack says whether its prices include tax, and the sync result carries the server's total (additive)

- **Raised by:** frontend F9, the till's sale screen and its queue.
- **Contract read first (1.42.0):** `OfflinePack.products[].priceBand` carries list, floor and ceiling prices and `taxCells` carries the levies, but nothing says whether the pack's prices include tax. `PriceList.taxInclusive` exists on the back office's price lists, not in the pack. `SyncResultItem` carries the outcome, the order and receipt numbers and the exceptions, but not the total the server recorded.
- **Why it matters:** the till totals the offline cart itself (BUILD_PROMPT, the one exception) and the customer pays that figure. For a tax-exclusive price the till would have to add the levies on top; it cannot tell which. After a sync the till compares its total with the server's and flags a difference to a person; today it reads each synced order back (`getOrder`, one request per sale) to learn the server's figure.

**Request:**

1. `OfflinePack.taxInclusive: boolean`, or the same flag on each `OfflineProduct` if a pack can mix price lists of both kinds.
2. `SyncResultItem.grossPesewas` (the order's total as recorded, the `Pesewas` integer) with `currency` on the result, so the till compares without a second request.

**Until this lands:** the till treats the pack's prices as what the customer pays (A-F9-02) and reads each synced order's `finalTotalPesewas` back.

## CR-032. The till PIN, verified on the device and checked again at sync; and the cash movement reasons in the pack (additive)

- **Raised by:** frontend F9, the offline unlock, supervisor approvals offline and the shift screen. **Made a firm request by the owner (2026-11-16):** "Without one, an offline till either cannot be unlocked or can be unlocked by anyone, and both defeat the design."
- **Contract read first (1.42.0):** OFFLINE_SYNC section 3 describes a `local_auth` store with a slow hash of each operator's PIN for the offline unlock, a supervisor's approval offline (an unverified mobile money tender, 5.3) and a cash drop's witness (10). No operation sets, issues or reads a PIN, and nothing in a synced sale says which PIN approved what. `recordCashMovement` needs a `reasonCode` for a pay-out or pay-in, but the pack example carries only `PRICE_OVERRIDE` and `VOID` reasons.

**Request, as the owner set it out:**

1. **The server issues each operator's PIN as a hash.** An operation for the till to fetch, at an online sign-in on an enrolled device, the PIN verifier of the signed-in operator and of each supervisor at the register's branch: a salted, slow hash and its parameters (algorithm, cost, salt), never the PIN. How an operator sets or is given a PIN is the backend's to define (with its own permission and audit).
2. **The till verifies locally; the PIN never authenticates to the server.** No operation accepts a PIN. It unlocks the device and records approvals; the staff session and the device credential stay the server's controls.
3. **Four to six digits**, with **attempt limits and a lockout** the till enforces offline and the pack states (attempts before lockout, lockout duration), so every till applies the same rule.
4. **An approval made offline records which PIN approved it**: the approver's principal id and the verifier version it was checked against, on the sale line or tender (the price override, the unverified mobile money tender) and on a cash drop's witness. **The server verifies it at sync**: an approval by a revoked operator, a superseded verifier, or someone without the approving permission is recorded and flagged as an exception, never silently accepted.
5. **The PIN is never the only control.** A revoked till is still refused at sync (`DEVICE_REVOKED`) whatever PIN unlocked it.
6. The pack's `reasonCodes` include the `CASH_MOVEMENT` domain.

**Until this lands:** no offline unlock (a till whose session has expired offline cannot sell until it reconnects), no supervisor approval offline (so no unverified mobile money), and no cash drop witness (A-F9-04).

**The exact shape (F10, 2026-11-16).** Read against 1.44.0 first: `TenderInput.unverifiedMobileMoney` already carries `payerPhone`, `network`, `providerReference` and `approvedById`, and `CashMovementCreate.witnessId` carries a drop's witness, so items 4 and 5 need only the verifier version. F10 builds the till against exactly this, behind `HK_REQUESTED_CONTRACT` (ADR 0046, ADR 0047):

1. `listTillPinVerifiers`: `GET /registers/{id}/pin-verifiers`, staff session plus `X-Device-Credential` (security `deviceCredential`), permission `pos.shift.open`. 200 `TillPinVerifiers`; 401 `DEVICE_CREDENTIAL_INVALID` or `DEVICE_REVOKED` as for a sync.
   ```yaml
   TillPinVerifiers:
     registerId: uuid
     issuedAt: date-time
     policy: # every till applies the same rule offline
       minDigits: integer # 4
       maxDigits: integer # 6
       maxAttempts: integer # wrong PINs in a row before that person is locked out on the till
       lockoutSeconds: integer
       idleLockSeconds: integer # the till locks itself after this long untouched
     verifiers: # the signed-in operator's, and each supervisor's at the register's branch
       - principalId: uuid
         displayName: string
         version: integer # rises each time the PIN is set or reset
         algorithm: PBKDF2-SHA256 # enum; Web Crypto has no Argon2 (ADR 0047)
         iterations: integer
         salt: string # base64, at least 16 bytes
         hash: string # base64, 32 bytes: PBKDF2(PIN as UTF-8, salt, iterations)
         approves: [OFFLINE_MOBILE_MONEY | CASH_DROP_WITNESS] # from the person's permissions at the branch
   ```
   Never the PIN. How a PIN is set, with its permission and audit, is the backend's to define.
2. `UnverifiedMobileMoneyInput.approvedByVerifierVersion` (integer, required when the field lands) and `CashMovementCreate.witnessVerifierVersion` (integer, with `witnessId`): the verifier the PIN was checked against. The server records an approval by a revoked operator, a superseded verifier or someone without the approving permission as an exception, never silently. Until then the till keeps the version on its own record and shows it on the queue screen.
3. The pack's `reasonCodes` include the `CASH_MOVEMENT` domain (unchanged from item 6).

The PIN unlocks the till and records approvals only. The till enforces the attempt limit and the lockout per person, on the device.

## CR-033. A digital receipt the customer can open from a link (additive)

- **Raised by:** frontend, ADR 0045 (owner, 2026-11-16): every sale produces a digital receipt, by SMS or a link; a printer is optional.
- **Contract read first (1.42.0):** a sale carries `customerPhone` "for an SMS or WhatsApp receipt", and `sendBillingDocument` is planned (202). `BillingDocument.provisionalRef` carries the sale reference beside the official number. There is no page or public read a customer can open from a link without an account, and nothing says when the SMS is sent for a sale made offline.

**Request:**

1. **A public receipt read** (no session) by an unguessable token: the official receipt number, the sale reference (`provisionalRef`), the lines, the tenders, the change and the business's details, and, until the sale has synced, a state saying the receipt is being recorded.
2. **The link can be made on the till offline**, so it can be shown at the counter and printed before the sale reaches the server (as text: the owner allows no QR code but the TOTP enrolment image, 2026-11-17). The simplest shape: the link names the sale's client id (a UUIDv7, 74 random bits), and the public read answers "being recorded" until that sale arrives. If the backend prefers a server-signed token, say how the till gets one offline.
3. **The SMS is sent once on sync** for a sale that carried `customerPhone`, with the link, the official number and the sale reference; and the sync result (or the order) says whether it was sent.

**Until this lands:** the till shows the sale reference and its own receipt on screen; nothing reaches the customer's phone.

**The exact shape (F10, 2026-11-16).** F10 builds the till's side against exactly this, behind `HK_REQUESTED_CONTRACT` (ADR 0046); the customer's page on the storefront waits for item 3:

1. `OfflinePack.receiptLinkTemplate` (string, an absolute `https` URL containing `{saleId}`, for example `https://hakoremfarms.com/r/{saleId}`): the till makes the link offline from the sale's client id, so it can show and print it before the sale reaches the server.
2. `SyncResultItem.receiptMessage` (object or null): `{ channel: SMS, status: QUEUED | SENT | FAILED | NO_PHONE }`. The server sends the SMS once, on the sale's first sync, to the sale's `customerPhone`, with the link, the official number and the sale reference; a resend (`DUPLICATE`) answers the first result's status and sends nothing.
3. `getPublicReceipt`: `GET /shop/receipts/{saleId}`, public, cacheable for a recorded sale. 200 `PublicReceipt`: `{ saleId, state: RECORDING | RECORDED, saleReference, receiptNo (null while RECORDING), occurredAt, business: { name, phone }, lines: [{ name, quantity, saleUom, weightKg, stockUnitIdentifier, unitPricePesewas, amountPesewas }], totalPesewas, tenders: [{ name, amountPesewas, tenderedPesewas, unverified }], changePesewas, currency }`. An id the server has never seen answers 200 `RECORDING` with only `saleId` and `state`, never 404, so a link shown at the counter works before the sale syncs and says nothing about whether an id exists. `quantity` and `weightKg` are the contract's three-place strings.

## CR-034. The server generates each product's SKU (changed request body)

- **Raised by:** frontend, the owner's decision (2026-11-17): "SKU stays, but the server generates it. Make it read-only on the product forms: never typed, shown once the product is saved."
- **Contract read first (1.53.0):** `ProductCreate` requires `sku` (a free string), so the console must type one. `ProductUpdate` has no `sku`, so a SKU already cannot change after creation. `Product.sku` is answered on every product read, and `listProducts` sorts and searches by it.
- **Why it matters:** with the owner's rule the console has no SKU to send, so in a build against 1.53.0 it cannot create a product at all.

**Request:**

1. `ProductCreate.sku` removed (or optional and ignored). The server generates the SKU in the create transaction, unique across the catalogue, and answers it in `Product.sku` on the 201. Its format is the backend's (the owner's example codes are short and readable, such as `LIV-GOAT` or `EGG-BIG`); say in the description how it is formed, so staff can read one aloud.
2. The SKU never changes after creation (as today: not in `ProductUpdate`), and import (`importMasterData` for products) names an existing product by its SKU but never sets one on a new row.
3. The SKU remains what `listProducts` and the till's search find a product by.

**Until this lands:** the create form has no SKU field and says the SKU is given by the server. In a build switched on for CR-034 (the e2e and CI builds, ADR 0046) it sends the body without `sku`; in a build for the real API the "Create product" button is disabled with words, and existing products can be changed as before.

## CR-035. A breakage reason for stock found broken, and a reason for goods rejected at the door (additive)

- **Raised by:** frontend, the owner (2026-11-17): "check against the real API whether a damage or breakage reason exists. If it doesn't, raise a contract request." Needed by the egg screens: cracked or broken crates rejected on a goods receipt with a reason (the egg session, part a), and eggs broken at a shop written off by a stock adjustment.
- **Checked:** the real API could not be reached from the frontend's session (no staging host is reachable, and the VPS deploy is B13), so this was checked against the contract, 1.54.0:
  - `listReasonCodes` ("a fixed list changed only by migration") lists, in its example, one `STOCK_ADJUSTMENT` reason, `COUNT_ERROR`, and no breakage or damage reason in that domain. `DAMAGED_IN_DELIVERY` exists, but in the `REFUND` domain (a customer's refund), which a stock adjustment refuses.
  - Yet `listStockAdjustments`' example posts an adjustment with `reasonCode: BREAKAGE`, and others with `RODENT_DAMAGE`, neither of which `listReasonCodes` lists. Either the seed has them and the reason list's example is short, or the adjustment examples name codes that do not exist.
  - **A rejection on a goods receipt has no reason at all.** `GoodsReceiptLineInput.qtyRejected` and `GoodsReceiptLine.qtyRejected` carry the quantity only; no field names why, and no reason code domain covers a receipt (the `domain` enum has no receiving domain).

**Request:**

1. **Seeded `STOCK_ADJUSTMENT` reasons for breakage and damage**, with a loss account group, at least `BREAKAGE` ("Broken or cracked in store", `requiresNote: false`) and `RODENT_DAMAGE` if it is real, so a shop writes off broken eggs without a free-text reason. Make `listReasonCodes`' example match the seed, or say in its description that the example is a part of it.
2. **A reason code domain for goods rejected at the door**, `GOODS_RECEIPT_REJECTION`, seeded with at least `BROKEN_ON_ARRIVAL` ("Broken or cracked on arrival"), `SHORT_DELIVERED`, `WRONG_ITEM` and `QUALITY_REJECTED`, each with `requiresNote`.
3. **`rejectionReasonCode` and `rejectionNote` on `GoodsReceiptLineInput`** (string, a `GOODS_RECEIPT_REJECTION` code; required when `qtyRejected` is above zero, refused when it is zero, 422 `GOODS_RECEIPT_INVALID` with details `REJECTION_REASON_REQUIRED`, `REASON_NOT_ALLOWED`, `NOTE_REQUIRED`), and both answered on `GoodsReceiptLine` (null when nothing was rejected). The receipt's `valuePesewas` stays the cost of the accepted quantity, as today.
4. Supplier scoring's rejection rate (FR-PUR, "quality and rejection rate") reads the same field, so a crate rejected for breakage counts against the supplier.

**Until this lands:** nothing is built on it this session. The egg session's receipt screen (part a) is built against this shape behind `HK_REQUESTED_CONTRACT` (ADR 0046) if it has not landed by then.

## CR-036. A claim raised from a goods receipt's rejected lines (additive)

- **Raised by:** frontend, the owner (2026-11-17): cracked or broken crates "rejected on arrival with a reason, with a claim raised from the receipt". Needed by the egg session, part a, before supplier payment.
- **Checked (1.54.0):** a supplier credit note exists (`createSupplierInvoice` with kind `CREDIT_NOTE`, then `submitSupplierCreditNote`), but it is raised against a supplier invoice, its lines return goods that are on hand (`returnFromLocationId`, a `SUPPLIER_RETURN` movement), and nothing links it to a receipt or to quantities that never entered stock. No operation raises anything from a `GoodsReceipt`, and the contract has no claim.

**Request:** the backend's choice of shape, with these properties:

1. **From a posted receipt with rejected lines**, staff raise a claim against its supplier in one step: one line per rejected receipt line, carrying the quantity, the reason (CR-035) and the value the supplier is asked to credit or replace. Its value is the server's (from the purchase order line's price), never the client's.
2. **The claim is linked both ways**: the receipt answers its claims, and the claim names the receipt, its purchase order and, once the supplier invoices, the invoice or credit note that settles it.
3. **It does not move stock** (the goods were never received), and it shows on the supplier's account until settled by a credit note, a replacement delivery, or being written off with approval.
4. If the backend's answer is that a supplier credit note raised from the receipt is the claim, say how a credit note names a receipt and a quantity that never entered stock.

**Until this lands:** no claim screen. The egg session's part a builds the receipt's rejection with its reason (CR-035) first.
