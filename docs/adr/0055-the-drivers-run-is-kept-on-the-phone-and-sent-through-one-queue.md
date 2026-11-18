# 0055. The driver's run is kept on the phone and sent through one queue

- Status: accepted
- Date: 2026-11-18
- Session: F11

## Context

F11's gate is a driver completing a delivery with one bar of signal. The owner's brief adds that the
driver's screens work offline for a whole run, and sync each delivery exactly once when the signal returns.

The contract (2.10.0) gives the driver:

- `getMyRoute` ("small and cacheable for a weak connection") and `getMyDelivery` for each stop;
- `markOnTheWay`, `recordProofOfDelivery` and `recordFailedDelivery`, each "accepted from an offline queue"
  with a client UUIDv7;
- `syncDriverEvents`, which takes a batch of proofs and failures and answers each by its client id
  (`APPLIED`, `APPLIED_WITH_EXCEPTION`, `DUPLICATE`, `REJECTED`);
- `getMyCashSummary`, the cash the driver should hand in.

A proof needs a signature or a photograph, and a photograph is an `uploadFile` before the proof can name
it.

Three questions had to be settled:

1. Which document the driver's screens live in. ADR 0030 has two: the back office and the till.
2. How the run survives no signal.
3. Which of the two write paths the phone uses.

The till answered the same questions in ADR 0043.

## Options considered

1. **A third document, `driver.html`.** The phone would not load the back office's entry, about 25 kB
   gzipped of a 285 kB first load.
   - It touches the shared entry rule, the Vite inputs, the budget script, the deployment rules and the e2e
     entry spec.
   - Another frontend session is editing those files today.
2. **Driver routes in the back office document, in their own full-screen frame, loaded on demand
   (ADR 0032).**
   - Shared-file edits stay small: the route table, the handle's shell kind, the sidebar.
   - The first load is the back office's. It is read once, where there is signal, before the run starts.
3. **Proofs one at a time (`recordProofOfDelivery`) online, the batch only offline.**
   - Two code paths for one record.
   - It raises the same question ADR 0043 met: whether the two share their exactly-once identity.
4. **Every proof and failure through the queue and `syncDriverEvents`.** One path, the one the gate tests.

## Decision

Option 2 for the document, option 4 for the writes.

**The screens.**

- `/driver`, `/driver/cash`, `/driver/stops/:id`, `/driver/stops/:id/delivered` and
  `/driver/stops/:id/not-delivered` belong to the back office document. They sit beside `BackOfficeShell`,
  in `DriverShell`: full screen, no sidebar, large touch targets, light by default like the till (A-F11-02).
- One module, `driver/DriverScreens.tsx`, holds the frame and every driver screen. Opening the run fetches
  all of them, so each opens later with no signal.
- The handle's `shell` gains `'driver'`.

**The store.**

- The store is IndexedDB, database `hakorem-driver`, beside the till's `hakorem-till`, with an in-memory
  twin for unit tests.
- It holds:
  - `records`: the run, each stop's delivery, the failure reasons, the unit names and the cash summary,
    with when they were read;
  - `queue`: what the driver recorded;
  - `photos`: each proof's photograph, as a Blob, until the server has it.
- The screens read only the store, through `useDriverRun()` and `useSyncExternalStore`, as the till does.
  No context, no provider, no library.
- The run and every stop are read when the frame opens and whenever the signal returns. With no signal the
  kept copy stays on screen, and the screen says when it was read.

**The records.**

- "On my way", a proof and a failed attempt are each written to the store first, with a UUIDv7 made once
  when the driver confirmed it. That id is the record's own id and its idempotency key.
- A stop takes one closing record (a proof or a failure) on the phone. A second one is refused there.
- `PhotoInput`'s `upload` keeps the shrunk photograph in `photos` and answers its local id (ADR 0037). The
  component is unchanged.

**One pass at a time sends the queue (`driver/offline/sync.ts`):**

1. each waiting photograph, `uploadFile` with purpose `PROOF_OF_DELIVERY`, its local id as the
   idempotency key, the file id kept once answered;
2. each "on my way", one `markOnTheWay`;
3. proofs and failures in `syncDriverEvents` batches of at most 50.

**How a record moves.**

- A record changes only on an answer: `DUPLICATE` is applied, and `REJECTED` stays on the phone in the
  server's words.
- No answer or a 5xx is a backoff: 5 seconds doubling to 5 minutes, with 20 per cent jitter, and a health
  probe every 30 seconds.
- An ended session stops the queue and keeps it, until the driver signs in again.

**Money.** The phone adds up nothing. The cash screen shows the server's figure, and each collection not
sent yet one by one, never added to it.

## Consequences

- The gate is proved by `e2e/specs/console/driver-offline.spec.ts`:
  - three stops recorded with the network off;
  - a reload while the driver's operations are still out of reach;
  - one bar of signal: Chromium throttled, every third request dropped, and the first sync's answer lost
    after the server applied it;
  - each delivery applied exactly once.
- Unit tests in `driver/offline/sync.test.ts` cover the lost answer, the duplicate, the refusal, the order
  of sends and the ended session.
- The driver's phone loads the back office's first load once, at the depot. A reload with no signal at all
  is F13's service worker, as for the till (ADR 0043).
- A proof's photograph rides in IndexedDB. Clearing the browser's data loses what was not sent; the
  driver variance report would show it.
- Revisit if the driver gets their own installable app, or if the back office's first load grows past what a
  phone on one bar can take at the depot. Option 1 is then the move.
