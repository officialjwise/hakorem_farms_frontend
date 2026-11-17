# F10b: the owner's decisions of 2026-11-17 (QR codes, barcodes, SKUs, ids, eggs)

- **Session:** F10 continued, on branch `claude/f10-session-contract-sync-76ir1u`, restarted from `main` at `0efb338` (F10 merged as PR #20).
- **Date:** 2026-11-17
- **Scope:** the owner's five decisions, done first, before the phase's own work. Contract synced to 1.53.0.
- **Not done here:** the phase's own work (the F10 report's opening message: the storefront receipt page, and acting on 1.45.0 to 1.53.0). This session's context is spent, so it stops at the nearest green commit and hands the phase to the next session (SHARED_BRIEF, "Session protocol"). The opening message below starts there.

## Contract 1.53.0

Synced with `pnpm sync-contract:github`: backend `4a519e6`, 1.44.0 to 1.53.0. The client builds against it. **2.0.0 (public ids) has not landed**, so the owner's item 4 waits for it.

What 1.45.0 to 1.53.0 change, and what was done:

| Change                                                                                                                                            | Acted on here                                                          | For the next session                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1.52.0: the dashboard's six sales figures answer numbers; only `alerts` and `exceptionsToday` stay pending                                        | The integration test follows the new example (`beforeExceptionReport`) | Nothing more: the dashboard already shows what is sent                                             |
| 1.53.0, CR-005: every list has `default` and `empty` examples                                                                                     | None needed; every gate passes                                         | The integration harness can ask Prism for `example=empty` instead of rewriting rows                |
| 1.53.0, CR-023: `x-seeded-roles`, the seeded role matrix                                                                                          | No                                                                     | Check the fake roles (A-F9-01, A-F6-02, A-F6b-02) against it, and close the assumptions it answers |
| 1.53.0, CR-027: `listProcessingOrders` takes `reversalId`                                                                                         | No                                                                     | Link a `PROCESSING_REVERSAL` approval to its order in the inbox                                    |
| 1.46.0, CR-029: `Cart.checkoutId`                                                                                                                 | No                                                                     | The storefront finds a cart's open checkout from any device                                        |
| 1.45.0, CR-031 and CR-032 (planned POS shapes): `OfflineProduct.taxInclusive`, `SyncResultItem.grossPesewas`, `CASH_MOVEMENT` reasons in the pack | No (B9b builds them)                                                   | Use them when B9b lands; CR-032's PIN verifier is still not in the contract                        |
| 1.50.0, LOUD: `createOrder` answers 202 for a price override                                                                                      | Nothing to do: no screen creates an order (`/orders` is a placeholder) | Show a waiting order when the order screens are built                                              |
| 1.53.0, LOUD for the Farm hand: a death report without its photograph is refused                                                                  | Nothing to do: the screen already requires the photograph              |                                                                                                    |

## 1. QR codes: only the TOTP enrolment image

- **Removed:** the QR code the 58 mm receipt printed (`GS ( k`), added in F10. The receipt now prints "Your receipt online:" and the link in full, as text. The encoder's tests and the printer e2e assert that no `GS` command reaches the printer.
- **Kept:** the TOTP enrolment image, which the server draws (`qrCodeDataUri`). No other QR code exists in the console, the storefront or `packages/ui`.
- **Withdrawn:** Q-F10-01 (the QR library question) and A-F10-03. ADR 0045 and CR-033 now say the link is shown and printed as text.
- **ADR 0046 and ADR 0047 are not about QR codes or barcodes**, so neither is withdrawn. Both are still **proposed**, for the owner:
  - **ADR 0046:** the console is built against a contract request only behind `HK_REQUESTED_CONTRACT`, which only the e2e and CI builds set. It now covers CR-032, CR-033 and CR-034.
  - **ADR 0047:** the till PIN is checked on the device with PBKDF2, with a lockout per person and an idle lock; the approving verifier is kept beside the record.

## 2. Barcodes: none at the till (ADR 0048, superseding ADR 0014)

- **Removed:** the barcode field in the till's shell, its focus trap (`useBarcodeTrap`), the scan events, the till's barcode lookup, the dialog asking which of two products shared a barcode, and the trap's e2e proof (11 specs).
- **How the till finds an item now:** tap a tile, or search by name, SKU or tag. A goat or a lot is found by typing its tag (G-0142), and animals and lots come first in the results. An exact tag the pack says is not for sale is refused in words. A barcode typed into search finds nothing.
- **Kept:** weight capture on weighed lines. Also kept: the barcode on the product record and in the back office, and the meat pack label screen exactly as built, barcode included.
- The till's initial script fell to 243.5 kB of 250 (from 244.4).

## 3. The SKU: given by the server, never typed (CR-034)

- The new product form has no SKU field. It says the SKU is "Given by the server when the product is saved. It is never typed."
- The product screen already shows the SKU read-only, and editing a product could never change it.
- **The contract disagrees today:** 1.53.0 requires `sku` on `createProduct`. **CR-034** asks for the server to generate it.
  - The e2e and CI builds create products against CR-034's shape: the fake adds the server's SKU before Prism answers.
  - **In a build for the real API, "Create product" is disabled with words until CR-034 lands** (A-F10-05). Existing products can be changed as before.

## 4. No UUID on screen: waits for contract 2.0.0

2.0.0 had not landed at 1.53.0, so per the owner's instruction nothing was changed. When it lands, the first step is an audit of every place a screen shows an id. Known ones to replace:

- the till's receipt and queue copy print and show the sale's UUIDv7 as "Sale id";
- product links and the approvals inbox use ids in addresses, which is fine (an address is not shown text);
- lists of customers and suppliers show names and their readable numbers.

The rules to apply then:

- products show their SKU; customers and suppliers show their public id (`cus_…`, `sup_…`);
- search takes both;
- long ids use the monospace face and wrap at 360 px, or are shortened in lists with the full id on the detail screen;
- every id gets a copy button;
- existing readable codes stay.

## 5. The egg business: which screens cover it

The business starts with eggs bought from a supplier and resold.

| What happens                                 | Screens today                                                                                                                                 | Covered?                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The egg product** (a crate of 30)          | `/products/new` (the SKU from the server, CR-034), with unit CRATE from `/units`                                                              | Yes, once CR-034 lands. Units are read-only, and **unit conversions (crate to single egg) have no screen** (A-F4-05), though the contract has them (`createUomConversion`)                                                                                                                                                                                                                                                       |
| **Buying eggs by the crate from a supplier** | The supplier list (`/suppliers`, read only). Then `/goods-receipts/new`, kind "Purchase", with crates counted and the value entered           | **Partly missing:** no purchase order screens, though the contract has had them since B7 (`createPurchaseOrder`, `submitPurchaseOrder`, `sendPurchaseOrder`). And **the receipt form names no supplier**, though the contract takes `supplierId`                                                                                                                                                                                 |
| **A delivery with cracked eggs on arrival**  | The receipt's detail shows a line's rejected quantity (`qtyRejected`)                                                                         | **Missing on entry:** the receipt form cannot record the cracked crates as rejected at the door. Breakage found after receiving is a stock adjustment (below)                                                                                                                                                                                                                                                                    |
| **Transfers to Kasoa and KNUST**             | `/branches` creates branches and their locations. `/stock-transfers/new`, then dispatch and receive at the destination (in transit meanwhile) | Yes. Kasoa is in the contract's examples; **KNUST must be set up** as a branch and location first                                                                                                                                                                                                                                                                                                                                |
| **Breakage at a shop**                       | `/stock-adjustments/new` with a reason code, the exact lines confirmed, then submitted (and approved above the threshold)                     | Yes, **if a breakage reason is seeded**. The contract's example reasons list none for breakage, so check the seed                                                                                                                                                                                                                                                                                                                |
| **Selling by the crate at the till**         | `/pos`: tap the egg tile or search; cash or mobile money; digital receipt                                                                     | Yes                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Selling a single egg at the till**         | None                                                                                                                                          | **Missing.** The till sells each product in its one sale unit (the pack's `saleUom`), and a sale line has no unit. Two routes, both the owner's and backend's to choose: a separate product "Egg, single" with its own price and stock, which needs a way to break a crate into 30 eggs (no screen or movement for that today); or the contract letting a sale line name another unit of the same product through its conversion |
| **Bulk buyer prices**                        | `/price-lists`: edit a version's prices, preview, submit for approval. Existing quantity breaks (`minQty`) are shown and kept                 | **Mostly missing:** no screen creates a price list, adds a quantity break, creates a customer tier, or assigns a price list to a buyer (no customers screen at all). The till sells only at the register's pack price, with no buyer chosen, and `/orders` is a placeholder. These are the BUILD_PROMPT's F10 phase (wholesale accounts) and the order screens                                                                   |

## Moved from the mock to the real API

**None.** B9b is not built. "Which parts of the gate wait for B9b" in the F10 report is unchanged: items 1 to 15 all still wait. CR-031 and CR-032 have planned shapes only, and CR-032's PIN verifier is not in the contract.

## Contract requests added

- **CR-034:** the server generates each product's SKU; `ProductCreate.sku` is removed.
- **No other request.** The single egg and the missing screens in section 5 are listed for the owner, not raised: which way a single egg is sold is a decision first.

## Assumptions

- **Withdrawn:** A-F10-03 (the owner withdrew the QR question).
- **New:** A-F10-05: until CR-034 lands, a console built for the real API cannot create a product.

## Decisions recorded

- **ADR 0048** (accepted, owner): the till finds items by tapping and searching, with no barcode scanning. It supersedes ADR 0014 and ADR 0004's barcode story.
- **ADR 0045 amended** (owner): no QR code; the link is shown and printed as text.
- **ADR 0046 and ADR 0047:** still proposed (above).

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                                                                             |
| ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                                                                                   |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                                                                                   |
| `test:unit`                                                         | 0    | console 236 (was 242: the barcode trap's 6 tests went; the finder's 7 tests replaced the scan matcher's 7), api-client 30, ui 885, storefront 29, data 28, i18n 6 |
| `test:integration`                                                  | 0    | console 244, storefront 13 (after the dashboard test followed 1.52.0)                                                                                             |
| `test:a11y`                                                         | 0    | 314 stories                                                                                                                                                       |
| `budget:console`                                                    | 0    | till 243.5 of 250 kB; back office 276.8 of 300 kB                                                                                                                 |
| `test:e2e`, full runs                                               | 0    | two full runs in a row, 263 of 263 each (274 before, less the 11 barcode trap specs), 5.6 minutes each                                                            |

## For the owner

1. **A single egg at the till.** Is a single egg its own product, with its own price and stock and a way to break a crate into 30? Or should a sale line carry another unit of the same product (one stock, sold by the crate or the egg)? The second needs a contract change.
2. **ADR 0046 and ADR 0047** are still proposed (section 1).
3. **What to build first for eggs.** The gaps in section 5 are: purchase orders; the supplier and cracked crates on a goods receipt; unit conversions; and price lists, tiers and buyers (the wholesale accounts of the BUILD_PROMPT's F10). The till's receipt and lock are done. Which comes first?

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, docs/sessions/F10-the-till-pin-and-the-digital-receipt.md and
docs/sessions/F10b-owner-decisions-qr-barcodes-sku-eggs.md, with the owner's answers to "For the owner" in
the F10b report if they are there. Read ADR 0045 to ADR 0048.

The BUILD_PROMPT's F10 phase (the quote builder, the request-for-quote form, wholesale accounts) still waits
for B9b (owner, 2026-11-16), unless the owner's answer to F10b's question 3 says otherwise.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 1.53.0. If 2.0.0 has
   landed, do the owner's item 4 first: no screen shows a UUID; products show the SKU, customers and
   suppliers their public id (such as cus_8F3K2M9Q7X4T1V6B); search accepts both; long ids in the monospace
   face, wrapping or shortened in lists with the full id on the detail screen, each with a copy button,
   readable at 360 px; existing readable codes stay. Start with an audit of every id a screen shows,
   including the till's "Sale id". If CR-034 landed, delete apps/console/src/requested/serverSku.ts and its
   id from HK_REQUESTED_CONTRACT, and send createProduct with no sku through the generated client.
2. Act on 1.45.0 to 1.53.0 as the F10b report's table lists: the fake roles against x-seeded-roles
   (CR-023), the processing reversal link (CR-027), Cart.checkoutId on the storefront (CR-029).
3. The customer's receipt page on the storefront (CR-033 item 3, A-F10-04), with the link as text and no
   QR code (owner, 2026-11-17). Decide first how the storefront's e2e answers a requested operation, and
   record it.
4. If B9b went live, take items 1 to 15 under "Which parts of the gate wait for B9b" in the F10 report
   against the real API, as that report's opening message says.
```
