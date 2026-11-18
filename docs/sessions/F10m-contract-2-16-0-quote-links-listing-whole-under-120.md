# F10m: contract 2.16.0, a sent quote's link, and the listing pages under 120 kB counted whole

- **Session:** F10 continued, on branch `claude/affectionate-ritchie-t8xlav`, from `main` at `aad2c91` (F10l merged as PR #33), rebased onto `2309e38` (F11 merged as PR #34). F11 took ADR 0055, so this session's is 0056; it took CR-053 to CR-057, and this session raised none.
- **Date:** 2026-11-18
- **Scope:** the F10l opening message, with the owner's three decisions on top:
  1. the storefront's 120 kB covers the whole first load, the layout's scripts included;
  2. a sent quote's link is shown once, with a copy button and "Send on WhatsApp";
  3. until CR-052, the till says that animals are sold through quotes and orders.
- **Not touched:** orders, picking, dispatch and driver screens. Another session is running F11. The one order file changed is the wholesale order page's credit card (`wholesale/OrderScreen.tsx`, built in F10i), because CR-046's switch it imported was deleted.

## 1. The sync: 2.12.0 to 2.16.0 (backend `4eb34ef`)

Four minor versions, all additive except one loud QUO change the console already met:

- **2.13.0:** `syncOfflineSales` moves into code with the shapes the till was built on.
- **2.14.0:** wholesale accounts and credit control move into code (CR-046, CR-048). **Loud for a quote line with no unit**: it is now the first unit the product is sold by. The quote builder sends a unit on every line, so nothing changed.
- **2.15.0:** the till's offline shift (`shiftSeq`, `nextShiftSeq`), and a batch's cash movements applied at sync.
- **2.16.0:** the ageing's ledger figures, dunning, and a statement's ageing.

### What landed, and what the console does now

| Change                                           | Where                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CR-046**, credit control                       | The switch and `requested/creditControl.ts` are deleted from the switch list, the builds, `CLAUDE.md` and `DEPLOYMENT.md`. The order's credit card calls `getOrderCreditCheck`. The override calls `requestCreditOverride` (202 `CreditOverridePending`). A buyer with no open account reads `NO_ACCOUNT` in words. The account's overrides always show who asked and why.                                                            |
| **CR-048**, the seed and a second person         | `fakeAuthServer` matches the seed: the Owner and the Manager hold `whl.account.release` and `whl.credit.override`; Sales and the Accountant hold the reads; the Accountant holds the hold. `NOT_SEEDED` has no `whl.*` line left. "Release from hold" is offered to holders of `whl.account.release`. An account says when a new limit or a release is waiting for its second person (`pendingCreditLimitPesewas`, `pendingRelease`). |
| **Wholesale accounts as built** (A-314)          | The terms form no longer has a price list: the server refuses one (`PRICE_LIST_THROUGH_MDM`), and a buyer's prices are given on the price list. The limit is sent only when it changes, because every change waits for a second person, with an optional "Why this limit" for the approver. Opening an account goes to the account whether the limit waits (202) or not.                                                              |
| **The approvals inbox**                          | It places the two new kinds, `CREDIT_LIMIT_CHANGE` and `ACCOUNT_RELEASE`, with words.                                                                                                                                                                                                                                                                                                                                                 |
| **New refusal codes**                            | Words for `ACCOUNT_EXISTS`, `CREDIT_LIMIT_EXCEEDED`, `CREDIT_TERMS_EXCEEDED`, `ACCOUNT_ON_HOLD`, `DUNNING_POLICY_INVALID` and `SYNC_BATCH_TOO_LARGE`.                                                                                                                                                                                                                                                                                 |
| **`syncOfflineSales`**, in code (2.13.0, 2.15.0) | The queue already sends a shift's sales and older cash movements in one batch, and reads each movement's `APPLIED`, `DUPLICATE` or `REJECTED`. **A-F10-07 is closed.** One change: a shift opened offline prints the pack's `nextShiftSeq` in its references and sends it as `ShiftOpen.shiftSeq`. If the pack is older than the last shift the till heard of, it takes one past that instead.                                        |
| **The ageing** (2.16.0)                          | The e2e fixtures carry the ledger and not-aged figures. No screen shows them yet.                                                                                                                                                                                                                                                                                                                                                     |

### What did not land

- **CR-032** (the till's PINs), **CR-033** (the digital receipt) and **CR-050** (the witness read). Their switches stay, and the builds name `CR-032,CR-033,CR-050`.
- **CR-051** (the pack's unit names) and **CR-052** (each animal's band in the pack).
- **Built in the contract, not on a screen:** dunning (`listDunningLevels`, `replaceDunningLevels`, `listDunningNotices`) and `CustomerStatement.ageing`.

## 2. The storefront: the whole first load under 120 kB

The owner: the 120 kB covers the whole first load, the layout's scripts included. The work went in three steps:

1. **The check counts it all.** `budget:storefront` now counts every file of the page entry and of the root layout, each once, and prints `next build`'s page figure beside it.
2. **CI was set to the exact bytes first.** Counted whole, the listing pages loaded 124,315 bytes. CI was held at exactly that so they could not grow (`ci(storefront)` commit).
3. **The payload was cut**, as below.

**What was cut:**

- **The basket button** is a plain `<button>` in `Button`'s primary classes, written out in `components/plainClasses.ts`: 1.8 kB. Taking `Button` out was the owner's suggestion.
- **The search box** was the bigger cost, which the owner's note did not name. The header's search box was `Input`, a client component. So the server-rendered header still shipped `Input`, `cn` and tailwind-merge to every page. It is now a plain `<input>` in `Input`'s classes: 10.4 kB.
- **A guard against drift:** `plainClasses.test.ts` fails if either string drifts from `buttonVariants()` or `cn(inputVariants(), …)`.

| Route                       | Whole first load, before | After                | Limit                        |
| --------------------------- | ------------------------ | -------------------- | ---------------------------- |
| `/`, `/c/[slug]`, `/search` | 124,315 B                | **112,145 B**        | **120 kB, enforced**         |
| `/q/[token]`                | 174,360 B                | **173,369 B**        | 170 kB: ratchet at 173,369 B |
| `/quote`                    | 166,901 B                | 165,426 B            | 170 kB, enforced             |
| `/p/[slug]`, `/checkout`    | 157,159 B, 207,849 B     | 155,764 B, 206,274 B | none                         |

**Counted whole, the quote link page is 3.4 kB over its 170 kB.** Its own page is 169.7 kB, which is what F10l measured. Its layout's scripts were never counted. It is held at its exact bytes so it cannot grow. See "For the owner".

## 3. A sent quote's link, shown once

`issueQuoteVersion` answers the link's token once, and B11 does not send it yet. So after a quote is sent, the quote page shows **"The customer's link"**:

- **The link itself**, with "Copy the link".
- **"Send on WhatsApp to +233…"**, which opens `wa.me` with the quote's contact number and the message: "Hello {name}, here is your quote {number} from HaKorem Farms. Open it to read and accept it: {link}". The message is also shown in words under the button.
- **Words that say it plainly:**
  - "This link is shown only once. Copy it or send it now: the farm keeps no copy of it."
  - "If it is lost, make a new link from this quote with 'Make a new link'. Links already given keep working until this version is replaced or expires."

**"Make a new link"** is offered on a live quote to holders of `quo.quote.issue`:

- It confirms first, saying nothing is sent to the customer.
- It then asks again for the issued version, with `channels: []`. The server answers a fresh token and sends nothing (2.12.0).
- Each new link is its own idempotency intent.

**The shop's address comes from the build's settings** (ADR 0056), never from the code:

- **The setting:** `HK_SHOP_URL`, read at build time like `HK_API_BASE_URL`. `docs/DEPLOYMENT.md` section 6 records it for F13: production `https://hakoremfarms.com`, staging its own shop.
- **A build for a real API fails without it.** A link the console cannot show is lost.
- **The e2e and CI builds** set `http://127.0.0.1:3100`, the suite's storefront.
- **A mock build without it** says in words that it cannot show the link.

After a margin approval, nobody sees the link, because the approver issues the version. The salesperson makes a new link from the quote.

## 4. The till: animals are sold through quotes and orders

The pack as 2.11.0 answers it gives a live animal no band. Until CR-052:

- **Before any tap**, the animal's tile says "Sold through quotes and orders".
- **A tap, or its tag found by search**, says: "Goat is sold through quotes and orders, not at this till", and to make a quote or an order for the customer in the back office.
- **Nothing goes on the sale**, the animal chooser does not open, and everything else still sells.
- **A quote-only tile** now says "Sold by quote only" in words. Before, it was only greyed out.

## Proved by

**e2e, at 360 px, axe-clean, no sideways scroll:**

- **`quotes-credit.spec.ts`, 2 new tests, 1 rewritten:**
  - **The link (rewritten):** it is shown once, with the build's address and the server's token. WhatsApp opens at `wa.me/233…` with the link and the quote number, `noopener noreferrer`. "Make a new link" sends `channels: []` and replaces the link.
  - **A release (new):** it waits for its second person, and the account then says so and offers no second release.
  - **A terms change (new):** it sends no limit when the limit is unchanged and never a price list. A new limit is sent with its reason and waits.
  - **Credit control:** the card and the override now run against the contract's operations (`api.respond`, with a 202 status).
- **`pos-till.spec.ts`, 1 new test:** with the pack exactly as 2.11.0 answers it, the goat's tile and its tag say it is sold through quotes and orders, nothing is added, and tomatoes still sell.

**Unit:**

- `shopAddress.test.ts`: the setting, the build's refusal, the link and WhatsApp's address.
- `plainClasses.test.ts` and `CartButton.test.tsx`.
- `sync.test.ts`: the offline shift's `nextShiftSeq`, and an older pack.
- `switch.test.ts`: CR-046 is refused as a switch.
- `hooks.test.tsx`: its sample requested write is CR-032's.

**Integration:** 648 operations in the mock (was 646).

## Moved from the mock to the real API

- **The order's credit check and the credit override** (`getOrderCreditCheck`, `requestCreditOverride`, 2.14.0).
- **Wholesale accounts:** the list, opening one, the terms, hold and release, and the overrides (2.14.0).
- **The ageing** (2.16.0).
- **The till's offline sync** (`syncOfflineSales`, 2.13.0), including its cash movements (2.15.0).

## Contract requests added or changed

- **CR-046** answered in 2.14.0 and built; its switch is deleted.
- **CR-048** answered in 2.14.0 and 2.16.0 and built.
- **CR-052:** its "Until this lands" now says what the till shows (the owner's decision).
- **No new request.**

## Decisions recorded

- **ADR 0056:** the console's shop address is a build setting, `HK_SHOP_URL`, and a build for a real API fails without it.
- **Assumptions closed:** A-F10-07 (the offline batch is in code) and A-F10-10 (the seed grants `whl.*`).
- **No new assumption.**
- **The F10l opening message's item 3**, an ADR for how the storefront's e2e answers a state the contract's examples cannot show, was already ADR 0054 (F10i). Nothing reopened.

## Gates, each run on its own

| Check                                        | Exit | Count                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`                               | 0    | the first run failed on two files; prettier, own commit                                                                                                                                                                                                         |
| `lint`                                       | 0    |                                                                                                                                                                                                                                                                 |
| `typecheck` (every package)                  | 0    |                                                                                                                                                                                                                                                                 |
| `sync-contract:check`                        | 0    | backend `4eb34ef`, 2.16.0                                                                                                                                                                                                                                       |
| `tokens:check`, `fonts:check`, `icons:check` | 0    |                                                                                                                                                                                                                                                                 |
| `test:unit`                                  | 0    | rebased onto F11: console 339 (309 before the rebase; F10l 307), ui 901, storefront 42 (was 39), data 33, api-client 30, i18n 6. The first run failed 2 in data (CR-046's sample) and 1 in console (four codes without words); each was fixed in its own commit |
| `test:integration`                           | 0    | rebased onto F11: console 260, storefront 20                                                                                                                                                                                                                    |
| `budget:console`                             | 0    | till 243.5 of 250 kB (F10l 242.2: the till's words for an animal); back office 285.9 of 300 kB, with F11's screens                                                                                                                                              |
| `budget:storefront`                          | 0    | listing pages 112.1 of 120 kB whole; `/q/[token]` 173.4 kB at its ratchet; `/quote` 165.4 of 170 kB                                                                                                                                                             |
| `test:e2e`, full run                         | 0    | 330 of 330 in 7.0 minutes, on the rebased branch; 3 tests are new here and 1 is rewritten                                                                                                                                                                       |
| `test:a11y`                                  | 0    | 322 stories in Chromium with axe, 65 files                                                                                                                                                                                                                      |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                                                                                                                                                                               |

## For the owner

1. **The quote link page is 3.4 kB over 170 kB, counted whole.** Your 120 kB decision covers the whole first load, so I counted the quote pages the same way. The quote link page (`/q/[token]`) is 173.4 kB with the layout, and 169.7 kB on its own, which is the figure F10l passed. CI holds it at 173,369 bytes so it cannot grow. Say whether its 170 kB covers the layout too. If it does, the next storefront session trims 3.4 kB from that page.
2. **After a margin approval, nobody sees the quote's link.** The approver issues the version, so the server's token goes to the approver's answer. The salesperson makes a new link from the quote, and the words say so. If you want the approver's page to show the link too, say so.
3. **Dunning is in the contract but not on a screen.** The reminder levels and the reminders sent (2.16.0) have no console screen yet. Say if they belong in F10 or in F12's reports.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10m-contract-2-16-0-quote-links-listing-whole-under-120.md.
Read ADR 0046, 0052 and 0055. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.16.0.
   - CR-050's read landed (landed.ts fails): delete requested/shiftWitnesses.ts and its id, call
     useApiQuery for it in CashMovementForm, and keep witness.ts's rule.
   - CR-032 landed: delete requested/tillPin.ts and its id; a deployed till can then take a PIN witness,
     and offline mobile money with unverifiedMobileMoney (2.15.0).
   - CR-033 landed: delete requested/digitalReceipt.ts and its id.
   - CR-052 landed (an animal's band on OfflineStockUnit): price an animal from its own band, delete
     soldThroughQuotes and its words, and delete goatPricedPerHead in e2e/support/till.ts.
   - CR-051 landed: the till says "6 eggs" from the pack's names.
2. The owner's answers to this report's "For the owner", if any: the quote link page's budget counted
   whole; the link after a margin approval; dunning.
3. If B11 sends the quote's link itself, say so beside the link, and keep it shown once.
```
