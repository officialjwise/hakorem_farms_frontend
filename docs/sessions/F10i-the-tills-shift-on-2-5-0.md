# F10i: the till's shift on contract 2.5.0, and its words on demand

- **Session:** F10 continued, on branch `claude/affectionate-babbage-wimd9c`, from `main` at `678f8c9` (F10h merged as PR #27).
- **Date:** 2026-11-18
- **Scope**, in the owner's order:
  1. the sync: the eggs' unit rename and the waiting requests;
  2. the till's refusal words loaded on demand;
  3. the till's shift screens on 2.5.0: open with a float, cash in and out, cash drops, the X and Z reports, the blind close, and the supervisor's sign-off.
- **Not touched:** customer, quote and credit screens (another session is on F10 quotes and wholesale).

## The till's first load

| When                                       | Till, initial script | Back office, initial script |
| ------------------------------------------ | -------------------- | --------------------------- |
| Before (main at `678f8c9`)                 | **247.1 of 250 kB**  | 279.8 of 300 kB             |
| After the refusal and shift words moved    | 241.8 kB             | 281.0 kB                    |
| After the shift screens on 2.5.0 (the end) | **242.1 of 250 kB**  | 281.1 of 300 kB             |

Each was measured with `pnpm budget:console` after a build with CI's switches (`HK_API_BASE_URL=/mock`, `HK_REQUESTED_CONTRACT` as CI sets it).

- **5.3 kB came out of the till's first load.** Two namespaces now load on demand:
  - `refusals`: 12 kB of sentences, moved out of `common`;
  - `posShift`: the shift screens' words, moved out of `pos`.
- **The till fetches both after the sale screen is up**, beside its other screens (`TILL_NAMESPACES` in `pos/routes.tsx`).
- **A refusal that arrives sooner waits for its words** (`inWordsWhenLoaded`). If they cannot be fetched, the server's sentence is said instead, which the contract says is safe to show.
- **The back office loads `refusals` at boot**, so its first load grew 1.2 kB.
- **The shift screens and their words are on demand, never in the first load.** The 0.3 kB added at the end is the queue's own code, which must load with the till: a fresh cash movement sent alone, and a refused open let go.
- ADR 0038 is amended for the place of the words only.

## The sync: nothing landed

`pnpm sync-contract:github` brought backend `17df00d`. The contract's body and digest are 2.5.0's; only the source line changed. Nothing is in the changelog after 2.5.0.

- **The eggs' unit is still `UNIT`, and units have no plural names.** The screens still say "540 Unit".
- **CR-032, CR-033, CR-038 and CR-042 did not land.** `landed.ts` still compiles, so every switch stays.
- **CR-043 and CR-044 are unanswered.**
- **Supplier credit notes:** the seed still gives `pur.supplier_invoice.approve` to the Owner and the Accountant only. The Manager's approval has not landed, so the test roles are unchanged. A new tripwire in `fakeRoles.test.ts` fails the day the seed gives it to the Manager: then give the fake Manager the grant (`fakeAuthServer.ts`), check the payables e2e's approver, and delete the tripwire.

## The refusal words F10g dropped are back

- **The 20 payables rules**, each said only by the payables operations: `CLAIM_INVOICED`, `CLAIM_NOT_INVOICED`, `ORIGINAL_SETTLED`, `NO_MISMATCH`, `PAYMENT_ALLOCATED` and 15 more.
- **New:** words for the 2.5.0 shift codes (`SHIFT_INVALID`, `SHIFT_NOT_OPEN`, `SHIFT_ALREADY_OPEN`, `SHIFT_CLOSE_SAME_PERSON`, `CASH_MOVEMENT_INVALID`, `REGISTER_INVALID`) and their rules (`WITNESS_REQUIRED`, `TILL_OVERDRAWN`, `OCCURRED_AT_OUT_OF_WINDOW`, `CASHIER_HAS_OPEN_SHIFT` and the rest).

## The till's shift on 2.5.0

F9 built the shift screens against the planned shapes and sent every cash movement in `syncOfflineSales`, which 2.5.0 still lists as planned. In 2.5.0, `openShift` and `recordCashMovement` are in code, and each needs a time within 300 seconds of the server's clock.

### Opening a shift

- The shift is made on the till and sent at once (`openShift`).
- **If the server refuses it**, for example because the cashier or the till already has a shift that is not closed:
  - the till lets the shift go, since nothing was sold on it;
  - the refusal stays on the open screen in words, with its reference;
  - the refused record stays on the queue for a manager (A-F10-09).
- **Offline it still opens on the till.** The screen now says that a shift reaching the server more than five minutes late waits for the server's offline sync.

### Cash drops, pay-outs and pay-ins

- **Every kind takes a reason that fits it**, read from `CashMovementCreate.reasonCode`'s description (A-F10-08):
  - a drop is `SAFE_DROP`, chosen for the cashier;
  - a pay-out is fuel, a supplier or another expense, with the note that reason needs;
  - a pay-in is `FLOAT_TOP_UP`.
- **Sent alone with `recordCashMovement`**, keyed by its own id, while younger than four minutes. An older one, made offline, waits for the offline batch (A-F10-07).
- **What the server said stays on screen until the next movement:** recorded, recorded unwitnessed, kept on the till, or refused in words with its reference.
- **"Cash moved on this shift"** lists the server's record (`listShiftCashMovements`): the float, then each drop, pay-out and pay-in, with who recorded it and its reason in words.

### The witness, as the owner decided

| The till is…                    | The witness                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Online, a supervisor signed in  | The cashier must choose one of the supervisors signed in at the branch (CR-045)     |
| Online, no supervisor signed in | None. "This drop is recorded unwitnessed": the drop goes ahead, marked unwitnessed  |
| Offline, a supervisor's PIN     | The supervisor enters their PIN on the till (CR-032)                                |
| Offline, no PIN                 | None, and the screen says so                                                        |
| Built with CR-045 off           | A PIN if the till holds one; otherwise none, with words saying the till cannot see  |

An unwitnessed drop says so in four places:

- a warning before it is recorded;
- "Unwitnessed" in the confirmation;
- "recorded, unwitnessed" afterwards;
- an "Unwitnessed" badge on the cash moved list.

**The contract does not allow this yet.** 2.5.0 refuses a drop without a witness (`WITNESS_REQUIRED`), and no operation tells the till who is signed in. A cashier can read neither the users nor the sessions. The backend recorded the owner's decision as A-273 (d), "built in B09b continued". So:

- **CR-045** asks for `listShiftWitnesses` and for a drop with no witness when nobody is signed in.
- It is built behind its switch (ADR 0046) and on in the e2e and CI builds.
- With the switch off, against 2.5.0, an unwitnessed drop is refused, and the refusal stays on screen in words.

### The X report, the blind close and the sign-off

- **The X report** says that it never shows the cash the till expects.
- **The close is blind:**
  - the cashier declares a count for each tender before any expected figure is shown;
  - the API's answer shows what was expected and the over or short;
  - the cashier has no sign-off button.
- **The sign-off:**
  - a supervisor who is not the cashier signs it off with a note;
  - `approveShiftClose` asks for a fresh step-up, and the authenticator dialog asks for the code and repeats the same write with the same key.
- **Then the shift shows as closed**, with who signed it off, the count and the stored Z report, while the till is already free.
  - Before, freeing the till hid the Z report at once.
- **A refused close or sign-off stays on the page** after its dialog closes.

## Proved by

**`e2e/specs/console/pos-shift.spec.ts`**, 6 tests at 360 px, axe-clean:

1. A drop names a signed-in supervisor. The request carries `SAFE_DROP`, the witness and the client id as the idempotency key. The list then shows "Witnessed by Kwabena Owusu".
2. No supervisor signed in: the drop is unwitnessed, in words, in the confirmation and on the list, and the request carries no `witnessId`.
3. A pay-out offers only the expense reasons, then asks for the fuel reason's note.
4. A refused drop stays on screen in the console's words, with its reference.
5. A refused open stays on the open screen in words.
6. The whole close: the blind count, "Short by GH₵120.00", the cashier signs out, the manager signs in, a note, the step-up, then "Signed off by Kwabena Owusu" and the Z report.

**Changed:**

- `pos-till.spec.ts`: a drop made offline is kept, sent alone on reconnecting, and is unwitnessed, and the close waits for it.
- `pos-pin-receipt.spec.ts`: the PIN witness is the offline case, sent alone on reconnecting.

**Unit:**

- `sync.test.ts`, 4 new tests:
  - a fresh movement goes alone, keyed, never in the batch;
  - an older one waits for the batch;
  - a refusal stays with its words and is never sent again;
  - a refused open is let go.
- `reasons.test.ts`, 3 tests.
- `fakeRoles.test.ts`, 1 new: the tripwire for the Manager's approval of supplier credit notes.
- `refusals.test.ts`, 3 new tests: a refusal waits for its words, keeps the server's sentence if they cannot load, and the till's first load has neither namespace.

**Screenshots:** `docs/screenshots/F10i/`, at 360 and 1280 px:

- the drop with a signed-in supervisor;
- the drop recorded with its witness;
- the unwitnessed drop, also in dark theme and compact density;
- the refused drop;
- the signed-off shift with its Z report.

`F10/cash-drop-witness` is retaken offline, where the PIN witness now applies.

## Moved from the mock to the real API

**None.** No B9b part is deployed. `openShift`, `recordCashMovement`, `listShiftCashMovements`, `getShift`, the X and Z reports, `closeShift` and `approveShiftClose` are the operations 2.5.0 implements, so the shift screens call real operations now. The rest of the till still waits on planned ones (`getOfflinePack`, `syncOfflineSales`).

## Contract requests added or changed

- **CR-045:** who can witness a cash drop now (`listShiftWitnesses`), and a drop with no witness when nobody is signed in. Built behind its switch, on in the e2e and CI builds.

## Decisions recorded

- ADR 0038 amended, for the place of the words only: they are the `refusals` namespace, loaded on demand in the till.
- A-F10-07, A-F10-08 and A-F10-09 in `docs/ASSUMPTIONS.md`. A-F10-01 names CR-045.

## Gates, each run on its own

| Check                                                     | Exit | Count                                                                                          |
| --------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `format:check`, `lint`                                    | 0    |                                                                                                |
| `typecheck` (every package)                               | 0    |                                                                                                |
| `sync-contract:check`                                     | 0    |                                                                                                |
| `test:unit`                                               | 0    | console 298 (was 287), data 31, api-client 30, ui 900, storefront 34, i18n 6, lint-tokens 41   |
| `test:integration`                                        | 0    | console 249, storefront 15                                                                     |
| `budget:console`                                          | 0    | till 242.1 of 250 kB (was 247.1); back office 281.1 of 300 kB (was 279.8)                      |
| `test:e2e`, full run                                      | E2E_EXIT | E2E_COUNT                                                                                  |
| `screenshots` (F10i, and F10 `cash-drop-witness`)         | 0    | 14 of 14                                                                                       |
| `tokens:check`, `fonts:check`, `icons:check`, `test:a11y` | n/r  | not run: no token, font, icon or `packages/ui` change                                          |

## For the owner

1. **An unwitnessed drop is refused by the server today.** Your rule is built and shown, but 2.5.0 still asks every drop for a witness. The backend has your decision as "built in B09b continued", so CR-045 asks for it and for a way to see who is signed in. Until then, a deployed till names a witness only by a supervisor's PIN.
2. **A drop names the supervisor; it does not prove they were there.** That is the backend's reading too: "the witness is named, not signed in", and the drop is checked against the safe when the count is signed off. Say if the supervisor must confirm on their own phone or by PIN instead.
3. **A cash movement made offline and sent more than five minutes later** waits on the till until the server takes offline movements (B09b continued 2).

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10i-the-tills-shift-on-2-5-0.md.
Read ADR 0038, 0046 and 0052.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.5.0.
   - CR-045 landed (landed.ts fails): delete requested/shiftWitnesses.ts and its id (switch.ts, package.json,
     ci.yml, CLAUDE.md, DEPLOYMENT.md, ASSUMPTIONS A-F10-01) and call useApiQuery('listShiftWitnesses').
   - The unwitnessed drop landed without the read: the switch stays; note it in CR-045.
   - syncOfflineSales or getOfflinePack moved into code: take the till's queue to the real API, and
     settle A-F10-07 (a movement older than four minutes goes in the batch).
   - The Manager approves supplier credit notes in the seed: fakeRoles.test.ts's tripwire fails; give
     the fake Manager the grant, check the payables e2e's approver, and delete the tripwire.
   - The eggs' unit, CR-032, CR-033, CR-038, CR-042, CR-043, CR-044: as F10g's opening message says.
2. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
```
