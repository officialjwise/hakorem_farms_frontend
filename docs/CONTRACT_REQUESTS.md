# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status |
| ------ | ---------- | ------ |
| CR-001 | 2026-11-13 | Open   |
| CR-002 | 2026-11-13 | Closed |
| CR-003 | 2026-11-14 | Open   |

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
