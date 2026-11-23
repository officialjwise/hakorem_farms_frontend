# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status                    |
| ------ | ---------- | ------------------------- |
| CR-001 | 2026-11-13 | Closed                    |
| CR-002 | 2026-11-13 | Closed                    |
| CR-003 | 2026-11-14 | Answered (1.7.0, 1.16.0)  |
| CR-004 | 2026-11-14 | Answered (1.2.0, 1.11.0)  |
| CR-005 | 2026-11-14 | Answered (1.53.0)         |
| CR-006 | 2026-11-14 | Answered (1.2.0, 1.4.0)   |
| CR-007 | 2026-11-14 | Answered (1.3.0)          |
| CR-008 | 2026-11-14 | Answered (1.3.0)          |
| CR-009 | 2026-11-15 | Open                      |
| CR-010 | 2026-11-15 | Open                      |
| CR-011 | 2026-11-15 | Open                      |
| CR-012 | 2026-11-15 | Open                      |
| CR-013 | 2026-11-15 | Open                      |
| CR-014 | 2026-11-15 | Open                      |
| CR-015 | 2026-11-15 | Open                      |
| CR-016 | 2026-11-15 | Closed (2.0.0)            |
| CR-017 | 2026-11-15 | Open                      |
| CR-018 | 2026-11-15 | Open                      |
| CR-019 | 2026-11-15 | Open                      |
| CR-020 | 2026-11-15 | Open                      |
| CR-021 | 2026-11-15 | Answered (1.26.0)         |
| CR-022 | 2026-11-15 | Closed                    |
| CR-023 | 2026-11-15 | Answered (1.53.0), built  |
| CR-024 | 2026-11-15 | Closed                    |
| CR-025 | 2026-11-15 | Answered (1.31.0), built  |
| CR-026 | 2026-11-15 | Answered (1.40.0)         |
| CR-027 | 2026-11-16 | Answered (1.53.0)         |
| CR-028 | 2026-11-16 | Answered (1.54.0)         |
| CR-029 | 2026-11-16 | Answered (1.46.0), built  |
| CR-030 | 2026-11-16 | Answered (1.43.0)         |
| CR-031 | 2026-11-16 | Planned shape (1.45.0)    |
| CR-032 | 2026-11-16 | Answered (2.17.0), built  |
| CR-033 | 2026-11-16 | Answered (2.24.0), built  |
| CR-034 | 2026-11-17 | Answered (2.0.0), built   |
| CR-035 | 2026-11-17 | Answered (2.3.0), built   |
| CR-036 | 2026-11-17 | Answered (2.4.0), built   |
| CR-037 | 2026-11-17 | Answered (2.4.0)          |
| CR-038 | 2026-11-17 | Answered in 2.11.0, built |
| CR-039 | 2026-11-17 | Open                      |
| CR-040 | 2026-11-17 | Answered (2.9.0), built   |
| CR-041 | 2026-11-17 | Answered (2.12.0), built  |
| CR-042 | 2026-11-17 | Answered (2.9.0), built   |
| CR-043 | 2026-11-17 | Answered (2.9.0), built   |
| CR-044 | 2026-11-17 | Answered (2.9.0), built   |
| CR-045 | 2026-11-18 | Answered (2.12.0), built  |
| CR-046 | 2026-11-18 | Open                      |
| CR-047 | 2026-11-18 | Part answered (2.12.0)    |
| CR-048 | 2026-11-18 | Open                      |
| CR-049 | 2026-11-18 | Answered (2.12.0)         |
| CR-050 | 2026-11-18 | Answered (2.17.0), built  |
| CR-051 | 2026-11-18 | Answered (2.17.0), built  |
| CR-052 | 2026-11-18 | Open                      |
| CR-053 | 2026-11-18 | Open                      |
| CR-054 | 2026-11-18 | Open                      |
| CR-055 | 2026-11-18 | Open                      |
| CR-056 | 2026-11-18 | Open                      |
| CR-057 | 2026-11-18 | Answered (2.31.0), built  |
| CR-058 | 2026-11-22 | Open                      |
| CR-063 | 2026-11-23 | Open                      |

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

**Closed (F10d, 2026-11-17):** contract 2.0.0 removed the product barcode, and the owner decided labels print text only. The labels screen no longer draws a barcode: each label prints its name, its SKU or its batch or tag, and its facts as text, still from the browser. The server-rendered PDF stays the backend's BL-049. The meat pack labels (`printPackLabels`) are unchanged, barcode included.

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

**Built (F10e, contract 2.2.0).** `packages/api-client` generates `seededRoles` from `components.x-seeded-roles`, and `apps/console/src/test/fakeRoles.test.ts` fails CI when the test fake gives a role a permission the seed does not, unless the permission is one the contract names on an operation and no seeded role holds yet (the till's `pos.*`, reports, wholesale statements, the audit log), each listed with its reason; that list fails too once the seed grants one. What the check found, and what changed in the fake:

- The Farm hand: the seed holds every read the death report needs (`mdm.reason_code.read`, `mdm.location.read`, `mdm.product.read`) and `platform.file.upload.evidence` for its photograph. The fake already matched.
- The Cashier does not hold `inv.stock.read`: removed from the fake. The Manager keeps it.
- Posting a stock take (`inv.stock_take.post`) is the Owner's and the Manager's, not the Storekeeper's: removed from the fake Storekeeper.
- The fake Manager held `ord.order.void.approve`, the name in the `listRoles` example; the operations and the seed say `ord.void.approve` (CR-037).

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

**Answered (1.53.0):** option 3, `listProcessingOrders` takes `reversalId`. Since F10c a `PROCESSING_REVERSAL` request's detail links to its order (`ReversalOrderLink`), and says so in words when the order is not found or the role cannot read orders.

## CR-028. The shop's contact details, readable by anyone (additive)

- **Raised by:** frontend F7, the product page of a live animal and the footer.
- **Contract read first:** a live animal is `REQUEST_TO_BUY`, and `addCartLine` refuses it with `REQUEST_TO_BUY_ONLY` ("open a quote request instead"). There is no anonymous request-for-quote operation yet (F10), and no anonymous read of the business's name, phone, WhatsApp number, address or opening hours: the business profile is staff-only.
- **What the frontend does today:** the product page says live animals are sold by request and that asking online opens soon, "until then, visit the farm or call the shop", with no number, because none can be read and none is invented.

**Request:** `getShopProfile` (`GET /shop/profile`, anonymous, cacheable): the trading name, a phone and a WhatsApp number in E.164, the farm's address and directions, and opening hours. The footer and every "call us" line read it.

**Until this lands:** no phone number on the storefront.

**Status:** the owner says (2026-11-16) the backend is adding a public read of the business's phone and WhatsApp numbers. When it lands, live animal pages show them, with a WhatsApp link. Not in 1.41.0 (F8 read it); still open.

**Answered (1.54.0):** `getShopProfile`. Since F10c a live animal's page shows the shop's phone as a `tel:` link and its WhatsApp number as a `wa.me` link (`AskTheShop`); with no profile set (404) it says to call or visit and shows no number. The footer does not read it yet.

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

**Amended (owner, 2026-11-17, F10e): no sale UUID in the link.** The owner's answer to the F10d report's first question, and the backend is changing CR-033 to match. It replaces item 2's "simplest shape" and the F10 shape below it:

- **The till makes the link's token itself, offline:** at least 128 bits from the device's cryptographically secure generator (`crypto.getRandomValues`), encoded base64url with no padding, about 22 characters (16 bytes are 22). Never derived from the sale's id, the device, the shift or the time.
- **It travels with the sale when it syncs**, and **the server stores only its hash.** The link works from then.
- **Before sync**, the till's receipt, on screen and on paper, says the link starts working once the sale reaches the server. The server answers nothing for a token it has not been sent.

**The exact shape, as amended (replaces the F10 shape of 2026-11-16).** The frontend builds it once the contract carries it (owner); the till's present switch (ADR 0046) is for the F10 shape and is rebuilt to this one then.

1. `OfflinePack.receiptLinkTemplate` (string): an absolute `https` URL containing `{token}`, for example `https://hakoremfarms.com/r/{token}`. The till fills it with the sale's own token, so it can show and print the link before the sale reaches the server.
2. `OfflineSale.receiptToken` (string, `^[A-Za-z0-9_-]{22,86}$`, optional so a till without the template still syncs): the token the till made for this sale, made once and kept with the sale on the device, so a resend carries the same token. It is part of the canonical sale that `payloadHash` covers. The server keeps only its hash, never the token; a resend (`DUPLICATE`) changes nothing. Please say what the server does with a token it already holds for another sale (at 128 random bits it should never happen); the frontend asks that the sale is still recorded.
3. `SyncResultItem.receiptMessage` (object or null): `{ channel: SMS, status: QUEUED | SENT | FAILED | NO_PHONE }`, as before. The server sends the SMS once, on the sale's first sync, to the sale's `customerPhone`, with the link (which works from that moment), the official number and the sale reference; a resend answers the first result's status and sends nothing.
4. `getPublicReceipt`: `GET /shop/receipts/{token}`, public, found by the token's hash. 200 `PublicReceipt`: `{ state: RECORDED, saleReference, receiptNo, occurredAt, business: { name, phone }, lines: [{ name, quantity, saleUom, weightKg, stockUnitIdentifier, unitPricePesewas, amountPesewas }], totalPesewas, tenders: [{ name, amountPesewas, tenderedPesewas, unverified }], changePesewas, currency }`, with no `saleId` and no other id. A token the server has not been sent, mistyped, guessed or altered answers 404 `NOT_FOUND`, one answer for all of them. The `RECORDING` state of the F10 shape is gone: until the sale syncs, the link is not live, and the receipt says so. `quantity` and `weightKg` are the contract's three-place strings.

**Answered in 2.17.0 (F10n), differently from the request, and built (ADR 0057):**

- The person's own till sets the PIN and sends only its verifier (`setTillPin`).
- The till reports every try, not only lockouts (`reportTillPinEvents`).
- Five wrong tries against a version lock it on every till until its owner sets a new PIN.
- A verifier names a role, not a list of approvals.
- The approvals carry `approvedByPinVersion` and `witnessPinVersion`.
- The PIN's length and the idle lock are not in the policy: the till's own constants (A-F10-14).
- The till's switch is deleted.

**Answered in 2.24.0 (F10o), points 1 and 2, and built:**

- `OfflinePack.receiptLinkTemplate` holds `{token}`; the till makes a 16-byte base64url token per sale and sends it as `OfflineSale.receiptToken`, under `payloadHash`. `getPublicReceipt` reads it (the storefront's `/r/[token]`).
- A token the server refuses (`RECEIPT_TOKEN_REFUSED`) leaves the sale recorded; the till then says the link was refused and to give the sale reference.
- **Point 3, the receipt SMS (`SyncResultItem.receiptMessage`), is not in the contract** (B11's). The till promises no SMS; the phone number still goes with the sale. The switch is deleted: this point is built when the contract carries it.

## CR-034. The server generates each product's SKU (changed request body)

- **Raised by:** frontend, the owner's decision (2026-11-17): "SKU stays, but the server generates it. Make it read-only on the product forms: never typed, shown once the product is saved."
- **Contract read first (1.53.0):** `ProductCreate` requires `sku` (a free string), so the console must type one. `ProductUpdate` has no `sku`, so a SKU already cannot change after creation. `Product.sku` is answered on every product read, and `listProducts` sorts and searches by it.
- **Why it matters:** with the owner's rule the console has no SKU to send, so in a build against 1.53.0 it cannot create a product at all.

**Request:**

1. `ProductCreate.sku` removed (or optional and ignored). The server generates the SKU in the create transaction, unique across the catalogue, and answers it in `Product.sku` on the 201. Its format is the backend's (the owner's example codes are short and readable, such as `LIV-GOAT` or `EGG-BIG`); say in the description how it is formed, so staff can read one aloud.
2. The SKU never changes after creation (as today: not in `ProductUpdate`), and import (`importMasterData` for products) names an existing product by its SKU but never sets one on a new row.
3. The SKU remains what `listProducts` and the till's search find a product by.

**Until this lands:** the create form has no SKU field and says the SKU is given by the server. In a build switched on for CR-034 (the e2e and CI builds, ADR 0046) it sends the body without `sku`; in a build for the real API the "Create product" button is disabled with words, and existing products can be changed as before.

**Answered (contract 2.0.0, B09q; F10d, 2026-11-17):** `ProductCreate` has no `sku`, and sending one is 422 `FIELD_SERVER_ASSIGNED`. The console sends `createProduct` without it in every build; the switch and `requested/serverSku.ts` are deleted.

## CR-035. A breakage reason for stock found broken, and a reason for goods rejected at the door (additive)

- **Goes to:** the backend's egg phase, B09e, which is next (owner, 2026-11-17). It arrives through the contract; the frontend builds nothing against it before then.

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

**Answered in 2.3.0 (B09e continued 2), built in the egg session:** `rejectionReasonCode` and `rejectionNote` on the receipt line, the `GOODS_RECEIPT_REJECTION` domain (`CRACKED`, `BROKEN`, `DIRTY`, `SHORT`, `WRONG_ITEM_DELIVERED`, `QUALITY_REJECTED`), and `BREAKAGE` and `RODENT_DAMAGE` among the adjustment reasons. The receipt screen asks for the reason, and the note when the reason needs one, before it sends.

## CR-036. A claim raised from a goods receipt's rejected lines (additive)

- **Goes to:** the backend's egg phase, B09e, which is next (owner, 2026-11-17). It arrives through the contract; the frontend builds nothing against it before then.

- **Raised by:** frontend, the owner (2026-11-17): cracked or broken crates "rejected on arrival with a reason, with a claim raised from the receipt". Needed by the egg session, part a, before supplier payment.
- **Checked (1.54.0):** a supplier credit note exists (`createSupplierInvoice` with kind `CREDIT_NOTE`, then `submitSupplierCreditNote`), but it is raised against a supplier invoice, its lines return goods that are on hand (`returnFromLocationId`, a `SUPPLIER_RETURN` movement), and nothing links it to a receipt or to quantities that never entered stock. No operation raises anything from a `GoodsReceipt`, and the contract has no claim.

**Request:** the backend's choice of shape, with these properties:

1. **From a posted receipt with rejected lines**, staff raise a claim against its supplier in one step: one line per rejected receipt line, carrying the quantity, the reason (CR-035) and the value the supplier is asked to credit or replace. Its value is the server's (from the purchase order line's price), never the client's.
2. **The claim is linked both ways**: the receipt answers its claims, and the claim names the receipt, its purchase order and, once the supplier invoices, the invoice or credit note that settles it.
3. **It does not move stock** (the goods were never received), and it shows on the supplier's account until settled by a credit note, a replacement delivery, or being written off with approval.
4. If the backend's answer is that a supplier credit note raised from the receipt is the claim, say how a credit note names a receipt and a quantity that never entered stock.

**Until this lands:** no claim screen. The egg session's part a builds the receipt's rejection with its reason (CR-035) first.

**Answered in 2.4.0 (B09e continued 3, ADR-0076), built in the egg session:** `raiseSupplierClaim` from a posted purchase receipt against an order, its value the server's from the order's price (the body takes only a note), and `listGoodsReceiptClaims`, so the receipt shows its claim, open or settled. The owner had said to wait for the contract (2026-11-17); it landed during the session. The claim's credit note and its settlement by an invoice (`draftSupplierClaimCreditNote`, `settleSupplierClaim`) belong to the supplier invoice screens, which are not built yet.

## CR-037. The examples name a void's approval `ord.order.void.approve`; the operations and the seed say `ord.void.approve` (example fix)

- **Raised by:** frontend F10e, checking the test fake against `components.x-seeded-roles` (CR-023).
- **Contract read first (2.2.0):** `voidSale`'s description and the seeded Owner and Manager say `ord.void.approve`. The `listRoles` and role examples (the Manager's permissions) and an approval policy's `approverPermission` example say `ord.order.void.approve`, which no operation names and no role is seeded with.

**Request:** change the examples to `ord.void.approve`, or say which name is right.

**Until this lands:** the fake follows the seed (`ord.void.approve`).

**Answered in 2.4.0:** the examples name `ord.void.approve`.

## CR-038. The till sells a product in more than one unit, each with its own price (additive)

- **Raised by:** frontend, the egg session, part b: "crate and single egg as two units of one product, at the till and in the shop, each with its own price" (owner, ADR 0049).
- **Contract read first (2.3.0):** 2.1.0 gives a price list entry, a price resolution and a staff order line a selling unit (`uom`), and says "a counter or online sale ... keep[s] the unit the line was sold in". But the till cannot sell a second unit: `OfflineProduct` carries one `saleUom`, one `priceBand` and one `priceListEntryId`, and `CounterSaleLine` (the line of a counter sale and of an offline sale) names no unit. The till totals offline from the pack's band (BUILD_PROMPT's one exception), so it needs each unit's own band in the pack; it must never work out a single egg's price from a crate's.

**Request:**

1. **`OfflineProduct.sellingUnits`**: an array, one entry per unit the product is sold by at this register, the product's `saleUom` first. Each `{ uom: string, priceListEntryId: uuid | null, priceBand: PriceBand | null, quoteOnly: boolean }`, priced exactly as `priceBand` is today (the register's lists, no quantity break), for its own unit. A product sold in one unit has one entry, the same as its `saleUom` and `priceBand`.
2. **`CounterSaleLine.uom`** (optional string): the unit the line is sold in, one of the product's `sellingUnits`; absent means `saleUom`, as today. `quantity` and `agreedUnitPricePesewas` are in it. The server converts to the base unit for stock (30 eggs a crate), re-prices by that unit's entry at sync, and answers the order line with its unit (`OrderLine.uom`, as 2.1.0 does). A unit the product is not sold by is `VALIDATION_FAILED` on `/lines/{i}/uom`, or the sync's own refusal.
3. A return (`createReturn`) of a line sold by the egg refunds by the egg: the receipt line names its unit already (2.1.0); say so in its description.

**Until this lands:** the till is built against this shape behind `HK_REQUESTED_CONTRACT=CR-038` (ADR 0046): `apps/console/src/requested/sellingUnits.ts`, answered in the e2e suite by a rewrite of the pack. With the switch off, a product is sold in its `saleUom` alone, as before.

**Answered in 2.11.0 (F10l):** `OfflineSellingUnit`, `OfflineProduct.sellingUnits` and `CounterSaleLine.uom` in exactly this shape, with `getOfflinePack` in code. A line that names no unit is the product's first unit, the one its `priceBand` is. The switch and `requested/sellingUnits.ts` are deleted; the till reads the generated types (`pos/sale/catalogue.ts`).

## CR-039. The shop sells a product in more than one unit, each with its own price (additive)

- **Raised by:** frontend, the egg session, part b: the crate and the single egg in the shop.
- **Contract read first (2.3.0):** `CatalogueItem` and `ProductDetail` carry one `saleUom` and one price range (`priceFromPesewas`, `priceToPesewas`), and `CartLineAdd` takes a `productId` and a `quantity` only, so the shop cannot offer the single egg beside the crate, nor say which a customer put in the basket. `CartLine.uom` is answered already.

**Request:**

1. **`ProductDetail.sellingUnits`** (and `CatalogueItem.sellingUnits`): one entry per unit sold online, `saleUom` first, each `{ uom: string, uomName: string, priceFromPesewas: Pesewas | null, priceToPesewas: Pesewas | null, availability: ... }`, each priced by its own entry, never derived.
2. **`CartLineAdd.uom`** (optional): the unit added; absent means `saleUom`. The cart keeps it (`CartLine.uom`), checkout and placement price by it, and stock is reserved in the base unit (as `confirmOrder` does, 2.1.0).
3. A crate and a single egg of one product are two cart lines.

**Until this lands:** nothing is built in the shop (owner, 2026-11-17: the till goes behind a switch and the shop waits). The storefront has no switch mechanism; adding one would be a new pattern.

## CR-040. A goods receipt line against a purchase order: is `valuePesewas` required? (description fix or additive)

- **Raised by:** frontend, the egg session, part a: receiving a delivery against a purchase order.
- **Contract read first (2.3.0):** `GoodsReceiptLineInput.valuePesewas` is in `required`, yet its description says "Defaults from the purchase order line". The screen cannot work out the value itself (quantity times the order's price is the server's arithmetic), so today the storekeeper types the cost of what was accepted from the supplier's paper.

**Request:** either make `valuePesewas` optional on a line that names `purchaseOrderLineId`, valued by the server from the order line for the accepted quantity (the receipt's answer shows it), or remove "Defaults from the purchase order line" from the description.

**Until this lands:** the receipt screen asks for the cost on every line, against an order or not.

**Status:** answered by 2.9.0. A line naming `purchaseOrderLineId` may leave out `valuePesewas`, and the server values it from the order line for the accepted quantity. **Built in F10k:** the receipt screen no longer asks for the cost on a line against an order; a typed value still wins.

## CR-041. Who holds a buyer's price list, and an entry's base unit (additive)

- **Raised by:** frontend, the egg session, part c: bulk buyer prices.
- **Contract read first (2.3.0):** `assignCustomerPriceList` (`PUT /customers/{id}/price-list`) has no read: neither a customer nor a price list answers which list a buyer holds, or who holds a list, so the screen can show only the answer to its own write. And `PriceListEntry.minQtyBase` is "the same break in the product's base unit", but the entry names no base unit (`ProductRef` has none), so the screen shows "from 10 Crate (300 in the base unit)" without saying eggs.

**Request:**

1. **`GET /customers/{id}/price-list`** (`getCustomerPriceList`, `mdm.customer.read`): the buyer's assignments, current and future, each a `PriceListAssignment`; and **`listPriceListAssignments`** on a price list (`GET /price-lists/{id}/assignments`), the buyers who hold it, with their windows.
2. **`PriceListEntry.baseUom`** (string): the unit `minQtyBase` is in.

**Until this lands:** the price list screen shows the assignment just made, from its answer; the break's base figure is shown bare.

**Answered in 2.12.0 (F10l):** both reads and `baseUom`, as asked. A buyer's list shows who pays its prices, with their windows, read again after an assignment; a break reads "from 10 crates (300 eggs)". `getCustomerPriceList` is in the client and not yet on a screen.

## CR-042. A supplier's balance: what is owed, claimed, in payment and paid (additive)

- **Raised by:** frontend, the supplier invoice session: "show the supplier's balance: what is owed, what is claimed, what is paid" (owner, 2026-11-17).
- **Contract read first (2.4.0):** each `SupplierInvoice` answers its own `grossPesewas`, `creditedPesewas`, `paidPesewas` and `outstandingPesewas`, each `SupplierClaim` its `claimedPesewas`, and each `SupplierPayment` its `amountPesewas`. Nothing answers them for a supplier as a whole: `getSupplier` carries no balance, `getAgeingReport` is receivables only, and no payables ageing or supplier statement exists. Adding them up in the browser would be the screen computing money (CLAUDE.md, the contract rule), and it would be wrong past one page of invoices.

**Request:** `GET /suppliers/{id}/balance` (`getSupplierBalance`, `pur.supplier_invoice.read`), answering `SupplierBalance`:

```yaml
SupplierBalance:
  supplier: SupplierRef
  asOf: date-time # when the server worked it out
  owedPesewas: Pesewas # outstandingPesewas of the supplier's APPROVED invoices, not cancelled
  awaitingApprovalPesewas: Pesewas # grossPesewas of invoices entered and not yet approved (DRAFT, MATCHED, MISMATCH)
  claimedPesewas: Pesewas # claimedPesewas of the supplier's OPEN claims
  inPaymentPesewas: Pesewas # amountPesewas of payments PENDING_APPROVAL or APPROVED, not yet paid
  paidPesewas: Pesewas # amountPesewas of the supplier's PAID payments
  currency: Currency
```

Within the branches the caller holds the permission at, as `listSupplierInvoices` is. Every figure is integer pesewas, never negative; direction is in the field's name.

**Until this lands:** the supplier's account screen is built against this shape behind `HK_REQUESTED_CONTRACT=CR-042` (ADR 0046, ADR 0052): `apps/console/src/requested/supplierBalance.ts`, answered in the e2e suite by `e2e/support/requested.ts`. With the switch off, the screen says the balance waits for the server and lists each outstanding invoice, open claim and payment with the API's own figures, unsummed.

**Status:** answered by 2.9.0 in the requested shape (`getSupplierBalance`, `SupplierBalance`). **Built in F10k:** the switch is deleted (`requested/supplierBalance.ts`, its id in the builds), and the supplier's account calls `useApiQuery('getSupplierBalance')`.

## CR-043. Approving a supplier invoice for payment refuses the person who entered it (behaviour, additive error code)

- **Raised by:** frontend, the supplier invoice session: "approve the invoice for payment and record the payment, each with its own approver, as the maker-checker rules say" (owner, 2026-11-17).
- **Contract read first (2.4.0):** `approveSupplierInvoice` takes `pur.supplier_invoice.approve` and refuses only on the match (`THREE_WAY_MATCH_FAILED`), the state and the period. Its `x-error-codes` have neither `MAKER_CANNOT_CHECK` nor `INVOICE_MAKER_CANNOT_APPROVE`, so the Accountant or the Owner may enter an invoice, match it and approve it for payment alone. The payment does need a second person (`submitSupplierPayment`, then `approveRequest`, `MAKER_CANNOT_CHECK`), and so do a credit note and a variance (`INVOICE_MAKER_CANNOT_APPROVE`). SHARED_BRIEF's separation of duties names supplier payments, not invoice approval.

**Request:** `approveSupplierInvoice` refuses the invoice's `createdBy` with 422 `INVOICE_MAKER_CANNOT_APPROVE` (the code and its meaning exist already), in the domain and the database, as a credit note's approval does; add the code to the operation's `x-error-codes`. Or say that invoice approval is deliberately one person's, and the payment's approval is the check.

**Until this lands:** invoice approval works as the contract says. The invoice screen shows any refusal of `approveSupplierInvoice` in words in its confirmation and on the page, so the refusal appears without a screen change once the server sends it. No switch: no shape changes.

**Status:** answered by 2.9.0 (422 `INVOICE_MAKER_CANNOT_APPROVE`, approved by the owner as a breaking behaviour). **Built in F10k:** the invoice screen offers no approval to the person who entered the invoice, and says someone else approves it; the refusal has its words.

## CR-044. What unit a line's quantity variance is in, and what its price variance is of (description fix)

- **Raised by:** frontend, the supplier invoice session: "when [the match] fails, show which lines disagree and by how much, from the API" (owner, 2026-11-17).
- **Contract read first (2.4.0):** `SupplierInvoiceLine.qtyVariance` is a `SignedQuantity` with no description, and `priceVariancePesewas` with `priceVarianceDirection` has none either. The match compares "its quantity in the base unit" with what was received, while the line's `qty` is in its `uom` (the order line's unit, a crate). The `listSupplierInvoices` example has 500 head at 1,290 against an order at 1,250 with `priceVariancePesewas` 20,000, which is the whole line's difference (500 × 40), not the unit price's.

**Request:** say in the descriptions (1) which unit `qtyVariance` is in: the line's `uom` or the product's base unit; (2) its sign: positive when the invoice charges more than is available to invoice; (3) that `priceVariancePesewas` is the line's whole difference from the order price, and `priceVarianceDirection` whether it is over or under.

**Until this lands:** the invoice screen reads `qtyVariance` in the line's `uom`, positive as "more than was received" and negative as "less", and `priceVariancePesewas` as the line's whole difference ("GH₵10.50 over the order's price on this line"), as A-F10-06 records.

**Status:** answered by 2.9.0. `qtyVariance` is in the product's base unit; `priceVariancePesewas` is per unit of the line's `uom`; the new `priceVarianceLinePesewas` is the line's whole difference. A-F10-06 read the price variance as the line's, which was wrong. **Built in F10k:** the line reads "30 eggs more than is left to invoice" and "GH₵0.50 per crate over the order's price; GH₵10.50 over on this line".

## CR-050. Who can witness a cash drop now, and a drop with no witness when nobody can (additive, behaviour)

- **Numbered CR-045 when it was raised** (merged in PR #29, 2026-11-18). The quotes session raised its own CR-045 to CR-049 at the same time, so this one is renumbered CR-050. A backend note that names CR-045 for `listShiftWitnesses` or the unwitnessed drop means this request.
- **Raised by:** frontend F10j, the till's shift screen: "a supervisor witnesses the drop when one is signed in at the branch. When none is, the drop goes ahead marked unwitnessed, as the server allows. Show that state plainly" (owner, 2026-11-17; the backend's A-273 (d) records the same decision, "built in B09b continued").
- **Contract read first (2.5.0):** `recordCashMovement` refuses a `CASH_DROP` without a `witnessId` (422 `CASH_MOVEMENT_INVALID`, `WITNESS_REQUIRED`); the witness holds `pos.shift.close.approve` at the branch and is neither the cashier nor the caller, and is named, not signed in (A-273 (d)). Nothing tells the till who that could be: `listUsers` needs `iam.user.read` and `listSessions` needs `iam.session.read.any`, which a cashier holds neither of, and neither says who holds a permission at a branch. `CashMovement.witness` is already nullable.

**Request, two parts:**

1. **`listShiftWitnesses`**, `GET /shifts/{id}/witnesses`, permission `pos.cash.move`, ownership the shift's own cashier, with the device credential as `recordCashMovement` has it. It answers `ShiftWitnessList`: `{ data: PrincipalRef[], asOf: date-time }`, the holders of `pos.shift.close.approve` at the shift's branch with a live staff session now, never the shift's cashier, so every one is a `witnessId` the server takes. An empty `data` means no supervisor is signed in.
2. **`recordCashMovement` takes a `CASH_DROP` with no `witnessId` when no supervisor is signed in at the branch**, answering `witness: null`, and puts it on the exception report; `WITNESS_REQUIRED` only when one is. No field changes: `witness: null` on a drop is "unwitnessed".

**Until this lands:** the e2e and CI builds switch it on (`HK_REQUESTED_CONTRACT=…,CR-050`, ADR 0046) and the fake answers it (`e2e/support/till.ts`). `requested/landed.ts` checks the first part.

**Status (F10k, 2026-11-18): part 2 answered by 2.6.0, part 1 still open.** `recordCashMovement` takes a drop with no `witnessId` while no supervisor is signed in at the branch and answers `unwitnessed: true`; the X and Z reports count them (`unwitnessedDropsCount`, `unwitnessedDropsPesewas`). No operation tells the till who is signed in yet, so the switch stays. The owner says the backend is adding that read.

**The witness, as the owner decided (2026-11-18):** the supervisor who takes the cash enters their PIN on the till, checked on the device by the till PIN's rules (CR-032). Naming a supervisor without their PIN is not a witness, so the till never sends a `witnessId` it did not prove that way. The till uses part 1's answer only to know whether a witness is needed: anyone signed in means a PIN is asked for; nobody means the drop goes unwitnessed and no PIN is asked. So part 1 may answer only whether a supervisor is signed in, if that is simpler; the names are shown so the cashier knows whom to ask. Offline, or without part 1, a supervisor who is there enters their PIN, and without one the drop is sent unwitnessed and the server decides.

**Not asked, for the backend to weigh:** the server cannot tell that a `witnessId` came from a PIN. The PIN check is reported with `reportTillPinEvents` (CR-032), as an offline mobile money approval is; if the server should hold the drop to that report, say so and the till will send the approval's verifier version on the movement.

## CR-045. A quote line names the unit it is sold in, a crate or a single egg (additive)

- **Raised by:** frontend, the quotes session: "build a quote for a customer with crate and egg lines priced by the API" (owner, 2026-11-17).
- **Contract read first (2.5.0):** `QuoteLine` answers `uom`, but `QuoteLineInput` (taken by `createQuote` and `updateQuoteVersion`) has no `uom`, so a quote cannot say whether "10.000" of the big eggs is ten crates or ten eggs. `PriceResolveLine.uom` (2.1.0) already prices a crate by the crate's entry and a single egg by the base unit's, and `PurchaseOrderLineInput`, `GoodsReceiptLineInput` and `OrderLineInput` take the unit they are entered in.

**Request:** `QuoteLineInput.uom: string` (pattern `^[A-Z]{2,10}$`), optional: the product's sale unit when left out, or a unit it converts from (`CRATE`, `UNIT`); a unit the product is not sold by is 422 `REFERENCE_NOT_FOUND`, as `resolvePrices` answers. `QuoteLine.uom` answers the unit sent, `resolvedUnitPricePesewas` is the entry for that unit (never one derived from the other unit's), and `convertQuote` carries the unit to the order line.

**Until this lands:** the quote builder sends `uom` only in a build switched on for CR-045 (`HK_REQUESTED_CONTRACT`, ADR 0046), from `apps/console/src/requested/quoteLineUnit.ts`. Each line's price comes from `resolvePrices` for that unit and customer, and is sent as `unitPricePesewas`; the person may agree another, and the API's price stays beside it. With the switch off, a line is in the product's sale unit and the screen says that a line by the single egg waits for the server.

**Answered in 2.12.0 (F10l):** `QuoteLineInput.uom`, the product's base unit when left out, and `QuoteLine.baseQuantity`. The switch and `requested/quoteLineUnit.ts` are deleted: every line sends its unit, and the notice that a line by the single egg waits is gone.

## CR-046. A credit order past the limit or the terms is refused with the amount over, and an override is asked for with a reason (behaviour, additive)

- **Raised by:** frontend, the credit control session: "a sale that would take a customer past their limit, or a customer past their terms, is refused by the server; show the refusal in words, with the amount over. An override needs an Owner or Manager, a reason, and is never approved by the person asking. Show who approved it" (owner, 2026-11-17).
- **Contract read first (2.5.0):** `confirmOrder` answers **202** `CREDIT_OVERRIDE` for a business account over its limit or on hold; until B10 it refuses a credit order with 422 `ORDER_INVALID` `CREDIT_CHECK_UNAVAILABLE` (A-224). Nothing answers by how much the order is over, nothing refuses a customer past their terms, the override carries no reason (`confirmOrder` takes no body), and `CreditOverride` names `approvedBy` but neither the reason nor who asked. `BusinessAccount` answers `exposurePesewas`, `availableCreditPesewas` and `overduePesewas`; working out "over by" from them and the order's estimate would be the browser computing money. No seeded role holds any `quo.*` or `whl.*` permission yet.

**Request:**

1. `GET /orders/{id}/credit-check` (`getOrderCreditCheck`, `ord.order.read`), answering `OrderCreditCheck`, worked out by the server as `confirmOrder` would judge it now:

   ```yaml
   OrderCreditCheck:
     order: DocumentRef
     customer: CustomerRef
     outcome: PASSES | OVER_LIMIT | PAST_TERMS | ON_HOLD | NOT_REQUIRED # NOT_REQUIRED: not a credit order
     creditLimitPesewas: Pesewas
     exposurePesewas: Pesewas # outstanding invoices plus confirmed orders, before this order
     orderPesewas: Pesewas # this order's estimated total, as the limit counts it
     overLimitPesewas: Pesewas # by how much exposure plus this order exceeds the limit; 0 when within
     overduePesewas: Pesewas
     oldestOverdueDays: integer | null # days the oldest unpaid invoice is past its due date
     paymentTermsDays: integer
     override: null | CreditOverrideState
     checkedAt: date-time
     currency: Currency
   CreditOverrideState:
     approvalRequestId: uuid
     status: PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED | EXPIRED
     reason: string
     requestedBy: PrincipalRef
     requestedAt: date-time
     decidedBy: PrincipalRef | null
     decidedAt: date-time | null
   ```

2. `confirmOrder` **refuses** a credit order that is over the limit, past the terms or on hold with 422 `CREDIT_LIMIT_EXCEEDED`, `CREDIT_TERMS_EXCEEDED` or `ACCOUNT_ON_HOLD`, unless an APPROVED override covers this order at this amount; the message names the amount over ("This order would take Asantewaa Chop Bar GH₵420.00 over its GH₵5,000.00 credit limit."). With an approved override it confirms with `creditCheck: OVERRIDDEN`.
3. `POST /orders/{id}/credit-override` (`requestCreditOverride`, `ord.order.confirm`, idempotent, CSRF) taking `{ reason: string }` (required, not blank), answering 202 `ApprovalPending` of kind `CREDIT_OVERRIDE` whose subject is the order. It is approved through `approveRequest` by a holder of `whl.credit.override` (seeded to the Owner and the Manager only) who is not the person who asked (422 `MAKER_CANNOT_CHECK`). Refused with 422 `ORDER_INVALID` (`CREDIT_OVERRIDE_NOT_NEEDED`) when the check passes, and `APPROVAL_PENDING` while one waits.
4. `CreditOverride` gains `reason: string`, `requestedBy: PrincipalRef` and `overLimitPesewas: Pesewas`.
5. The seed grants the `quo.*` and `whl.*` permissions (CR-023). The frontend fake assumes: the Owner and the Manager hold all of them; the Sales role holds `quo.rfq.read`, `quo.rfq.update`, `quo.quote.read`, `quo.quote.create`, `quo.quote.issue`, `quo.quote.convert`, `whl.account.read` and `whl.ageing.read`; the Accountant holds `whl.account.read`, `whl.account.hold` and `whl.ageing.read` (A-F10-10).

**Until this lands:** the order's credit check and the override are built against these shapes behind `HK_REQUESTED_CONTRACT=CR-046` (ADR 0046, ADR 0052, ADR 0053): `apps/console/src/requested/creditControl.ts`, answered in the e2e suite by `e2e/support/requested.ts`. With the switch off, the order page confirms as the contract says, shows a 202 as "waiting for a credit override" with its approval, shows `CREDIT_CHECK_UNAVAILABLE` in words, and says that the amount over waits for the server.

**Answered in 2.14.0 (F10m):** `getOrderCreditCheck`, `requestCreditOverride` (202 `CreditOverridePending`) and `CreditOverride.reason`, `requestedBy` and `overLimitPesewas`, in the requested shape, with `reasons` and an outcome `NO_ACCOUNT` beside it; `confirmOrder` takes `creditOverrideReason`. The switch and `requested/creditControl.ts` are deleted: the order's credit card and the override call the generated client, and the account's overrides always show who asked and why.

## CR-047. The quote link's token, and what an accepted or replaced quote says (description fix, additive)

- **Raised by:** frontend, the quote acceptance page: "the link carries its own long random token, never a quote number or ID. Show clear states for an expired quote and for one replaced by a newer revision" (owner, 2026-11-17).
- **Contract read first (2.5.0):** `viewQuoteByLink`, `acceptQuoteByLink` and `declineQuoteByLink` take `token` as a bare string. `issueQuoteVersion` says it "sends the acceptance link"; nothing says what the token is, how long it lives, or whether a newer version's link replaces it. `PublicQuote.status` has `EXPIRED` and `SUPERSEDED`, but an `ACCEPTED` quote does not say who accepted it or when, and a `SUPERSEDED` one does not say a newer version was sent.

**Request:**

1. Say in the descriptions that `token` is opaque, at least 128 bits from a secure random source, URL-safe, stored only as its hash, never derived from the quote's number or id, one per issued version, and that a wrong or unknown token is 404 with nothing about the quote (as the tracking link's token is, 2.0.1).
2. `PublicQuote` gains `acceptedName: string | null` and `decidedAt: date-time | null` (the acceptance or decline), and `supersededAt: date-time | null` (when a newer version was issued and sent).
3. Say which refusal `acceptQuoteByLink` answers for an expired version and for a superseded one (409 `CONFLICT` or 422 with a code), so the page can say which.

**Until this lands:** nothing is switched. The page shows the status the API gives: an expired quote says when it expired and how to ask for a new one; a replaced one says the farm sent a newer version and this link can no longer be used. A refused acceptance reads the quote again and shows its state in words.

**Part answered in 2.12.0 (F10l):** items 1 and 3. The token is `quo_` and 256 random bits, kept as its hash, answered once by `issueQuoteVersion` (`QuoteVersion.acceptanceLinkToken`), and a closed link is 422 `QUOTE_LINK_CLOSED` with `EXPIRED`, `REPLACED` or `WITHDRAWN` and nothing of the quote (ADR-0087). The link page says each in words. Item 2 is open: `PublicQuote` still has no `acceptedName`, `decidedAt` or `supersededAt`.

## CR-048. Who quotes, holds, releases and approves: the seed for quotes and wholesale, and a second person on a release and a limit change (seed, behaviour)

- **Raised by:** frontend, F10i, on the owner's decision (2026-11-18): "Sales builds, revises, sends and converts quotes, and never approves an override. The Accountant may put an account on hold. Releasing a hold, approving an over-limit override and changing a credit limit are Owner or Manager only, never the person who asked."
- **Approved by the owner (2026-11-18):** a second Owner or Manager on every hold release and every credit-limit change (items 2 and 3 below). Raised as CR-049 while this session was briefly numbered F10j; the same request.
- **Contract read first (2.5.0):** no seeded role holds any `quo.*` or `whl.*` permission. `holdBusinessAccount` and `releaseBusinessAccount` both take `whl.account.hold`, so whoever may put a hold on may also release it. `updateBusinessAccount` (`whl.account.manage`) needs approval only for "raising a credit limit above the configured amount" (202 `CREDIT_OVERRIDE`), so a limit change below that amount is one person's.

**Request:**

1. **The seed** (CR-023, `components.x-seeded-roles`):

   | Permission                                                                                                     | Owner | Manager | Sales | Accountant |
   | -------------------------------------------------------------------------------------------------------------- | ----- | ------- | ----- | ---------- |
   | `quo.rfq.read`, `quo.rfq.update`, `quo.quote.read`, `quo.quote.create`, `quo.quote.issue`, `quo.quote.convert` | yes   | yes     | yes   | no         |
   | `whl.account.read`, `whl.ageing.read`                                                                          | yes   | yes     | yes   | yes        |
   | `whl.account.hold` (put on hold)                                                                               | yes   | yes     | no    | yes        |
   | `whl.account.release` (new: release a hold)                                                                    | yes   | yes     | no    | no         |
   | `whl.account.manage` (open an account, change its terms)                                                       | yes   | yes     | no    | no         |
   | `whl.credit.override` (approve a credit override, CR-046)                                                      | yes   | yes     | no    | no         |

2. **Releasing a hold** takes `whl.account.release` (not `whl.account.hold`), and answers 202 `ApprovalPending` of a kind such as `ACCOUNT_RELEASE`, approved by a holder of `whl.account.release` who did not ask (422 `MAKER_CANNOT_CHECK`).
3. **Every change to a credit limit**, up or down, answers 202 `CREDIT_OVERRIDE` (or a new `CREDIT_LIMIT_CHANGE`), approved by an Owner or Manager who did not ask; the other terms may change at once.
4. **A credit override** (CR-046) is approved only by a holder of `whl.credit.override`, never by the person who asked; Sales may ask (it holds `ord.order.confirm`) and never approve.

**Until this lands:** the test fake gives these roles as above (A-F10-10), with `whl.account.manage` standing in for the release permission: the console offers "Release from hold" only to a holder of both `whl.account.hold` and `whl.account.manage`, so the Accountant who may put a hold on never sees it. The account screen already shows a 202 from a limit change or a release as waiting for an Owner or Manager other than the person who asked, with the approval. No switch: the shapes are the contract's.

**Answered in 2.14.0 and 2.16.0 (F10m):** the seed grants `whl.*` as asked (the Owner and the Manager everything, with `whl.account.release` and `whl.credit.override`; Sales and the Accountant the reads, the Accountant the hold); `releaseBusinessAccount` takes `whl.account.release` and answers 202 `ACCOUNT_RELEASE`; every credit-limit change answers 202 `CREDIT_LIMIT_CHANGE`. Built: "Release from hold" is offered to a holder of `whl.account.release`, an account says when a limit or a release waits for its second person (`pendingCreditLimitPesewas`, `pendingRelease`), and the fake's grants match the seed.

## CR-049. The shop's request for quote takes a quantity and its unit (additive)

- **Raised by:** frontend, F10i, the request-for-quote form: "how many crates". The owner (2026-11-18): the count as text is fine until the backend adds a quantity and unit field.
- **Contract read first (2.5.0):** `PublicQuoteRequest` has `requirements` (free text, 2,000 characters), `productId` and `stockUnitId`, and no quantity; `Rfq` answers none either.

**Request:** `PublicQuoteRequest.quantity: Quantity` and `PublicQuoteRequest.uom: string` (pattern `^[A-Z]{2,10}$`, `CRATE` or `UNIT` for eggs), both optional and sent together; `RfqCreate` takes the same two, and `Rfq` answers them (null when not given), so the quote builder can start the line from them.

**Until this lands:** the form writes the number into `requirements` as "Crates wanted: N" (A-F10-11), and the request's page shows the buyer's words.

**Answered in 2.12.0 (F10l), not built:** `PublicQuoteRequest.quantity` and `uom`, but only with `productId`. The shop's form names no product, so the count stays in `requirements` (A-F10-11) until the form asks which product.

**Answered in 2.17.0 (F10n), and built:** `listShiftWitnesses` (part 1), read with `useApiQuery` on the till's shift screen. A witnessed drop carries the witness's PIN version (`witnessPinVersion`). The switch is deleted.

## CR-051. The offline pack names its units, for one and for more (additive)

- **Raised by:** frontend F10k, the till's sale screen, after 2.9.0 gave every unit `singularName` and `pluralName` ("540 eggs", "1 crate").
- **Contract read first (2.10.0):** `OfflinePack` carries `products` (each with `saleUom` and its codes) and `stockUnits`, but no unit's names. The back office reads them from `listUnitsOfMeasure`, but the till works from its pack offline, so it says the code in lower case: "6 egg", "By the egg".

**Request:** `OfflinePack.uoms`: `{ code, name, singularName, pluralName, displayDecimals }[]`, the units the pack's products are sold or counted in, as `Uom` gives them. Additive; a planned operation, so B9b can add it with `getOfflinePack`.

**Until this lands:** the till says the unit's code in lower case after a quantity ("6 egg"), which is wrong for a plural. Nothing is built on it.

**Still open after 2.11.0 (F10l):** `getOfflinePack` moved into code without `uoms`.

**Answered in 2.17.0 (F10n):** `OfflinePack.uoms` as asked. The till says "6 eggs", "1 crate" and "By the egg" from it, on screen and on the printed receipt.

## CR-052. The till sells a live animal priced by grade or weight (additive)

- **Raised by:** frontend F10l, the till's sale screen, after 2.11.0 moved `getOfflinePack` into code.
- **Contract read first (2.12.0):** `getOfflinePack` says "a product priced by grade or weight (a live animal) has no single band (`priceBand` null)", and its example gives the goat no band and a `sellingUnits` entry with no band. `OfflineStockUnit` carries `gradeId` and `lastWeightKg` but no price. The till totals offline from the pack's band (BUILD_PROMPT's one exception) and keeps an agreed price inside the floor and ceiling, so with no band it cannot sell the animal at all: the sale screen says "Goat has no price on this till". Selling a live animal at the counter is in the mission ("sell live animals by weight").

**Request:** the band each sellable animal is sold at, resolved as the server would at the counter (the register's lists, a buyer with no account, its grade and its weight band from `lastWeightKg`): `OfflineStockUnit.priceBand: PriceBand | null` and `OfflineStockUnit.priceListEntryId: uuid | null`, null when the animal has no price at this register. A product priced per kilogram keeps its own band, and the scale gives the weight. Say in `syncOfflineSales` how an animal re-weighed at the sale is priced if its weight moved it to another band.

**Until this lands** (the owner, 2026-11-18: the backend adds each animal's price to the pack late in the till work): with the real pack, an animal's tile says "Sold through quotes and orders" before it is tapped, and a tap, or its tag found by search, says the animal is sold through quotes and orders, not at this till, and to make a quote or an order in the back office. Nothing goes on the sale, and everything else sells (`soldThroughQuotes` in `pos/sale/catalogue.ts`; `pos-till.spec.ts` with the pack as 2.11.0 answers it). The other till specs give the goat the per-head band of 2.10.0's example (`goatPricedPerHead` in `e2e/support/till.ts`), so they still run with an animal.

## CR-053. An order names its pick lists and the answer it waits for (additive)

- **Raised by:** frontend F11, the order's picking and delivery page (`/orders/:id/fulfilment`).
- **Contract read first (2.10.0; the same in 2.12.0):**
  - `listFulfilments` filters by `status`, `pickLocationId` and `date`, not by order, and `SalesOrder` names its `delivery` but not its fulfilments. The page reads every open pick list (`useApiAllPages`, ADR 0028) and finds the order's among them.
  - An order `AWAITING_CUSTOMER` does not say what it waits for: a substitute proposed with `proposeSubstitution`, or a weighed total over `maximumTotalPesewas`. The person recording `recordCustomerConsent` has to choose `kind` themselves.

**Request:**

1. `listFulfilments` takes `orderId`, and `SalesOrder.fulfilments: DocumentRef[]`.
2. `SalesOrder.pendingConsent`: null, or `{ kind: 'SUBSTITUTION' | 'HIGHER_TOTAL', lineId, proposed: { productId, productName, quantity, uom } | null, weighedTotalPesewas: Pesewas | null, askedAt }`. The page can then show what the customer was asked, and send the right `kind`.

**Until this lands:** the page reads the open pick lists and matches `order.id`. The consent form asks which of the two the customer was asked (A-F11-05).

## CR-054. Picking eggs: cracked eggs on the pick, a short pick with the customer's agreement, and a substitute's unit (additive, description)

- **Raised by:** frontend F11, the pick list (`/fulfilments/:id`). The owner: "Eggs found cracked while picking are recorded with a reason, and the order is short-picked or substituted only with the customer's agreement, as the server allows."
- **Contract read first (2.10.0):**
  - `PickInput` has `qty`, `weightKg`, a stock unit and a pack barcode, but nothing for what was found broken.
  - `recordPicks` says nothing of a pick below `qtyToPick`.
  - `ConsentRecord.kind` is `HIGHER_TOTAL` or `SUBSTITUTION`: there is no consent to receive less.
  - `SubstitutionCreate` has `productId` and `quantity`, but no unit. An egg order line is in crates or in single eggs (2.1.0).

**Request:**

1. **Breakage on the pick.** `PickInput.damaged`: optional, `{ qty: Quantity, reasonCode: string }`, in the line's unit, a `STOCK_ADJUSTMENT` reason (`BREAKAGE`). The server writes the broken units off from the pick location in the same transaction as the pick, and the fulfilment's line names it. Until then the console writes them off with `createStockAdjustment` and `submitStockAdjustment` (`BREAKAGE`, `LOSS`, at the pick location, in the product's base unit), unlinked to the pick.
2. **A short pick only with agreement.** Either confirm that a short pick is a `proposeSubstitution` of the same product with a smaller `quantity`, answered by `recordCustomerConsent` `SUBSTITUTION`, or add `ConsentRecord.kind` `SHORT_PICK` and a way to propose one. Either way, say what `recordPicks` does with a quantity below `qtyToPick` while no agreement is recorded: refuse it (422), or back-order the rest.
3. **`SubstitutionCreate.uom`**: optional, the unit `quantity` is in (a crate or an egg), the line's unit when left out, refused (`UNIT_NOT_SOLD`) in a unit the product is not sold by.

**Until this lands:**

- the pick list refuses a quantity below or above `qtyToPick`;
- a short line is offered to the customer as a substitution of the same product in a smaller quantity, in the line's unit;
- cracked eggs are written off as in item 1 (A-F11-06, A-F11-07).

## CR-055. A part delivery: what was delivered, and why the rest came back (additive)

- **Raised by:** frontend F11, the driver's stop (`/driver/stops/:id`). The owner: "recording a refused or part-delivered order with a reason".
- **Contract read first (2.10.0):**
  - `ProofOfDeliveryCreate` closes the whole delivery.
  - `DeliveryFailure` fails the whole delivery (`REATTEMPT` or `RETURN_TO_STOCK`).
  - `Delivery.contents` carries no order line id, so a line cannot be named.
  - A customer who keeps 10 of 12 crates cannot be recorded.

**Request:**

1. `Delivery.contents[].orderLineId`.
2. `ProofOfDeliveryCreate.lines`: optional, `{ orderLineId, deliveredQty: Quantity }[]`. Absent means everything was delivered.
3. `ProofOfDeliveryCreate.returnedReasonCode`: a `DELIVERY_FAILURE` reason, required when a line is short.

The server returns the rest to stock (or keeps it on the van for a reattempt, as `nextAction`), invoices what was delivered, and fixes the cash due again. The same in `DriverProofSync`, so it is accepted from the offline queue.

**Until this lands:**

- a refused order is a failed attempt with its reason, `RETURN_TO_STOCK`;
- the stop says in words that a part delivery cannot be recorded yet;
- the driver delivers all of it, or records it as not delivered, and tells the office (A-F11-08).

## CR-056. The B11 seed: the Driver, the Storekeeper's picking, and a list of drivers (seed, additive)

- **Raised by:** frontend F11, every screen of this phase.
- **Contract read first (2.10.0 `x-seeded-roles`):**
  - No role holds any `del.*` permission but `del.slot.*`.
  - No role holds `ord.fulfilment.*` or `ord.order.update`.
  - The seeded Driver holds only `iam.session.read`, `iam.session.revoke` and `mdm.product.read`. It could not read its run, record a proof, upload the proof's photograph (`platform.file.upload`) or read the failure reasons (`mdm.reason_code.read`).
  - Choosing a driver at dispatch means `listUsers` (`iam.user.read`) and filtering for a `DRIVER` grant.

**Request:**

1. **Driver:** `del.delivery.read.assigned`, `del.delivery.update.assigned`, `del.proof.create`, `platform.file.upload` (purpose `PROOF_OF_DELIVERY` at least) and `mdm.reason_code.read`.
2. **Storekeeper:** `ord.fulfilment.read`, `ord.fulfilment.pick`, and `ord.order.read` for the order it picks.
3. **Manager and Owner:** `ord.fulfilment.*`, `ord.order.update`, `del.delivery.read`, `del.delivery.assign`, `del.route.read` and `del.route.manage`.
4. **A list of drivers** that dispatch can read without `iam.user.read`: `listUsers?roleCode=DRIVER` under `del.route.manage`, or a `listDrivers`.

**Until this lands:** the test fake grants exactly this (A-F11-01; `fakeRoles.test.ts` fails line by line as the seed catches up). A console against the real API shows each screen's permission-denied state.

## CR-057. A driver's cash is handed in at a till shift; and three answers the driver's phone needs (additive, description)

- **Raised by:** frontend F11, the driver's cash screen (`/driver/cash`) and the queue. The owner: "The cash is handed in at a till shift, never typed in as loose cash."
- **Contract read first (2.10.0):**
  - `DriverCashReconciliationCreate` takes a driver, a date and `declaredPesewas`, but no till shift. Since 2.6.0 cash moves into or out of a till only through its open shift, so a driver's hand-in would be cash outside every drawer.
  - `getMyRoute` lists no 404, so the contract does not say what a driver with no run that day gets.
  - `syncDriverEvents` answers a resend `DUPLICATE` with `reason`. It does not say whether that carries the first answer's exception ("cash collected differs") when the first answer was lost.

**Request:**

1. `DriverCashReconciliationCreate.shiftId`: the open till shift the cash is counted into. Its cashier is `receivedBy`, never the driver. The cash lands in that shift's drawer, so the X and Z reports and the blind close see it. The hand-in itself is a till screen, for the till's session.
2. `getMyRoute` with no run that day: say whether it answers 404 or a route with no stops.
3. `DriverSyncItem` for a `DUPLICATE`: answer the first result's `outcome` and `reason` (in a `firstOutcome` field if `outcome` must stay `DUPLICATE`), as the operations' "a resubmission with the same id returns the first result" says.

**Until this lands:**

- the driver's screen shows the server's `expectedPesewas`, and the collections not sent yet one by one, and says the cash is handed in at a till shift;
- nothing is built for the hand-in (the till is another session's);
- the phone treats a 404 and an empty route alike ("No run for you today");
- after a lost answer, the phone's own words say when cash differs from what was due.

**Answered in 2.31.0 (F10o), differently from item 1, and built:**

- A hand-in is its own till operation, `handInDriverCash` (`POST /shifts/{id}/driver-cash-hand-ins`, `pos.sale.create`, the device credential), on the cashier's own open shift. `createDriverCashReconciliation` and `postDriverCashReconciliation` are deprecated, never built.
- Every collection the driver holds at the branch is handed in at once; the count is a cleared cash payment in the drawer, counted at the close. Short or over goes to the driver variance report.
- The till's shift screen takes it: driver, blind count, a confirmation with the amount, then the server's expected, counted and short or over kept on screen. A refusal stays in words.
- **The till cannot find the driver's id:** nothing the Cashier holds lists drivers. CR-063 asks for that read; until it lands the hand-in is behind its switch.
- Items 2 and 3 (the driver's phone) are not answered by 2.31.0.

## CR-058. After a margin approval, the salesperson issues the quote and gets its link (behaviour, additive)

- **Raised by:** frontend F10n, the quote page. The owner (2026-11-19): after a margin approval, the salesperson issues and sends the quote and sees its link; the backend is changing it.
- **Contract read first (2.17.0):**
  - `issueQuoteVersion` below the margin floor answers 202 `ApprovalPending` (`QUOTE_BELOW_MARGIN`). Approved, "the version is issued", so the link's token goes to the approver's answer, which never shows it.
  - `QuoteVersion` has no state for "approved, not yet issued".
- **Today:** the quote page tells the salesperson to make a new link from the quote ("Make a new link", `channels: []`).

**Request:**

1. **Approving `QUOTE_BELOW_MARGIN` no longer issues the version.** It records the approval on the version and nothing else. There is no reservation, no `quo.QuoteIssued` and no token.
2. **The version says it is approved and waiting to be issued.** For example, `QuoteVersion.marginApproval`: `{ approvalRequestId, decidedBy: PrincipalRef, decidedAt }` or null. With it, `Quote.status` is a value such as `APPROVED`, distinct from `PENDING_APPROVAL` and `ISSUED`.
3. **`issueQuoteVersion` on an approved version issues it**, with the channels the salesperson chooses. It answers 200 with `acceptanceLinkToken`, as an unapproved issue does, and does not ask for approval again unless the prices or costs changed since it was approved. If they changed, it answers 202 again, with the reason.
4. **Who may issue it:** a holder of `quo.quote.issue`, normally the version's author. Please state whether the approver may issue it too.

**Until this lands:** nothing changes on the console. When the contract carries it, the quote page offers "Issue and send" on an approved version and shows the link once, as for any issue (F10m, section 3).

## CR-059. The daily exception report: marking an item reviewed, and the controls that have no kind (additive, seed)

- **Raised by:** frontend F12, the daily exception report (`/exceptions`). The owner (F12 brief, 2026-11-19): "Let an Owner or Manager mark it reviewed with a note. Urgent items at the top."
- **Contract read first (2.16.0 and 2.17.0):**
  - `getDailyExceptionReport` and `listExceptions` answer `ExceptionItem`s with a severity, branch, actor, `subjectDocument` and `raisedAt`, but nothing says whether anyone has looked at an item, and no operation records it.
  - `ExceptionKind` has no kind for five controls the owner names as feeding the report. The descriptions publish each for "the daily exception report's source", but not under which kind:
    - an unwitnessed cash drop (`recordCashMovement`, `syncOfflineSales`, abuse case 17);
    - a death's photograph whose bytes are already on another record (`liv.MortalityPhotoReused`, abuse case 2);
    - a quote accepted from its link in a browser holding a staff session;
    - cash handed in late (a driver's collections not handed in on the day, `OFFLINE_CASH_NOT_TAKEN` at sync);
    - stock that went below zero (`NEGATIVE_STOCK` at sync, a `StockException` kind).
  - No seeded role holds `rpt.exceptions.read` (2.16.0 `x-seeded-roles`).

**Request:**

1. `reviewException`: `POST /exceptions/{id}/review`, permission `rpt.exceptions.review`, `Idempotency-Key`, CSRF. Body `ExceptionReviewCreate { note: string }`, 1 to 500 characters, as `ReasonRequest.reason`. Answers the `ExceptionItem` with its `review`. A second review is 409 `ALREADY_REVIEWED`, or replaces the first; say which. It is audited.
2. `ExceptionItem.review: ExceptionReview | null`, always sent: `{ reviewedBy: PrincipalRef, reviewedAt: date-time, note: string }`.
3. `listExceptions?reviewed=true|false`, so the header can show only what nobody has looked at.
4. `ExceptionKind` gains `CASH_DROP`, `MORTALITY_PHOTO_REUSED`, `QUOTE_ACCEPTED_BY_STAFF`, `CASH_HANDED_IN_LATE` and `NEGATIVE_STOCK`. If any of them already lands under an existing kind, say which, and which `details` key names it.
5. **The seed:** the Owner and the Manager hold `rpt.exceptions.read` and `rpt.exceptions.review`; the Accountant holds `rpt.exceptions.read`.

**Until this lands:**

- the report shows every item, urgent first, and says in words that marking reviewed waits for the backend;
- an e2e build switched on for CR-059 sends `reviewException` and reads `review` (`requested/exceptionReview.ts`, ADR 0046, ADR 0053);
- the five kinds have their words ready, and any kind the build does not know shows its code.

## CR-060. The egg reports: sales by shop, margin per crate after breakage, breakage by reason and shop, stock valuation (additive)

- **Raised by:** frontend F12, the reports section (`/reports`). The owner's F12 brief names the four.
- **Contract read first (2.16.0):** `listReportDefinitions` lists ten codes: `STOCK_ON_HAND`, `AGEING_STOCK`, `EXPIRING_LOTS`, `MORTALITY_RATE`, `FEED_CONVERSION`, `DELIVERY_PERFORMANCE`, `SALES_BY_CASHIER`, `SALES_SUMMARY`, `PURCHASES` and `CUSTOMER_LIST`. None is for eggs. `STOCK_ON_HAND` values all stock at cost, not eggs by crate and loose egg. Breakage is a stock adjustment reason (CR-035), with no report.

**Request:** four codes on `runReport`, each listed by `listReportDefinitions` with its parameters and with a named example (`Prefer: example=<CODE>`), in SCREEN, XLSX and PDF. Money is integer pesewas; quantities are in eggs, the base unit, with the crate's figure beside them where it applies.

1. `EGG_SALES_BY_SHOP` (`branchId`, `from`, `to`): per branch and channel, crates sold, loose eggs sold, eggs in all, net sales and tax, with totals.
2. `EGG_CRATE_MARGIN` (`branchId`, `from`, `to`): per branch, the crates sold, the cost per crate at cost with breakage spread over the good crates, the price per crate, and the margin per crate in pesewas and per cent, all from the server.
3. `EGG_BREAKAGE` (`branchId`, `from`, `to`): per branch and reason code (received broken, broken in store, cracked at picking, rejected at the door), the eggs written off and their value at cost.
4. `EGG_STOCK_VALUATION` (`branchId`, `to`): per branch and location, crates and loose eggs on hand, and their value at cost, never at price (CR-001).

**Until this lands:** the reports section lists the four. Each says it waits for the backend, until `listReportDefinitions` lists its code. Then it runs on `runReport` like every other report, with no console change.

## CR-061. The VAT return: VAT, NHIL and GETFund for a period (additive)

- **Raised by:** frontend F12, the reports section (`/reports/vat-return`).
- **Contract read first (2.16.0):** the tax module carries the levies (`listTaxLevies`: VAT, NHIL and GETFund, 15%, 2.5% and 2.5% on one base), the scheme versions and `calculateTax`. No operation or report code gives a period's return: output tax charged, input tax reclaimable and the net due, per levy.

**Request:** a `VAT_RETURN` code on `runReport` (`branchId`, `from`, `to`), listed by `listReportDefinitions`, in SCREEN, XLSX and PDF.

- One row per levy, in the order the return is filed: code, name, rate, the taxable base, output tax on sales, input tax reclaimable on purchases (zero for a levy that is not reclaimable), and the net due. Every money column is integer pesewas.
- `totals`: the base, the output, the input and the net due for all three.
- If the return is better as its own operation (`getVatReturn`), with exempt and zero-rated sales apart, say so and the console will call that.

**Until this lands:** the VAT return is listed in reports and says it waits for the backend, until `listReportDefinitions` lists `VAT_RETURN`.

## CR-062. Every report exports: the financial statements and the exception report as files; and the B12 seed for reports (additive, seed)

- **Raised by:** frontend F12, the profit and loss, balance sheet and trial balance screens and the exception report. The brief's RPT: "export to spreadsheet and PDF for every report in the system".
- **Contract read first (2.16.0):**
  - `getProfitAndLoss`, `getBalanceSheet`, `getTrialBalance` and `getDailyExceptionReport` answer JSON only. `runReport` exports its own codes (PDF, XLSX), and `createExportJob` exports master data. `createAccountingExport` is the accountant's ledger package. Neither gives a statement as the owner reads it on screen.
  - No seeded role holds `rpt.report.read` or `rpt.report.export`. The Owner holds only `rpt.dashboard.owner` and `rpt.tile.read`.

**Request:**

1. Four codes on `runReport`, in PDF and XLSX only, with the parameters of the operations they mirror:
   - `PROFIT_AND_LOSS` (`branchId`, `from`, `to`);
   - `BALANCE_SHEET` (`branchId`, `asOf`);
   - `TRIAL_BALANCE` (`branchId`, `from`, `to`);
   - `DAILY_EXCEPTIONS` (`branchId`, `date`).

   The figures are the operations' own, so a file always matches the screen.

2. **The seed:**
   - the Owner and the Manager hold `rpt.report.read` and `rpt.report.export`;
   - the Accountant holds them and `fin.report.read`.

**Until this lands:** each screen offers "This page as CSV", built from the table on screen. Its Export menu offers XLSX and PDF only once `listReportDefinitions` lists the screen's code.

## CR-063. The till lists the drivers who hold delivery cash at its branch (additive)

- **Raised by:** frontend F10o, the till's shift screen, the driver's cash hand-in (`handInDriverCash`, 2.31.0, CR-057).
- **Contract read first (2.31.0):**
  - `handInDriverCash` needs `driverId`, and says every collection the driver holds at the branch is handed in.
  - Nothing the Cashier holds lists drivers. `listUsers` needs `iam.user.read`; `getMyCashSummary` is the driver's own; `listDriverCashReconciliations` is the Manager's and the Owner's, and lists hand-ins already made; `SalesOrder.delivery` names no driver; the offline pack carries no people.
- **Why it matters:** without the driver's id the cashier cannot take a driver's cash at all, so the owner's rule (handed in at a till shift, never as loose cash) cannot be followed at the till.

**Request:**

1. `listShiftDriverCashHolders`: `GET /shifts/{id}/driver-cash-holders`, `pos.sale.create`, the device credential, the shift's own cashier (as `listShiftWitnesses`).
2. Answers `{ data: [{ driver: PrincipalRef, collections: integer }] }`: each driver holding at least one collection at the shift's branch that is not handed in, and how many.
3. **No amount.** The cashier counts blind, as the close is counted; `handInDriverCash`'s answer then shows what was expected. Say so if the backend would rather show it.
4. Another cashier's shift 403, a shift that is not open 422 `SHIFT_NOT_OPEN`, as `handInDriverCash`.

**Until this lands:** the till's shift screen says it cannot list the drivers yet, so it cannot take a driver's cash. The e2e and CI builds are switched on for CR-063 (ADR 0046) and their fake answers this shape; the hand-in itself calls the real `handInDriverCash`.
