# 0043. Every till sale goes through the offline queue, kept in IndexedDB, read through one till store

- Status: accepted; the receipt bullet amended by 0045 (owner, 2026-11-16)
- Date: 2026-11-16
- Session: F9

## Context

F9's gate is a full sale with the network off that syncs exactly once on reconnect. The rules are the backend's `docs/OFFLINE_SYNC.md` (read at backend `3a74d76`): client UUIDv7 ids, a gap-free device counter per shift, a provisional reference, a SHA-256 payload hash over the canonical sale, an IndexedDB queue in dependency order, batches of at most 500, backoff, and the server always authoritative. The contract offers two ways to record a counter sale: `completeCounterSale` (one sale, online, answers with the official receipt and its ESC/POS bytes) and `syncOfflineSales` (a batch from the queue, official numbers allocated there).

The till is one document (ADR 0030) whose shell and sale screen share state: the barcode bar lives in the shell (ADR 0014), the cart under it. CLAUDE.md treats a new context or provider as a question for the owner.

## Options considered

1. **Online sales through `completeCounterSale`, offline sales through the queue.** The official receipt at once when online. But a sale whose request is cut off mid-flight is in neither state: retrying it through the queue is a second endpoint for the same id, and the contract does not say the two share their exactly-once identity. Two code paths, one of them used only when things go wrong.
2. **Every sale through the queue.** The sale is written to IndexedDB with its counter, hash and receipt before anything is sent, then the queue is sent at once. Online, the official number arrives within a request; offline, it waits. One path, the one the gate tests, used on every sale.
3. **A state library or a React context for the till.** A context needs a provider above both the shell and the screens, which is the new pattern CLAUDE.md asks about; a library is a dependency for one store.

## Decision

Option 2, read through a module-level store.

- **The store** (`apps/console/src/pos/offline/store.ts`) is IndexedDB, database `hakorem-till`, with the backend's stores: `records` (the device, the pack, the shift, bookkeeping), `queue` (each record with its provisional receipt, which is the backend's `receipts` store kept on the same record because they live and die together), `held` and `sync_log`. No library: the standard API behind a small interface, with an in-memory twin for unit tests. A completed sale's counter increment and queue record are one transaction, refused if another window took the counter.
- **The arithmetic** (`cart.ts`) is the backend's ADR-0001 ported: integer pesewas in `bigint`, half-up once per line, the total the sum of line integers, with its own exact-pesewa tests. The till's agreed-price limits are the pack's cached policy.
- **The hash** (`payloadHash.ts`) is RFC 8785 canonical JSON and SHA-256 through Web Crypto.
- **Sending** (`sync.ts`) is one pass at a time: a shift opened on the till first (`openShift`, alone), then the shift's sales and cash movements in `syncOfflineSales` batches of 500 in counter order. Each record changes only on an answer. No answer or a 5xx is a backoff (5 s doubling to 5 min, 20 percent jitter) with a health probe every 30 s; 429 waits; an ended session or a revoked device stops the queue and keeps it; another 4xx marks the records for a manager. After a sync, each sale's order is read (`getOrder`) and a total that differs from the till's is flagged, never absorbed (CR-031 asks for the total on the sync result instead).
- **The till store** (`till.ts`) is one object per till document, read with `useTill()` through `useSyncExternalStore`, as `useOnlineStatus` reads the browser. No context, no provider, no library.
- **The receipt** is printed by the till from its own record, for an 80 mm roll through the browser's print (the receipt printer is the till's printer). The API's ESC/POS bytes, which `completeCounterSale` and a `THERMAL` reprint return, are not sent to a printer from the browser in this phase.
- **Offline within a session.** The till's on-demand screens are fetched once the till is ready, so a till that goes offline can still open them. Starting the till with no network (a reload offline) is F13's service worker and the PIN unlock in OFFLINE_SYNC section 3.

## Consequences

- One path for every sale, proved by the e2e gate with the network off and by unit tests for the lost answer, the duplicate, the refusal and the 501-sale queue.
- Online, the customer's paper receipt carries the provisional reference, and the official number shows on screen as soon as the sync answers; a reprint after sync carries both. If the owner wants the official number printed on every online sale, the till would print after the sync answers rather than at completion.
- IndexedDB is only as durable as the browser profile. Clearing site data loses the queue; the counter gap and the blind count show it on the server.
- What needs the real API to prove: the server's exactly-once by id (Prism keeps no state), the shift sequence, counter gaps, `REJECTED_INTEGRITY` on a real hash mismatch, revocation, and the stock exceptions of OFFLINE_SYNC section 9.
