# F10g: supplier invoices and payment, so the owner can pay the egg supplier

- **Session:** F10 continued, on branch `claude/serene-dirac-q9sz4y`, from `main` at `41ce67c` (F10f merged as PR #25).
- **Date:** 2026-11-17
- **Scope:** the supplier invoice screens, in the owner's order:
  - (a) an invoice entered against its purchase order and receipt, with the three-way match;
  - (b) approval for payment and the payment, each with its own approver;
  - (c) a claim settled by an invoice or turned into a credit note;
  - (d) the supplier's balance.
- **Not done here:** items 1, 3 and 4 of the F10f opening message. CR-032, CR-033, CR-038 and CR-039 did not land, the storefront e2e ADR waits, and B9b is not live.

## The contract: unchanged at 2.4.0

`pnpm sync-contract:github` brought backend `2189ba7`. The contract's body is byte for byte 2.4.0, and only the source line in its header changed. Nothing after 2.4.0 is in the changelog.

- CR-038's and CR-033's switches stay: `landed.ts` still compiles.
- **The eggs' unit is still `UNIT`, named "Unit", and units have no plural names.** So the screens still say "540 Unit" and "60 Unit". When the backend's rename and plurals land, show "540 eggs" and "from 10 crates", never "Unit" or "Crate" after a number. Every quantity goes through `useUnits().name` and `QuantityDisplay`, so the change is in `stock/units.ts` and the price line words, not in each screen.

## The owner's two answers, at the start of the session

Asked once, before building:

1. **Invoice approval refuses no one.** `approveSupplierInvoice` lets the Accountant or the Owner approve an invoice they entered. Answer: **build to the contract and raise a request** (CR-043). The screen shows any refusal of the approval in words, so the server's refusal appears with no screen change when it lands.
2. **The contract has no supplier balance.** Answer: **raise a request and build behind a switch** (CR-042, ADR 0046), as CR-038 was. Doing so needed a requested read on a back-office screen, recorded in ADR 0052.

## (a) Entering an invoice and the three-way match

**Screens:** `/supplier-invoices`, `/new` and `/:id`, under Business beside Purchase orders, loaded on demand in a new namespace, `payables`.

**Entering:**

- The person picks the supplier, then one of its orders open for invoicing, then a posted receipt against that order.
- One card per received order line shows what was ordered (20 Crate, GH₵47.50 per Crate), what was received (18 Crate, 540 Unit) and what was turned away.
- The person types what the supplier's paper says:
  - the quantity, in the order's unit;
  - the price per that unit;
  - the tax category.
- A line can be left off the invoice. The printed total is optional; the server refuses the invoice if the lines don't add up to it.
- Nothing is worked out. The server converts, prices, taxes and totals.

**The match**, on the invoice's own page, comes from the API, after "Check against the order and receipt":

- **Not checked**, **every line matches**, **no match needed** or **paid on an approved difference** (with its reason).
- **"1 line disagrees with the order or what was received"**, with each failing line under its own heading:
  - why, in words, from `matchReasons`: "It charges for more than was received", "Its price is more than 1 percent away from the order's price";
  - by how much: "1 Crate more than was received" from `qtyVariance`, and "GH₵10.50 over the order's price on this line" from `priceVariancePesewas` and its direction.
- **CR-044:** the contract doesn't say which unit `qtyVariance` is in, nor that the price variance is the whole line's. The example (500 head, 20,000 pesewas over at 40 a head) shows it is the line's. A-F10-06 records how the screen reads both until it is answered.

**Actions**, each by its permission and state:

- Check against the order and receipt.
- Approve for payment, confirmed with the total and what is still owed.
- Ask to pay as invoiced, with a reason. It is offered only when every failing line fails on price or a levy; goods not received never are. The answer is 202, with a link to the approval.
- Send a credit note for approval (202).
- Pay this invoice.
- Cancel, with a reason.

**Refusals stay on screen:** a refused approval stays in its dialog, and stays on the page in words after the dialog closes ("The invoice does not match its order and what was received.").

## (b) Payment, with a different person approving

**Screens:** `/supplier-payments`, `/new` and `/:id`.

**Preparing a payment:**

- Opened from an approved invoice, or from the supplier's account.
- It lists the supplier's approved invoices still owed, the one it was opened from already ticked. Each amount starts at what the API says is still owed.
- The person chooses the method and, optionally, the day to pay. The screen checks each amount is above nothing and no more than is owed; that compares two of the API's integers and adds nothing. The server judges it again.

**The payment page:**

- Shows who it pays (the masked payout details), what it pays on each invoice, and the API's total.
- **Send for approval** says that whoever prepares a supplier payment cannot approve it. The 202 leaves "The payment waits for approval: someone other than you must approve it", with a link.
- **The maker** sees "You prepared it, so someone else must approve it". The approval page shows no Approve to the person who asked.
- **When the server refuses the maker** (the Owner prepared it and the Accountant sent it, so the inbox cannot tell), "You made this request, so you cannot approve or reject it." stays in the dialog.
- **Another person approves** it in the approvals inbox, which now opens the payment ("Open the record").
- **Record as paid:**
  - takes the day, a 24-hour time (Accra is UTC, so `2026-11-18T14:30:00Z`) and the bank or mobile money reference;
  - a time typed as "2.30 pm" is stopped in words before anything is sent;
  - the paid payment shows its number (`SPY-…`) and its remittance advice, line by line.

**Invoice approval itself** works as the contract says: whoever holds `pur.supplier_invoice.approve` approves alone (CR-043).

## (c) Settling a claim

**Screen:** `/supplier-claims/:id`. It opens from the receipt's claim ("Open the claim to settle it") and from the supplier's account.

- **What it shows:** each rejected line with its reason, its eggs, the order's price per crate and the server's claimed value, then the claim's total.
- **Settle by an invoice:** choose an approved invoice of the claim's own order. Only `supplierInvoiceId` is sent. The answer reads "The claim is settled: settled by Invoice AWT-0471".
- **Turn it into a credit note:**
  - choose the invoice that charged the rejected goods, then the supplier's credit note number and date;
  - only those three fields are sent: the lines and amounts are the claim's;
  - it opens the credit note, which says it came from the claim, shows "The claim's value" and is sent for approval (202).
- **After a credit note is drafted,** the claim says so and links to it. A settled claim names what settled it.
- `SUPPLIER_CLAIM_INVALID`'s details (`CLAIM_INVOICED`, `CLAIM_NOT_INVOICED`) are said in the server's own sentence. See the till below.

## (d) The supplier's account

**Screen:** `/suppliers/:id`, opened from a new "Account" column in the supplier list. Readers of supplier invoices see it.

**The balance, with CR-042 on** (e2e and CI): the server's owed on approved invoices, claimed back, paid, in payment and entered but not approved, and when it was worked out.

**With the switch off,** as a deployed build runs: "The balance waits for the server", and nothing is asked or added.

**Beneath it,** each with the API's own figures and pages:

- the invoices still owed;
- the open claims;
- the payments.

**Actions:** enter an invoice; prepare a payment.

## The till: not touched, and measured

- **Size:** the till builds to **247.1 of 250 kB** here, the same with this session's changes as without them. Measured three ways: with them; with them stashed; and with `main`'s data layer put back.
- **Why 247.1, not 246.9:** the F10f report's 246.9 came from a different build. This session adds nothing.
- **Two things kept out of it:**
  - `useRequestedQuery` is built by its own factory (`createRequestedQuery`), only in the back office's requested module, not inside `createApiHooks`, which the till builds.
  - **Refusal words for the payables rules were written and then dropped.** The till loads `common:refusals` up front, and 20 rule sentences cost it 0.6 kB. Each rule is said in the server's own sentence instead, which ADR 0038 allows. They can return when the next till work loads the refusal words lazily, which the till needs anyway.

## Proved by

**`e2e/specs/console/supplier-invoices.spec.ts`**, 12 tests at 360 px:

1. The Owner enters AWT-0471 against PO-2026-DDW-000052 and GRN-2026-DDW-000081: 21 crates at GH₵48.00.
   - The request body is checked: crates and pesewas as typed.
   - The match says line 1 charges 1 Crate more than was received and is GH₵10.50 over the order's price.
   - Neither "Approve" nor "Ask to pay it as invoiced" is offered.
2. A refused approval stays in its dialog, and on the page after it closes.
3. The corrected invoice (18 crates at GH₵47.50, GH₵855.00) is approved for payment.
4. A payment is prepared from the invoice (body checked) and sent for approval (202). Its maker opens the approval and has no Approve.
5. The server refuses the payment's maker at approval, in words.
6. The Manager approves it.
7. It is recorded as paid: a bad time is stopped in words, then `2026-11-18T14:30:00Z` and the reference are sent; the number and the remittance advice show.
8. The claim is settled by the invoice (body checked).
9. The claim becomes a credit note (body checked), which is sent for approval.
10. The supplier's account shows the server's balance (CR-042), the invoice, the claim and no payments.
11. The invoice list.
12. A cashier is denied in words, naming `pur.supplier_invoice.read`.

Every screen runs axe and checks for no sideways scroll at 360 px.

**Other tests:**

- **`apps/console/src/payables/screens.integration.test.tsx`**, 5 tests against the real Prism with every switch off: the invoice list's four states, one invoice, the payment list, and the account saying the balance waits.
- **`apps/console/src/payables/payables.test.ts`:** when a variance may be asked for, and how the paid time is read.
- **`packages/data/src/hooks.test.tsx`:** the requested read, its key, its switch and its refusal.

## Every screen at 360 px

Every screen is in `docs/screenshots/F10g/`, at 360 and 1280 px (`pnpm screenshots`, tag `F10g`).

| Screen                                          | File                                |
| ----------------------------------------------- | ----------------------------------- |
| Supplier invoices                               | `supplier-invoices-360.png`         |
| Entering AWT-0471 against the order             | `supplier-invoice-entry-360.png`    |
| The match: which line disagrees and by how much | `supplier-invoice-mismatch-360.png` |
| The corrected invoice, matched                  | `supplier-invoice-matched-360.png`  |
| Preparing the payment                           | `supplier-payment-new-360.png`      |
| The payment waiting for another approver        | `supplier-payment-waiting-360.png`  |
| The payment's approval                          | `supplier-payment-approval-360.png` |
| The claim, to settle                            | `supplier-claim-360.png`            |
| Awutu Poultry Farm's account with its balance   | `supplier-account-360.png`          |

## Moved from the mock to the real API

**None.** B9b is not built, and nothing is deployed.

## Contract requests added or changed

- **CR-042, new:** `getSupplierBalance`, what is owed, claimed, in payment and paid. Built behind its switch. The e2e, screenshot and CI builds are now `CR-032,CR-033,CR-038,CR-042`; `package.json`, `ci.yml`, `CLAUDE.md` and `DEPLOYMENT.md` say so.
- **CR-043, new:** `approveSupplierInvoice` refuses the invoice's maker (`INVOICE_MAKER_CANNOT_APPROVE`), or the backend says invoice approval is deliberately one person's. No switch: no shape changes.
- **CR-044, new:** the unit and sign of `SupplierInvoiceLine.qtyVariance`, and that `priceVariancePesewas` is the line's whole difference (description fix).

## Decisions recorded

- **ADR 0052:** a back-office screen reads a requested operation through `useRequestedQuery`, built by `createRequestedQuery` in `packages/data`, apart from `createApiHooks`. It has the same four states, retry and cache as any read, and its own key.
- No other new pattern: the screens reuse Table and TableCard, Field, ConfirmDialog, ReasonDialog, QueryBoundary, StatusBadge and MoneyInput.

## Assumptions

- **A-F10-01** now covers CR-042.
- **A-F10-06, new:** until CR-044, `qtyVariance` is read in the line's `uom`, positive as more than received, and the price variance as the line's whole difference.
- **The paid time** is typed as a 24-hour time beside a date picker. `Input` takes no `time` or `datetime-local` type, and adding one would change `packages/ui`.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                 |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                       |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                       |
| `test:unit`                                                         | 0    | console 295 (was 290), data 31 (was 28), api-client 30, ui 900, storefront 34, i18n 6 |
| `test:integration`                                                  | 0    | console 249 (was 244), storefront 15                                                  |
| `test:a11y`                                                         | n/r  | not run: `packages/ui` is unchanged; every new screen's spec runs axe                 |
| `budget:console`                                                    | 0    | till 247.1 of 250 kB (unchanged by this session); back office 279.8 of 300 kB         |
| `test:e2e`, full run                                                | 0    | 286 of 286 in 6.0 minutes (was 274: 12 supplier invoice tests)                        |

## For the owner

1. **Who approves a claim's credit note.**
   - The server refuses the claim's maker, whoever posted the receipt, and whoever entered the credit note.
   - Only the Owner and the Accountant hold `pur.supplier_invoice.approve`; the Manager does not.
   - So if the Owner raises a claim and the Accountant drafts its credit note, **nobody in the seed can approve it**. Either the Accountant raises claims, or the Manager is given the approval for credit notes.
   - The same gap holds if the Owner both raises the claim and drafts the credit note: only the Accountant can approve it, and only if they posted nothing.
2. **Invoice approval is one person's today** (CR-043). The payment is the second pair of eyes. Say if the invoice's approval must be someone else's too.
3. **The balance waits for the server** in any real build (CR-042). Until then the account lists each invoice, claim and payment with its own figures.
4. **"Unit" or "egg":** still "Unit" until the backend's rename lands; then the screens read "540 eggs" with no change of theirs.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10g-supplier-invoices-and-payment.md.
Read ADR 0046, 0049 and 0052.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.4.0.
   - If the eggs' unit is renamed to "egg" and units carry plural names: show "540 eggs" and "from 10 crates"
     everywhere a quantity is shown (stock/units.ts, QuantityDisplay's unit, pricing's entry words), never
     "Unit" or "Crate" after a number; update the e2e and screenshot expectations.
   - If CR-042 landed, requested/landed.ts fails: delete requested/supplierBalance.ts and its id (switch.ts,
     package.json, ci.yml, CLAUDE.md, DEPLOYMENT.md) and call useApiQuery('getSupplierBalance').
   - If CR-038, CR-039, CR-032 or CR-033 landed: as the F10f opening message says.
   - If CR-043 or CR-044 was answered: follow the answer (no shape change is expected).
2. The next till work must load lazily: the till is at 247.1 of 250 kB. Load common:refusals' rule words on
   demand there, then restore the payables rule words dropped in F10g (CLAIM_INVOICED and the rest).
3. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
4. If B9b went live, take the F10 report's items against the real API.
```
