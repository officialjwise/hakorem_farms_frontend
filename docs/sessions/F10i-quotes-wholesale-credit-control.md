# F10i: quotes, wholesale accounts and credit control

- **Session:** F10 continued, on branch `claude/determined-goodall-33snvl`, from `main` at `4df43d7` (F10g merged as PR #26), rebased onto `678f8c9` (F10h merged as PR #27) before merging.
- **Date:** 2026-11-17
- **Scope:** the F10 row of `docs/BUILD_PROMPT.md`, in the owner's order:
  1. quotes in the console: built, revised, sent, converted;
  2. the public request-for-quote form;
  3. accepting a quote from a phone (the gate);
  4. wholesale accounts;
  5. credit control: ageing, the refusal with the amount over, the override.
- **Parallel work:** the other session (F10h) merged first. It synced the same contract 2.5.0 and built nothing else, so the rebase met only a comment in `fakeRoles.test.ts` and `package.json`'s e2e lines. Its report took the name F10h, so this one is F10i (screenshots in `docs/screenshots/F10i/`, tag `F10i`). No supplier, purchase order, supplier invoice or payment screen was touched, and not the till.
- **How it was built:** the storefront half (items 2 and 3, ADR 0054) was built in a separate worktree on a branch and merged in; the rebase made the history linear. The only conflict was `package.json`'s three e2e lines, which carry both the console's switches and the storefront's API address.

## The contract: 2.5.0, additive, and B10 not in it yet

`pnpm sync-contract:github` brought backend `bef5f1c`, contract **2.5.0** (B9b), byte for byte the sync F10h merged first:

- Twelve till operations moved from planned into code, with their planned shapes.
- The seed now grants their `pos.*` permissions. `fakeRoles.test.ts` drops the seven it listed as not seeded.
- Nothing for this session changed. Every quote, request-for-quote, business account, ageing and override operation is in the contract as **planned**: the shapes are there, B10 is not built.
- **No seeded role holds a `quo.*` or `whl.*` permission.** The fake gives them to the Owner and the Manager (A-F10-07, CR-046 item 5).
- **Units still have no plural names.** The console reads "10 Crate" and "30 Unit" through `useUnits().name`. When the backend's plural names land, the change is in `stock/units.ts` and nowhere in these screens. The storefront page has its own words and reads "10 crates" and "30 items".

## 1. Quotes in the console

**Screens:** `/quotes`, `/quotes/new`, `/quotes/:id`, in a new namespace `wholesale`, loaded on demand. Quotes, Requests for quote and Wholesale accounts are under Selling in the sidebar; Ageing is under Billing.

**Building a quote:**

- The person picks the buyer, which fills the contact name and phone; types when it holds until (end of that day, Accra time), the terms, the delivery and its fee; and adds lines.
- Each line has a product, the unit it is sold in (a crate or a single egg), how many, and the words the customer reads.
- **"Get the API's prices"** asks `resolvePrices` once for every line, for this buyer, on the `QUOTE` channel. Each line takes the API's price for its own unit: GH₵60.00 a crate and GH₵2.20 an egg, each from the buyer's list. A single egg is never priced from a crate.
- The agreed price starts at the API's price. The person may agree another; the API's stays beside it on the quote.
- Saving before the lines are priced is stopped in words.
- **Nothing is added up.** The line totals, the tax, the total and the margin come back from the server.
- **The line's unit is CR-045.** `QuoteLineInput` has no `uom` yet, so it is sent only in a build switched on for CR-045. With the switch off, the builder says that lines by the single egg wait for the server.

**The quote's page:**

- The version in force, with each line's quantity and unit, the API's price, the agreed price and the line total, then the delivery fee, before tax, tax, total and margin.
- Who sent it and when, and how it was accepted ("By Akosua Asantewaa, by the link sent to them").
- A version below the margin floor is said in words.

**Versions:**

- Every version is listed, newest first. Each opens as it was (`?version=`), marked "An earlier version, as it was", and cannot be changed.
- **Revise** asks what changed and starts a new draft version from the one in force (`reviseQuote` with `copyFromVersionId`). The old version stays.

**Actions**, each by state and permission, confirmed first with the total:

- edit the draft (`updateQuoteVersion`, the whole version sent back);
- send to the customer by WhatsApp, SMS or email. Only the channels are sent: the link and its token are the server's. Below the margin floor the answer is 202 and the page says it waits for someone else, with the approval;
- record an acceptance given in person or by phone, with the name given;
- record a decline, or withdraw, each with a reason;
- **make it an order** (`convertQuote`): how it reaches them, and payment (on credit by default).

**Every link is kept:**

- the quote links to its order; the order links back to its quote;
- each order line says "At the quote's price";
- the order offers its proforma invoice (`issueProforma`) and links to the invoice when there is one;
- the approvals inbox opens an order or a quote it is about.

**Requests for quote:** `/rfqs` and `/rfqs/:id`. What the buyer asked for in their own words, where it came from, and "Quote this request", which fills the builder's contact from it. A request can be started on, closed or marked as spam.

## 2. The request-for-quote form in the shop

**Page:** `/quote`, server rendered, with a small form island. It is linked from the footer ("Ask for a quote") and is in the sitemap.

- **Fields:** name, phone, what you want, how many crates, and optionally when it is needed and where to deliver. Consent to be contacted is required and not ticked in advance.
- **The crates go into the words.** `PublicQuoteRequest` has no quantity field, so the number is added to `requirements` as "Crates wanted: N" (A-F10-08).
- **No captcha and no honeypot.** Abuse is the server's to stop. A 429 is said in words with its reference, and nothing typed is lost.
- **What it shows:** an empty send is stopped in words; a sent request shows the server's number (`RFQ-…`) and message, and they stay on the page.

## 3. Accepting a quote from a phone: the gate

**Page:** `/q/[token]`, server rendered, read by the token in the path and nothing else.

- **The link is private:** never indexed (`noindex, nofollow`, and `/q/` is disallowed in `robots.txt`), and `Referrer-Policy: no-referrer`, so the token never leaves the page.
- **The quote, all from the API:** each line's words, quantity, price per unit and line total, then delivery, before tax, tax, total, terms, delivery and valid-until in Accra time.
- **Accepting:** the customer types their name and presses Accept. A confirmation repeats the quote number, the version and the API's total, then `acceptQuoteByLink` sends only `{ acceptedName }`. The server's message stays on the page.
- **Declining** is confirmed too, with an optional reason.
- **Every state says what it is, in words:**
  - expired: when it expired, and how to ask for a new one;
  - replaced by a newer version: the farm sent a newer one, and this link cannot be accepted;
  - accepted;
  - declined;
  - a wrong link: only that it is not valid, nothing about any quote.
- **A refused acceptance** keeps its words on the page and reads the quote again, so the expired or replaced state shows.
- **CR-047** asks what the token is (long, random, stored as a hash), what an accepted or replaced quote says, and which code an expired or replaced acceptance is refused with.

**Script size** (`next build` first-load JS): `/quote` 157.1 kB and `/q/[token]` 169.3 kB. The difference from a listing is the data layer, which the form's write and the accept and decline need; the quote itself is readable before any script runs. **The owner accepted them at that size (2026-11-18), under their own budget of 170 kB, checked in CI** by the new `pnpm budget:storefront` (see "The owner's decisions" below). The quote link page has 0.7 kB left.

**ADR 0054** decides the item carried from F10e: the storefront's e2e builds against a small shop API on 127.0.0.1:4011.

- It answers `viewQuoteByLink` from fixtures keyed by token: issued, expired, replaced, accepted and declined; any other token is a 404.
- It passes everything else to Prism unchanged.
- The browser's writes are routed in the spec, so their bodies are checked.

## 4. Wholesale accounts

**Screens:** `/business-accounts`, `/new` and `/:customerId`.

**The list:** each buyer's state, credit limit, what they owe, what is overdue, the credit left and their terms, with a filter for accounts over their limit.

**One account:**

- Limit, payment terms, the hold threshold, the assigned price list (`BusinessAccount.priceList`, which answers CR-041's first half for a credit buyer) and the account manager.
- **What they owe:** owed now, overdue and credit left, all as the server works them out.
- **How late:** their own ageing row, bucket by bucket.
- **On hold** is said in words with the reason; no credit left is said too.
- **Actions:**
  - change the terms (Owner or Manager); a limit change that waits for another Owner or Manager says so, with the approval;
  - put on hold (Owner, Manager or Accountant) or release (Owner or Manager), each with a reason; a release that waits for another person says so too;
  - quote this buyer.
- **Credit overrides:** every approved override, with its order and **who approved it**. With CR-046 on, also who asked and why.

**Opening an account:** the customer, the limit, the terms, the hold threshold and the price list.

## 5. Credit control

**Ageing** (`/ageing`): who owes what, from `getAgeingReport`, in the API's five buckets: not yet due, 1 to 30, 31 to 60, 61 to 90, and over 90 days late. It shows the totals, each buyer's limit, on hold in words, and the day the server worked it out; a day can be chosen. The screen sorts and never adds.

**The refusal with the amount over (CR-046, behind its switch):**

- **Where it happens:** confirming a credit order, on the order's page (`/orders/:id`). The quote's order is where a credit sale happens; the till is untouched.
- **Before anything is sent,** the server's credit check (`getOrderCreditCheck`) says it in words: "This order would take Asantewaa Chop Bar GH₵286.00 over their GH₵5,000.00 credit limit." Beside it are the limit, what is owed before this order, this order, the amount over, what is overdue, the oldest unpaid invoice past due, and the terms.
- **Past the terms**, for example: "Asantewaa Chop Bar has GH₵1,250.00 overdue, the oldest 41 days past due on 30-day terms." **On hold:** said in words too.
- **The refusal:** `confirmOrder` answers 422 `CREDIT_LIMIT_EXCEEDED`, `CREDIT_TERMS_EXCEEDED` or `ACCOUNT_ON_HOLD`. The dialog closes and the refusal stays on the page, in words, with the amount over, and says what to do next.

**The override:**

- "Ask for a credit override" asks for a reason and sends `requestCreditOverride` (202). It is a requested write, through `useRequestedMutation` (ADR 0053).
- The page then says it waits for an Owner or Manager other than the person who asked, with the reason and a link to the approval.
- **The asker cannot approve it:** in the approvals inbox they see "You asked for this, so you cannot decide it" and no Approve. The server's `MAKER_CANNOT_CHECK` backs it.
- **A Manager approves it.** The order then says "Override approved by Kwabena Owusu at 2026-11-17 12:50" and who asked; the account's overrides list names him.
- **With the switch off** (a deployed build):
  - the order page confirms as the contract says, and shows its 202 as waiting for a credit override, with the approval;
  - `CREDIT_CHECK_UNAVAILABLE` is shown in the server's words;
  - the page says that the amount over waits for the server.

## Proved by

**The gate: `e2e/specs/storefront/quotes.spec.ts`**, 10 tests at 360 px. Every state runs axe and checks for no sideways scroll.

1. **The gate:** a customer reads the quote on a phone over throttled 3G (the API's lines and GH₵688.00) and accepts it after a confirmation. The request body is exactly `{ acceptedName }`, its path carries only the token, and the decision stays on the page.
2. The page is never indexed, and the link is never passed on as a referrer.
3. An expired quote says when it expired and how to ask again, with no Accept.
4. A replaced quote says so, and cannot be accepted.
5. An accepted quote says so; a declined one offers a new request.
6. A wrong link says only that it is not valid.
7. A refused acceptance keeps its words on the page.
8. Declining is confirmed and sends the reason.
9. The request form: an empty send is stopped in words; a filled one sends what was typed and shows its number.
10. Too many requests are said in words, with the reference.

**`e2e/specs/console/quotes-credit.spec.ts`**, 14 tests at 360 px with axe:

1. A quote for 12 crates and 30 eggs, each priced by the API for its own unit. The `resolvePrices` and `createQuote` bodies are checked: pesewas, and `uom` per CR-045. The server's GH₵786.00 shows.
2. Revised to 10 crates: version 1 stays readable as it was (GH₵786.00), and version 2 is in force (GH₵666.00).
3. Sent by WhatsApp and SMS; the body is only the channels.
4. Below the margin floor, sending waits for approval.
5. Accepted from the link, it becomes one order, linked both ways, its lines at the quote's price.
6. Confirming is refused with GH₵286.00 over, in words that stay; an override is asked for with a reason (body checked).
7. The person who asked cannot approve the override.
8. A Manager approves it; the order and the account say who approved it.
9. The account: limit, terms, price list, what is owed and how late; put on hold with a reason (body checked).
10. The ageing, in the API's buckets.
11. A cashier is denied the quotes in words, naming `quo.quote.read`.
12. Sales edits and sends a quote, sees no way to change terms, hold or release, and is denied the override's approval in words.
13. The Accountant puts an account on hold (with a reason) and is offered neither Release nor a change of terms.
14. A Manager is offered Release and a change of terms on a held account.

**Other tests:**

- `apps/console/src/wholesale/screens.integration.test.tsx`: 8 tests against the real Prism with every switch off. The quote list's four states, one quote, the builder saying single eggs wait, requests for quote, an order, accounts, an account, and the ageing and its denial.
- `apps/storefront`: unit and integration tests for both pages (storefront integration 15 to 20).
- `packages/data/src/hooks.test.tsx`: the requested write, its key, its body and what it refetches (ADR 0053).
- `apps/console/src/requested/switch.test.ts`: CR-045 and CR-046 have landed checks, and neither requested operation is in the manifest.

## Every screen at 360 px

Every screen is in `docs/screenshots/F10i/`, at 360 and 1280 px (`pnpm screenshots`, tag `F10i`).

| Screen                                               | File                              |
| ---------------------------------------------------- | --------------------------------- |
| Quotes                                               | `quotes-360.png`                  |
| A new quote, crate and egg lines priced by the API   | `quote-new-priced-360.png`        |
| The quote's versions, version 2 in force             | `quote-versions-360.png`          |
| Version 1, as it was                                 | `quote-older-version-360.png`     |
| An accepted quote, ready to make an order            | `quote-accepted-360.png`          |
| The order, refused with the amount over              | `order-credit-refused-360.png`    |
| The order, override approved and by whom             | `order-override-approved-360.png` |
| The override's approval                              | `override-approval-360.png`       |
| Wholesale accounts                                   | `business-accounts-360.png`       |
| Asantewaa Chop Bar's account, what it owes, how late | `business-account-360.png`        |
| Ageing                                               | `ageing-360.png`                  |
| Requests for quote                                   | `rfqs-360.png`                    |
| A request for quote                                  | `rfq-360.png`                     |
| The shop's request-for-quote form                    | `quote-request-360.png`           |
| The request sent, with its number                    | `quote-request-sent-360.png`      |
| The quote by its link, on a phone                    | `quote-link-360.png`              |
| Accepting it: the confirmation                       | `quote-link-confirm-360.png`      |
| Accepted                                             | `quote-link-accepted-360.png`     |
| Expired                                              | `quote-link-expired-360.png`      |
| Replaced by a newer version                          | `quote-link-replaced-360.png`     |
| A wrong link                                         | `quote-link-not-valid-360.png`    |

## Moved from the mock to the real API

**None.** B10 is not built: every quote and wholesale operation is planned in 2.5.0, and nothing is deployed.

## Contract requests added or changed

- **CR-045, new:** `QuoteLineInput.uom`, so a quote line says crate or single egg, priced by that unit's entry. Built behind its switch.
- **CR-046, new:** credit control, built behind its switch:
  - `getOrderCreditCheck`, with the amount over;
  - `confirmOrder` refuses past the limit, the terms or on hold with 422 and the amount, instead of 202;
  - `requestCreditOverride` with a reason, approved by the Owner or a Manager who did not ask;
  - `CreditOverride.reason`, `requestedBy` and `overLimitPesewas`;
  - the seed's `quo.*` and `whl.*` grants.
- **CR-047, new:** the quote link's token (long, random, hashed, never derived), what an accepted or replaced quote says, and which refusal an expired or replaced acceptance gets. No switch.
- **CR-048, new (the owner's decision):** the seed for quotes and wholesale (Sales quotes; the Accountant may hold; the Owner and the Manager release, change terms and approve overrides), a separate `whl.account.release`, and a second Owner or Manager on every release and every credit limit change. No switch.
- **CR-049, new:** `PublicQuoteRequest.quantity` and `uom` (and on `Rfq`), so the shop's crates are a field, not words.
- The e2e, screenshot and CI builds are now `CR-032,CR-033,CR-038,CR-042,CR-045,CR-046`: `package.json`, `ci.yml`, `CLAUDE.md`, `DEPLOYMENT.md` and A-F10-01 say so.

## The owner's decisions (2026-11-18)

1. **Roles.** Sales builds, revises, sends and converts quotes, and never approves an override. The Accountant may put an account on hold. Releasing a hold, approving an over-limit override and changing a credit limit are Owner or Manager only, never the person who asked.
   - The test roles are set that way: a Sales user (Kojo Antwi) and an Accountant who has set up TOTP (Esi Boateng) are added to the fake, and the Accountant gains `whl.account.hold`.
   - The console offers Release only to a holder of `whl.account.hold` and `whl.account.manage` until the seed has its own release permission.
   - The backend's seed and the second person on a release and a limit change are **CR-048**.
2. **The shop form's crate count as text** is fine until the backend adds a quantity and unit field (**CR-049**; A-F10-08 accepted).
3. **The two quote pages** are accepted at their size under their own budget of **170 kB**, checked in CI like the others; the 120 kB listing target stays for listing pages.
   - `pnpm budget:storefront` (`apps/storefront/scripts/check-budget.ts`) runs in CI after the storefront's build and fails over an enforced budget. It measures what `next build` reports as first-load script, the figure the 170 kB was set against.
   - **One thing for the owner:** the listing pages measure **121.7 kB, 1.7 kB over their 120 kB target, and were already over on `main` before this session** (121 kB in `next build`'s table at `678f8c9`, against 118 kB in F8). The check prints them against the target without failing, so this merge is not blocked by a gap it did not open. Say if CI should fail on them now; the cut would come from what every page shares (the copy-button and request-reference code in `packages/ui` is the likeliest).
   - The table is in `docs/PERFORMANCE_BUDGET.md`, "Per route, checked in CI".

## Decisions recorded

- **ADR 0053:** a back-office screen writes a requested operation through `useRequestedMutation` (`createRequestedMutation` in `packages/data`), the twin of ADR 0052's read. It answers ADR 0052's note on invalidating a requested read.
- **ADR 0054:** the storefront's e2e answers a state the contract's examples cannot show from a shop API in front of Prism, keyed by path. The storefront e2e build's API is 127.0.0.1:4011.
- No other new pattern: the screens reuse Table and TableCard, Field, ConfirmDialog, ReasonDialog, QueryBoundary, StatusBadge, MoneyInput and the existing pickers.

## Assumptions

- **A-F10-01** now covers CR-045 and CR-046.
- **A-F10-07, new:** the fake gives the `quo.*` and `whl.*` grants by the owner's decision until the seed does (CR-048).
- **A-F10-08, new, accepted by the owner:** the shop form's crates go into `requirements` until CR-049.
- **A-F10-09, new:** until CR-047, the quote page says only the API's status, and a refused acceptance reads the quote again.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                      |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                      |
| `test:unit`                                                         | 0    | console 299, data 33 (was 31), api-client 30, ui 900, storefront 39 (was 34), i18n 6 |
| `test:integration`                                                  | 0    | console 257 (was 249), storefront 20 (was 15)                                        |
| `test:a11y`                                                         | n/r  | not run: `packages/ui` is unchanged; every new screen's spec runs axe                |
| `budget:console`                                                    | 0    | till 247.3 of 250 kB (was 247.1); back office 280.9 of 300 kB (was 279.8)            |
| `budget:storefront` (new)                                           | 0    | `/quote` 157.1 and `/q/[token]` 169.3 of 170 kB; listings 121.7 against 120 (target) |
| `test:e2e`, full run                                                | run  | rerun after the owner's decisions; the count is added in the next commit             |

**The till grew by 0.2 kB** without being touched. The shared namespace table (`packages/i18n`) carries one more loader, for `wholesale`. It has 2.7 kB left; the F10g opening message's item 2 (load the till's refusal words on demand) is now more pressing.

## For the owner

1. **The listing pages are 1.7 kB over their 120 kB target** (from before this session). Say whether CI should fail on them now.
2. **Credit control is built to your words, not the contract's.** Today the contract confirms an over-limit order with a 202 approval and no amount and no reason. The screens follow CR-046 behind a switch, and show the contract's 202 in words with the switch off.
3. **The quote link page has 0.7 kB left** under its 170 kB.
4. **"Unit" or "egg":** still "Unit" in the console until the backend's unit names land.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10i-quotes-wholesale-credit-control.md.
Read ADR 0046, 0052, 0053 and 0054.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.5.0.
   - If B10 moved the quote and wholesale operations into code, check each screen against the shapes as
     built and move them off the mock in the report; match fakeAuthServer's quo.* and whl.* grants to the
     seed and drop them from fakeRoles.test.ts's NOT_SEEDED.
   - If CR-045 landed, landed.ts fails: delete requested/quoteLineUnit.ts and its id; send QuoteLineInput.uom.
   - If CR-046 landed: delete requested/creditControl.ts and its id; call getOrderCreditCheck and
     requestCreditOverride with the generated client, and read CreditOverride.reason and requestedBy.
   - If CR-048 landed (the seed and whl.account.release): match fakeAuthServer to the seed, offer Release
     to holders of whl.account.release, and show a release or a limit change waiting for its second person.
   - If CR-049 landed: the shop form sends quantity and uom; drop "Crates wanted" from the words (A-F10-08).
   - If CR-047 was answered: show who accepted and when, and which refusal an expired or replaced
     acceptance gets.
   - If units carry plural names: "540 eggs", "10 crates" in stock/units.ts and the e2e expectations.
   - CR-038, CR-039, CR-032, CR-033, CR-042 to CR-044: as the F10g opening message says.
2. The till is at 247.3 of 250 kB: load common:refusals' rule words on demand there (F10g item 2).
3. If B9b went live, take the F10 report's items against the real API.
```
