# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status |
| ------ | ---------- | ------ |
| CR-001 | 2026-11-13 | Open   |
| CR-002 | 2026-11-13 | Closed |
| CR-003 | 2026-11-14 | Open   |
| CR-004 | 2026-11-14 | Open   |
| CR-005 | 2026-11-14 | Open   |
| CR-006 | 2026-11-14 | Open   |
| CR-007 | 2026-11-14 | Open   |
| CR-008 | 2026-11-14 | Open   |

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

**Request:** say which it is. (a) `TOTP_ENROLMENT_REQUIRED` issues a restricted session and cookies, so the two calls work as written; or (b) both calls accept the `challengeToken` (for example in the body), with no CSRF token because there is no session yet. This is the same question as CR-004 point 1 for the forced password change, and one answer can cover both.

**Until this lands:** enrolment is not built. A user whose sign-in answers `TOTP_ENROLMENT_REQUIRED` sees "this sign-in step is not available yet" (F1).

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
