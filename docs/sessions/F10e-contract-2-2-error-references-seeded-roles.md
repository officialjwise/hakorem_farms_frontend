# F10e: contract 2.2.0, short error references, the receipt link's token, the seeded roles and the cart's checkout

- **Session:** F10 continued, on branch `claude/intelligent-bohr-gqmzrf`, from `main` at `5a44d38` (F10d merged as PR #23).
- **Date:** 2026-11-17
- **Scope:** the F10d report's opening message, with the owner's two answers to its "For the owner" on top.
- **Not done here:** the customer's receipt page (CR-033 item 3, A-F10-04): the owner said to build the receipt link once the contract carries the token, and the page is read by that token. The egg screens: B09e merged, and ADR 0049 gives them their own session. Item 4 of the opening message: B9b is not live.

## Contract 2.2.0 (additive)

Synced with `pnpm sync-contract:github`: backend `bf4e41d`, 2.0.0 to 2.2.0. The backend's egg phase (B09e) merged: 2.0.1 (the tracking token is random and stored as a hash), 2.1.0 (a price per selling unit, an order line in crates) and 2.2.0 (goods receipts, transfers and reorder rules in crates; `StockUnit.receivedAt`; oldest lot first). **CR-032 and CR-033 did not land**, so `requested/landed.ts` still compiles and both switches stay. CR-035 and CR-036 are not in it.

The sync broke the type check in two fixtures. Three places read a field whose meaning changed, and each is fixed in the sync commit:

- **Receiving a transfer.** A transfer line's `uom` and `qtyDispatched` are now the unit it was entered in, while `qtyReceived` and `varianceQty` stay in the base unit. The receive screen sends the line's `uom` with what arrived, so 18 crates are 18 crates and not 18 eggs. The transfer detail shows the arrival and the variance in `baseUom`.
- **Price list drafts.** An entry names its selling unit. The draft preview keys a line by it, so a crate and a single egg are two lines. `toInput` sends it back when a draft is replaced (never on a `PER_KG` entry, which the contract refuses), so a crate's price stays a crate's. Without this, replacing a draft would have turned a crate's price into a single egg's.
- **The fixtures** carry the new required fields.

Not done, for the egg session: the price list screen shows a quantity break ("from 10") without its unit.

## The owner's answers

### 1. The receipt link carries a token the till makes (CR-033 amended)

CR-033 now says what the owner set out:

- the till makes at least 128 bits from `crypto.getRandomValues`, base64url, about 22 characters;
- it travels with the sale (`OfflineSale.receiptToken`), and the server stores only its hash;
- the link works from the sale's sync, and before then the receipt says so;
- `getPublicReceipt` is `GET /shop/receipts/{token}` and answers 404 for a token it has not been sent;
- the F10 shape's `RECORDING` state and its `saleId` are gone.

The backend is changing CR-033 to match. **Nothing is built until the contract carries it** (owner). The till's present CR-033 switch is for the F10 shape. When the amended request lands, `landed.ts` fails on `receiptLinkTemplate`, and the till and the storefront's receipt page are built to the new shape.

### 2. Error references show their last eight characters (ADR 0051)

- **`formatReference`** (`packages/ui`) takes a reference, leaves out its hyphens, and keeps the last eight characters in two groups of four: `019a7b1d-f4de-751c-aa55-5aa0965fd37e` reads `965f d37e`. It takes the end, not the start.
- **`CopyId`** takes an optional `shown`: what is shown, while the whole value is copied.
- **`ErrorState`'s `referenceCopy`** shows a request reference this way.
  - `QueryBoundaryLabels.referenceCopy`, `FormError` and `TableMessageRow` require it, so no error state can show the whole UUID by leaving it out.
  - A reference a person reads in full (a permission's name on the denied screen, a till store error) is shown whole, as before.
  - A blank reference shows nothing.
- **Inside a sentence**, the console's and the storefront's `RequestReference` do the same:
  - the till's queue and payment alerts;
  - the checkout alerts;
  - the audit event's request reference;
  - the console's own render-error reference;
  - the storefront's route error digest.
- **Proved by:**
  - `format.test.ts`, `CopyId.test.tsx`, `ErrorState.test.tsx` and its type test;
  - the console's `lib.test.tsx`;
  - the integration suites, where every Prism reference is checked in its short form and the whole UUID is checked to be absent;
  - the stories `CopyId/RequestReference` and `ErrorState/WithPlainReference`;
  - the approvals e2e spec, which also finds the copy button.
- The QueryBoundary keyboard path now passes the copy button before "Try again".

## CR-023: the fake is checked against the seed

`packages/api-client` now generates `seededRoles` from `components.x-seeded-roles`. `apps/console/src/test/fakeRoles.test.ts` fails CI when the test fake gives a role a permission the seed does not give it.

There is one exception: a permission the contract names on an operation and no seeded role holds yet. These are the till's `pos.*` (B9b), reports, wholesale statements and the audit log, each listed with its reason. That list fails too once the seed grants one of them. The test also checks the TOTP rule.

**What the check found, and what changed:**

| Role        | Seed                                                                                             | The fake, now                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cashier     | no `inv.stock.read`                                                                              | removed. The Manager keeps it                                                                 |
| Storekeeper | no `inv.stock_take.post` (the Owner's and the Manager's)                                         | removed. The Owner holds it                                                                   |
| Manager     | `ord.void.approve`                                                                               | was `ord.order.void.approve`, the `listRoles` example's name; now `ord.void.approve` (CR-037) |
| Farm hand   | `mdm.reason_code.read`, `mdm.location.read`, `mdm.product.read`, `platform.file.upload.evidence` | already matched                                                                               |

Every other permission the fake holds beyond the seed is in a module the backend has not seeded yet. Two unit tests and two e2e specs sent the Cashier to `/stock`; they now use the Storekeeper.

**The stock take in review now says who posts it.** A Storekeeper used to see no button and no words: now the screen says "The owner or a manager posts this stock take. The counts are saved." The F5 gate spec follows the seed: the Storekeeper counts, finishes and reads the differences, then the Owner signs in and posts.

## CR-029: the storefront opens the cart's own checkout

`CheckoutFlow` takes the open checkout from `Cart.checkoutId` (1.46.0) instead of an id remembered on the device, so a second tab or device with the same cart cookie opens the same checkout. `startCheckout` re-reads the cart. The remembered `hk_checkout` value is gone.

`openCheckoutId` is unit tested. The second-device path cannot be shown against Prism, because every cart example is `ACTIVE` with a null `checkoutId`. That is the question item 3 of the opening message asks to settle in an ADR, and it carries over with that item.

## Moved from the mock to the real API

**None.** B9b is not built, and nothing is deployed.

## Contract requests added or changed

- **CR-033 amended** to the owner's token terms.
- **CR-023:** answered and built (the check above).
- **CR-029:** answered and built.
- **CR-037, new (example fix):** the examples name a void's approval `ord.order.void.approve`, while `voidSale` and the seed say `ord.void.approve`.

## Decisions recorded

- **ADR 0051** (accepted, owner): a request reference shows its last eight characters and copies in full.
- **ADR 0050:** its consequences note the owner's two answers.

## Assumptions

- **Closed:**
  - A-F6-02 and A-F6b-02: the seed gives the Farm hand the reads and the evidence upload.
- **Partly answered:**
  - A-F9-01: the seed now gives the Cashier and the Manager everything but `pos.*`.
- **Still open:**
  - A-F10-04: it now waits for the amended CR-033.
- None new.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                |
| ------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                      |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                      |
| `test:unit`                                                         | 0    | console 280 (was 250), api-client 30, ui 900 (was 892), storefront 34 (was 31), data 28, i18n 6      |
| `test:integration`                                                  | 0    | console 244, storefront 15                                                                           |
| `test:a11y`                                                         | 0    | 322 stories (was 320: CopyId RequestReference, ErrorState WithPlainReference)                        |
| `budget:console`                                                    | 0    | till 246.2 of 250 kB (was 244.9: CopyId through ErrorState); back office 278.5 of 300 kB (was 276.9) |
| `test:e2e`, full run                                                | 0    | 266 of 266 in 5.5 minutes                                                                            |

## For the owner

No new questions. Two things to know:

1. **The receipt link** waits for the backend's amended CR-033. Until then the e2e build's till still shows the F10 link (built from the sale id) behind its switch. No production build can turn that switch on (ADR 0046).
2. **Support now hears eight characters**, for example "965f d37e", or gets the pasted full reference from the copy button. Eight hexadecimal characters are about four billion values, enough to find one request in a day's logs.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10e-contract-2-2-error-references-seeded-roles.md.
Read ADR 0046, 0049 and 0051.

The BUILD_PROMPT's F10 phase (the quote builder, the request-for-quote form, wholesale accounts) still waits
for B9b (owner, 2026-11-16).

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.2.0.
   - If CR-032 or the amended CR-033 landed, requested/landed.ts fails the type check: delete that switch
     and call the generated client. For CR-033, check the contract kept the owner's terms (a till-made
     token of at least 128 bits, base64url; only its hash on the server; the link live from sync, 404
     before), and say so if it did not. Then build the till's link from the token, the receipt's words
     before sync, and the customer's receipt page on the storefront (text, no QR code).
   - fakeRoles.test.ts fails if the seed granted a permission it lists as not seeded: match the seed.
2. The egg screens, in the owner's order (ADR 0049, F10c report): selling in two units first (2.1.0's
   uom on price list entries, price resolution and order lines; the till's pack), then receiving and
   transferring in crates and reorder levels in crates (2.2.0), then bulk buyer prices. CR-035 and
   CR-036 (breakage at the door, the claim) only if the contract carries them. Show a price break's unit.
3. Decide how the storefront's e2e answers a state the contract's examples cannot show (a cart at
   checkout with its checkoutId; the live animal page's contact block; the receipt page), and record it
   in an ADR.
4. If B9b went live, take items 1 to 15 under "Which parts of the gate wait for B9b" in the F10 report
   against the real API.
```
