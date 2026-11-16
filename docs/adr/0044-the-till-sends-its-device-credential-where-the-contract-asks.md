# 0044. The till sends its device credential where the contract asks, and keeps it in its own store

- Status: accepted
- Date: 2026-11-16
- Session: F9

## Context

Eight operations name the `deviceCredential` security scheme beside the staff session: `openShift`, `recordCashMovement`, `closeShift`, `holdSale`, `recallHeldSale`, `getOfflinePack`, `completeCounterSale` and `syncOfflineSales`. The scheme is a header, `X-Device-Credential`, holding the credential `enrolDevice` shows once (`DeviceEnrolled.deviceCredential`). The backend's `docs/OFFLINE_SYNC.md` (section 3) says it is stored on the device, sent with the cashier's session, revocable by a manager at any moment, and authorises nothing on its own.

The generated client (ADR 0018) knew the session's cookie and the CSRF token, but not this header: nothing in its operation table said which operations want it.

## Options considered

1. **Each till screen adds the header itself.** The client has no per-call header option, and adding one would let any screen send anything. Refused.
2. **A fixed header on the till's client** (`ApiClientOptions.headers`). It would send the credential to every operation, including ones that do not ask for it, and it is fixed when the client is made, before the till is enrolled.
3. **The operation table says it, and the session hooks supply it.** The generator marks each row whose security names `deviceCredential` (`device: true`). The client asks `SessionHooks.getDeviceCredential()` for the value when it sends one of those, and sends nothing when the hook is absent or returns null.

## Decision

Option 3.

- `packages/api-client/scripts/generate.ts` writes `device: boolean` on every row of `operationManifest`. Today eight rows are true.
- `SessionHooks.getDeviceCredential?: () => string | null`. `client.ts` sends `X-Device-Credential` on a `device` row when it returns a value, and on no other row.
- The console's session hooks read it from the till's store (`apps/console/src/pos/offline`), in IndexedDB beside the device id and register (OFFLINE_SYNC section 3, the `device` store). It is held in memory only while the till document runs; the back office document never loads it, so the back office never sends it.
- Enrolment is the one moment the credential is seen. The till stores it without showing it on screen, and never writes it to the console, a log or the audit trail.

## Consequences

- A contract change that adds or removes `deviceCredential` from an operation reaches the till by regenerating the client, with no screen change.
- A browser has no hardware-backed store, so the credential is only as safe as the till's browser profile. The controls are the backend's: revocation, the PIN lock, and a staff session always required too (OFFLINE_SYNC section 3).
- The e2e fake and Prism see the header like any other. Prism checks the scheme is present; neither checks the value, so revocation (`DEVICE_REVOKED`) is proved against the real API only.
