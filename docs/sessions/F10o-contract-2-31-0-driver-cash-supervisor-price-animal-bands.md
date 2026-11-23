# F10o: contract 2.31.0, the driver's cash at the till, a supervisor's PIN for a price, each animal's own band, the receipt link and the approved quote

- **Session:** F10 continued, on branch `claude/stoic-lamport-xaohhr`, from `main` at `66b1be7` (F12, PR #37), rebased onto `2905f47` (F12b, PR #38, the investor portal as its own build) before merging.
- **Date:** 2026-11-23.
- **Numbers taken from `main` just before committing:** CR-063, assumptions A-F10-15 to A-F10-19. No ADR: every decision here follows ADR 0046, 0047 and 0057.
- **Ran beside:** F12b, the investor portal, in another session. The portal, reports and exceptions were not touched. Shared files changed, small: the switch list and `landed.ts`, the builds' `HK_REQUESTED_CONTRACT` (`package.json`, `ci.yml`), `CLAUDE.md`, `DEPLOYMENT.md`, `PERFORMANCE_BUDGET.md`, `e2e/support/fakeApi.ts` (one line: the latest requested answer installed wins) and the approvals screen's words for a margin approval.
- **Scope:** the F10n opening message, with the owner's three items on top:
  1. Accepted as built: a cashier locked out offline waits to sign in online and set a new PIN; PINs of four to six digits; the till locking itself after two minutes (A-F10-14, now accepted).
  2. A supervisor's PIN approving a price beyond the cashier's limit at an offline till, every such override reported at sync.
  3. The driver's cash hand-in at a till shift once CR-057 lands. It landed in 2.31.0 as its own till operation, `handInDriverCash`, and is built on it.
- **Screenshots:** none were taken, opened or committed (CLAUDE.md). Every screen is checked by its spec at 360 px, with no sideways scroll and axe.
- **Two parts were built by agents in their own worktrees and reviewed before they were taken in:** the quote screens and the shop's receipt page.

## 1. The sync: 2.17.0 to 2.31.0 (backend `a851f1a`)

`pnpm sync-contract:github` brought fourteen minor versions. `landed.ts` failed for CR-033, as ADR 0046 means it to, so the sync and CR-033's change are one commit.

| Request     | Landed                 | What the console does now                                                                                  |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **CR-033**  | 2.24.0, points 1 and 2 | The till makes the receipt link's token and the shop shows the receipt (section 4). The switch is deleted. |
| **CR-052**  | 2.28.0                 | Each animal sells at its own band (section 3). `soldThroughQuotes` and `goatPricedPerHead` are deleted.    |
| **CR-057**  | 2.31.0, differently    | `handInDriverCash` on the cashier's own shift (section 2). The driver list is CR-063, requested.           |
| **CR-058**  | 2.19.0                 | "Issue and send" on an approved version (section 5).                                                       |
| CR-033 pt 3 | no                     | No receipt SMS is in the contract. The till promises none.                                                 |

**Breakage fixed in the sync's commit:** the `APPROVED` version's badge, `SHORT_PICK` in the customer's answer, the pick list filter's enum, words for eight new error codes, the seeded B11 grants (`fakeRoles.test.ts`), the mock's 659 operations, and the e2e fixtures' new fields.

**Not built from 2.18.0 to 2.31.0** (for the next sessions): `payInvoiceAtTill` and `revokeReceiptLink` (2.26.0), a business buyer on a counter sale (2.26.0), `BreakResolve.posting` `VERIFIED` and `reversePayment` `MOBILE_MONEY_NOT_RECEIVED` (2.22.0), card on the storefront's checkout (2.30.0), `proposeShortPick` (2.25.0), `getOrderFulfilmentView` for the Storekeeper (2.29.0), the standing orders and bad-debt write-off (2.18.0), and the driver's phone items of CR-057 (2 and 3). The till's queue shows every new sync exception (`OFFLINE_LATE_CASH`, `OFFLINE_PACK_PRICE`, `RECEIPT_TOKEN_REFUSED`, `BUYER_DETAILS_REFUSED`) in the server's own summary, as before.

## 2. The driver's cash at the till's shift (CR-057, 2.31.0)

`handInDriverCash`, `POST /shifts/{id}/driver-cash-hand-ins`, on the shift screen (which loads on demand), for the shift's own cashier holding `pos.sale.create`, online only (the operation is not in the offline batch).

- **The count is blind.** The cashier chooses the driver, enters what they counted (0 if nothing), and an optional note. Nothing expected is shown before.
- **A confirmation with the exact amount**, then the server's answer stays on screen: collected on delivery, counted, and short, over or exact in words. A short count says the driver is reported short and the drawer holds only what was counted. The deliveries handed in are listed.
- **A refusal** (`DRIVER_CASH_INVALID` `NOTHING_HELD` or `RECEIVER_IS_DRIVER`, `SHIFT_NOT_OPEN`) stays in words with its reference.
- **One idempotency key per intent**, so a retry of the same count cannot hand the cash in twice.

**The gap, CR-063.** `handInDriverCash` needs the driver's id, and nothing the Cashier holds lists drivers. CR-063 asks for `listShiftDriverCashHolders` (`GET /shifts/{id}/driver-cash-holders`): each driver holding delivery cash at the branch and how many deliveries, never an amount (A-F10-19). It is built behind its switch (ADR 0046, `requested/driverCashHolders.ts`), on in the e2e and CI builds. **A build for the real API says on the shift screen that the till cannot list the drivers yet, so it cannot take a driver's cash.** The hand-in itself calls the real operation.

## 3. Each animal at its own band (CR-052, 2.28.0)

- `OfflineStockUnit.priceBand` is the animal's own, from its grade and latest weight. A lot has none and sells at its product's band.
- The chooser shows each goat's price beside its tag and weight. An animal the pack cannot price is greyed out with the pack's reason in words ("No price: it needs a grade or a weight first", and the others). Found by its tag, it says the same and nothing goes on the sale.
- A recalled held sale takes the animal's band from the pack held now, and drops an animal the pack no longer prices.
- The till's line carries the animal's last weight as an estimate, which the server prices from too. An animal weighed again since the pack is priced by the server from its latest weight; the till's price stands and the difference is raised.

## 4. The receipt link (CR-033, 2.24.0)

**The till:** each sale gets a 16-byte base64url token from `crypto.getRandomValues` (22 characters, never derived from anything), the pack's `receiptLinkTemplate` filled with it, and `OfflineSale.receiptToken` sent with the sale under `payloadHash`. The link is kept with the receipt, so a reprint carries the same one. Before sync the till says the link works once the sale reaches the server; after, that it works now. A refused token (`RECEIPT_TOKEN_REFUSED`) leaves the sale recorded and the till says to give the sale reference instead. No SMS is promised: the phone number goes with the sale.

**The shop, `/r/[token]`:** the receipt as `getPublicReceipt` answers it, read on the server with no island: the business, the receipt number and sale reference, when it was sold in Accra time, each line with its quantity, weight, unit price and amount, the total, the tenders and the change. A token not of the till's shape is the 404 without a request. One 404 page for every dead link says the link may be mistyped or the sale may not have reached the farm yet, with the shop's numbers. `noindex`, `no-referrer`, `private, no-store`, `/r/` disallowed in robots. It prints without the site's header and footer (Tailwind's `print:`, every page). 111,771 B whole, enforced at 120 kB. The route is an assumption (A-F10-18).

## 5. Quotes on 2.19.0, 2.21.0, 2.23.0 and 2.29.0

- **An approved version (2.19.0, CR-058):** the quote page says the margin is approved and nothing is held or sent yet, and offers "Issue and send" with the issue flow's channels; the link shows once. The approver's refusal (`APPROVER_CANNOT_ISSUE`) stays in words. The approvals screen says a margin approval only approves and the salesperson then issues. The approver still sees the button (A-F10-16).
- **Markup is not margin (2.29.0):** `marginPercent` is no longer read. The totals show markup over cost and margin over the selling price, each "Not known" when a cost is missing; the floor is described as a margin over price.
- **Subject to stock (2.23.0):** a version and its lines say when they went out subject to stock, with what was on hand and what is held in the base unit (A-F10-17). The shop's quote page says so in words, never with a stock level.
- **A version's links (2.21.0):** listed with their state, who made and revoked them and why, never a token; an open one is revoked with a reason.

## 6. A supervisor's PIN for a price beyond the cashier's limit (2.17.0)

- **In the line editor**, once the discount passes the cashier's per-line or per-shift limit (with a reason chosen), it offers "A supervisor approves this price". Only supervisors of the branch are offered: never the shift's cashier, never a locked PIN, and only one whose own per-line limit (`TillPinVerifier.priceOverrideLimitPerLinePesewas`) covers the discount. With none, it says so in words and to change the price.
- **The approval holds for the price it was given at.** A changed price asks again; nothing passes the band. Approved, the line passes the cashier's limits up to the supervisor's own (A-F10-15).
- **Reported at sync:** the offline line carries `overrideApproval` (`approvedById`, `approvedByPinVersion`); every try, right or wrong, is reported with purpose `APPROVAL` before the sale; the queue screen names who approved. The server raises every such price on the daily exception report.
- **A recalled held sale** asks for the price and its approval again.

## Proved by

**e2e, 379 of 379** in 8.3 minutes on the rebased branch (F12b 354), at 360 px, axe-clean, no sideways scroll:

- `pos-driver-cash.spec.ts`, 3 new: the blind count, the confirmation with GH₵1,440.00, the server's short of GH₵100.00 in words, the body sent and the list read again; a refusal in words with its reference; offline.
- `pos-pin-receipt.spec.ts`: the receipt link from the till's own token, the token sent with every resend and never the sale's id (rewritten); the supervisor's PIN for a price, new: refused past the supervisor's GH₵100.00, approved at GH₵80.00 off after one wrong PIN, `overrideApproval` sent, both tries reported as `APPROVAL`, and the queue naming the approver.
- `pos-till.spec.ts`: each goat at its own band, G-0190 unpriced with its reason, G-0163 not offered, and the sale's line at GH₵1,200.00 (rewritten); the agreed price within limits on G-0142's own band.
- `pos-offline.spec.ts`: the goat at its own band, offline.
- `quotes-issue.spec.ts`, 6 new; `quotes-credit.spec.ts`; `storefront/quotes.spec.ts`, 2 new; `storefront/receipt.spec.ts`, 13 new, on the 3G profile.

**Unit:** `receiptToken.test.ts`, `animalBand.test.ts`, `priceApproval.test.ts` (new); `till.pin.test.ts` (a supervisor approves four things); `switch.test.ts` (CR-033 refused as a switch); the storefront's `receiptToken.test.ts`; `refusals.test.ts`.

**Integration:** 659 operations in the mock; the receipt page and the quote screens against Prism.

## Moved from the mock to the real API

- The receipt link's token on the offline sale and the shop's receipt (`OfflineSale.receiptToken`, `OfflinePack.receiptLinkTemplate`, `getPublicReceipt`, 2.24.0).
- Each animal's band in the pack (`OfflineStockUnit.priceBand`, 2.28.0).
- A supervisor's approval of an offline price (`OfflineSaleLine.overrideApproval`, 2.17.0).
- The driver's cash hand-in (`handInDriverCash`, 2.31.0). Its driver list is still requested (CR-063).
- Issuing an approved quote version and revoking a quote link (`issueQuoteVersion` on `APPROVED`, 2.19.0; `revokeQuoteLink`, 2.21.0).

## Contract requests added or changed

- **CR-033, CR-052, CR-057 and CR-058** answered and built. CR-033 point 3 (the receipt SMS) and CR-057 items 2 and 3 (the driver's phone) are not in the contract.
- **CR-063 raised:** the till lists the drivers who hold delivery cash at its branch, names and counts only.

## Decisions recorded

- **A-F10-14** accepted as built (owner, 2026-11-23).
- **A-F10-15:** a supervisor's approval lets a line pass the cashier's per-line and per-shift limits, up to the supervisor's own per-line limit; it still counts toward the shift's discounts.
- **A-F10-16** to **A-F10-19:** the approver sees "Issue and send"; a quote line's stock in the base unit, and only an open link revokes; the receipt page's route and formats; the driver's cash counted blind.

## Gates, each run on its own, on the rebased branch

| Check                                        | Exit | Count                                                                                                                                                     |
| -------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`          | 0    |                                                                                                                                                           |
| `sync-contract:check`                        | 0    | backend `a851f1a`, 2.31.0                                                                                                                                 |
| `tokens:check`, `fonts:check`, `icons:check` | 0    |                                                                                                                                                           |
| `test:unit`                                  | 0    | console 353, ui 901, storefront 44, data 33, api-client 30, i18n 6. Both agents saw one console test time out once under load; it passed alone and after. |
| `test:integration`                           | 0    | console 281, storefront 25                                                                                                                                |
| `test:e2e`, full run                         | 0    | 379 of 379 in 8.3 minutes                                                                                                                                 |
| `budget:console`                             | 0    | till 246.2 of 250 kB (F12b 244.9); back office 288.0 of 300 kB; investor 213.4 of 250 kB                                                                  |
| `budget:storefront`                          | 0    | `/r/[token]` 111.8 of 120 kB, `/q/[token]` 159.2 of 170 kB, `/quote` 165.6 of 170 kB, listing pages 112.2 of 120 kB                                       |
| `test:a11y`                                  | 0    | 322 stories, 65 files                                                                                                                                     |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                                                                         |

## For the owner

1. **The driver's cash can be taken at the till only once the backend lists the drivers (CR-063).** The hand-in is built on the real operation, but nothing the Cashier holds names a driver. Until CR-063 lands, a real till says it cannot list the drivers yet. Say if the count should show what was expected before the cashier counts (A-F10-19: it does not).
2. **A supervisor's PIN approves a price past the cashier's limit, up to that supervisor's own limit per item**, and the approved item also passes the cashier's shift limit (A-F10-15). Say if the shift limit should hold even with a supervisor's PIN.
3. **The till's initial load is 246.2 of 250 kB.** The next feature on the sale screen needs the chunk-merging lever, a decision for you.
4. **No receipt SMS yet:** the contract carries none (CR-033 point 3). The phone number goes with the sale.
5. **The receipt page is `/r/{token}` on the shop** (A-F10-18). The backend's template must point there.
6. **The approver of a quote's margin still sees "Issue and send"** and is refused in words (A-F10-16).

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10o-contract-2-31-0-driver-cash-supervisor-price-animal-bands.md.
Read ADR 0046, 0047 and 0057. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.31.0.
   - CR-063 landed (the till lists the drivers holding cash): delete requested/driverCashHolders.ts and its id,
     and read the list through useApiQuery.
   - CR-033 point 3 landed (the receipt SMS): say on the till whether the SMS went.
2. Build what 2.18.0 to 2.31.0 added and this session left (report section 1): payInvoiceAtTill and
   revokeReceiptLink at the till, a business buyer on a counter sale, the unverified tender's VERIFIED posting.
3. The owner's answers to this report's "For the owner", if any.
```
