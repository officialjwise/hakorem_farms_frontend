# 0047. Check the till PIN on the device with PBKDF2, lock out per person, and keep the approving verifier beside the record

- Status: **accepted (owner, 2026-11-17)**, once the three fixes below were built (F10d). The owner set the PIN rules out in the F9 report ("The owner's answers" 3); the F10c report listed where this ADR differed from the owner's four conditions.
- Date: 2026-11-16
- Session: F10

## Context

The owner (2026-11-16): the server issues each operator's PIN as a hash; the till verifies locally and the PIN never authenticates to the server; four to six digits with attempt limits and a lockout; an approval made offline records which PIN approved it and the server checks it at sync. OFFLINE_SYNC section 3 keeps the verifiers in a `local_auth` store, created at an online login on the device and removed at shift close or logout. The contract already carries the approver on an offline mobile money tender (`unverifiedMobileMoney.approvedById`) and on a cash drop (`witnessId`), but not which verifier approved it.

## Options considered

1. **Argon2id** in the browser. The server's choice for passwords, but the browser has no Argon2: a WebAssembly dependency in the till's initial load, which is at 240 of 250 kB.
2. **PBKDF2-HMAC-SHA256 through Web Crypto.** In every browser the till runs in, no dependency. A four to six digit PIN is a million guesses at most whatever the hash; the hash only slows a copied store down, and the controls that matter are the lockout on the device, the server's check at sync, revocation, and the PIN authorising nothing on the server.
3. **A PIN checked by the server.** Needs the network, which is the case the PIN exists for.

## Decision

Option 2, and:

- **The check** (`pos/pin/pin.ts`): PBKDF2 with the verifier's salt and iteration count, the derived bytes compared in constant time. A verifier with any other algorithm matches nothing. Something that is not four to six digits is refused before hashing and costs no attempt.
- **The lockout is per person on this till**, kept in the till's store so a reload, a sign-out or the end of a shift does not reset it. A right PIN clears the count. The limit and how it ends are the owner's (below).
- **The lock**: a cashier with a verifier can lock the till, and it locks itself after the policy's `idleLockSeconds` untouched. Only the shift's cashier's PIN opens it. The sale screen stays mounted underneath, hidden, so a sale under way is not lost; the barcode trap stands down while locked.
- **Approvals**: an offline mobile money tender (only where the pack lists the method offline) and a cash drop's witness need the PIN of someone whose verifier lists that approval. The contract's fields carry who; the verifier version goes on the queue record (`approvals`) and on the queue screen, until CR-032's version fields land.
- **Forgotten** at shift end and sign-out: the verifiers and the lock. The tries, the lockouts and the events the server has not heard stay.

## The owner's conditions (2026-11-17), each enforced

The owner approved this ADR if the PIN is never stored or logged in plain text, is checked offline against a salted slow hash, locks after five wrong tries, and a supervisor's PIN can only sign a locked cashier out, never sell as them. The first held already. The three that did not are built so (`pos/pin/pin.ts`, `pos/offline/till.ts`, `pos/pin/TillLocked.tsx`, `shells/PosShell.tsx`), and CR-032 asks the backend for the same:

1. **A floor on the hash, judged on the device.** PBKDF2-SHA256 through Web Crypto with at least **600,000 iterations**, a salt of at least **16 bytes** per person and a 32-byte hash (`verifierStrength`). A verifier below it is **refused: not stored, never checked**; the till names whose it was in words on every till screen ("weaker than this till accepts"), that person's PIN checks answer `weak-verifier`, and a cashier with none cannot lock the till, so they can only sign in online with a password until the server sends a strong one. Checked again on what is stored, so an earlier build's verifier is held to it too.
2. **At most five wrong tries, with no timer.** The limit is `min(policy.maxAttempts, 5)` (`effectivePolicy`): a lower server limit wins. A lockout has **no end time** and the device clock plays no part (`lockoutSeconds` is gone from the request). It is recorded as a `LOCKED_OUT` event and sent to the server as soon as it can be reached (`reportTillPinEvents`), which answers each verifier with its own `lockedOut`. **It ends only when the till reaches the server and the server's answer says so** (a manager there, or the server's own rule), **or when a supervisor signs the cashier out.** Reaching the server again changes nothing while the server holds it. Online, the lock screen can ask the server ("Check with the server").
3. **Sign-out on a locked till needs a supervisor's PIN.** The header's "Sign out" is gone while the till is locked. The lock screen's "Sign out the cashier" takes the PIN of someone whose verifier lists `SUPERVISOR_SIGN_OUT`, never the cashier's own, checked the same way and counting against the supervisor's own tries. It **only signs the cashier out**: it does not open the till or sell. It is **recorded with who did it and when** (`SUPERVISOR_SIGN_OUT`: the cashier, both verifier versions, the till's time) and sent to the server before the session ends, or kept on the device until the server can be reached. It ends the cashier's lockout. **Without a supervisor's PIN, a locked cashier stays locked.**

Proved by `pin.test.ts` and `till.pin.test.ts` (at the real 600,000 iterations) and by `pos-pin-receipt.spec.ts` against the e2e fake, which keeps lockouts as the server would.

## Consequences

- The till can be locked and opened, and can take a supervisor-approved unverified mobile money tender and a witnessed cash drop, with no network.
- Until CR-032 lands the server cannot check the verifier version at sync; it can check the approver's id and permission.
- A locked-out cashier at a till with no supervisor and no network waits: that is the owner's rule. The sales on the till are kept.
- A till reloaded with no network still does not start (F13): the PIN opens a running till, not a cold one.
- Revisit if the backend issues a different algorithm: the check refuses an unknown one rather than guessing.
