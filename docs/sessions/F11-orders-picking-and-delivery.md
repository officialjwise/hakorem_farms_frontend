# F11: online orders, picking, dispatch and delivery

- **Session:** F11, on branch `claude/brave-thompson-24mg8d`, from `main` at `b2c8fef`, rebased onto `a0059c7` (PR #32, no screenshots until F13).
- **Date:** 2026-11-18
- **Ran beside:** the till's session, F10l. Its lane covers the 2.12.0 sync, CR-038 and CR-045. It took CR-052, so this session's requests are CR-053 to CR-057.
- **Not touched:** the till, quotes, wholesale and credit screens. `/orders/:id` stays F10i's page (A-F11-04).
- **Screenshots:** none were taken, opened or committed (owner, CLAUDE.md). Every screen is checked by its spec: 360 px, no sideways scroll, axe.

## The gate

A driver completes a delivery with one bar of signal. The driver's screens work offline for a whole run, and sync each delivery exactly once when the signal returns.

**Proved by `e2e/specs/console/driver-offline.spec.ts`,** against the production build:

1. **With signal.** The driver opens today's run: three stops from Kasoa and KNUST, in order, each with its cash to collect, and the run's total from the server.
2. **The signal goes.**
   - **Stop 1:** the address, the phone as a `tel:` link, "12 crates" and "30 eggs". "I'm on my way", then delivered: who took it, a photograph and GH₵786.00 cash. The confirmation shows the cash due and the cash received.
   - **Stop 2:** refused, the eggs back to stock, with the reason from the server's list.
   - **Stop 3:** paid GH₵50.00 of GH₵60.00. The confirmation and the stop say it goes on the driver variance report.
   - **The run:** each stop says "Delivered, waiting to send" or "Not delivered, waiting to send", and the header says "4 waiting to send".
   - **The cash screen:** the office's figure, the two collections not sent yet one by one, and "Hand all of it in at a till shift … never written down as loose cash".
3. **A reload** with the driver's operations still out of reach: the run, as the phone kept it, and the four records are still there.
4. **One bar of signal:**
   - Chromium throttled to 800 ms latency, 50 kbit/s down and 20 kbit/s up;
   - every request held 400 ms, and every third driver or upload request dropped before it reaches the server;
   - the first sync's answer lost after the server applied it.
5. **Exactly once.** The phone says "All sent":
   - the server applied three records, one per stop;
   - the phone sent some ids more than once, every resend under the same id;
   - each photograph reached the server under one idempotency key;
   - each stop says "sent".

**Repeated:** five runs in a row passed (1.4 minutes).

## What was built

### The driver's phone (ADR 0055)

- **Where it lives.** `/driver` and below, in the back office document, in its own full-screen frame (`DriverShell`): no sidebar, large touch targets, light by default (A-F11-02). One chunk, 10.3 kB gzipped, holds the frame and every driver screen, so each opens with no signal once the run has opened.
- **The store** (`driver/offline/store.ts`): IndexedDB `hakorem-driver`. It holds:
  - the run, each stop's delivery, the failure reasons, the unit names and the cash summary, with when they were read;
  - the queue;
  - each proof's photograph, until it is uploaded.
- **The queue** (`driver/offline/sync.ts`). Every record carries a client UUIDv7, made once.
  - Photographs go first (`uploadFile`, keyed by their own id), then "on my way" (`markOnTheWay`), then proofs and failures in `syncDriverEvents` batches.
  - `DUPLICATE` counts as applied. `REJECTED` stays on the phone in the server's words.
  - No answer or a 5xx is a backoff: 5 seconds doubling to 5 minutes, and a probe every 30 seconds.
  - An ended session stops the queue and keeps it.
  - "Try now" sends the queue at once.
- **The screens:**
  - the run;
  - a stop: who, where, a call link, a map link, what goes in its units, the cash to collect, "I'm on my way";
  - proof of delivery: the recipient's name, a photograph (A-F11-03), the cash paid, and the position when the phone gives one;
  - not delivered or refused, with the reason and what happens to the goods;
  - the cash I carry.
- **Part delivery** cannot be recorded yet, and the stop says so in words (CR-055, A-F11-08).

### The back office

- **`/orders`:** every channel in one list, with search by number or a guest's name, and filters by status and channel. Each row shows the total as the API states it: the estimate until it is final.
- **`/orders/:id/fulfilment`:**
  - the order's facts and its lines (ordered, picked and back-ordered, in the line's unit), the API's totals, and its history;
  - the customer's answer, when the order waits for it: what they were asked, agreed or declined, and how;
  - its pick list, or "Start picking" from a chosen location.
  - It links to F10i's `/orders/:id` for payment, the invoice and credit.
- **`/fulfilments/:id`, picking:**
  - **Each line** shows what to pick, what was ordered and what was picked so far, in the line's unit.
  - **Short or over is refused.** A short line is offered to the customer first, with "Short? Offer a substitute": the same product in a smaller quantity, or another (A-F11-06).
  - **Cracked eggs** are written off with their reason (`BREAKAGE`, in eggs). The outcome stays in words: posted, or waiting for a manager (A-F11-07).
  - **Picks** are recorded with a client id each.
  - **Then** the order is packed, and dispatched (driver and van) or collected. Each step confirms with the order's totals first.
- **`/deliveries`, dispatch:** the day's deliveries. Tick them, choose the driver and the van, and make a run (`createRoute`).
- **`/routes`, `/routes/:id`:** the day's runs. A run's stops are moved up or down and saved (`reorderRouteStops`, with its `version`), then the run is started.
- **The sidebar** gains Picking, Dispatch, Delivery runs and Today's run, each behind its permission.

### Single eggs in the online shop (CR-039)

Not built. CR-039 is not in 2.10.0 nor in 2.12.0: `ProductDetail` has no `sellingUnits`, and `CartLineAdd` takes no `uom`.

## The contract

- **This session builds on 2.10.0, as committed.** Backend main (`7ef2851`) is at 2.12.0.
  - Syncing it lands CR-038 (the till) and CR-045 (quotes). `landed.ts` and the quote fixtures then fail, and making them pass means changing till and quote code.
  - The order and delivery shapes are identical in both versions.
  - The till's session was told. It has taken the 2.12.0 sync on `claude/awesome-hamilton-se5jqq` (A-F11-09).
- **Every F11 operation is still planned (B11).** Nothing moved from the mock to the real API this session.

## Contract requests added

| Id     | What                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-053 | An order names its pick lists (`listFulfilments?orderId`) and the answer it waits for (`pendingConsent`).                                             |
| CR-054 | Picking eggs: breakage named on the pick; a short pick only with agreement (and what `recordPicks` does below `qtyToPick`); `SubstitutionCreate.uom`. |
| CR-055 | A part delivery: `contents[].orderLineId`, `ProofOfDeliveryCreate.lines` and the reason the rest came back.                                           |
| CR-056 | The B11 seed: the Driver (its run, the photograph upload, the reasons), the Storekeeper's picking, and a list of drivers for dispatch.                |
| CR-057 | A driver's cash handed in at a till shift (`shiftId`); `getMyRoute` with no run; a `DUPLICATE` answering the first result.                            |

## Decisions recorded

- **ADR 0055:** the driver's run is kept on the phone and sent through one queue.
- **A-F11-01 to A-F11-09:**
  - 01: the fake's B11 grants;
  - 02: the driver light;
  - 03: a photograph, not a signature;
  - 04: the order page's path;
  - 05: the pick list found among the open ones;
  - 06: a short pick offered as a substitution;
  - 07: cracked eggs as a stock adjustment;
  - 08: no part delivery yet;
  - 09: no 2.12.0 sync here.
- **`fakeRoles.test.ts`** names each B11 permission as not seeded. A new per-role list holds the grants the seed gives other roles but not this one; each line fails when the seed catches up.

## Gates, each run on its own

| Check                                                     | Exit | Count                                                                                                        |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`                                    | 0    |                                                                                                              |
| `typecheck` (every package)                               | 0    |                                                                                                              |
| `sync-contract:check`                                     | 0    | backend `5815c06`, 2.10.0 (unchanged)                                                                        |
| `test:unit`                                               | 0    | console 343, data 33, api-client 30, ui 900, storefront 39, i18n 6                                           |
| `test:integration`                                        | 0    | console 257 before the driver's file, then 3 more (`driver/offline/sync.integration.test.ts`); storefront 20 |
| `budget:console`                                          | 0    | till 243.4 of 250 kB; back office 284.9 of 300 kB. The driver's chunk (10.3 kB gzipped) loads on demand      |
| `test:e2e`, full run                                      | 0    | 325 of 325 in 7.6 minutes, first run; the F11 specs are 7 of them (the gate also passed 5 of 5 alone)        |
| `tokens:check`, `fonts:check`, `icons:check`, `test:a11y` | n/r  | not run: no token, font, icon or `packages/ui` change                                                        |

**Fixed while getting here:**

- **The driver's screens subscribed before the run existed.** The frame made the run in an effect, so `useSyncExternalStore` had subscribed to nothing, and the run stayed "Loading your run". It is now made before the first read.
- **The customer's recorded answer disappeared.** It went with the consent card when the order stopped waiting; it is now kept on the page.
- **"The customer agreed to A substitute".** The sentence has its own lower-case words.
- **The money tripwire** caught `toFixed` and `Math.round` on the phone's coordinates. They are now cut as text to the contract's six places (`driver/position.ts`, with tests).

## For the owner

1. **A real API needs B11 and its seed.** Until CR-056 is seeded, every F11 screen shows its permission-denied state to every role, the driver's included.
2. **The driver's cash is not reconciled anywhere yet.** The phone says it is handed in at a till shift. The hand-in is a till screen, for the till's session, once CR-057 gives the reconciliation a `shiftId`.
3. **F10i's order page does not link to the new picking and delivery page.** One link, left for that lane.
4. **A short pick is offered to the customer as a substitution of the same product in a smaller quantity.** The backend may prefer a consent of its own (CR-054).

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F11-orders-picking-and-delivery.md.
Read ADR 0055.

1. Rebase on main. If F10l's PR (the 2.12.0 sync) has merged, nothing in F11 should change: the order and
   delivery shapes are the same.
2. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md for B11.
   - As B11 moves operations into code, F11's screens call the same operations; check each description for
     refusals and behaviour, and give each new refusal code its words.
   - CR-053 landed: find the order's pick list by orderId, and send the consent kind the order names.
   - CR-054 landed: send breakage on the pick, and a short pick as the contract says.
   - CR-055 landed: the part delivery on the driver's stop.
   - CR-056 seeded: delete the fake's B11 lines in fakeRoles.test.ts as they fail.
   - CR-057 landed: the till's session builds the driver's hand-in at a shift.
   - CR-039 landed: single eggs in the shop.
3. F12, as BUILD_PROMPT says.
```
