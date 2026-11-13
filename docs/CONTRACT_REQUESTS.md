# Contract requests

Things the frontend needs that `contract/openapi.yaml` does not yet offer, or must offer in a specific shape. The backend track reads this file at the start of each session and either implements each request or explains in its report why not. Each entry names the screen that needs it.

| Id     | Date       | Status |
| ------ | ---------- | ------ |
| CR-001 | 2026-11-13 | Open   |

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
