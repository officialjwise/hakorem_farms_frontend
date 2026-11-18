/**
 * Sending the driver's queue (ADR 0055). One pass, `flushDriverQueue`, sends what waits in the order it was
 * recorded:
 *
 * 1. each proof's photograph, with `uploadFile` (purpose `PROOF_OF_DELIVERY`), its own client id as the
 *    idempotency key, so a resend after a lost answer is the same file;
 * 2. "on my way" notices, one `markOnTheWay` each, the record's id as the idempotency key;
 * 3. proofs and failed attempts, in `syncDriverEvents` batches, each carrying the client id the contract asks
 *    for. The server applies each id once and answers a resend `DUPLICATE`.
 *
 * Exactly once is the server's, by those ids: a pass may always be repeated, and a record is only ever
 * marked from an answer. A record the server refused stays, in its words, for a person to see.
 *
 * How a pass ends tells the caller when to try again: no answer, a timeout or a 5xx is backoff; 429 waits;
 * a session that ended stops the queue until the driver signs in again (the queue is kept).
 */
import { ApiError, type ApiClient } from '@hakorem/api-client';
import type { DriverStore } from './store';
import {
  PENDING,
  type DriverEntry,
  type EntryFailure,
  type FailureEntry,
  type ProofEntry,
} from './types';

/** Proofs and failures per `syncDriverEvents` call: a run is tens of stops, so one batch is the usual. */
export const MAX_DRIVER_BATCH = 50;

export type DriverFlushOutcome =
  | { kind: 'done' }
  | { kind: 'unreachable' }
  | { kind: 'rate-limited'; seconds: number }
  | { kind: 'blocked'; failure: EntryFailure };

export interface DriverSyncDeps {
  store: DriverStore;
  call: ApiClient['call'];
  now: () => Date;
}

function failureOf(error: ApiError): EntryFailure {
  return { code: error.code, message: error.message, correlationId: error.correlationId };
}

/** How a refusal ends the pass, or null when it refuses these records only. */
function stopFor(error: unknown): DriverFlushOutcome | null {
  if (!(error instanceof ApiError)) return { kind: 'unreachable' };
  if (error.status === 0 || error.status >= 500) return { kind: 'unreachable' };
  if (error.status === 429) return { kind: 'rate-limited', seconds: error.retryAfter ?? 30 };
  if (error.status === 401) return { kind: 'blocked', failure: failureOf(error) };
  return null;
}

export const isPending = (entry: DriverEntry) => PENDING.includes(entry.localStatus);

/** How many records are still to send. */
export function pendingCount(entries: readonly DriverEntry[]): number {
  return entries.filter(isPending).length;
}

export async function flushDriverQueue(deps: DriverSyncDeps): Promise<DriverFlushOutcome> {
  const { store, call, now } = deps;
  const at = () => now().toISOString();
  const snapshot = await store.read();
  const sending = (entry: DriverEntry): DriverEntry => ({
    ...entry,
    localStatus: 'SENDING',
    attempts: entry.attempts + 1,
    lastAttemptAt: at(),
  });
  const rejected = (entry: DriverEntry, failure: EntryFailure): DriverEntry => ({
    ...entry,
    localStatus: 'REJECTED',
    failure,
    confirmedAt: at(),
  });

  // 1. Photographs, before the proofs that name them.
  const proofs = snapshot.entries.filter(
    (e): e is ProofEntry => e.kind === 'PROOF' && isPending(e),
  );
  for (const entry of proofs) {
    if (entry.photoLocalId === null || entry.payload.photoFileId !== undefined) continue;
    const photo = await store.getPhoto(entry.photoLocalId);
    if (photo === null) {
      await store.putEntries([
        rejected(entry, {
          code: 'PHOTO_MISSING',
          message: 'The photograph is no longer on this phone.',
          correlationId: '',
        }),
      ]);
      continue;
    }
    let fileId = photo.fileId;
    if (fileId === null) {
      try {
        const file = new File([photo.blob], `${photo.id}.jpg`, {
          type: photo.blob.type || 'image/jpeg',
        });
        const stored = await call(
          'uploadFile',
          { body: { file, purpose: 'PROOF_OF_DELIVERY' } },
          { idempotencyKey: photo.id },
        );
        fileId = stored.id;
        await store.putPhoto({ ...photo, fileId });
      } catch (error) {
        const stop = stopFor(error);
        if (stop !== null) return stop;
        await store.putEntries([rejected(entry, failureOf(error as ApiError))]);
        continue;
      }
    }
    await store.putEntries([{ ...entry, payload: { ...entry.payload, photoFileId: fileId } }]);
  }

  // 2. "On my way", one at a time, before the proof of the same stop.
  for (const entry of (await store.read()).entries) {
    if (entry.kind !== 'ON_THE_WAY' || !isPending(entry)) continue;
    const out = sending(entry);
    await store.putEntries([out]);
    try {
      await call(
        'markOnTheWay',
        { path: { id: entry.deliveryId }, body: entry.payload },
        { idempotencyKey: entry.id },
      );
      await store.putEntries([
        { ...out, localStatus: 'APPLIED', serverOutcome: 'APPLIED', confirmedAt: at() },
      ]);
    } catch (error) {
      const stop = stopFor(error);
      if (stop !== null) {
        await store.putEntries([{ ...out, localStatus: 'QUEUED' }]);
        return stop;
      }
      await store.putEntries([rejected(out, failureOf(error as ApiError))]);
    }
  }

  // 3. Proofs and failures, in batches, by their client ids.
  for (;;) {
    const ready = (await store.read()).entries
      .filter(
        (e): e is ProofEntry | FailureEntry =>
          isPending(e) &&
          (e.kind === 'FAILURE' ||
            (e.kind === 'PROOF' &&
              (e.photoLocalId === null || e.payload.photoFileId !== undefined))),
      )
      .slice(0, MAX_DRIVER_BATCH);
    if (ready.length === 0) return { kind: 'done' };
    const out = ready.map(sending) as (ProofEntry | FailureEntry)[];
    await store.putEntries(out);
    const body = {
      proofs: out
        .filter((e): e is ProofEntry => e.kind === 'PROOF')
        .map((e) => ({ deliveryId: e.deliveryId, proof: e.payload })),
      failures: out
        .filter((e): e is FailureEntry => e.kind === 'FAILURE')
        .map((e) => ({ deliveryId: e.deliveryId, failure: e.payload })),
    };
    let result;
    try {
      result = await call('syncDriverEvents', { body });
    } catch (error) {
      const stop = stopFor(error);
      await store.putEntries(out.map((e) => ({ ...e, localStatus: 'QUEUED' as const })));
      if (stop !== null) return stop;
      // A refusal of the whole batch (400, 403, 422): each record keeps the server's words.
      await store.putEntries(out.map((e) => rejected(e, failureOf(error as ApiError))));
      continue;
    }
    const byId = new Map(result.results.map((r) => [r.clientId, r]));
    const answered: DriverEntry[] = out.map((entry) => {
      const item = byId.get(entry.id);
      // Not in the answer: the server said nothing about it, so it waits for the next pass.
      if (item === undefined) return { ...entry, localStatus: 'QUEUED' };
      const common = { serverOutcome: item.outcome, serverReason: item.reason, confirmedAt: at() };
      return item.outcome === 'REJECTED'
        ? {
            ...entry,
            ...common,
            localStatus: 'REJECTED',
            failure: {
              code: 'REJECTED',
              message: item.reason ?? 'The server refused it.',
              correlationId: '',
            },
          }
        : { ...entry, ...common, localStatus: 'APPLIED', failure: null };
    });
    await store.putEntries(answered);
    // A record the server left out is tried again next pass, not in a loop now.
    if (answered.some((e) => e.localStatus === 'QUEUED')) return { kind: 'unreachable' };
  }
}

/** 5 s doubling to 5 minutes, with 20 percent jitter either way (as the till waits, OFFLINE_SYNC 6.4). */
export function driverBackoffMs(attempt: number, random: number): number {
  const base = Math.min(5000 * 2 ** Math.max(0, attempt), 300_000);
  return base * (0.8 + 0.4 * random);
}
