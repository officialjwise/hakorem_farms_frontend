# F10k: contract 2.10.0 synced, and a cash drop's witness is a supervisor's PIN

- **Session:** F10 continued, on branch `claude/amazing-brahmagupta-p6d1dt`, from `main` at `37e5c98` (F10j merged as PR #29).
- **Date:** 2026-11-18
- **Scope**, in the owner's order:
  1. the naming collision: the till's shift session and the quotes session (PR #28, still open) were both F10i, and both raised a CR-045;
  2. the opening message of the till's shift report: the sync, and what landed;
  3. the drop witness, as the owner decided it.
- **Not touched:** customer, quote and credit screens (PR #28).

## 1. The collision (PR #30, merged)

- **The till's shift session is F10j**: `docs/sessions/F10j-the-tills-shift-on-2-5-0.md`, `docs/screenshots/F10j/`, ADR 0038's amendment, the budget note and A-F10-01.
- **Its contract request is CR-050**. PR #28 takes CR-045 to CR-049, so CR-046, the next number free on main alone, would have collided again. The entry says it was raised as CR-045, so a backend note that uses the old number still leads to it.
- **The commits and PR #29 keep the old names.**
- **When PR #28 is rebased**, its CR-045 to CR-049 entries and table rows go before CR-050, and its screenshots keep `docs/screenshots/F10i/`.

## 2. The sync: 2.5.0 to 2.10.0 (backend `5815c06`)

Five minor versions. Two are LOUD:

- **2.6.0** changes PAY's till cash;
- **2.9.0** makes CR-043 a breaking behaviour, approved by the owner.

### What landed, and what the console does now

| Change                                                                 | Where                                                                                                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CR-042** `getSupplierBalance` (2.9.0)                                | The switch is deleted (`requested/supplierBalance.ts`, its id in the builds, CI, CLAUDE.md, DEPLOYMENT.md). The supplier's account calls `useApiQuery`.                    |
| **CR-043** the invoice's maker never approves it (2.9.0)               | The person who entered an invoice is not offered "Approve for payment", and the screen says someone else approves it.                                                      |
| **CR-044** what the variances are in (2.9.0)                           | "30 eggs more than is left to invoice" (base unit, read from the product). "GH₵0.50 per crate over the order's price; GH₵10.50 over on this line".                         |
| **CR-040** a receipt line's value against an order is optional (2.9.0) | The receipt screen no longer asks for the cost on a line from an order. The hint says the server values it at the order's price.                                           |
| **The eggs' unit** is `EGG`; units carry `singularName`, `pluralName`  | Every quantity says "540 eggs", "1 crate", "from 10 crates". "Per" takes the singular, and "in crates" the plural. Columns keep the title.                                 |
| **The seed** (2.6.0, 2.9.0)                                            | The Manager approves supplier invoices; the device, force-close and statement grants are seeded. `fakeRoles.test.ts`'s tripwires failed as written: deleted, fake matched. |
| **2.6.0** `initiateMobileMoneyCharge` takes `shiftId`                  | The till names its shift once the server holds it, so mobile money shows on the X and Z reports. A new e2e test checks the request.                                        |
| **2.6.0** `enrolDevice` needs a fresh step-up                          | The till setup asks for the authenticator code and repeats the write with the same key. The fake's step-up list gains `enrolDevice`, `revokeDevice` and `forceCloseShift`. |
| **2.6.0** `CashMovement.unwitnessed`, the reports' unwitnessed drops   | The X and Z reports show "1 drop unwitnessed" with its amount.                                                                                                             |
| **2.7.0** statements in code                                           | A balance in the customer's favour, other charges and credits, and the new line kinds are shown.                                                                           |
| **New refusal codes** (2.6.0 to 2.10.0)                                | 18 codes are named only in descriptions, so the coverage test missed them. It now reads "422 \`CODE\`" too, and each has words, with its rules' words.                     |

### Still planned, so the till's queue is unchanged

`getOfflinePack` and `syncOfflineSales` are still planned, so A-F10-07 stands.

- **`completeCounterSale` (2.6.0) and the held sales (2.10.0) are in code.** The held sales screen already calls them in the planned shapes.
- **The till still sends its sales in the offline batch.** Moving the online sale to `completeCounterSale` is a till change of its own. Nothing in this session's scope asked for it.

## 3. The drop witness (owner, 2026-11-18)

**The rule.** A witness is the supervisor who takes the cash, entering their PIN on the till. The till checks it on the device with the till PIN's rules: the hash floor, at most five tries, no timer. Naming a supervisor without their PIN is not a witness, so the supervisor picker is gone. The till never sends a `witnessId` it did not prove that way.

| What the till knows                               | What it asks for                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online with CR-050's read, a supervisor signed in | The PIN, required. The hint names who is signed in.                                                                                                                 |
| The same, and the till holds no supervisor's PIN  | Nothing is recorded. "This drop needs a supervisor's PIN", with why.                                                                                                |
| Online with the read, nobody signed in            | No PIN. "This drop is recorded unwitnessed": 2.6.0 takes it.                                                                                                        |
| Offline, or a build without the read              | A PIN if a supervisor is there. Without one, the drop is sent unwitnessed, and the confirmation says the server refuses it if a supervisor is signed in (A-F10-10). |

- **The cashier's own PIN never witnesses their drop**, even if they hold the approval.
- **The rule is `pos/shift/witness.ts`**, a pure function with its own tests; the form only renders it.
- **CR-050** keeps part 1 (who is signed in) open, now with the owner's rule written in. It says the till uses the answer only to know whether a witness is needed, so a bare yes or no would do. Part 2 (the unwitnessed drop) landed in 2.6.0.

## Proved by

**`e2e/specs/console/pos-shift.spec.ts`**, 360 px, axe-clean:

1. With a supervisor signed in, the PIN is asked for: there is no list to choose from, Record refuses without the PIN, and a wrong PIN is no witness. The right PIN sends `witnessId`, and the list shows "Witnessed by Kwabena Owusu".
2. With a supervisor signed in and no supervisor's PIN on the till, nothing is recorded, and a pay-in still is.
3. With nobody signed in, no PIN is asked even though the till holds one, and the drop is unwitnessed in words, in the confirmation and on the list.
4. Online mobile money names the till's shift (2.6.0).

**Changed:** the refused drop is now an unwitnessed one. `supplier-invoices.spec.ts`, the egg specs and the screenshots read eggs and crates, and CR-044's variances.

**Unit:**

- `witness.test.ts`, 7 tests;
- `lines.test.ts`, 1 new (CR-040);
- `entryWords.test.ts`, 1 new (a break of one in the singular);
- `refusals.test.ts`, which now covers the description codes;
- the payables integration test reads the server's balance.

**Screenshots:** `docs/screenshots/F10k/`, at 360 and 1280 px:

- the PIN asked for;
- the drop it witnessed;
- no PIN on the till;
- unwitnessed, also in dark theme and compact density;
- the refused drop.

F10j keeps its sign-off shot. Its old drop shots stay as the record of F10j.

## Moved from the mock to the real API

- **The supplier's account balance** (`getSupplierBalance`), from a requested switch to the generated client.
- **The statement screens**, whose operations are in code from 2.7.0.
- **The held sales, and device enrolment and revocation**, in code from 2.6.0 and 2.10.0.

## Contract requests added or changed

- **CR-050** (was CR-045): renumbered; part 2 answered by 2.6.0; part 1 open, now with the owner's PIN rule.
- **CR-040, CR-042, CR-043 and CR-044:** answered by 2.9.0, built. The table gains their rows.

## Decisions recorded

- A-F10-06 is resolved: its price half was wrong.
- A-F10-10: what the till does when it cannot see who is signed in.
- A-F10-01: CR-042 is off the build list.

## Gates, each run on its own

_Pending: the full e2e run, integration, the budget and the screenshots are running; this table is filled in when they finish._

## For the owner

1. **A deployed till cannot take a witness yet.** A witness is a PIN on the till, and the till's PINs are CR-032, still requested. A production build sends every drop unwitnessed. The server takes it while nobody is signed in at the branch and refuses it in words otherwise. CR-032 landing fixes this.
2. **The server cannot tell that a witness came from a PIN.** It takes any supervisor's `witnessId`. The till reports each PIN check through CR-032's `reportTillPinEvents`. CR-050 asks the backend whether the server should hold a drop to that report.
3. **The contract names 18 refusal codes only in descriptions.** They are missing from the operations' `x-error-codes`. The console now finds them there too, but the backend may want to list them.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10k-contract-2-10-0-and-the-pin-witness.md.
Read ADR 0038, 0046 and 0052.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.10.0.
   - CR-050's read landed (landed.ts fails): delete requested/shiftWitnesses.ts and its id (switch.ts,
     package.json, ci.yml, CLAUDE.md, DEPLOYMENT.md, A-F10-01), call useApiQuery for it in
     CashMovementForm, and keep witness.ts's rule.
   - CR-032 landed: delete requested/tillPin.ts and its id; a deployed till can then take a PIN witness.
   - syncOfflineSales or getOfflinePack moved into code: take the till's queue to the real API and
     settle A-F10-07.
   - CR-033, CR-038 or CR-041 landed: as the F10f and F10g opening messages say.
2. The online sale on completeCounterSale (2.6.0), if the owner wants it before the offline sync lands.
3. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
```
