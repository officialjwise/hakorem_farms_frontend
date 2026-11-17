# F10d: contract 2.0.0, public ids, text-only labels, and the owner's PIN conditions (ADR 0047 accepted)

- **Session:** F10 continued, on branch `claude/quirky-wright-bz9kxv`, from `main` at `aea09a0` (F10c merged as PR #22).
- **Date:** 2026-11-17
- **Scope:** the F10c report's opening message, with the owner's four decisions of 2026-11-17 on top. The owner's decisions were done first.
- **Not done here:** CR-023 (the fake roles against `x-seeded-roles`), CR-029 (`Cart.checkoutId` on the storefront) and the customer's receipt page (CR-033 item 3). They carry over to the opening message below.

## Contract 2.0.0 (BREAKING, approved by the owner)

Synced with `pnpm sync-contract:github`: backend `edec540`, 1.54.0 to 2.0.0. The sync broke the console type check in seven places, as expected. Each is fixed in the sync commit:

- **No product barcode.** It is gone from `Product`, `ProductCreate`, `ProductUpdate`, the label data and `OfflineProduct`. The product screen loses its barcode fact and field, the new product form loses its field, and product search is by name or SKU.
- **The SKU is the server's (CR-034 landed).** `createProduct` sends no `sku` through the generated client in every build. The CR-034 switch is gone everywhere: `requested/serverSku.ts`, its landed check, its id in `switch.ts`, `package.json` and CI, and the e2e fake's server-filled SKU. "Create product" is no longer disabled in a build for the real API. A-F10-05 is closed. `FIELD_SERVER_ASSIGNED` now has words.
- **Public ids.** `customerNo` and `supplierNo` became `publicId` (`cus_…`, `sup_…`).
- **The examples changed.** SKUs are now `LIV-0004`, `EGG-0003` and so on, so the integration and e2e tests follow them.
- **Unchanged:** the meat pack labels, barcode included.
- **Not landed:** CR-032, CR-033, CR-035, CR-036, and the egg units.

## The owner's decisions

### 1. ADR 0047: the three fixes are built, and the ADR is accepted

| Owner's condition                                                                                                                             | How it is enforced now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PBKDF2-SHA256, at least 600,000 iterations, a salt of at least 16 bytes; anything weaker is refused and said so                               | `verifierStrength` also checks for a 32-byte hash. A weak verifier is never stored (only the name is kept, in `localAuth.refused`) and never checked: the outcome is `weak-verifier`. Every till screen shows a warning naming the people refused. A cashier with no accepted verifier cannot lock the till, so they can only sign in online. Stored verifiers are checked against the floor again                                                                                                                            |
| At most five wrong tries, and a lower server limit wins                                                                                       | `effectivePolicy`: `min(maxAttempts, 5)`, and at least 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Offline, the lockout never ends on a timer. It ends only when the till reaches the server, or when a supervisor signs the cashier out         | `lockoutSeconds` is removed, and a lockout has no time. A lockout is recorded as a `LOCKED_OUT` event and sent as soon as the server can be reached. **It ends only when the server's answer says `lockedOut: false`, or on a supervisor's sign-out.** Reaching the server while the server still holds the lockout changes nothing. The lockout survives a reload, a sign-out and the end of the shift. Online, the lock screen has a "Check with the server" button                                                         |
| Sign-out needs a supervisor's PIN, checked the same way, and is recorded with who did it and when. Without one, a locked cashier stays locked | While the till is locked, the header has no "Sign out". The lock screen's "Sign out the cashier" takes the PIN of someone whose verifier lists `SUPERVISOR_SIGN_OUT`. The cashier is never offered, and wrong tries count against the supervisor. It only signs the cashier out: it never opens the till. It is recorded as `SUPERVISOR_SIGN_OUT` (both people, both verifier versions, the time) and sent before the session ends, or kept on the till. With no supervisor on the till, it says so and the till stays locked |

**CR-032 is amended to the same terms**, for the backend:

- the floor;
- `maxAttempts` at most 5, and no `lockoutSeconds`;
- `PinVerifier.lockedOut`;
- `reportTillPinEvents` (`POST /registers/{id}/pin-events`), answered with the verifiers as they now stand;
- the `SUPERVISOR_SIGN_OUT` approval.

`landed.ts` checks both of CR-032's operations.

**How it is proved:**

- `pin.test.ts` and `till.pin.test.ts` run at the real 600,000 iterations. They cover a year on the device clock, the lower limit, the server ending a lockout, a lockout surviving the end of a shift, refused verifiers, and a supervisor's sign-out with and without the network.
- `pos-pin-receipt.spec.ts` has two new e2e specs. One locks the cashier out, shows the lockout surviving ten minutes and a reload, shows the server still holding it, then has a supervisor sign the cashier out (one wrong PIN first) and checks what was recorded. The other shows a refused verifier.
- The e2e fake issues verifiers at the floor and keeps lockouts the way the server would.

### 2. Staging: none exists yet

No host was added. The API is not deployed until the launch phase.

### 3. CR-035 and CR-036 go to the backend's egg phase, B09e

Both requests now say so. They will arrive through the contract, and nothing is built before then.

### 4. Public ids and text-only labels

**No UUID on screen.** The audit covered every id a screen shows or prints, and found:

- the till receipt's "Sale id", on screen and printed;
- the payment id a cleared mobile money tender fell back to;
- the order id and original document id a billing document fell back to;
- the archive's template version id;
- the audit event's record id and branch id;
- the reprint file name falling back to a document id.

Each is removed or replaced with words. The sale reference stays on the receipt. Ids stay in addresses, keys and query parameters, where they are not shown.

**SKUs and public ids** (ADR 0050):

- **`CopyId`** is a new component in `packages/ui`. It shows the id in the monospace face, wrapping at 360 px, with a copy button that says "Copied" or why it could not. It has six stories, unit tests and a type test.
- **On detail screens**, `ReadableId` (the console's wrapper) shows:
  - a product's SKU;
  - a customer's public id on statements and billing documents;
  - a supplier's public id on a goods receipt, an animal and the supplier list.
- **Beside the name, as plain text**, the SKU is shown on stock lines, the stock take, transfers, processing inputs and outputs, price list entries and returns. The supplier filter shows the public id.
- **Search** takes both. The customer and supplier searches say they take a public id, because `listCustomers` and `listSuppliers` accept one in `q` in 2.0.0. Product search takes a name or a SKU.

**Labels print text only (CR-016 closed).** The Code 128 drawing is gone from `/labels`. Each label prints the name, the SKU (or a lot's batch or an animal's tag) in the monospace face, and its facts. The meat pack label screen is unchanged, barcode included.

## Moved from the mock to the real API

**None.** B9b is not built, and nothing is deployed.

## Contract requests added or changed

- **CR-032 amended**, as above.
- **CR-034** is answered (2.0.0) and built.
- **CR-016** is closed (labels print text).
- **CR-035 and CR-036** go to the backend's B09e.
- No new request.

## Decisions recorded

- **ADR 0047:** accepted (owner). It records the three conditions and how each is enforced.
- **ADR 0050** (accepted, owner): readable ids are shown with a copy button, and never a UUID.
- **ADR 0046:** CR-034 is gone from its build list.

## Assumptions

- **Closed:** A-F10-05 (CR-034 landed).
- None new.

## Gates, each run on its own

| Check                                                               | Exit | Count                                                                                                        |
| ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| `format:check`, `lint`, `typecheck`                                 | 0    |                                                                                                              |
| `tokens:check`, `fonts:check`, `icons:check`, `sync-contract:check` | 0    |                                                                                                              |
| `test:unit`                                                         | 0    | console 250 (was 240), api-client 30, ui 892 (was 885: CopyId), storefront 31, data 28, i18n 6               |
| `test:integration`                                                  | 0    | console 244, storefront 15                                                                                   |
| `test:a11y`                                                         | 0    | 320 stories (was 314: CopyId's six)                                                                          |
| `budget:console`                                                    | 0    | till 244.9 of 250 kB (was 243.5); back office 276.9 of 300 kB                                                |
| `test:e2e`, full run                                                | 0    | 266 of 266 in 5.9 minutes (265 before: the lockout spec rewritten as the sign-out spec, plus the floor spec) |

## For the owner

1. **The digital receipt link still carries a UUID.** CR-033 builds it from the sale's client id (`https://hakoremfarms.com/r/{saleId}`), and you asked for the link to be printed in full as text. So the receipt prints a 36-character UUID inside an address. The alternatives are a shorter token from the server (a change to CR-033), or keeping it as it is: it is an address, and it is what makes the link work offline. Which do you want?
2. **Error states show a request reference** (`correlationId`, a UUID) so support can find the request in the logs. This happens across the console and the storefront. Should these stay, as the one exception to "no UUID on screen", or be hidden, or be shortened?
3. **The till has no PIN until CR-032 lands.** A locked-out cashier at a till with no supervisor and no network waits, as you decided. The sales on the till are kept.

## Opening message for the next session

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md and docs/sessions/F10d-contract-2-public-ids-and-the-pin-conditions.md,
with the owner's answers to its "For the owner" if they are there. Read ADR 0046, 0047, 0049 and 0050.

The BUILD_PROMPT's F10 phase (the quote builder, the request-for-quote form, wholesale accounts) still waits
for B9b (owner, 2026-11-16).

1. pnpm sync-contract:github and read .contract-upstream/CONTRACT_CHANGELOG.md after 2.0.0.
   - If CR-032 or CR-033 landed, requested/landed.ts fails the type check: delete that switch and call
     the generated client (CR-032 now includes reportTillPinEvents, lockedOut, SUPERVISOR_SIGN_OUT and the
     hash floor; check the contract kept the owner's terms, and say so if it did not).
   - If the backend's egg phase (B09e) merged, with CR-035 and CR-036, the egg screens come in their own
     session in the owner's order (ADR 0049; F10c report), not this one.
   - If the owner answered F10d's questions 1 and 2, build what they chose.
2. CR-023: check the fake roles (A-F9-01, A-F6-02, A-F6b-02) against components.x-seeded-roles and close
   the assumptions it answers. CR-029: the storefront finds a cart's open checkout from Cart.checkoutId.
3. The customer's receipt page on the storefront (CR-033 item 3, A-F10-04), link as text, no QR code.
   Decide first how the storefront's e2e answers a requested operation or a state the contract's example
   cannot show (the live animal page's contact block needs the same), and record it in an ADR.
4. If B9b went live, take items 1 to 15 under "Which parts of the gate wait for B9b" in the F10 report
   against the real API.
```
