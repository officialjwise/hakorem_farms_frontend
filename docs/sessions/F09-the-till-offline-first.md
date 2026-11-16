# F9: the till, offline first: sale, scan and weight, split tender, hold and recall, returns, shift open and close

- **Session:** F9, on branch `claude/fervent-sagan-qwlk50`, from `main` at `cd810af` (F8 merged).
- **Date:** 2026-11-16
- **Scope:** the F8 report's opening message, with the owner's three answers on top:
  1. the console's subdomain also sends `/api` to the API through the reverse proxy; no CORS anywhere (DEPLOYMENT.md section 4);
  2. no receipt printer in the back office, which prints A4 PDFs; paper-roll receipts are the till's, this phase;
  3. credit notes are raised by the Accountant, a Manager or the Owner, never a cashier, and approved by an Owner or Manager who did not raise them; refunds at the counter are till returns, not credit notes.
- **Gate:** a full sale completes with the network off and syncs exactly once on reconnect.
- **The backend's till and offline sync (B9b) are not built.** Everything here runs against the mock. The section "What still needs the real API" says plainly which parts of the gate that leaves unproven.

## The gate

**Proved on the mock, in Chromium at 360 px, against the production build** (`e2e/specs/console/pos-offline.spec.ts`):

- **A full sale with the network off.** A manager sets the device up as till T1 (`enrolDevice`), the cashier opens a shift with a GH₵200.00 float, and the network goes. The cashier scans goat G-0142 (GH₵850.00, its last weight carried as an estimate), adds a pack of beef from its tile and weighs it at 15.250 kg (GH₵457.50, worked out on the device as `half_up(3,000 × 15.250)`), takes GH₵1,400.00 cash and gives GH₵92.50 change. The confirmation lists every amount first. The sale completes, the receipt reads `P-T1-312-0001` with "Follows when sent", and the header says "1 to send". **No request reached the server** while the network was off, and the sale is in IndexedDB (`hakorem-till`, read back in the test).
- **It syncs exactly once on reconnect.** When the network returns the till sends the sale at once: exactly one batch with exactly one sale, counter 1, the lines and tender exactly as asserted, and a `payloadHash` equal to SHA-256 of the RFC 8785 form computed independently in the test (Node's `crypto`). The screen shows "Official receipt RCP-2026-DDW-T1-006201", "Sent and recorded" and "All sent". "Send now" has nothing to send, and a reload sends nothing more: one batch, one sale applied.
- **A lost answer.** The server applies the batch and the answer is lost (the connection resets). The till backs off, resends the same sale with the same id, counter and hash, the server answers `DUPLICATE`, and it still holds one sale.
- **Fifty sales offline** (the shared brief's scenario 6, ahead of F13): fifty cash sales with the network off, then one reconnect: fifty sent, counters 1 to 50 in order, fifty distinct ids, every hash the server's, fifty applied with fifty receipt numbers.
- axe clean and no sideways scroll on the confirmation, the completed sale and the queue.

**Proved below the browser:**

- `sync.test.ts` (Vitest, memory store, a scripted server that applies once by id): the shift open goes first and alone, keyed by its own id; sales batch in counter order; a lost answer is resent and lands once; 501 sales go as 500 and 1; `REJECTED_INTEGRITY` is never resent and needs a person; `DEVICE_REVOKED` stops the queue and keeps it; another 4xx marks the batch `FAILED_PERMANENT` with its reference; a server total that differs from the till's is flagged; records go 24 hours after confirmation, not before; the counter survives a reload, is not consumed by a sale that fails, and a second window cannot reuse it.
- `cart.test.ts`: exact pesewa values from OFFLINE_SYNC's worked examples (eight crates 49,600; a goat at 125,000 with a 2,500 discount; 31,000 split as 20,000 mobile money and 11,000 cash with 4,000 change), the rounding edges (an exact half up, one below down), weighed lines rounded once, the band and the cached per-line and per-shift limits.
- `sync.integration.test.ts`, against the real Prism, which validates every body and header: the shift, a sale the till built and its batch, a cash movement, a held sale, the close, the enrolment and a return are all accepted; a broken quantity is refused (422); a sync without `X-Device-Credential` is refused (401).

## What still needs the real API (B9b)

The gate's two halves are proved on the device's side. The server's side of "exactly once" is not: Prism keeps no state, so every server behaviour above came from a fake that does what OFFLINE_SYNC.md says the server does. These need the real API before the gate is closed for good:

1. **Exactly once on the server.** That the API applies a sale once by its client id, answers a resend `DUPLICATE` with the first result, and consumes no second number (OFFLINE_SYNC 9.7).
2. **The hash agrees.** That the server's canonical form and SHA-256 equal the till's for real sales; a disagreement would refuse every offline sale as `REJECTED_INTEGRITY`. The till's form is RFC 8785 over integers and strings only, and an independent implementation agrees with it, but the server's has not been run against it.
3. **The id window.** That the server accepts the till's UUIDv7s within its clock tolerance (4.1).
4. **The shift.** The shift sequence and number the server gives (the till's references take it once known), the 409 for two shifts on one register, and the close refused while a sale is missing.
5. **Counter gaps** in a real `counterGaps`, and their words on the queue screen.
6. **Stock and price exceptions** (`SERIAL_CONFLICT`, `HOLD_CONFLICT`, `NEGATIVE_STOCK`, `PRICE_OVERRIDE` after the fact): the screens show `exceptions` and `APPLIED_WITH_EXCEPTION` in words, but only unit tests have produced them.
7. **The device credential:** revocation (`DEVICE_REVOKED`) and a wrong credential (`DEVICE_CREDENTIAL_INVALID`) refuse the batch.
8. **The server's total read back** (`getOrder`) and the flag when it differs.
9. **Mobile money at the counter:** `initiateMobileMoneyCharge` and `checkPaymentStatus` answered from examples only, and whether a sync accepts a tender carrying a cleared `paymentId`.
10. **The close and its sign-off** (`closeShift`, `approveShiftClose`, the X and Z reports), **held sales on the register**, and **returns** (`createReturn`, `submitReturn`): their shapes pass Prism, their behaviour is the mock's examples.
11. **A session that expires during a sync**: the client refreshes once and retries; a refused refresh stops the queue and keeps it. Proved in the client's unit tests, not with a real sync.

## The owner's answers

1. **The console and the API (DEPLOYMENT.md section 4).** Rewritten: the console is built with `HK_API_BASE_URL=/api/v1`, its Caddy block proxies `/api` to the API, its cookies stay host-only, the till's credential is a header on the same origin, and the smoke suite checks for no `OPTIONS` and no other host.
2. **No receipt printer in the back office.** A-F8-01 confirmed. The till prints its own receipts (below).
3. **Credit notes.** The fake roles: the Accountant and the Manager raise credit notes as the Owner does, a cashier never. Approval stays with an Owner or Manager who did not raise it: the approval screen already shows no Approve on one's own request, and the server refuses it (`MAKER_CANNOT_CHECK`). A new billing spec proves the manager is offered "Raise a credit note" and the cashier is not, and is refused at its address. A-F8-03 replaced. Refunds at the counter are the till's return screen.

## First: contract 1.42.0

Synced with `pnpm sync-contract:github`: backend `3a74d76`, contract 1.41.0 to 1.42.0. Nothing broke the build.

- **1.42.0, payments and refunds.** Thirteen planned PAY operations move into code; `REFUND_INVALID` is added; `markRefundPaid` now needs step-up. No screen used them before F9; the till's mobile money tender uses two of them (`initiateMobileMoneyCharge`, `checkPaymentStatus`).
- **CR-023, CR-027, CR-028, CR-029 and CR-030 have not landed.** CR-028 (the shop's phone and WhatsApp) has not, so live animal pages are unchanged. The statements are still planned.

## What was built

| Route             | Screen                                                                                                                                                                                                                                                                     | Reads / writes                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pos`            | The sale, loaded with the document: scan by barcode or tag, search, tiles; weighed lines; an agreed price inside the band with its reason and the cashier's limits; cash and, online, cleared mobile money; a confirmation with every amount; the receipt; hold and recall | The offline pack; the queue (`syncOfflineSales`); `holdSale`, `listHeldSales`, `recallHeldSale`; `initiateMobileMoneyCharge`, `checkPaymentStatus` |
| `/pos/setup`      | A manager makes this device a till: the register and a name                                                                                                                                                                                                                | `listRegisters`, `enrolDevice`                                                                                                                     |
| `/pos/shift/open` | Open a shift with its float; queued, so it opens offline too, then the pack downloads                                                                                                                                                                                      | `openShift`, `getOfflinePack`                                                                                                                      |
| `/pos/shift`      | The shift: cash drops, pay-outs and pay-ins (queued), the X report, the blind close, the supervisor's sign-off and the Z report                                                                                                                                            | `getShift`, `listReasonCodes`, the queue, `getShiftXReport`, `closeShift`, `approveShiftClose`, `getShiftZReport`                                  |
| `/pos/queue`      | Everything on this till not yet confirmed, or confirmed in the last day: status in words, references, exceptions, refusals with their reference, counter gaps, a total that differs, a copy of a receipt                                                                   | The queue                                                                                                                                          |
| `/pos/returns`    | A return against a receipt: what comes back, where it goes, the reason and the refund destination; the API works out the refund and the credit note, or waits for a second person                                                                                          | `listBillingDocuments`, `getOrder`, `listReasonCodes`, `createReturn`, `submitReturn`                                                              |

- **One path for every sale (ADR 0043).** Online or not, a completed sale is written to IndexedDB with its counter, provisional reference, hash and receipt in one transaction, then sent with `syncOfflineSales`. `completeCounterSale` is not used.
- **Nothing is computed but the offline cart.** The cart's arithmetic is the backend's ADR-0001 ported: integer pesewas in `bigint`, half-up once per line, the total the sum of line integers. The server re-prices every sale; its total is read back and a difference is flagged on the queue, never absorbed. Every other figure (returns, the close's expected cash, the reports) is the API's.
- **The device credential (ADR 0044).** The generated client marks the eight operations whose security names `deviceCredential` and sends `X-Device-Credential` on those only; the till's credential lives in its IndexedDB and is never shown.
- **The receipt.** Laid out for an 80 mm roll and printed through the browser's print, the receipt printer being the till's printer. It carries the provisional reference, the official number once sent, every line, the tenders, the change and the sale id. A copy from the queue screen is marked "COPY: reprint of a receipt already given, not a new sale".
- **Offline within a session.** The till's other screens are fetched once the till is ready, so they open with the network off afterwards. The shell sends the queue when the browser says it is online again, and probes the API every 30 s while records wait.
- **Four states** on every till screen: the store loading; empty (no till, no shift, no items, nothing queued) in words with the next step; errors in words (the store refused, the prices failed to download, a refused record with its reference); permission denied in words with the permission (`/pos/setup` for a cashier, the till for a storekeeper).
- **A failed money or stock write stays on screen:** in the confirmation dialog (enrolment, shift open, the close, the sign-off, a return), in the payment dialog, and on the queue for every refused record.
- **One fix in `packages/ui`:** Select and Combobox lists now open on the popover layer, above a Dialog's scrim. Inside a Dialog their options could not be clicked. A story proves it (`Select › InsideDialog`).

## The screenshots

The production build on the mock, at 1280 px and 360 px (`pnpm screenshots`, `docs/screenshots/F09/`). Each shot sets the device up as till T1 and opens Adwoa Darko's shift first. Shrunk to a 256-colour palette (2.1 MB to 0.8 MB).

### A sale with a goat and weighed beef

Phone, 360 px: ![A sale with a goat and weighed beef, 360 px](../screenshots/F09/sale-cart-360.png)

Desktop, 1280 px: ![A sale with a goat and weighed beef, 1280 px](../screenshots/F09/sale-cart-1280.png)

### Payment with the network off: cash only, the change worked out

Phone, 360 px: ![Payment with the network off, 360 px](../screenshots/F09/pay-offline-360.png)

Desktop, 1280 px: ![Payment with the network off, 1280 px](../screenshots/F09/pay-offline-1280.png)

### The confirmation with every amount

Phone, 360 px: ![The confirmation, 360 px](../screenshots/F09/pay-confirm-360.png)

Desktop, 1280 px: ![The confirmation, 1280 px](../screenshots/F09/pay-confirm-1280.png)

### The sale complete, offline: kept on this till, the receipt with its provisional reference

Phone, 360 px: ![The sale complete offline, 360 px](../screenshots/F09/sale-done-offline-360.png)

Desktop, 1280 px: ![The sale complete offline, 1280 px](../screenshots/F09/sale-done-offline-1280.png)

### The same sale after reconnecting: the official receipt number

Phone, 360 px: ![The sale synced, 360 px](../screenshots/F09/sale-done-synced-360.png)

Desktop, 1280 px: ![The sale synced, 1280 px](../screenshots/F09/sale-done-synced-1280.png)

### Sales to send, offline

Phone, 360 px: ![The queue offline, 360 px](../screenshots/F09/queue-offline-360.png)

Desktop, 1280 px: ![The queue offline, 1280 px](../screenshots/F09/queue-offline-1280.png)

### An agreed price past the cashier's limit, refused in words

Phone, 360 px: ![An agreed price refused, 360 px](../screenshots/F09/line-agreed-price-360.png)

Desktop, 1280 px: ![An agreed price refused, 1280 px](../screenshots/F09/line-agreed-price-1280.png)

### The shift, before the blind count

Phone, 360 px: ![The shift, 360 px](../screenshots/F09/shift-360.png)

Desktop, 1280 px: ![The shift, 1280 px](../screenshots/F09/shift-1280.png)

### The count against what was expected, revealed only after declaring

Phone, 360 px: ![The count declared, 360 px](../screenshots/F09/shift-counted-360.png)

Desktop, 1280 px: ![The count declared, 1280 px](../screenshots/F09/shift-counted-1280.png)

### A return against a receipt

Phone, 360 px: ![A return, 360 px](../screenshots/F09/returns-360.png)

Desktop, 1280 px: ![A return, 1280 px](../screenshots/F09/returns-1280.png)

### The sale screen, empty, and the cart in the dark theme

![The sale screen, empty, 360 px](../screenshots/F09/sale-empty-360.png) ![The cart, dark, 360 px](../screenshots/F09/sale-cart-dark-360.png)

The dark shot sets the till's theme directly: the till defaults to light (A-F0-03) and has no theme switch of its own.

## Moved from the mock to the real API

**None.** CI and e2e build against Prism, and no backend runs here. The till's operations are the backend's B9b, not built. The payments that 1.42.0 moved into code (mobile money initiation and status) are ready to move once a live check is possible.

## Contract requests added

- **CR-031:** the offline pack says whether its prices include tax, and the sync result carries the server's total (today the till reads each order back).
- **CR-032:** the pack carries the `CASH_MOVEMENT` reasons, and the offline PIN verifier for the unlock, the supervisor's approval offline and a cash drop's witness.

CR-023 (the role matrix) now also covers the till's permissions (A-F9-01). CR-023, CR-027, CR-028, CR-029 and CR-030 are still open.

## Assumptions

A-F8-01 confirmed and A-F8-03 replaced by the owner. New:

- **A-F9-01:** the fake roles' till permissions (the Cashier's shift, cash, report, reason, return and mobile money permissions; the Manager's setup, sign-off and force close).
- **A-F9-02:** the pack's prices are what the customer pays; no levies added on top (CR-031).
- **A-F9-03:** every sale through the queue; the receipt printed by the till through the browser's print, not raw ESC/POS.
- **A-F9-04:** no offline PIN unlock, no supervisor approval offline (so no unverified mobile money), no cash drop witness; a till reloaded with no network does not start until F13.
- **A-F9-05:** an animal or lot is sold by its stock unit from the pack, never as a bare product.

## Decisions recorded

- **ADR 0043:** every till sale goes through the offline queue, kept in IndexedDB, read through one till store (no context, no library).
- **ADR 0044:** the till sends its device credential where the contract asks, from the session hooks; the generator marks those operations.
- **DEPLOYMENT.md section 4:** the console's `/api` on its own host (owner).

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                                                                                                                                                                 |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                                                                                                                                                                 |
| `test:unit`                                                         | 0    | console 214 (was 172; 49 for the till), ui 885 (was 883; two tooltip focus tests), storefront 29, data 28, api-client 28 (was 26), i18n 6                                                                                                       |
| `test:integration`                                                  | 0    | console 242 (was 234; 8 new, the till against the real Prism), storefront 13                                                                                                                                                                    |
| `test:a11y`                                                         | 0    | 314 stories (was 313; `Select › InsideDialog`), axe, both themes and densities                                                                                                                                                                  |
| `build:console`, `build:storefront`                                 | 0    | (in `test:e2e`)                                                                                                                                                                                                                                 |
| `budget:console`                                                    | 0    | till 240.2 of 250 kB initial script (was 190.8), 68.1 kB in 26 chunks on demand; back office 277.0 of 300 kB (was 273.9)                                                                                                                        |
| `test:e2e`, full runs                                               | 0    | two full runs in a row, 266 of 266 in each (249 before F9), 6.4 and 6.0 minutes. 17 new: the till's 16 (the gate, the lost answer, fifty sales offline, the other flows, and axe and 360 px on every till route) and the credit note role check |
| console screenshots (`@screenshots F09`)                            | 0    | 24 shots: 12 till screens and states at 1280 and 360 px                                                                                                                                                                                         |

### What the gates found, and what was done

- **Playwright's offline mode still reaches route handlers.** `context.setOffline(true)` blocks the network, but a request the fake API intercepts is still answered, so the first run of the gate saw a sync land "offline". The fake now refuses every API request while the network is off (`api.setNetwork`), as a dead connection does, and the gate asserts nothing reached it.
- **Select inside a Dialog could not be chosen.** Its list sat under the Dialog's scrim (z 200 under 300). Fixed in `packages/ui` with a story.
- **A flush asked for during a pass returned the old pass**, so a sale queued meanwhile waited for the next timer. The till now runs one more pass after the current one for everyone who asked.
- **Two sales in the same millisecond sorted by their random ids.** The queue now keeps counter order for them.
- **The provisional reference used the till's own shift number** before the server's arrived. It now takes the server's, unless a receipt was already printed under the provisional one.
- **The close's four-column table scrolled sideways at 360 px.** Each tender's count is now its own small block.
- **The cart sat under every tile at 360 px.** It now leads the screen below the two-column layout.
- **The F1 chrome test asserted no navigation at all.** The till now has one row of links (not a sidebar); the test checks it spans the screen at the top.
- **CI failed one story twice, never re-run.** `Tooltip › Open`: after a Tab, focus was on the page body. My first diagnosis, named on the PR, was a race in F8's lazily loaded tooltip (ADR 0042), which decided whether to put focus back when its Radix half arrived while React swapped the trigger in a moment later. That race was real, and is fixed with a unit test that fails on the old code (`4991952`), but it was not the cause: the second run failed the same way, and in both the trigger already carried Radix's `data-state`, so no swap happened. The cause, corrected on the PR: the story pressed Tab from wherever an earlier story on the same page had left focus, and from there Tab went past the trigger, the story's only tabbable element. The tooltip's keyboard stories now press Tab from a focus point at the top of their canvas. An experiment that leaves focused elements before and after the story fails the old plays and passes the new ones.
- **The till's initial load grew to 240.2 kB of 250.** Under budget. The sale's dialogs stay in it on purpose so a sale completes offline even if the network drops right after the till starts (PERFORMANCE_BUDGET). The headroom is small.

## For the owner

1. **The receipt printer.** The till prints an 80 mm page through the browser, so the printer must be installed as the tablet's printer. If the shop's printer only takes raw ESC/POS over USB or Bluetooth, say which model: the API already returns ESC/POS bytes, and sending them from the browser (WebUSB or Web Bluetooth) is a decision for its own ADR.
2. **The official number on paper.** Every receipt is printed at completion with the till's reference; the official number shows on screen a moment later when online. Should an online sale wait for the official number before printing?
3. **The supervisor's PIN.** Offline unlock, a supervisor's approval offline (needed for unverified mobile money) and a cash drop's witness all rest on a till PIN the contract does not have yet (CR-032). Confirm the PIN approach, so the backend can add it.

## The owner's answers (after the merge, 2026-11-16)

1. **The printer: do not design the till around one.** Every sale produces a digital receipt, by SMS or a link, which works on every phone with no hardware. A printer is an optional capability the till detects, 58 mm ESC/POS over Bluetooth where used. The reason is the stack: Web Bluetooth works in Chrome on Android and does not exist in Safari on iOS, and the business does not control which phones staff bring. Recorded in **ADR 0045**; A-F9-03 replaced; the receipt link is **CR-033**. Separately, as a question for whoever answers the business's tax questions, not a design decision: whether a farm selling retail at these volumes must issue a numbered receipt or a VAT invoice (**Q-TAX-01**, `docs/OPEN_QUESTIONS.md`).
2. **Never wait for the official number, even online.** A till that usually answers at once and sometimes waits on a round trip is worse than one that never waits. The till prints or shows the **sale reference** at once, labelled as a sale reference, never as a receipt number (the receipt now reads "Sale reference"). The official number comes at sync and appears on the digital receipt and in the records, with the sale reference beside it on both (ADR 0045).
3. **The PIN: yes, and it is a backend request, not an open question.** The server issues each operator's PIN as a hash; the till verifies locally and the PIN never authenticates to the server; four to six digits, with attempt limits and a lockout; an approval made offline records which PIN approved it and the server checks it at sync, flagging a revoked or wrong one; a revoked till is still refused at sync. **CR-032**, rewritten to say exactly that.
4. **B9b before F10.** The gate proves the till against a mock written from the same assumptions as the till, so it cannot catch a wrong assumption, and every item under "What still needs the real API" sits on the server's side of it. The quote builder does not go on top of a sync contract where both ends came from one guess. The opening message below makes it an instruction.

**What this repository can and cannot do about B9b.** The frontend never edits `../backend/` (CLAUDE.md), so it cannot build B9b. The backend track builds B9b (POS, shifts, offline sync, with CR-031 to CR-033); the frontend's next session closes the F9 gate against it, and does not start F10 until it has. If B9b is not live when that session starts, it stops and says so.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F09-the-till-offline-first.md, including "The owner's
answers (after the merge)". Read ADR 0043, ADR 0044 and ADR 0045.

This session closes the F9 gate against the real API. It does not start F10. F10 (the quote builder) does
not begin until every item under "What still needs the real API (B9b)" in the F9 report is proved against
the backend's B9b or recorded as a defect with its cause: the owner's instruction of 2026-11-16, because the
F9 gate was proved only against a mock written from the same assumptions as the till.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 1.42.0. Answer what it
   changes, including CR-023 and CR-027 to CR-033.
2. If B9b (POS, shifts, offline sync) is not live in the backend, stop here. Write a short report saying so,
   and what the backend still lacks. Do not start F10 and do not build on the mock.
3. With B9b live: run the till against it, against the backend's local or staging API, never Prism. Take the
   eleven items under "What still needs the real API" one by one, first among them that the server applies
   a sale exactly once by its id and recomputes the same payload hash as the till. For each, prove it with
   a test against the real API (test:integration or test:e2e:staging) or record the defect, its cause and
   which side it is on. Fix the frontend's side here; raise the backend's in docs/CONTRACT_REQUESTS.md.
4. Then, against the real API: the till PIN if CR-032 landed (offline unlock, supervisor approval offline,
   the server's check at sync), and ADR 0045's receipt (the digital receipt by SMS or link once CR-033
   landed; a Bluetooth 58 mm ESC/POS printer detected where the browser has Web Bluetooth; the F9 print-to-page
   receipt removed). The till never waits on the network for any of it.
5. Say in the report which till operations moved from the mock to the real API.

If CR-028 landed, show the shop's phone and WhatsApp on live animal pages (owner, 2026-11-16).
F10 is the session after this one, and only once step 3 is complete.
```
