# 0047. Check the till PIN on the device with PBKDF2, lock out per person, and keep the approving verifier beside the record

- Status: proposed (the owner set the PIN rules out, F9 report "The owner's answers" 3; the mechanism here is this session's, against CR-032). **Not accepted (2026-11-17):** the owner approved it only if it meets four conditions, and it differs on three; the differences are listed in `docs/sessions/F10c-owner-conditions-adr-0046-0047-breakage.md`, "ADR 0047".
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
- **The lockout is per person on this till**: the policy's `maxAttempts` wrong PINs in a row lock that person out for `lockoutSeconds`, kept in the till's store so a reload does not reset it. A right PIN clears the count. A locked-out cashier signs out; the queue stays.
- **The lock**: a cashier with a verifier can lock the till, and it locks itself after the policy's `idleLockSeconds` untouched. Only the shift's cashier's PIN opens it. The sale screen stays mounted underneath, hidden, so a sale under way is not lost; the barcode trap stands down while locked.
- **Approvals**: an offline mobile money tender (only where the pack lists the method offline) and a cash drop's witness need the PIN of someone whose verifier lists that approval. The contract's fields carry who; the verifier version goes on the queue record (`approvals`) and on the queue screen, until CR-032's version fields land.
- **Forgotten** at shift end and sign-out, with the attempts and the lock.

## Consequences

- The till can be locked and opened, and can take a supervisor-approved unverified mobile money tender and a witnessed cash drop, with no network.
- Until CR-032 lands the server cannot check the verifier version at sync; it can check the approver's id and permission.
- A till reloaded with no network still does not start (F13): the PIN opens a running till, not a cold one.
- Revisit if the backend issues a different algorithm: the check refuses an unknown one rather than guessing.
