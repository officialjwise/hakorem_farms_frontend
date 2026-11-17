# F10c: the owner's conditions on ADR 0046 and 0047, eggs decided, breakage requested, CR-027 and CR-028

- **Session:** F10 continued, on branch `claude/quirky-gauss-88ev2l`, from `main` at `878c285` (F10b merged as PR #21).
- **Date:** 2026-11-17
- **Scope:** the F10b report's opening message, with the owner's five decisions of 2026-11-17 on top. The owner's decisions first, then the phase's items as far as this session's context allowed.
- **Not done here:** CR-023 (the fake roles against `x-seeded-roles`), CR-029 (`Cart.checkoutId` on the storefront) and the customer's receipt page (CR-033 item 3). The session stops at a green commit and hands them on (SHARED_BRIEF, "Session protocol"); the opening message below starts there.

## Contract 1.54.0

Synced with `pnpm sync-contract:github`: backend `e722cac`, 1.53.0 to 1.54.0. The client builds against it.

- **Landed:** CR-028 (`getShopProfile`, anonymous). `getBusinessProfile` and `updateBusinessProfile` move into code; `BusinessProfile` gains `whatsapp`, `directions` and `openingHours`. No implemented answer changed.
- **Not landed:** **CR-034** (the server's SKU; the owner says it comes with B09q), **2.0.0** (public ids, the owner's item 4 of F10b), and **the egg units** (the backend's egg phase). CR-032 and CR-033 are still not in the contract.
- So **the CR-034 switch stays**: retiring it against 1.54.0 would send `createProduct` without the `sku` the contract still requires. When B09q's contract is synced, `requested/landed.ts` fails the type check and says to delete it (below).

## The owner's decisions

### 1. A single egg (ADR 0049, accepted)

One product sold in two units, the crate and the egg, with stock held in eggs. Not a separate product, and no crate-breaking screen. The backend's egg phase builds it with a price per selling unit (a crate can cost GHS 55.00). **Nothing was built**: the frontend waits for that contract, with no requested module and no switch.

### 2. ADR 0046, accepted, and each condition enforced

| Condition                                                                      | How it is enforced now                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every switch names its contract request                                        | A switch is a request id (`CR-032`); `CONTRACT_REQUESTS` holds only ids, and an unknown id fails the build. Every `RequestedOperation` carries `request`. Unchanged, already true                                                                                                                                                                                                                                                                                                                  |
| It is deleted when that request lands                                          | **New:** `apps/console/src/requested/landed.ts` checks at type-check time that the generated client still lacks each request (`listTillPinVerifiers`; `receiptLinkTemplate`, `receiptMessage`, `getPublicReceipt`; `ProductCreate` still requiring `sku`). A sync that brings one fails `pnpm typecheck` with "CR-0xx is in the contract now: delete its switch". `switch.test.ts` fails if a switch has no check. Proved by a probe that the check fails for an operation the contract does carry |
| A production build fails if a switch is on for an operation the contract lacks | **New:** `vite.config.ts` calls `assertSwitchesAllowed` before anything is built: with any switch on and `HK_API_BASE_URL` anything but `/mock`, the build (and dev server) stops, naming the switches. Proved: `HK_API_BASE_URL=/api/v1 HK_REQUESTED_CONTRACT=CR-034 vite build` exits 1 with that message. Every switch is for a shape the contract lacks (row 2), so this is the owner's rule                                                                                                   |

ADR 0046, DEPLOYMENT.md section 5 and CLAUDE.md say so.

### 3. ADR 0047: **not accepted**; it differs from the owner's conditions on three points

The owner approved it only if all four hold. Read against the code (`pos/pin/pin.ts`, `pos/offline/till.ts`, `pos/pin/TillLocked.tsx`, `shells/PosShell.tsx`):

| Owner's condition                                                         | Holds?                 | What the code does                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The PIN is never stored or logged in plain text                           | Yes                    | The PIN lives only in the field's state until it is hashed. The till stores the server's verifier (salt, cost, hash), the attempt count and the lock, never the PIN. Nothing in `pos/` logs. The field is `type="password"`, `autoComplete="off"`                                                                   |
| Checked offline against a salted slow hash                                | **No, not guaranteed** | It is checked offline with PBKDF2-SHA256 and the verifier's salt, but the till **accepts whatever iteration count and salt the verifier carries**: a verifier with 1 iteration or an empty salt would be checked as given. The ADR leaves "slow" and "salted" to the server. (The e2e fake uses 10,000 iterations.) |
| Locks after five wrong tries                                              | **No**                 | The limit is the server's `policy.maxAttempts`, not five (the e2e fake uses 3). And the lock is **timed**: after `policy.lockoutSeconds` the person gets a fresh set of tries, judged by the device's clock                                                                                                         |
| A supervisor PIN can only sign the locked cashier out, never sell as them | **Partly**             | A supervisor's PIN can never open the cashier's lock or sell as them: only the shift's cashier's PIN opens it (holds). But **there is no supervisor path at all**: "Sign out" stays in the till's header, and anyone at the counter can sign the locked cashier out **with no PIN**                                 |

To make it hold, for the owner to approve before it is built: (a) refuse, on the device, a verifier below a floor (a 16-byte salt and a minimum iteration count the backend and owner agree, for example OWASP's 600,000 for PBKDF2-SHA256, measured on the shop's cheapest phone first); (b) fix the limit at five wrong tries, whatever the policy says, or ask the backend to fix `maxAttempts` at 5 in CR-032, and decide whether the lock ends with time or only by sign-out; (c) on a locked till, replace the header's sign-out with "Sign out the cashier", which takes a supervisor's PIN (a verifier that approves it, a new `approves` value in CR-032) and does nothing but sign out. Each changes CR-032's shape or the till's behaviour, so none was built.

### 4. The egg screens' order

Written into the opening message below, for their own session after the backend's egg phase merges.

### 5. Breakage reasons: none in the contract, so CR-035 (and CR-036)

- **The real API could not be checked.** This session's network policy refuses `api.staging.hakoremfarms.com` and `api.hakoremfarms.com` (the proxy answers 403), and the VPS deploy is B13. Checked against the contract instead.
- **The contract (1.54.0):** `listReasonCodes` lists one `STOCK_ADJUSTMENT` reason, `COUNT_ERROR`, and no breakage or damage reason for stock. `DAMAGED_IN_DELIVERY` exists only in the `REFUND` domain. Yet `listStockAdjustments`' example posts adjustments with `BREAKAGE` and `RODENT_DAMAGE`, which the reason list does not carry: the seed or the example is wrong. **A goods receipt's rejected quantity carries no reason at all**, and no reason domain covers receiving.
- **CR-035** asks for seeded `BREAKAGE` (and `RODENT_DAMAGE`) stock adjustment reasons, a `GOODS_RECEIPT_REJECTION` domain (`BROKEN_ON_ARRIVAL`, `SHORT_DELIVERED`, `WRONG_ITEM`, `QUALITY_REJECTED`), and `rejectionReasonCode` and `rejectionNote` on the receipt line.
- **CR-036** asks for a claim raised from a receipt's rejected lines (the owner's "with a claim raised from the receipt"): the contract's supplier credit note is raised against an invoice and returns goods on hand, and nothing links it to a receipt or to goods that never entered stock.

## The phase's own work

| Item                                                                           | Done                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CR-028: the shop's phone and WhatsApp on live animal pages (owner, 2026-11-16) | **Yes.** A `REQUEST_TO_BUY` product page reads `getShopProfile` on the server and shows "Call 020 000 0120" (`tel:`) and "WhatsApp 020 000 0121" (`wa.me`, opening WhatsApp, said in its name), two plain links with no script. With no profile (404) it says to call or visit, with no number. Read only on a live animal's page. The footer does not read it yet |
| CR-027: a processing reversal links to its order                               | **Yes.** The approval's detail finds the order with `listProcessingOrders?reversalId=` and links "Open processing order PRC-…"; not found, not loadable, or a role without `prc.order.read` each say so in words. Two e2e specs, one asserting the `reversalId` sent                                                                                               |
| CR-023: fake roles against `x-seeded-roles`                                    | No (next session)                                                                                                                                                                                                                                                                                                                                                  |
| CR-029: `Cart.checkoutId` on the storefront                                    | No (next session)                                                                                                                                                                                                                                                                                                                                                  |
| The customer's receipt page (CR-033 item 3)                                    | No (next session)                                                                                                                                                                                                                                                                                                                                                  |
| 2.0.0, item 4 of F10b                                                          | Not landed; nothing changed                                                                                                                                                                                                                                                                                                                                        |

**Not proved in e2e:** the live animal page's contact block. The storefront's e2e reads Prism directly on the server, and the contract's one `getCatalogueProduct` example is a `LISTED` goat meat pack, so no e2e page is a live animal. The block is proved against the real Prism in `routes.integration.test.tsx` (the profile, and the 404). How the storefront's e2e answers a state the example cannot show is the same decision the receipt page needs (opening message, item 3).

## Moved from the mock to the real API

**None.** B9b is not built; the F10 report's "Which parts of the gate wait for B9b" items 1 to 15 all still wait.

## Contract requests added

- **CR-035:** breakage and damage stock adjustment reasons; a reason for goods rejected on a receipt.
- **CR-036:** a claim raised from a goods receipt's rejected lines.
- The request table now runs to CR-036 with each answered request's version (CR-005, CR-023, CR-026, CR-027, CR-028, CR-029, CR-030).

## Decisions recorded

- **ADR 0046:** accepted (owner), with its three conditions enforced.
- **ADR 0047:** still proposed; marked not accepted, pointing here.
- **ADR 0049** (accepted, owner): eggs are one product sold by the crate and by the egg, stock held in eggs.

## Assumptions

None new.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                                 |
| ------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                                       |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                                       |
| `test:unit`                                                         | 0    | console 240 (was 236: four for ADR 0046's conditions), api-client 30, ui 885, storefront 31 (was 29), data 28, i18n 6 |
| `test:integration`                                                  | 0    | console 244 (the mock's operation count now 636), storefront 15 (was 13)                                              |
| `test:a11y`                                                         | 0    | 314 stories                                                                                                           |
| `budget:console`                                                    | 0    | till 243.5 of 250 kB; back office 276.8 of 300 kB                                                                     |
| `test:e2e`, full run                                                | 0    | 265 of 265 in 5.7 minutes (263 before, plus the two CR-027 specs)                                                     |

## For the owner

1. **ADR 0047** differs from your conditions on three points (section 3): no floor on the hash's cost and salt on the device; the limit is the server's (not five) and the lock ends with time; and anyone can sign a locked cashier out from the header with no PIN. The fixes are proposed there; each changes CR-032 or the till, so say which you want.
2. **The real API.** If staging is up, allowing `api.staging.hakoremfarms.com` in this cloud environment's network settings lets a session check reason codes and B9b against it.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10c-owner-conditions-adr-0046-0047-breakage.md,
with the owner's answers to its "For the owner" if they are there. Read ADR 0046, 0047 and 0049.

The BUILD_PROMPT's F10 phase (the quote builder, the request-for-quote form, wholesale accounts) still waits
for B9b (owner, 2026-11-16).

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 1.54.0.
   - If CR-034 landed (B09q), requested/landed.ts fails the type check: delete
     apps/console/src/requested/serverSku.ts, its line in landed.ts, CR-034 from CONTRACT_REQUESTS in
     switch.ts and from package.json and .github/workflows/ci.yml, enable "Create product" for every build,
     and send createProduct with no sku through the generated client.
   - If 2.0.0 landed, do F10b's item 4 first (no UUID on screen; start with the audit, including the
     till's "Sale id").
   - If CR-035 or CR-036 landed, note it for the egg session.
   - If the owner answered ADR 0047's differences, build what they chose, test first.
2. CR-023: check the fake roles (A-F9-01, A-F6-02, A-F6b-02) against components.x-seeded-roles and close
   the assumptions it answers. CR-029: the storefront finds a cart's open checkout from Cart.checkoutId.
3. The customer's receipt page on the storefront (CR-033 item 3, A-F10-04), link as text, no QR code.
   Decide first how the storefront's e2e answers a requested operation or a state the contract's example
   cannot show (the live animal page's contact block needs the same), and record it in an ADR.
4. If B9b went live, take items 1 to 15 under "Which parts of the gate wait for B9b" in the F10 report
   against the real API.

The egg screens are NOT this session's. They come in their own session, after the backend's egg phase
merges, in this order (owner, 2026-11-17; ADR 0049):
  a. Buying: purchase order screens (createPurchaseOrder, submitPurchaseOrder, sendPurchaseOrder), the
     supplier on the goods receipt (supplierId), and cracked or broken crates rejected on arrival with a
     reason (CR-035), with a claim raised from the receipt (CR-036). Payment needs the purchase order, so
     this comes first.
  b. Selling: the crate and the single egg as two units of one product, stock held in eggs, a price per
     selling unit from the API, at the till and in the shop.
  c. Bulk buyer prices: price lists, quantity breaks counted in crates, and assigning prices to a buyer.
```
