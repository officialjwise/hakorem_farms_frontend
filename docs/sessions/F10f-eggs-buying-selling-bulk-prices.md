# F10f: the egg screens: buying in crates, a crate or a single egg at the till, and bulk buyer prices

- **Session:** F10 continued, on branch `claude/nifty-sagan-3ikft4`, from `main` at `439e1db` (F10e merged as PR #24).
- **Date:** 2026-11-17
- **Scope:** the egg screens from ADR 0049, in the owner's order:
  - (a) buying;
  - (b) selling in two units;
  - (c) bulk buyer prices.
- **Not done here:**
  - The shop's two units: the contract has none, and the owner said the shop waits (CR-039).
  - Items 1, 3 and 4 of the F10e opening message:
    - CR-032 and CR-033 did not land;
    - the storefront e2e ADR waits;
    - B9b is not live.

## The owner's two answers, at the start of the session

Contract 2.3.0 has a price per selling unit in price lists, price resolution and staff orders. It has no second unit at the till or in the shop. CR-036's claim was not in it either. Asked, the owner (2026-11-17) answered two things:

1. **The till is built behind a switch; the shop waits.**
   - CR-038 (the till) is built against its requested shape behind `HK_REQUESTED_CONTRACT` (ADR 0046).
   - CR-039 (the shop) is raised and nothing is built. The storefront has no switch mechanism, and adding one would be a new pattern.
2. **The claim waits for the contract.** It landed during the session (contract 2.4.0), so it is built on the contract.

ADR 0049's consequences record both.

## Contract 2.3.0, then 2.4.0 (additive)

| Sync  | Backend   | What it carries                                                                                                                                                                                                                                                                       |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.3.0 | `add9878` | <ul><li>CR-035: `rejectionReasonCode` and `rejectionNote` on a receipt line, the `GOODS_RECEIPT_REJECTION` reasons, and `BREAKAGE` and `RODENT_DAMAGE` for an adjustment.</li><li>An order line's price may be left out: it takes the last price paid.</li></ul>                      |
| 2.4.0 | `1eefa55` | <ul><li>CR-036: the supplier claim (`raiseSupplierClaim`, `listGoodsReceiptClaims`, the claim's credit note and settlement).</li><li>CR-037: the examples' void permission fixed.</li><li>A new refusal code, `SUPPLIER_CLAIM_INVALID`, which now has its words (ADR 0038).</li></ul> |

- Both syncs type checked clean.
- **CR-032 and CR-033 did not land**, so their switches stay.
- `fakeRoles.test.ts` passes: everything the fake now gives the Owner, the Storekeeper and the Accountant is in the seed.

## (a) Buying

**Purchase orders**:

- **Screens:** `/purchase-orders`, `/new` and `/:id`, under Business, beside Suppliers. They load on demand in a new namespace, `buying`.
- **Drafting.** The person names the supplier, where it is delivered, the order date and the expected day. Each line names a product and the unit it is bought by: the product's own unit or one it converts from. The choice reads "Crate (30 Unit)", the API's conversion shown, never applied.
- **The price.** A line takes a price per that unit, or none. With none, the server uses the last price paid to that supplier (2.3.0).
- **The order.** It shows the following, all as the API answers them:
  - what was ordered, in crates, with the eggs beneath;
  - the price per crate;
  - the line totals before tax;
  - what was received and what is still to come, in eggs;
  - before tax, tax and total.
- **Actions**, each confirmed first with the lines and the total:
  - submit: 200 approved, or 202 waiting for approval, said in words;
  - send by WhatsApp or email;
  - receive a delivery;
  - cancel when nothing was received, with a reason;
  - close when part received, with a reason.

**Goods receipts**:

- **A purchase names its supplier.** It did not before, and the receipt screen sent none. It may come in against an open order of that supplier (approved, sent or part received). The order fills in the store and one line per order line, its product and unit fixed. Opening "Receive a delivery" from an order does the same.
- **Units.** A line is counted in crates or eggs (2.2.0); the crate goes as `uom: CRATE` and the server converts. Transfers send their unit too.
- **Rejections.** Goods turned away at the door have a quantity, a reason (required) and a note (required when the reason asks for one). The screen checks both before it sends, as the server would refuse them (2.3.0).
- **What the receipt shows:**
  - the crates, with the eggs the server booked beneath;
  - why each rejection happened;
  - a notice that what was rejected never enters stock.
- **The claim (CR-036, 2.4.0).** A posted purchase receipt against an order raises one claim, confirmed first with the rejected lines.
  - Only a note is sent: the value is the server's, from the order's price.
  - The receipt then reads its claim back, open or settled, with what was claimed line by line.
  - Who sees what: without the read, the screen says who raises it; on a draft, it says a claim comes after posting.
- **Not built:** the claim's credit note and its settlement by an invoice. They belong to the supplier invoice screens, which do not exist yet.

**Proved by:** `e2e/specs/console/eggs-buying.spec.ts`, 5 tests:

1. The Storekeeper drafts 20 crates with no price; the request body is checked. The draft shows the API's 600 eggs, GH₵47.50 a crate and GH₵950.00, and is submitted.
2. A delivery against the order: 18 crates accepted and 2 rejected.
   - Saving without a reason is stopped in words.
   - The request carries `uom: CRATE`, the order line, `qtyRejected` and `CRACKED`.
   - The receipt shows 540 eggs and the reason, and its post confirmation names the rejection.
3. The Owner raises the claim. Only the note is sent; GH₵11.09 comes back and the claim reads back open.
4. The purchase order list.
5. A cashier is denied in words, naming `pur.purchase_order.read`.

`apps/console/src/stock/lines.test.ts` proves the line input and its checks.

## (b) Selling: a crate or a single egg at the till (CR-038, behind its switch)

**The request.** CR-038 asks for:

- `OfflineProduct.sellingUnits`: each unit with its own band;
- `CounterSaleLine.uom`.

`apps/console/src/requested/sellingUnits.ts` reads it only in a build switched on for CR-038. `landed.ts` fails the type check when either field lands. The e2e, screenshot and CI builds are now `CR-032,CR-033,CR-038`: `package.json`, `ci.yml`, `CLAUDE.md` and `DEPLOYMENT.md` all say so.

**At the till:**

- Tapping the eggs asks "Sell Eggs, big by which unit?": by the crate at GH₵60.00, or by the unit at GH₵2.20. Each price comes from the pack's own band for that unit.
- The line is priced in its unit, and the till's one local total multiplies that unit's own price.
- A held sale is re-priced in its unit on recall, and dropped if the pack no longer prices that unit.
- The sale line names its unit.
- A single egg's price is never worked out from a crate's.
- Two lines of one product are told apart: "Change Eggs, big, by the unit".

**With the switch off,** a product is sold in its `saleUom` alone, as before.

**Proved by:** `e2e/specs/console/eggs-selling.spec.ts`. With the network off, a crate and six eggs make GH₵73.20 at their own prices. They sync once with `uom: CRATE` and `uom: UNIT`. `apps/console/src/pos/sale/sellingUnits.test.ts` covers the switch off, the egg's own price and the recall. The existing till specs pass with CR-038 on.

**The shop:** nothing built (CR-039).

## (c) Bulk buyer prices

**A price line** names its selling unit ("per crate", "per unit") and its quantity break in that unit. The F10e report's gap is closed: a break of 10 crates reads "from 10 Crate (300 in the base unit)". The 300 is the API's `minQtyBase`; the entry names no base unit (CR-041). A crate's price band now reads "per crate", where it said "per unit".

**A draft takes a new price:**

- a product, the unit it is sold by (crate or egg), what the price is per, and the floor, list and ceiling;
- a break "from how many, in Crate";
- the whole draft is sent back with every other line kept as entered.

**A buyer's own list:**

- "New price list for a buyer" creates a `CUSTOMER` list.
- On a buyer's list, "Give these prices to a buyer" picks the buyer and the first day, with an optional last day.
- The person ticks that it replaces any list the buyer has from that day; without the tick it is not sent.
- What the server recorded stays on screen.
- The contract has no read of who holds a list (CR-041).

**Proved by:** `e2e/specs/console/eggs-buyer-prices.spec.ts`, 2 tests:

1. A draft shows the crate, the 10-crate break and the single egg. A price from 50 crates is added, and the request keeps every unit and break.
2. A buyer's list is created, then given to Asantewaa Chop Bar from 2026-12-01.

The F4 gate spec still passes. `apps/console/src/pricing/entryWords.test.ts` covers the line words.

## Every egg screen at 360 px

Every screen is in `docs/screenshots/F10f/`, at 360 and 1280 px (`pnpm screenshots`, tag `F10f`).

**At 360 px:**

| Screen                                              | File                                 |
| --------------------------------------------------- | ------------------------------------ |
| Purchase orders                                     | `purchase-orders-360.png`            |
| A new order, 20 crates                              | `purchase-order-new-360.png`         |
| The order with the API's totals                     | `purchase-order-360.png`             |
| A receipt against the order, cracked crates         | `goods-receipt-from-order-360.png`   |
| The draft receipt with the rejection                | `goods-receipt-rejected-360.png`     |
| The posted receipt with its open claim              | `goods-receipt-claim-360.png`        |
| The draft with a crate, a 10-crate break and an egg | `price-list-egg-prices-360.png`      |
| Adding a price in crates                            | `price-list-add-price-360.png`       |
| A buyer's list with "Give these prices to a buyer"  | `buyer-price-list-360.png`           |
| A new list for a buyer                              | `price-lists-new-buyer-list-360.png` |
| The till asking crate or egg                        | `till-choose-unit-360.png`           |
| The till with a crate and six eggs                  | `till-crate-and-eggs-360.png`        |

Every new screen's spec runs axe and checks for no sideways scroll at 360 px.

## Moved from the mock to the real API

**None.** B9b is not built, and nothing is deployed.

## Contract requests added or changed

- **CR-035:** answered (2.3.0) and built.
- **CR-036:** answered (2.4.0) and built (the raise and the read).
- **CR-037:** answered (2.4.0).
- **CR-038, new:** the till's second selling unit. Built behind its switch.
- **CR-039, new:** the shop's second selling unit. Nothing built.
- **CR-040, new:** `GoodsReceiptLineInput.valuePesewas` is required, yet "defaults from the purchase order line". Until it is answered, the storekeeper types the cost on every line.
- **CR-041, new:**
  - a read of a buyer's price list, and of who holds a list;
  - `PriceListEntry.baseUom`.

## Decisions recorded

- **ADR 0049:** its consequences record the owner's answers of this session.
- No new ADR:
  - the switch for CR-038 is ADR 0046's mechanism;
  - the new screens reuse the reference shapes: Table, Field, ConfirmDialog, ReasonDialog, QueryBoundary.

## Assumptions

- **A-F10-01** now covers CR-038: the e2e and CI builds are built against CR-032, CR-033 and CR-038.
- The base unit of the seeded eggs is `UNIT`, named "Unit" by the unit list, so the screens say "540 Unit" and "6 unit". If the owner wants "egg", that is a unit name in the seed, not a screen change.

## Gates, each run on its own

<!-- e2e filled in below -->

| Check                                                               | Exit | Count                                                                        |
| ------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                              |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                              |
| `test:unit`                                                         | 0    | console 290 (was 280), api-client 30, ui 900, storefront 34, data 28, i18n 6 |
| `test:integration`                                                  | 0    | console 244, storefront 15                                                   |
| `test:a11y`                                                         | n/r  | not run: `packages/ui` is unchanged; every new screen's spec runs axe        |
| `budget:console`                                                    | 0    | till 246.9 of 250 kB (was 246.2); back office 278.8 of 300 kB (was 278.5)    |
| `test:e2e`, full run                                                | TBD  | TBD                                                                          |

## For the owner

1. **The shop's single egg** waits for CR-039. Until then the shop sells eggs by the crate only.
2. **A buyer's price list cannot be read back** (CR-041). The screen shows only the answer to the write.
3. **The cost on a receipt against an order** is typed from the supplier's paper (CR-040). Working it out from the order's price would be the browser doing the server's arithmetic.
4. **"Unit" or "egg":** the seed names the eggs' base unit "Unit". Say if it should read "egg".

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10f-eggs-buying-selling-bulk-prices.md.
Read ADR 0046 and 0049.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.4.0.
   - If CR-038 landed, requested/landed.ts fails: delete the switch (requested/sellingUnits.ts, the id in
     switch.ts, package.json, ci.yml, CLAUDE.md, DEPLOYMENT.md) and read the generated fields.
   - If CR-039 landed: the shop's crate and single egg (product page, cart, checkout), with a spec.
   - If CR-032 or CR-033 landed: as the F10e opening message says.
2. The supplier invoice screens, if the owner wants them next: matching, the claim's credit note
   (draftSupplierClaimCreditNote) and settling a claim by an invoice (settleSupplierClaim).
3. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
4. If B9b went live, take the F10 report's items against the real API.
```
