# F10p: contract 2.47.0, the drivers holding cash, an invoice paid at the till, a receipt link revoked, a business buyer, standing orders, bad debt, short picks and card at the shop

- **Session:** F10 continued, on branch `claude/sharp-archimedes-h63qjn`, from `main` at `43acd8f` (F10o, PR #39).
- **Date:** 2026-11-24 to 2026-11-25.
- **Numbers taken from `main` just before committing:** CR-064 and CR-065, assumptions A-F10-20 to A-F10-28. No ADR: every decision here follows ADR 0030, 0038, 0043, 0046 and 0057.
- **Scope:** the F10o opening message, with the owner's four items on top:
  1. The shift discount limit kept as built.
  2. The driver's cash hand-in kept blind.
  3. The chunk-merging change, kept only if no first load grows; the 250 kB till limit stays.
  4. Then the 2.18 to 2.31 additions, starting with paying an invoice at the till and revoking a receipt link.
- **Not touched, as the owner asked:** the reports and the exception screens. They wait for the backend's B12 continued 4.
- **Screenshots:** none were taken, opened or committed (CLAUDE.md). Every screen is checked by its spec at 360 px, with no sideways scroll and axe.
- **Built by agents in their own worktrees, then reviewed and taken in:** standing orders and bad debt, the short pick and the Storekeeper's view, and card at the shop.

## 1. The sync: 2.31.0 to 2.47.0, not 2.48.0 (backend `f1d5597`)

`pnpm sync-contract:github` at `main` brought 2.48.0, the daily exception report. CR-059 landed in it, so `landed.ts` would force CR-059's switch out (ADR 0046) and the exception screen onto the real operation. The owner held the exception screens for their own session. **So this session syncs at `f1d5597`, the backend commit that carries 2.47.0, the last before 2.48.0** (A-F10-20). Nothing built here is in 2.48.0. The exceptions session takes 2.48.0 and CR-059.

| Request             | Landed                 | What the console does now                                                                                          |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **CR-063**          | 2.35.0, as asked       | The shift screen reads `listShiftDriverCashHolders` through `useApiQuery`. The switch is deleted from every build. |
| **CR-033 pt 3**     | 2.41.0, without item 3 | The till says when the receipt SMS goes (section 4). The sync answers no message status (backend BL-119).          |
| **CR-057 pts 2, 3** | 2.32.0, 2.35.0         | A driver with no run is a 404 (the phone already said "No run for you today"); a resend keeps `firstOutcome`.      |
| CR-039, CR-055      | 2.42.0, 2.35.0         | Answered, not built here (the shop's crate and egg; a part delivery).                                              |

**Breakage fixed in the sync's commit:**

- The approval kinds `INVESTOR_PAYOUT_CHANGE` and `FINANCING`, placed and given words.
- Words for fifteen new error codes.
- `del.route.read` and `del.route.manage` are seeded now.
- The e2e fixtures carry `Route`'s six new fields, `DriverSyncItem.firstOutcome` and `PublicQuoteLine.availableNow*`.
- The mock's 668 operations.

## 2. The owner's answers

1. **The shift discount limit, kept as built (A-F10-15, accepted).** A supervisor-approved discount still counts toward the cashier's shift total, and once the total is used, every further discount needs a supervisor's PIN. A new test proves it, and it found a bug: once approvals had taken the shift past its total, the till refused even a line at the list price. **Fixed:** a line with no discount needs no limit.
2. **The driver's cash, counted blind (A-F10-19, accepted).** The expected figure shows only in the server's answer, after the count is confirmed. Now on the real driver list.
3. **The chunk-merging change: measured, and not kept.**
   - **Before:** the till 246.3 kB, the back office 288.4 kB, the investor portal 213.6 kB, the shop's listing pages 112.2 kB.
   - **Tried:** eleven shapes of Rolldown's `codeSplitting.groups`.
   - **The best shape shrank every first load** (the till to 243.1 kB, the back office to 282.5 kB). But it folds the sign-in code, which the till loads on demand, into the back office's entry chunk. Signing out at the till would then fetch and run the back office's entry, and what the till loads on demand would grow from 80.9 kB to 368.3 kB. That breaks ADR 0030.
   - **Every shape that kept the till apart** made the till larger, 247.4 to 288.4 kB.
   - **The storefront** is a separate build that none of this touches.
   - **The build is unchanged,** and the figures are in `PERFORMANCE_BUDGET.md`.
4. **The 2.18 to 2.31 additions:** sections 3 to 8.

## 3. An invoice paid in cash at the till (2.26.0, 2.36.0)

`payInvoiceAtTill` on the shift screen, which loads on demand, for the shift's own cashier, online only.

- **Finding it:** the cashier finds the document by its number (`listBillingDocuments`, which the Cashier holds). The till shows the customer, the total and what is still to pay.
- **What it takes:** only an issued invoice, or an issued order receipt (a guest's collection balance), with something outstanding. Anything else says why in words.
- **Entering it:** the amount (part payment allowed, never beyond what is outstanding) and the cash handed over.
- **Confirming it:** a confirmation with the exact amounts. The server's answer then stays on screen: paid, handed over, the change to give back and what is still outstanding, all the server's figures.
- **Refusals** stay in words with the reference. Seven rule words were added.

## 4. The receipt link: revoked, and its SMS

- **Revoking (2.26.0, `revokeReceiptLink`):** on the receipt's page in the back office.
  - Offered only on an issued receipt the till's offline sync made, to a holder of `pos.shift.close.approve`.
  - It asks for a reason and a fresh step-up. Who revoked it, why and when stay on the page.
  - A sale with no link (404) and a link already revoked are refused in words with the reference (A-F10-22).
  - It is in the back office because the till's session has no step-up.
- **The SMS (2.41.0):** the till now says, where it said no SMS is sent:
  - that the farm sends the receipt link by SMS once the sale reaches the server;
  - that none goes for a sale with no link or a refused one;
  - never that it arrived. The sync answers nothing about the message (A-F10-24).

## 5. A business buyer on a counter sale (2.26.0)

- **In the payment dialog:** an optional business name and TIN, both or neither. A GRA TIN or a Ghana Card PIN, trimmed and upper-cased (A-F10-23).
- **On the sale and its receipt:** sent as `OfflineSale.buyer` under the sale's hash, shown in the confirmation, and shown and printed on the receipt.
- **What it is not:** it makes no customer.
- **If the server refuses it at sync,** the sale is still recorded, and the sale's exceptions show the server's `BUYER_DETAILS_REFUSED`.
- **It is in the sale screen** because it must work offline. The till's first load is now **247.1 of 250 kB (+0.8 kB)**.

## 6. Standing orders and bad debt on the business account (2.18.0)

- **Standing orders:**
  - The list says how often each one runs in words ("Every week on Monday, Wednesday and Thursday", "Every 3 days"), with what it orders, the next run and its state.
  - Create and edit; pause, resume and end, each with a reason and only in the states the contract allows.
  - Each order's runs, with the outcome and the server's reason.
- **Open invoices:**
  - The account page lists the customer's open invoices (`listOpenItems`).
  - A bad debt write-off of the whole amount owed: a confirmation with the exact amount and a reason (A-F10-26).
  - The 202 answer stays on screen: it waits for a different person, with a link to the approval.
- **The fake's roles** now hold what the seed gives each role for standing orders, receivables and bad debt.

## 7. The short pick and the Storekeeper's view (2.25.0, 2.29.0)

- **A short pick proposed to the customer** from an open, counted line of a `PICKING` order:
  - What can be sent and what is short, in the line's unit; a reason; a check, then send.
  - The order then says it waits for the customer, and packing and dispatch wait until they answer.
  - A refusal stays in words.
  - The substitute dialog no longer offers the line's own product (`SAME_PRODUCT`).
- **The Storekeeper** (who holds `ord.order.read.fulfilment`, not `ord.order.read`) reads the order through `getOrderFulfilmentView`:
  - no money anywhere;
  - the order number as text;
  - its own loading, error and permission-denied states (A-F10-28).
- **The gap, CR-064:** the store's view carries no `pendingConsent`, so the Storekeeper sees that the order waits, not what was asked.

## 8. Card at the shop's checkout (2.30.0)

- **Leaving for the card page:** after placing, the shop says in words that the customer is going to Paystack's card page, with the amount and the order number. It then sends the browser there, with a link in case it does not go.
- **Only `https://checkout.paystack.com/` is followed** (`cardPageUrl`). Any other host, scheme, port or user name is refused in words and never opened. The old "Continue to the payment page" link followed any address.
- **A 503 with the order placed:** the shop says the order is placed but the card page did not open, and stays. One button replays the same request with the same key (A-F10-25).
- **The gaps, CR-065:**
  - the route the provider returns the customer to;
  - which order a 503 placed.
  - Until they land, nothing is built for the customer's return.
- **Size:** `/checkout` is 207.1 kB (+0.5 kB) and not budgeted. Every budgeted shop page is unchanged.

## Also

- **The driver's phone (CR-057 point 3):** a resend answered `DUPLICATE` is recorded with the server's `firstOutcome`. An exception raised when the first answer was lost now shows in the server's words.
- **An e2e spec that expired:** `quotes-credit.spec.ts` typed a valid-until of 2026-11-24, which the quote form refuses from 2026-11-25. It now types a week from today in Accra (`accraDay`).

## Not built from 2.18.0 to 2.47.0 (for the next sessions)

- `BreakResolve.posting` `VERIFIED` and `reversePayment` `MOBILE_MONEY_NOT_RECEIVED` (2.22.0). The console has no customer payment or reconciliation-break screens yet. The break queue is PAY's exception queue, beside the exception work the owner held, so it belongs with that session.
- `PickInput.damaged` (2.37.0) and the `STOCK_UNIT_OTHER_BAND` refusal (2.44.0) on the pick screen.
- `ReturnLine.uom` (2.38.0): part of a crate returned as single eggs.
- Everything from B11 continued 3 to 12 for the back office:
  - the driver's run (`createRoute` to `completeRoute`);
  - deliveries reassigned, rescheduled, cancelled, written off or returned to stock;
  - the part delivery (CR-055);
  - the extra delivery fee;
  - the notification templates, triggers, message log and preferences;
  - document and statement sending.
- The shop's crate and single egg (CR-039, 2.42.0) and the shared document page `/d/<token>` (2.42.0).
- CAP and costing (2.45.0 to 2.47.0), beyond what the investor portal already reads.

## Proved by

**e2e, 400 of 400** in 9.6 minutes, none flaky, at 360 px, axe-clean, no sideways scroll (F10o: 379). New:

- `pos-invoice-payment.spec.ts`, 3 tests:
  - paid in part, with the server's change and balance;
  - a refusal in words;
  - a settled invoice not offered, and offline.
- `billing-receipt-link.spec.ts`, 3 tests:
  - revoked with a reason after step-up;
  - already revoked, in words;
  - not offered on an online receipt or to a cashier.
- `pos-buyer.spec.ts`: the buyer checked, sent with every resend, and on the receipt.
- `wholesale-standing-orders.spec.ts`, 8 tests.
- `checkout-card.spec.ts`, 3 tests: the redirect, the 503 and its replay with one key, a wrong host refused.
- Changed:
  - `fulfilment.spec.ts`: the short pick, and the Storekeeper's view with no money;
  - `pos-driver-cash.spec.ts`: the real driver list;
  - `pos-pin-receipt.spec.ts`: the SMS words;
  - `quotes-credit.spec.ts`: the valid-until.

**Unit:**

- New: `invoicePayment.test.ts`, `buyer.test.ts`, `ReceiptLink.test.ts`, `standingOrders.test.ts`, `pickRules.test.ts`, `cardPage.test.ts`.
- Extended:
  - `priceApproval.test.ts`: the owner's shift rule;
  - `escpos.test.ts`: the buyer printed;
  - `driver/offline/sync.test.ts`: `firstOutcome`.

## Moved from the mock to the real API

- The drivers holding cash at the till's branch (`listShiftDriverCashHolders`, 2.35.0, CR-063). The CR-063 switch is gone.
- An invoice paid at the till (`payInvoiceAtTill`) and a receipt link revoked (`revokeReceiptLink`), 2.26.0.
- A business buyer on an offline sale (`OfflineSale.buyer`, 2.26.0).
- Standing orders (eight operations) and the bad debt write-off (`writeOffBadDebt`), 2.18.0. Open items by customer (`listOpenItems`).
- A short pick (`proposeShortPick`, 2.25.0) and the store's view of an order (`getOrderFulfilmentView`, 2.29.0).
- Card at the checkout (`placeOrder` with `CARD`, 2.30.0).
- A driver's resend answered with its first outcome (`DriverSyncItem.firstOutcome`, 2.35.0).

## Contract requests added or changed

- **CR-063** answered in 2.35.0 and built.
- **CR-033** point 3 answered in 2.41.0 without its item 3.
- **CR-057** points 2 and 3 answered and built.
- **CR-039** and **CR-055** marked answered.
- **CR-064 raised:** the store's view of an order says what the customer is asked (`OrderFulfilmentView.pendingConsent`), and `proposeShortPick` lists its error codes.
- **CR-065 raised:** card at the shop, the route the provider returns the customer to, and which order a 503 placed.

## Decisions recorded

- **A-F10-15 and A-F10-19** accepted as built (owner, 2026-11-24).
- **A-F10-20:** the sync at 2.47.0.
- **A-F10-21 to A-F10-24:** the invoice at the till, the receipt link's revoke, the buyer's forms, the SMS words.
- **A-F10-25 to A-F10-28:** card's 503, the write-off of the whole amount, the standing order form's checks, the short pick's rules.

## Gates, each run on its own

| Check                                        | Exit | Count                                                                                                          |
| -------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`          | 0    |                                                                                                                |
| `sync-contract:check`                        | 0    | backend `f1d5597`, 2.47.0                                                                                      |
| `tokens:check`, `fonts:check`, `icons:check` | 0    |                                                                                                                |
| `test:unit`                                  | 0    | console 387, ui 901, storefront 51, data 33, api-client 30, i18n 6                                             |
| `test:integration`                           | 0    | console 281, storefront 25                                                                                     |
| `test:e2e`, full run                         | 0    | 400 of 400 in 9.6 minutes                                                                                      |
| `budget:console`                             | 0    | till 247.1 of 250 kB (F10o 246.2); back office 288.8 of 300 kB; investor 213.6 of 250 kB                       |
| `budget:storefront`                          | 0    | `/r/[token]` 111.8 of 120 kB, `/q/[token]` 159.4 of 170 kB, `/quote` 165.8 of 170 kB, listings 112.2 of 120 kB |
| `test:a11y`                                  | 0    | 322 stories, 65 files                                                                                          |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                              |

**A note on the integration run.** The first run, while the three agents were building and testing on the same machine, failed 77 of 281. 76 of those were Prism unreachable or slow. One was real: the mock's count, now 668. Run again with the machine to itself, all 281 passed.

## For the owner

1. **The till is at 247.1 of 250 kB, and merging chunks is not the way down** (section 2.3). The next sale-screen feature needs one of two owner decisions: something taken out of what the sale screen loads at boot, or the till's budget raised.
2. **Payments and reconciliation breaks have no screens yet.** The `VERIFIED` posting and the "mobile money not received" reversal wait for them. They sit beside the exception work you held, so I recommend they go with that session.
3. **Card at the shop:**
   - **After a reload during a 503, the shop cannot reopen the card page**, because the request's key lives only in memory. My recommendation: keep it in the session's own storage for that one checkout. It is a new storage use, so it is yours to decide.
   - **The customer's return from Paystack** waits for CR-065.
4. **The bad debt write-off always asks for the whole amount owed** (A-F10-26). Say if a part should be offered.
5. **A standing order's last day can be moved but never removed:** the contract's update takes no empty date. The form says so in words.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10p-contract-2-47-0-invoice-at-till-receipt-link-standing-orders-card.md.
No screenshots until F13.

If the backend's B12 continued 4 has landed: this is the reports and exceptions session.
1. pnpm sync-contract:github (main) and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.47.0.
   CR-059 landed in 2.48.0: delete requested/exceptionReview.ts and its switch, call reviewException and
   listExceptions' new fields through the generated client, and take ExceptionKind's 44 new kinds.
2. The reconciliation breaks and customer payments, with BreakResolve.posting VERIFIED and
   reversePayment MOBILE_MONEY_NOT_RECEIVED (2.22.0).
3. If CR-064 or CR-065 landed, build them.
4. The owner's answers to this report's "For the owner", if any.

Otherwise: sync at the last backend commit before any report or exception change, and build from the
report's "Not built" list, starting with the pick screen's breakage on the pick (2.37.0) and the driver's run
in the back office (2.32.0).
```
