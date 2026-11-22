# F10n: contract 2.17.0, the till PIN as it landed, payment reminders, and the quote link page under 170 kB

- **Session:** F10 continued, on branch `claude/fervent-ptolemy-scx0xd`, from `main` at `5242161` (F10m merged as PR #35).
- **Date:** 2026-11-19 to 2026-11-22.
- **Numbers taken:**
  - ADR 0057 and CR-058, the next free on `main` when committed.
  - Assumption A-F10-14. A-F10-12 was already taken: the code first cited it, and was renumbered before its commit.
- **Ran beside:** F12, in another session. Reports, exports and the investor portal were not touched.
- **Scope:** the F10m opening message, with the owner's four items on top:
  1. The quote link page's 170 kB covers the whole first load. Hold CI at 173,369 bytes, then cut below 170 kB and set the limit there.
  2. Payment reminders (dunning) belong in F10, with credit control.
  3. Link the wholesale order page to its picking and delivery page.
  4. After a margin approval, the salesperson issues and sends the quote and sees its link, once the contract carries it.
- **Screenshots:** none were taken, opened or committed (CLAUDE.md). Every screen is checked by its spec at 360 px, with no sideways scroll and axe.
- **Two parts were built by agents in their own worktrees and reviewed before they were taken in:** the storefront cut and the dunning screens.

## 1. The sync: 2.16.0 to 2.17.0 (backend `475378e`)

`pnpm sync-contract:github` brought 2.16.1 (a description) and 2.17.0, which is loud for a witnessed cash drop and for an offline price difference. `landed.ts` failed for CR-032 and CR-050, as ADR 0046 means it to. Upstream was still 2.17.0 on 2026-11-22.

| Request    | Landed           | What the console does now                                                                                                                                                                               |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CR-032** | yes, differently | The till PIN on the contract's rules (section 2, ADR 0057). `requested/tillPin.ts` and the switch are deleted.                                                                                          |
| **CR-050** | yes (part 1)     | `listShiftWitnesses` through `useApiQuery` on the shift screen. A witnessed drop sends `witnessPinVersion`. `requested/shiftWitnesses.ts` and the switch are deleted. `witness.ts`'s rule is unchanged. |
| **CR-051** | yes              | The till says "6 eggs", "1 crate" and "By the egg" from `OfflinePack.uoms`, on screen and on the 58 mm print (`pos/units.ts`).                                                                          |
| CR-033     | no               | Its switch stays. The builds, CI, `CLAUDE.md` and `DEPLOYMENT.md` now name `CR-033` only.                                                                                                               |
| CR-052     | no               | The till still says an animal is sold through quotes and orders.                                                                                                                                        |

**New words:** `TILL_PIN_INVALID`, and the rules `WITNESS_PIN_REQUIRED`, `WITNESS_PIN_UNKNOWN`, `WITNESS_PIN_SUPERSEDED`, `WITNESS_PIN_LOCKED`, `PIN_ITERATIONS_TOO_FEW` and `PIN_SALT_REUSED`.

**The seed:** `pos.pin.set` is new for the Cashier, the Manager and the Owner. The test fake matches it.

## 2. The till PIN as 2.17.0 carries it (ADR 0057)

CR-032 landed with three rules different from what was requested:

- **The person's own till sets the PIN.** `setTillPin` takes only the verifier the till derived. In the request, the server issued it.
- **Every try is reported**, right or wrong, with its purpose (`UNLOCK`, `APPROVAL`, `WITNESS`, `SIGN_OUT`). Five wrong tries against a PIN version lock it on every till, and a right try wipes nothing.
- **A lock ends only with a new PIN** (`NEW_PIN_SET`). A supervisor's sign-out is taken only for a cashier the server holds locked, and it does not end the lock.

**What the till does:**

- **Who may approve:** a verifier names a role. A supervisor approves offline mobile money, witnesses a drop and signs a locked cashier out. An operator's PIN only opens the till.
- **A locked PIN** comes with no salt or hash. The till keeps it as locked, not as weak, and it can neither open nor lock the till.
- **Every try is kept with its own id**, sent at once where the server can be reached, and sent first in each sync pass, so the server checks the sales' and drops' approvals against the tries. Batches follow the contract: at most 500 tries and 50 sign-outs.
- **A person's count** is the server's `wrongTries` plus this till's wrong tries it has not yet told the server.
- **The supervisor's sign-out** is offered on the lock screen only once the cashier's PIN is locked. It is sent after the tries that locked it, and the cashier's PIN stays locked.
- **"Set my till PIN"** (or "Change my till PIN") sits in the till's header, for holders of `pos.pin.set`, online, and never on a locked till. The PIN is typed twice. The till makes a fresh 16-byte salt and 600,000 PBKDF2 iterations, sends only the verifier, and reads the verifiers again, so the new PIN works at once. It loads on demand.
- **The approvals' PIN versions:** offline mobile money sends `approvedByPinVersion` and a witnessed drop sends `witnessPinVersion`.

**What stands from ADR 0047:** the hash floor, at most five tries, no timer, no plain sign-out on a locked till, and a supervisor never sells as the cashier.

**Not in the contract (A-F10-14):** the PIN's length (four to six digits) and the idle lock (120 seconds) are the till's constants.

**Not built:** `overrideApproval` on an offline sale line, a supervisor's PIN approving a price beyond the cashier's limit (2.17.0). The till still keeps an offline price inside the cashier's own limits.

## 3. The quote link page: 158,952 B whole, under its 170 kB

- **CI held it** at 173,369 bytes (F10m's ratchet) until the cut.
- **The cut:** the accept and decline confirmations move to `components/quote/QuoteConfirm.tsx`, loaded with `next/dynamic`. They are the Radix Dialog with its focus trap and layers, the Dialog wrapper and `Textarea`, about 12 kB. Loading starts on the first focus on the name or an answer button, or on the tap. A customer who only reads the quote no longer downloads them.
- **Unchanged:** the mutations, the idempotency keys, the refusal kept in words and the focus return.

| Route                       | Whole first load, before | After         | Limit                                 |
| --------------------------- | ------------------------ | ------------- | ------------------------------------- |
| `/q/[token]`                | 173,365 B                | **158,952 B** | **170 kB, enforced**; ratchet deleted |
| `/quote`                    | 165,426 B                | 165,403 B     | 170 kB, enforced                      |
| `/`, `/c/[slug]`, `/search` | 112,145 B                | 112,183 B     | 120 kB, enforced                      |

## 4. Payment reminders (dunning), with credit control

Built on `listDunningLevels`, `replaceDunningLevels` and `listDunningNotices` (2.16.0), in `wholesale/DunningScreens.tsx`, beside the ageing in the nav. All three need `whl.dunning.read`.

**`/dunning-policy`, "Reminder levels".**

- The levels, lowest first: level, days overdue, channels in order, template.
- **Holders of `whl.dunning.manage`** change the whole set at once. They can add and remove levels, set the days (1 to 365), set up to three channels (a channel chosen above is not offered below) and type the template code. Levels are numbered by position, so they are always 1, 2, 3.
- **An empty set** says before saving that no customer will be sent a reminder.
- **Saving** confirms every level in words, with a fresh idempotency key for each new body.
- **A refusal** (`DUNNING_POLICY_INVALID` with `LEVELS_NOT_CONSECUTIVE`, `DAYS_NOT_INCREASING` or `CHANNEL_REPEATED`) stays on the form in words, and marks the level the server named.
- **Others** read the levels with no edit control, and the screen says who can change them.

**`/dunning-notices`, "Reminders sent".**

- Newest first: customer (linked to the account), document (linked), level, days past due, what was outstanding then, channels, and when it was queued.
- Filters: a customer, and "queued on or after" a day in Accra time. Cursor paging.

**A wholesale account's page** has a "Payment reminders" section: that buyer's reminders, read-only.

**What the contract does not give:**

- **Templates:** no operation lists them, so the template code is typed.
- **Delivery:** `DunningNotice` says when a reminder was queued, not which channel delivered it or whether it arrived, so the list says "Queued".

No request was raised for these.

## 5. The order page links to its picking and delivery

- `/orders/:id` (F10i's page) links to `/orders/:id/fulfilment` (F11's): "Picking and delivery for this order".
- A-F11-04 says so now.

## 6. After a margin approval: CR-058

The contract still has the approver's approval issue the version (2.17.0, `issueQuoteVersion`), so nothing could be wired.

**CR-058** asks for this:

- approving `QUOTE_BELOW_MARGIN` records the approval and does not issue the version;
- the version says it is approved and waiting to be issued;
- `issueQuoteVersion` on it issues the version with the salesperson's channels and answers the link's token, with no second approval unless the prices or costs changed.

Until then the quote page still tells the salesperson to make a new link.

## Proved by

**e2e, at 360 px, axe-clean, no sideways scroll:**

- **`pos-pin-receipt.spec.ts`, 2 tests rewritten, 1 new:**
  - **Rewritten: three wrong PINs.** Each try reaches the server, which holds the PIN locked; a reload and ten minutes end nothing. The supervisor's sign-out is offered only then, and is sent with the supervisor's tries. The cashier's PIN stays locked.
  - **New: a locked PIN.** It cannot lock the till. "Change my till PIN" sends only the verifier (600,000 iterations, no PIN in the body) and refuses two different PINs in words. The old PIN is then wrong and the new one opens the till.
  - **Rewritten: offline mobile money.** It sends `approvedByPinVersion: 7`.
  - The witnessed drop sends `witnessPinVersion: 7`, here and in `pos-shift.spec.ts`.
- **`eggs-selling.spec.ts`:** "6 eggs" and "Eggs, big, by the egg", from the pack's names.
- **`quotes-credit.spec.ts`:** the order page's link to its fulfilment page opens it.
- **`dunning.spec.ts`, 6 tests, new:**
  - A Manager replaces the set, and the PUT body is checked.
  - A 422 stays on the form and marks the level. The fixed save goes with a new key.
  - The empty set is warned about and sends `{ levels: [] }`.
  - Sales reads with no edit and sends no PUT. A cashier is denied both routes in words.
  - The reminders list: paging and both filters, checked on the request.
  - The account's own reminders.
  - Light and dark, both densities.
- **`/q/[token]`:** `specs/storefront/quotes.spec.ts`, 11 of 11, on the 3G profile.
- **The e2e fake** answers the PIN operations in the contract's shapes (`e2e/support/tillPins.ts`). It gives the till no PINs unless a test installs them; Prism's example would otherwise give every till test a supervisor's PIN.

**Unit:**

- `pin.test.ts`: the locked PIN, the verifier the till makes (agreeing with Node's PBKDF2 byte for byte), the count across tills, purposes and roles.
- `till.pin.test.ts`: rewritten against a fake that counts per version, locks until a new PIN and takes a sign-out only once locked. 16 tests.
- `units.test.ts`.
- `switch.test.ts`: CR-032 and CR-050 are refused as switches.
- The api-client's and the data layer's sample requested operations are now fixtures no contract will carry. They were CR-032's and CR-050's, which the client rightly refused once they landed.

**Integration:**

- 652 operations in the mock (was 648).
- `wholesale/dunning.integration.test.tsx`: 9 tests against Prism.

## Moved from the mock to the real API

- The till's PIN verifiers, PIN tries and sign-outs, and setting one's own PIN (`listTillPinVerifiers`, `reportTillPinEvents`, `setTillPin`, 2.17.0).
- Who may witness a drop now (`listShiftWitnesses`, 2.17.0).
- The pack's unit names (`OfflinePack.uoms`, 2.17.0).
- Payment reminders (`listDunningLevels`, `replaceDunningLevels`, `listDunningNotices`, 2.16.0): first screens.

## Contract requests added or changed

- **CR-032, CR-050 and CR-051** answered in 2.17.0 and built. CR-032 landed differently from the request, as recorded under it.
- **CR-058 raised:** after a margin approval, the salesperson issues the quote and gets its link.

## Decisions recorded

- **ADR 0057:** the till PIN as 2.17.0 carries it. It builds on ADR 0047, which stands.
- **A-F10-14:** the PIN's length and the idle lock are the till's constants.
- **A-F11-04 amended:** `/orders/:id` now links to its fulfilment page.
- **`.gitignore`:** `.claude/worktrees/`, where the agents' worktrees live during a session.

## Gates, each run on its own

| Check                                        | Exit | Count                                                                                                                                                                                    |
| -------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`                               | 0    |                                                                                                                                                                                          |
| `lint`                                       | 0    |                                                                                                                                                                                          |
| `typecheck` (every package)                  | 0    |                                                                                                                                                                                          |
| `sync-contract:check`                        | 0    | backend `475378e`, 2.17.0                                                                                                                                                                |
| `tokens:check`, `fonts:check`, `icons:check` | 0    |                                                                                                                                                                                          |
| `test:unit`                                  | 0    | console 348 (F10m 339), ui 901, storefront 42, data 33, api-client 30, i18n 6. The first run failed 1 in api-client: the sample requested operation had landed. Fixed in its own commit. |
| `test:integration`                           | 0    | console 269, storefront 20. The first run failed the mock's operation count (648, now 652). Fixed in its own commit.                                                                     |
| `budget:console`                             | 0    | till 244.4 of 250 kB (F10m 243.5: the PIN's new rules and units); back office 286.4 of 300 kB (F10m 285.9: the reminders' routes)                                                        |
| `budget:storefront`                          | 0    | `/q/[token]` 159.0 of 170 kB, enforced; `/quote` 165.4 of 170 kB; listing pages 112.2 of 120 kB                                                                                          |
| `test:e2e`, full run                         | …    | running; the count follows in its own commit                                                                                                                                             |
| `test:a11y`                                  | …    | after the e2e run; the count follows in its own commit                                                                                                                                   |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                                                                                                        |

**The first till e2e runs:**

- **The first run, 29 of 36 failed.** It overlapped the dunning agent's builds and tests on the same machine and ports. Run alone, the first test that failed passed.
- **The second run, 31 passed and 5 failed, for three reasons:**
  - The new words used a straight apostrophe where the house words use ’.
  - An old pattern expected "…locks Kwabena Owusu out".
  - Tests with no PINs installed got Prism's example verifiers, now that the operation is real.
- **After the fixes, 53 of 53** (the till, eggs, offline, shift and quote specs).

## For the owner

1. **A locked till PIN now stays locked until its owner sets a new one, on every till.** This is the contract's rule (2.17.0). Before, a supervisor's sign-out ended a lockout; now it only signs the cashier out. The cashier then signs in online with their password and uses "Set my till PIN". At a till with no network, a locked-out cashier waits for the network.
2. **Every PIN try now reaches the server, right ones included.** Each carries who, which PIN version, the outcome and what it was for, never the PIN. The fifth wrong one is raised on the daily exception report (the backend's rule).
3. **The PIN's length (four to six digits) and the two-minute idle lock** are the till's own settings now: the contract carries neither (A-F10-14). Say if either should change.
4. **Not built yet:** a supervisor's PIN approving a price beyond the cashier's limit at an offline till (2.17.0 offers it). Say if you want it next.
5. **Payment reminders:** the levels are typed with their template code, because nothing lists the message templates. The list says "Queued", not "Delivered": the contract does not say which channel delivered a reminder. Say if either matters enough to ask the backend.
6. **After a margin approval:** CR-058 sets out what the quote page needs. Nothing changes on screen until the contract carries it.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10n-contract-2-17-0-till-pin-dunning-quote-link-under-170.md.
Read ADR 0046, 0047 and 0057. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.17.0.
   - CR-058 landed (a margin approval leaves the version for the salesperson): offer "Issue and send" on an
     approved version and show the link once, as any issue does; drop the "make a new link" words after approval.
   - CR-033 landed: delete requested/digitalReceipt.ts and its id (the last switch).
   - CR-052 landed: price an animal from its own band, delete soldThroughQuotes and its words, and delete
     goatPricedPerHead in e2e/support/till.ts.
2. The owner's answers to this report's "For the owner", if any: the supervisor's PIN for a price beyond the
   cashier's limit (OfflineSaleLine.overrideApproval, 2.17.0); the PIN length and idle lock; templates and
   delivery for payment reminders.
```
