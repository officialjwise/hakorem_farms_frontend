# F10q: contract 2.52.0, 10 kB free on the till, the card page after a reload, a part written off, and the exception review

- **Session:** F10 continued, on branch `claude/elegant-johnson-4h5b3w`, from `main` at `953fbc8` (F10p, PR #40).
- **Date:** 2026-11-25.
- **Numbers taken from `main` just before committing:** ADR 0059 and 0060, CR-066, assumptions A-F10-29 and A-F10-30.
- **Scope:** the owner's four answers to F10p:
  1. Keep the till's 250 kB budget. Before the next sale-screen feature, free at least 10 kB by moving rarely used pieces out, or report the options.
  2. Keep the card request's key in session storage for that one checkout.
  3. Build the partial bad-debt write-off once the contract carries it.
  4. Send `receiptToken` with sales made online too (2.51.0).
- **Brought in by the sync:** CR-059 (the exception review) and CR-064 (the store's view of a consent), both landed.
- **Not touched:** the reports and the other exception work, apart from what the sync forced. The reconciliation breaks wait as before.
- **Screenshots:** none were taken, opened or committed (CLAUDE.md). Every screen is checked by its spec at 360 px, with no sideways scroll and axe.

## 1. The sync: 2.47.0 to 2.52.0 (backend `840a578`)

Item 4 needs 2.51.0, so this session syncs at `main` and takes 2.48.0's CR-059 with it, as `landed.ts` requires (ADR 0046).

| Version | What                                                                               | What the console does now                                                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.48.0  | **CR-059**: `reviewException`, `ExceptionItem.review`, `sourceKind`, 44 new kinds  | The report marks an item reviewed through the generated client. `requested/exceptionReview.ts` is deleted, and so is the last switch: no build sets `HK_REQUESTED_CONTRACT` any more. Every new kind has words. |
| 2.49.0  | The report grants seeded; a setting for `CHECKOUT_HOLDING`                         | `fakeRoles.test.ts` no longer lists the report permissions as unseeded. The setting is not built.                                                                                                               |
| 2.50.0  | `QuoteVersion.approvedBy`                                                          | Not shown yet.                                                                                                                                                                                                  |
| 2.51.0  | `CounterSale.receiptToken`, the SMS for live sales                                 | Nothing to change (section 5).                                                                                                                                                                                  |
| 2.52.0  | `DailyExceptionReport.countLines`; **CR-064** `OrderFulfilmentView.pendingConsent` | The report shows the counted controls (the till sales with no receipt link) in a table of their own. The Storekeeper sees what the customer was asked.                                                          |

**Breakage fixed in the sync's commit:**

- Words for `ALREADY_REVIEWED` and `REVIEWER_IS_ACTOR`.
- A company-wide item (`branchId` null) says so.
- The mock's 669 operations.
- The e2e spec answers `reviewException` as a contract operation.

**Also:** an item that names the reader says that someone else reviews it, instead of offering a button the server refuses (A-F10-30).

## 2. The till's first load: 247.0 to 239.3 kB, 10.7 kB free (owner item 1)

**The audit.** I read the till's first load from the build's source maps. It is 36 chunks:

- `react-dom` about 62 kB gzipped, `react-router` 28 kB, `i18next` 13 kB, `@tanstack/query-core` 10 kB, `tailwind-merge` 8.5 kB;
- the generated operation table, 12 kB, the largest piece of the project's own code;
- Radix Select with floating-ui, about 10 kB;
- the till's own code, and 14 kB of words.

**What stays, and why.** Radix Select is not rarely used: every weighed line uses it (the weight's source), and so do a price's reason, the mobile money network and the supervisor's PIN. The sale screen's dialogs must work with the network off. Neither is moved.

**Three changes, none of which changes what the till does:**

| Change                                                                                                                                 | Till         | Back office  | Investor portal |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------ | --------------- |
| Before (F10p's build on 2.52.0)                                                                                                        | 247.0 kB     | 288.8 kB     | 213.6 kB        |
| The operation table travels packed; its permissions are in a table only the tests read (ADR 0059)                                      | −4.3 kB      | −4.3 kB      | −4.4 kB         |
| The words only the till's on-demand screens and parts read move to `posScreens`, fetched with those screens, as `posShift` was in F10j | −2.4 kB      | +0.1 kB      | 0               |
| The back office's navigation words move from `shell` to `nav`, which only the back office loads at boot                                | −1.0 kB      | +1.2 kB      | −0.9 kB         |
| **After**                                                                                                                              | **239.3 kB** | **285.8 kB** | **208.3 kB**    |

- **The packed table** is typed by an interface the bundler drops. It travels as one line per operation, for example `syncOfflineSales p /pos/sync 001 r j`, unpacked when the module loads. `manifest.test.ts` proves the round trip.
- **Not done:** loading the table on demand. Every document calls the API within a second of starting, so that would move the number without cutting the payload.
- **The shop gains too:** `/quote` 165.8 to 161.7 kB, `/q/[token]` 159.4 to 155.2 kB, `/checkout` 207.1 to 203.5 kB. The listing pages are unchanged.
- **Guarded:** `apps/console/src/app/entries.test.ts` fails if the moved words come back into the till's first load.

## 3. The card page after a reload (owner item 2, ADR 0060)

- **What is kept:** one entry in the tab's session storage, `hk_card_request`: the checkout's id, the exact body, the key, and whether the 503 arrived. Never local storage, never an address.
- **When it is written:** just before a card `placeOrder` is sent, so a reload while it is on its way replays the same request. It is marked when the 503 arrives.
- **When it is cleared:**
  - the card page is handed over (any 2xx);
  - the request is refused with nothing placed;
  - the checkout reads expired, cancelled or completed;
  - the checkout's `reservedUntil`, as the server reads it now, has passed;
  - another checkout is open in the tab.
    The tab closing ends it too.
- **After a reload:** the page says again that the order is placed but its card page did not open, the details stay locked, and its button replays the same body with the same key.
- **"The key alone must open nothing":**
  - The key only ever travels as `placeOrder`'s `Idempotency-Key` on that checkout, with the guest cookie that proves the checkout is this browser's. The contract already says any other checkout is 404.
  - It does not say the cookie is checked before a stored answer is replayed. **CR-066** asks the backend to state, and keep, that a replay without the checkout's cookie is 404 whatever the key, and that a key is bound to its checkout.

## 4. Part of a bad debt written off (owner item 3)

The contract has carried a part since 2.18.0 (`amountPesewas`, with `NOT_POSITIVE` and `MORE_THAN_OUTSTANDING`). F10p had only offered the whole amount (A-F10-26, now resolved).

1. **How much:** starts at all of what is owed. It takes at most that and more than nothing; anything else is refused in words before sending. One button puts back the whole amount.
2. **The confirmation:**
   - the document, what is still owed, and the exact amount to write off;
   - whether that is all of what is owed or part of it, in words;
   - that a second person, the Owner, decides, and that it cannot be you;
   - the reason.
3. **The 202** stays on screen with the amount asked for, as before.

Nothing is computed: the amount is compared with the API's `outstandingPesewas`, never subtracted from it.

## 5. The receipt token on sales made online (owner item 4)

**Nothing to change.**

- The till makes every sale through its queue, online or not (ADR 0043). A sale made with the network on reaches the server through `syncOfflineSales` within a request, carrying `OfflineSale.receiptToken`.
- The till never calls `completeCounterSale`, so the backend's `NO_LINK` count should stay at zero for this till (A-F10-29).
- `pos-pin-receipt.spec.ts` now says so. It checks that a sale made with the network on sends its token and phone, and fails if any sale goes as `completeCounterSale`.
- A sale still sends no token when the shop's receipt address is not set (`receiptLinkTemplate` null), as the contract says. That is the farm's setting, not the till's.

## 6. The Storekeeper sees what was asked (CR-064, 2.52.0)

The pick screen words a short pick from the store's view as it does from the whole order: "The order waits for the customer to agree to 11 crates of …". There is no money in it.

## Proved by

**e2e, 403 of 403** in 9.8 minutes, none flaky, at 360 px, axe-clean, no sideways scroll (F10p: 400). New and changed:

- `checkout-card.spec.ts`: a reload during the 503. The entry is checked in session storage only, the page says the same after the reload, the replay sends the same key and body, and the entry is gone after.
- `wholesale-standing-orders.spec.ts`:
  - the whole amount through the amount step;
  - a part: over and nothing refused in words, then GH₵500.00 sent and confirmed as part, with the second person;
  - a refusal through the amount step.
- `exceptions.spec.ts`: the review through the real operation; an item that names the reader.
- `fulfilment.spec.ts`: the Storekeeper reads the short pick's words.
- `pos-pin-receipt.spec.ts`: the online sale's token, and no `completeCounterSale`.

**Unit:**

- New: `manifest.test.ts`, `cardRequest.test.ts`, `entries.test.ts`.
- Changed:
  - `switch.test.ts`: every landed request refused, CR-059 the last;
  - `fakeRoles.test.ts` and `routes.test.ts`: they read `operationPermissions`.

**Integration:** the exception report reads the example's review and count line, and offers "Mark reviewed" on every other item.

## Moved from the mock to the real API

- Marking an exception reviewed (`reviewException`) and its review on each item (`ExceptionItem.review`), 2.48.0, CR-059. The CR-059 switch is gone from every build.
- The report's count lines (`DailyExceptionReport.countLines`, 2.52.0).
- What the customer is asked, in the store's view (`OrderFulfilmentView.pendingConsent`, 2.52.0, CR-064).

## Contract requests added or changed

- **CR-059** answered in 2.48.0 and built.
- **CR-064** answered in 2.52.0 and built.
- **CR-066 raised:** a replayed `placeOrder` key opens nothing for another browser, and a key is bound to its checkout (description only).

## Decisions recorded

- **ADR 0059:** the operation table travels packed, and its permissions stay with the tests.
- **ADR 0060:** the shop keeps a card request's key in the tab's session storage, for one checkout (the owner, 2026-11-25).
- **A-F10-26** resolved: a part is offered (the owner, 2026-11-25). **A-F10-25** notes ADR 0060.
- **A-F10-29:** the till makes no live sale, so 2.51.0 needs no change.
- **A-F10-30:** an exception that names the reader is not offered to them.

## Gates, each run on its own

| Check                                        | Exit | Count                                                                                                          |
| -------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`          | 0    |                                                                                                                |
| `sync-contract:check`                        | 0    | backend `840a578`, 2.52.0                                                                                      |
| `tokens:check`, `fonts:check`, `icons:check` | 0    |                                                                                                                |
| `test:unit`                                  | 0    | console 384, ui 901, storefront 57, data 33, api-client 33, i18n 6                                             |
| `test:integration`                           | 0    | console 281, storefront 25                                                                                     |
| `test:e2e`, full run                         | 0    | 403 of 403 in 9.8 minutes, none flaky (F10p: 400)                                                              |
| `budget:console`                             | 0    | till 239.3 of 250 kB (F10p 247.1); back office 285.7 of 300 kB; investor 208.3 of 250 kB                       |
| `budget:storefront`                          | 0    | `/r/[token]` 111.8 of 120 kB, `/q/[token]` 155.2 of 170 kB, `/quote` 161.7 of 170 kB, listings 112.2 of 120 kB |
| `test:a11y`                                  | 0    | 322 stories, 65 files                                                                                          |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                              |

## For the owner

Each item has my recommendation. Nothing here blocks the next session.

1. **The till has 10.7 kB free.** That covers the next sale-screen feature or two. The next lever, if one is ever needed, is `tailwind-merge` (8.5 kB). Replacing it is a design-system change, so I do not recommend it until the headroom is gone.
2. **CR-066** asks the backend to state what the card replay already relies on. I recommend the backend answers it in its next session. It changes no shape.
3. **Approve the new exception words as built.** The 40 new kinds read in plain words, for example "Paid soon after payout details changed" and "Till receipt link refused". Say if any reads wrong.
4. **`QuoteVersion.approvedBy` (2.50.0)** names who approved a version below the margin floor. I recommend the quote page shows it next to the approval. That is small, and it belongs in the next quotes change.
5. **The reconciliation breaks and customer payments** still have no screens. I recommend they come with the reports and exceptions session, as before. CR-059 is now in, so that session no longer starts with it.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10q-contract-2-52-0-till-headroom-card-reload-part-write-off.md.
No screenshots until F13.

This is the reports and exceptions session.
1. pnpm sync-contract:github (main) and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.52.0.
2. The rest of the exception work: listExceptions' reviewed filter in the header, sourceKind, the
   CHECKOUT_HOLDING setting (2.49.0), and the report screens' grants.
3. The reconciliation breaks and customer payments, with BreakResolve.posting VERIFIED and
   reversePayment MOBILE_MONEY_NOT_RECEIVED (2.22.0).
4. If CR-065 or CR-066 landed, build or record them.
5. The owner's answers to this report's "For the owner", if any.

The till has 10.7 kB of headroom (239.3 of 250 kB): a sale-screen feature reads PERFORMANCE_BUDGET.md first.
```
