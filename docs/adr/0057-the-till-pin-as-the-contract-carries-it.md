# 0057. The till PIN as 2.17.0 carries it: the till sets the PIN, reports every try, and a lock ends only with a new PIN

- Status: accepted
- Date: 2026-11-22
- Session: F10n
- Builds on ADR 0047 (the PIN checked on the device with PBKDF2, the owner's conditions), which stands. Replaces ADR 0046's switch for CR-032 and CR-050, which landed in 2.17.0.

## Context

The till's PIN was built against CR-032 as the frontend asked for it (ADR 0046, ADR 0047). 2.17.0 carries it with a different shape and three different rules:

1. **The person's own till sets the PIN.** `setTillPin` takes the verifier the till derived (PBKDF2-SHA256, 600,000 to 10,000,000 iterations, a 16 to 64-byte salt, a 32-byte hash), never the PIN. The request had the server issue it.
2. **Every try is reported**, right or wrong, with its purpose (`reportTillPinEvents`: `UNLOCK`, `APPROVAL`, `WITNESS`, `SIGN_OUT`). Five wrong tries against a PIN version lock it on every till, and a right try wipes nothing. The request reported only lockouts, per till.
3. **A lock ends only when its owner sets a new PIN** (`policy.lockedUntil` `NEW_PIN_SET`). A supervisor's sign-out is taken only for a cashier the server holds locked (`CASHIER_NOT_LOCKED`), and it does not end the lock. In the request, a sign-out ended it, and so could the server.

A verifier now names a role (`OPERATOR`, `SUPERVISOR`), not a list of approvals. A locked PIN comes with no salt or hash. The policy carries no PIN length and no idle time. A witnessed drop carries `witnessPinVersion`, and offline mobile money `approvedByPinVersion`.

## Options considered

1. **Keep the requested model on the till and translate at the edge.** The till would keep counting per till and clearing on a right PIN. The server would then disagree about who is locked, and a PIN the server had locked could still open the till.
2. **Follow the contract's rules on the till, keeping ADR 0047's owner conditions.** The till's own view of a verifier is made from the contract's `TillPinVerifier`, and the rules are the server's.

## Decision

Option 2.

**The verifier (`pos/pin/pin.ts`).**

- `fromContract` makes the till's view of a `TillPinVerifier`. A `SUPERVISOR` approves offline mobile money, witnesses a drop and signs a locked cashier out. An `OPERATOR` only opens the till.
- A locked PIN, sent with no material, is kept as locked, not refused as weak.
- ADR 0047's floor still refuses a weaker verifier: it is not stored, never checked, and the person is named.

**The tries (`pos/offline/till.ts`).**

- Every check makes a `TillPinEvent` with its own UUIDv7, kept in the till's store.
- Each check is reported at once where the server can be reached. The sync pass reports first, before the queue, so the sales' and drops' approvals are checked against the tries (as `reportTillPinEvents` asks).
- Batches are at most 500 tries and 50 sign-outs. A sign-out goes only once every try before it has been told.
- A person's count is the server's `wrongTries` against the version it sent, plus this till's wrong tries against that version not yet told. The PIN is locked when the server says so or the count reaches the limit.
- The limit is the server's, at most five (ADR 0047).

**The lock.**

- A locked PIN cannot open or lock the till.
- On a locked till, once the cashier's PIN is locked, a supervisor's PIN signs the cashier out. Only then: before it, the server would refuse the sign-out. The cashier's PIN stays locked.
- The lock ends when a new version arrives with no tries against it.
- ADR 0047's conditions hold: no timer, no plain sign-out on a locked till, a supervisor never sells as the cashier.

**Setting a PIN (`pos/pin/SetTillPin.tsx`).**

- "Set my till PIN" (or "Change my till PIN") sits in the till's header for holders of `pos.pin.set`, online, never on a locked till. A PIN set there would open the till for whoever stood at it.
- The PIN is typed twice and checked for four to six digits.
- The till derives the verifier: a fresh 16-byte salt from `crypto.getRandomValues`, 600,000 iterations. It sends only that, with one idempotency key for each time the dialog opens, then reads the verifiers again, so the new PIN works at once.
- The dialog loads on demand, like the lock screen.

**What the contract does not carry** (A-F10-14): the PIN's length (four to six digits, the owner's) and the idle lock (120 seconds) are the till's own constants.

**The approvals' versions.** A witnessed drop sends `witnessPinVersion` and offline mobile money sends `approvedByPinVersion`, both from the PIN that was checked.

**Who can witness a drop now** is `listShiftWitnesses` through `useApiQuery`. `witness.ts`'s rule is unchanged.

## Consequences

- The till and the server agree on who is locked, on every till. A cashier locked out at a till with no network stays locked until they sign in online and set a new PIN. This is stricter than ADR 0047's "a supervisor's sign-out ends it", and it is the contract's rule.
- Every PIN try reaches the server, the right ones too. It carries the person, the version, the outcome and the purpose, never the PIN.
- Not built yet: `overrideApproval` on an offline sale line (a supervisor's PIN approving a price beyond the cashier's limit, 2.17.0), and its per-supervisor limit (`priceOverrideLimitPerLinePesewas`). The till still keeps an offline price inside the cashier's own limits.
- Revisit if the contract carries the PIN length or the idle time: the constants then go.
