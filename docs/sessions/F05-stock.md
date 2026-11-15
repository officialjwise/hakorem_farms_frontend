# F5 stock: on hand, stock takes, adjustments, transfers, goods receipts

- **Session:** F5, on branch `f05-stock`, stacked on `f04-catalogue` (PR base `f04-catalogue`).
- **Date:** 2026-11-15
- **Gate:** **met against the mock.** A storekeeper completes a stock take on a phone, standing in the cold room. `e2e/specs/console/stock.spec.ts` ("the F5 gate") runs it at 360 px by the keyboard: a blind count, saved, counting finished, the differences reviewed, posted (202, "Nothing has posted yet").
- **Task 1, F3's real-API gate: UNMET, attempted again.** Same blockers as F4 (no `../backend`, no `HK_API_BASE_URL`, the proxy refuses the API hosts). Carried to F6 as task 1.
- **The session stopped after F5, by the owner's rule.** Context ran low, and F6 to F8 were not started. The opening message below resumes there.

## Assumed this session (all dated 2026-11-15, in docs/ASSUMPTIONS.md)

| Id      | Assumption                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| A-F5-01 | F3's real-API gate is still unmet (as A-F4-01).                                                                          |
| A-F5-02 | While counting, the expected quantity is never shown, even when the API sends it (the mock does; CR-012).                |
| A-F5-03 | A new stock take is a full count of one location; a cycle count is not offered yet.                                      |
| A-F5-04 | A goods receipt's `receivedAt` is the moment it is saved; there is no supplier or purchase order picker yet.             |
| A-F5-05 | Quantity precision comes from the unit's kind (COUNT 0, else 3; unknown 3), CR-003's interim rule.                       |
| A-F5-06 | Receiving a transfer receives every line in full; shortfalls are not entered yet.                                        |
| A-F5-07 | Counts save a page (25 lines) at a time; pages cannot turn while a page has unsaved counts.                              |
| A-F5-08 | F5 screens and the `stock` namespace load on demand (ADR 0032).                                                          |
| A-F5-09 | The test storekeeper and owner hold the F5 stock permissions, not `inv.adjustment.approve`.                              |
| A-F5-10 | Adjustment reasons are the STOCK_ADJUSTMENT and WASTAGE lists; a reason that needs a note requires one.                  |
| A-F5-11 | Holds, reservations, exceptions, the movement ledger, alerts, availability, trace and location admin are not F5 screens. |

## Built

All routes load on demand (ADR 0032). Each route's permission is the `x-permission` of the operation it reads, or writes for a form.

| Route                                | Screen                                                                                                                                  | Permission                          | Writes                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/stock`                             | Stock on hand by location: on hand, available, weight, unit cost, value at cost, price band, expiry; the API's total at cost and `asOf` | `inv.stock.read`                    |                                                                                                      |
| `/stock-takes`                       | Stock takes; a new full count of a location in a dialog                                                                                 | `inv.stock_take.read`               | `createStockTake`                                                                                    |
| `/stock-takes/:id`                   | **The gate.** Start (snapshot), count blind page by page, finish, review differences, recount, post                                     | `inv.stock_take.read`               | `startStockTake`, `recordStockTakeCounts`, `closeStockTakeCounting`, `submitStockTake` (202 handled) |
| `/stock-adjustments`, `/new`, `/:id` | Adjustments: list; a draft with location, reason, note and gain or loss lines; post after the exact lines                               | `inv.adjustment.read`, `.create`    | `createStockAdjustment`, `submitStockAdjustment` (202 handled)                                       |
| `/stock-transfers`, `/new`, `/:id`   | Transfers: list; a draft from one location to another; send; receive in full                                                            | `inv.transfer.read`, `.create`      | `createStockTransfer`, `dispatchStockTransfer`, `receiveStockTransfer`                               |
| `/goods-receipts`, `/new`, `/:id`    | Goods receipts: list; a draft with source, location, lines and their cost; post                                                         | `inv.goods_receipt.read`, `.create` | `createGoodsReceipt`, `postGoodsReceipt`                                                             |

- **Four states on every screen**, the new-document forms included (they wait on the locations list). 51 integration tests on the real Prism: four per screen, plus three gate writes.
- **Every write that moves stock confirms first**, with the exact lines (quantities in their unit, values at cost from the API): starting and finishing a count, posting a take, posting an adjustment or receipt, and sending or receiving a transfer. A refusal stays in the dialog with its reference. Saving a draft moves no stock and does not ask.
- **No calculation:** totals, values, variances and their direction come from the API. Typed quantities are padded to the contract's three places as strings (`stock/units.ts`, three unit tests).
- **On a phone:** count fields are the large control size, one card per line; the keyboard path is type then Tab down the list, Enter to save.
- **New in the console:** `lib/ConfirmDialog.tsx` (Dialog plus MutationFailure, the shape of F3's `ReasonDialog`), and in `stock/` a line editor with a product search on `listProducts`. **No new `packages/ui` component**, stylesheet, provider, context or variant mechanism.
- **Sidebar:** Stock on hand (was the Stock placeholder), Stock takes, Goods receipts, Transfers, Adjustments.

## Checks at the tip

Each run on its own, exit code recorded.

| Check                                               | Exit | Result                                                                                                                                     |
| --------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `typecheck`                 | 0    |                                                                                                                                            |
| `sync-contract:check`                               | 0    | contract 1.1.0                                                                                                                             |
| `test:unit`                                         | 0    | console 147 (was 144); one login test expected the old placeholder's "Stock" heading and now reads "Stock on hand"                         |
| `test:integration`                                  | 0    | 157 (was 106)                                                                                                                              |
| `build:console`, `budget:console`                   | 0    | back office 270.6 of 300 kB initial; till 195.8 of 250 kB                                                                                  |
| `test:e2e`, full, 3 workers                         | 1    | 187 passed, 1 failed: `permissions.spec.ts` named the storekeeper's menu link "Stock", which now matches "Stock on hand" and "Stock takes" |
| `permissions.spec.ts` after naming the link exactly | 0    | 3 passed                                                                                                                                   |
| gate and adjustment specs after their fixes         | 0    | 2 passed                                                                                                                                   |
| `pnpm screenshots` (F05)                            | 0    | 24 shots                                                                                                                                   |

Not re-run, because nothing they read changed: `test:a11y`, `build-storybook`, and the token, font and icon checks. The full e2e suite was not re-run after the one-line permissions spec change; the spec itself was.

## Screenshots

Production build on the mock, signed in as the owner, light theme. Twelve screens, all shot.

**Stock take, counting: the gate.** A blind count on a phone, large fields, saved page by page.

![stock-take-counting at 1280](../screenshots/F05/stock-take-counting-1280.png) ![stock-take-counting at 360](../screenshots/F05/stock-take-counting-360.png)

**Stock on hand.** Cost and selling price apart, and the API's total at cost with its time.

![stock-on-hand at 1280](../screenshots/F05/stock-on-hand-1280.png) ![stock-on-hand at 360](../screenshots/F05/stock-on-hand-360.png)

**Stock takes.** Each count, its state and how far along it is.

![stock-takes at 1280](../screenshots/F05/stock-takes-1280.png) ![stock-takes at 360](../screenshots/F05/stock-takes-360.png)

**Adjustments.** Reason, state and value at cost.

![adjustments at 1280](../screenshots/F05/adjustments-1280.png) ![adjustments at 360](../screenshots/F05/adjustments-360.png)

**Adjustment.** Facts, lines with gain or loss, and posting behind a confirmation.

![adjustment at 1280](../screenshots/F05/adjustment-1280.png) ![adjustment at 360](../screenshots/F05/adjustment-360.png)

**New adjustment.** Location, reason, note and lines.

![adjustment-new at 1280](../screenshots/F05/adjustment-new-1280.png) ![adjustment-new at 360](../screenshots/F05/adjustment-new-360.png)

**Transfers.** Route and state.

![transfers at 1280](../screenshots/F05/transfers-1280.png) ![transfers at 360](../screenshots/F05/transfers-360.png)

**Transfer.** Sent, arrived and the difference per line.

![transfer at 1280](../screenshots/F05/transfer-1280.png) ![transfer at 360](../screenshots/F05/transfer-360.png)

**New transfer.** From, to and lines.

![transfer-new at 1280](../screenshots/F05/transfer-new-1280.png) ![transfer-new at 360](../screenshots/F05/transfer-new-360.png)

**Goods receipts.** Source, supplier and total at cost.

![goods-receipts at 1280](../screenshots/F05/goods-receipts-1280.png) ![goods-receipts at 360](../screenshots/F05/goods-receipts-360.png)

**Goods receipt.** Accepted, rejected and cost per line.

![goods-receipt at 1280](../screenshots/F05/goods-receipt-1280.png) ![goods-receipt at 360](../screenshots/F05/goods-receipt-360.png)

**New goods receipt.** Source, location and lines with their cost.

![goods-receipt-new at 1280](../screenshots/F05/goods-receipt-new-1280.png) ![goods-receipt-new at 360](../screenshots/F05/goods-receipt-new-360.png)

## Not verified, and said plainly

- **Nothing against a real API** (task 1). Prism ignores filters: the location filter on stock on hand changes nothing against the mock.
- **No real phone.** The gate ran in Chromium at 360 px with touch-sized fields, not on an Android device in a cold room.
- **A review with recounts** was not exercised end to end: the mock's lines never need a recount. The recount field is covered by the type checker and the review table's axe walk only.
- **The adjustment's confirmation lists the mock's example line** (Yam), not the line typed, because Prism answers a draft with its example.
- **CI has not run remotely.**

## Contract

- **Synced:** not possible (no `../backend`). Contract 1.1.0.
- **Screens moved from the mock to the real API:** none.
- **Added to `docs/CONTRACT_REQUESTS.md`:** CR-012 (the counting example carries `expectedQty`). CR-001 marked **answered in 1.1.0**, for the owner to close.
- **Still open:** CR-003 to CR-012.

## Opening message for the next session (F6, then F7 and F8)

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F6, F7 and F8 rows of the screen sessions table
in docs/BUILD_PROMPT.md. Read docs/DATA_CONVENTIONS.md. Read only the most recent report in
docs/sessions/ (F05-stock.md). Do not reopen decisions in docs/adr/ (0001 to 0032; 0032 is
proposed and stands until the owner answers).

Start on a branch created off f05-stock, named f06-livestock. Each phase branches off the
previous and gets a stacked PR. Merge nothing.

TASK 1 (REQUIRED, first): the deferred real-API half of F3's gate, unchanged since F4.
- Point HK_API_BASE_URL at the B3 API. Sign in as an owner and as a cashier.
- As the cashier, confirm the denied state in words, on the same URL, on /users, /roles,
  /sessions and /audit. Check step-up and the CSRF origin rule against the real server.
- If it cannot be reached, attempt it and record what you tried: UNMET, not skipped.
TASK 2, only if task 1 passed: issue #4.

Then F6: animal register, weights, health, breeding, mortality, feed, processing orders. Gate:
one animal's full history reads on one screen without scrolling to find it. Then F7
(storefront catalogue to checkout; gate: checkout completes on throttled 3G and the
catch-weight estimate is unmissable; re-measure the storefront budget, A-F0-06). Then F8
(invoices, receipts, credit notes, statements, document viewer and reprint; gate: a reprint is
visibly a reprint and the tax breakdown matches the API to the pesewa). Do not start F9.

Every screen ships four states, a keyboard path, axe clean, a Playwright spec per primary flow
and a check at 360 px. Back office screens load on demand with their own namespace (ADR 0032);
reuse lib/ConfirmDialog for every stock or money write. After each gate, run
pnpm screenshots for that phase and embed them in its report. In this container Playwright needs
an untracked e2e/playwright.local.config.ts pointing at /opt/pw-browsers/chromium (F4 report).
```
