# F10l: contract 2.12.0, the quotes in code, and the listing pages under 120 kB

- **Session:** F10 continued, on branch `claude/awesome-hamilton-se5jqq`, from `main` at `b2c8fef` (F10k merged as PR #31).
- **Date:** 2026-11-18
- **Scope**, in the owner's order:
  1. a standing rule, in its own PR (#32, merged): no screenshots until F13;
  2. the F10j opening message, as F10k left it: the sync, and what landed;
  3. the drop witness (CR-050), when the contract carries it;
  4. the storefront's listing pages under 120 kB, then their CI limit at 120 kB.
- **Not touched:** orders, picking, dispatch and driver screens. Another session is running F11.

## 1. No screenshots until F13 (PR #32)

- **The rule, in `CLAUDE.md`:**
  - a session does not capture screenshots, open images to review them, commit them or embed them in a report;
  - reports describe screens in words;
  - F13 takes one full set at 360 and 1280 px for the owner's review.
- **The e2e run:**
  - `e2e/playwright.config.ts` ignores the three screenshot specs. Before, the run loaded them and filtered them out by tag.
  - `pnpm screenshots` runs them alone from `e2e/playwright.screenshots.config.ts`.
  - Every other spec keeps its 360 px checks: no sideways scroll, and axe.
- **The `hakorem-screen` skill's 360 px step** now says the check is the spec's, not a screenshot.

This report has no screenshots. Its screens are described in words.

## 2. The sync: 2.10.0 to 2.12.0 (backend `7ef2851`)

Two minor versions:

- **2.11.0 is LOUD** for a counter line that names no unit. It is now the product's first unit: a crate of eggs, never one egg.
- **2.12.0 is additive.** It moves nineteen QUO operations into code and adds CR-041's two reads.

### What landed, and what the console does now

| Change                                                                 | Where                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CR-038** the till's selling units (2.11.0), `getOfflinePack` in code | The switch and `requested/sellingUnits.ts` are deleted. The till reads `OfflineSellingUnit` from the generated types. It offers the crate or the single egg only when a product has more than one unit, and names the unit on the line.   |
| **CR-045** a quote line's unit (2.12.0)                                | The switch and `requested/quoteLineUnit.ts` are deleted. Every line offers its unit and sends it to `resolvePrices` and the quote. The notice "Lines by the single egg wait for the server" is gone.                                      |
| **QUO in code** (2.12.0)                                               | A draft is saved at `QuoteVersion.version`, the lock the server names, where it sent the quote's. Recording an acceptance asks for "What they said, and where" and sends it as `note`. Each version shows "Made" with who and when.       |
| **`QUOTE_LINK_CLOSED`** (2.12.0)                                       | The link page said a closed link was a load failure. It now says "This quote has expired", "This quote was replaced by a newer version" or "The farm withdrew this quote". It shows no number or total, and offers a new request.         |
| **CR-041** who holds a price list, and the break's base unit (2.12.0)  | A buyer's price list has a "Who pays these prices" table: each buyer, from and until, every state in words, read again after an assignment. A break reads "from 10 crates (300 eggs)", where it said "(300 in the base unit)".            |
| **The seed** (2.12.0): the quote grants for Owner, Manager and Sales   | `fakeRoles.test.ts` drops them from `NOT_SEEDED`. The fake already matched the seed.                                                                                                                                                      |
| **New refusal codes**                                                  | Words for `QUOTE_INVALID`, `RFQ_INVALID`, `QUOTE_LINK_CLOSED`, `QUOTE_ALREADY_DECIDED` and `QUOTE_ALREADY_CONVERTED`, and for thirteen rules (`STOCK_SHORT`, `VERSION_OPEN`, `UOM_NOT_SOLD`, `NO_LINES`, `VALIDITY_PASSED` and the rest). |

### What did not land

- **CR-050's read** (`listShiftWitnesses`), so the drop witness stays exactly as F10k built it: a supervisor's PIN on the till, checked with the till PIN's rules.
- **CR-032** (the till's PINs), so a deployed till still sends every drop unwitnessed.
- **CR-033** (the digital receipt), **CR-046** (credit control), **CR-048** (the wholesale seed) and **CR-051** (the pack's unit names).
- **`syncOfflineSales`** is still planned, so A-F10-07 stands and the till's queue is unchanged.

### A live animal has no price at the till (CR-052, new)

2.11.0's pack gives a product priced by grade or weight no band: "a live animal has no single band". As built, a till with the real pack says "Goat has no price on this till" and cannot sell a goat. It sells everything else.

- **CR-052** asks for each sellable animal's own band on `OfflineStockUnit`.
- **The e2e pack keeps the goat's per-head band** from 2.10.0's example (`goatPricedPerHead`), so the till's tests still sell an animal. Three till specs failed on this before the fix.

## 3. The listing pages under 120 kB

| Route                                | Before (`main`) | After        | Limit                      |
| ------------------------------------ | --------------- | ------------ | -------------------------- |
| `/`, `/c/[slug]`, `/search`          | 121.7 kB        | **108.5 kB** | **120 kB** (was a ratchet) |
| the layout's own chunks, beside them | 5.2 kB          | 15.8 kB      | not budgeted               |
| a listing's whole first load         | 126.9 kB        | 124.3 kB     |                            |
| `/q/[token]`                         | 169.3 kB        | 169.3 kB     | 170 kB                     |

**Three changes in `packages/ui`:**

1. **`ErrorState` loads its copy button on first use.** A listing page renders `ErrorState` for its error state. Its static `CopyId` put the copy button, `Button` and `cn` in every listing's first load, with `Button` and `cn` loaded twice, beside the layout's own copies. `LazyCopyId` loads them the first time a reference is shown, as ADR 0042 loads the toaster (amended). Until then, the reference's eight characters are on screen without the button.
2. **`cn` reads the colour names alone** from a generated `color-names.json`, not the whole token manifest. `pnpm tokens` writes it, and `tokens:check` guards it.
3. **`PhotoImage` takes no `className`**, so it needs no `cn`.

**What went, and what moved:**

- **2.6 kB is gone** from what a listing page loads.
- **The budgeted figure fell further, by 13.2 kB.** tailwind-merge (8.7 kB), the icons' base and Radix Slot are now counted under the layout, which needs them for the header's basket button.
- **The budget counts the page entry, as `next build` does**, and prints the layout beside it. See "For the owner".

## Proved by

**e2e, at 360 px, axe-clean:**

- **`quotes-credit.spec.ts`, 2 new tests:**
  1. A draft is saved at its own version (4, never the quote's 3), and the version shows who made it.
  2. An acceptance by phone is not sent without what the buyer said. It is then sent with `note`.
- **`storefront/quotes.spec.ts`, 1 new test:** each closed link (expired, replaced, withdrawn) says why, shows no quote number or amount, and offers "Ask for a new quote". The shop API in front of Prism answers the 422 for three new tokens.
- **`eggs-buyer-prices.spec.ts`:** a buyer's list shows the hotel that holds it, "Until another list is given to them". The break reads "from 10 crates (300 eggs)".
- **Changed:**
  - the quote builder's request carries each line's unit with no switch;
  - the till's pack keeps the goat's band;
  - the quote fixtures carry 2.12.0's new fields.

**Unit and integration:**

- `sellingUnits.test.ts`: the till's units, rewritten without the switch;
- `entryWords.test.ts`: the base unit's words;
- `ErrorState.test.tsx`: the copy button arrives after the reference;
- the integration tests: 646 operations in the mock (was 644), the lazy copy button, and the quote builder with no unit notice.

## Moved from the mock to the real API

- **The quote screens:** builder, revision, sending, acceptance, decline, cancel and conversion. Their nineteen QUO operations are in code from 2.12.0.
- **The quote link page.**
- **The shop's request for a quote.**
- **The till's offline pack** (`getOfflinePack`, 2.11.0).
- **Who holds a price list** (`listPriceListAssignments`).

## Contract requests added or changed

- **CR-038, CR-041 and CR-045:** answered, built; their switches are deleted.
- **CR-047:** part answered. The token and the closed link are in. `PublicQuote` still has no `acceptedName`, `decidedAt` or `supersededAt`.
- **CR-049:** answered, not built. The quantity needs `productId`, and the shop's form names no product, so the count stays in the buyer's words (A-F10-11).
- **CR-051:** still open. `getOfflinePack` moved into code without `uoms`.
- **CR-052, new:** the band each sellable animal is sold at on the till.

## Decisions recorded

- **ADR 0042 amended:** `ErrorState`'s copy button loads on first use.
- **A-F10-01:** CR-038 is off the build list. The e2e and CI builds now set `HK_REQUESTED_CONTRACT=CR-032,CR-033,CR-046,CR-050`.

## Gates, each run on its own

| Check                                        | Exit | Count                                                                                                        |
| -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`                       | 0    | the first `format:check` failed on `e2e/support/quotes.ts`; prettier, own commit                             |
| `typecheck` (every package)                  | 0    |                                                                                                              |
| `sync-contract:check`                        | 0    | backend `7ef2851`, 2.12.0                                                                                    |
| `tokens:check`, `fonts:check`, `icons:check` | 0    | `color-names.json` is new                                                                                    |
| `test:unit`                                  | 0    | console 307 (was 301), ui 901 (was 900), storefront 39, data 33, api-client 30, i18n 6                       |
| `test:integration`                           | 0    | console 257, storefront 20; the first run failed 3, each this session's, fixed in `test(integration)`        |
| `budget:console`                             | 0    | till 242.2 of 250 kB (was 241.9); back office 284.1 of 300 kB (was 282.3: the refusal words, loaded at boot) |
| `budget:storefront`                          | 0    | listing pages 108.5 of 120 kB; `/q/[token]` 169.3 of 170 kB; `/quote` 157.2 of 170 kB                        |
| `test:e2e`, full run                         | 0    | 321 of 321 in 7.4 minutes; 3 are new here (F10k reported 294)                                                |
| `test:a11y`                                  | 0    | 322 stories in Chromium with axe, 65 files                                                                   |
| `screenshots`                                | n/r  | not run: no screenshots until F13                                                                            |

## For the owner

1. **A goat cannot be sold at a deployed till** (CR-052). 2.11.0's pack gives an animal priced by grade or weight no price, and the till will not sell without one. Everything else sells.
2. **What the listing budget counts.** The listing pages are at 108.5 of 120 kB as the budget measures them: the page, as `next build` reports it. 15.8 kB more loads for the layout, which carries tailwind-merge for the header's basket button, and that part is not budgeted. Say if the 120 kB should cover it. The whole is 124.3 kB, and taking tailwind-merge out of the storefront's client code would bring it under.
3. **Nobody can send a quote's link yet.** `issueQuoteVersion` answers the link's token once and says B11 sends it. Until B11, the customer gets no link. Say if the console should show the link after sending, so the salesperson can pass it on by WhatsApp. The console does not know the shop's address, so it would need one.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10l-contract-2-12-0-quotes-in-code-listing-under-120.md.
Read ADR 0042, 0046 and 0052. No screenshots until F13.

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.12.0.
   - CR-050's read landed (landed.ts fails): delete requested/shiftWitnesses.ts and its id, call
     useApiQuery for it in CashMovementForm, and keep witness.ts's rule.
   - CR-032 landed: delete requested/tillPin.ts and its id; a deployed till can then take a PIN witness.
   - CR-052 landed (an animal's band on OfflineStockUnit): price an animal from its own band, and delete
     goatPricedPerHead in e2e/support/till.ts.
   - CR-051 landed: the till says "6 eggs" from the pack's names.
   - syncOfflineSales moved into code: take the till's queue to the real API and settle A-F10-07.
   - CR-046 or CR-048 landed: as the F10i opening message says.
2. The owner's answers to this report's "For the owner", if any.
3. Decide how the storefront's e2e answers a state the contract's examples cannot show, in an ADR
   (carried from F10e).
```
