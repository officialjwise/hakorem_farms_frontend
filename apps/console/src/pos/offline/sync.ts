/**
 * Sending the queue (OFFLINE_SYNC.md sections 6 and 7). One pass, `flushQueue`, sends what is waiting in
 * dependency order and records what the server said about each record:
 *
 * 1. a shift opened on the till (`openShift`, alone, with its own id as the idempotency key);
 * 2. that shift's sales and cash movements, in one `syncOfflineSales` batch of at most 500 sales, in
 *    ascending device counter, again and again until none is left;
 * 3. the server's total for each sale it took, read back from its order (`getOrder`), so a difference from
 *    the till's total is flagged to a person and never absorbed;
 * 4. records the server confirmed more than 24 hours ago are removed (a reprint is possible until then).
 *
 * Exactly once is the server's: it applies each sale once by its client id and answers a resend with
 * `DUPLICATE` and the first result (section 9.7). So a pass may always be repeated, and a record is only
 * ever marked from an answer. A record is never deleted because the server refused it.
 *
 * What a pass ends with tells the caller when to try again (section 6.4): no answer or a 5xx is backoff;
 * 429 waits for `Retry-After`; an expired session or a revoked device stops the queue until a person acts;
 * any other 4xx marks the records `FAILED_PERMANENT` for a manager, and the pass goes on.
 */
import { ApiError, type ApiClient } from '@hakorem/api-client';
import type { TillStore } from './store';
import {
  CONFIRMED_STATUSES,
  PENDING_STATUSES,
  type EntryFailure,
  type QueueEntry,
  type SaleEntry,
  type TillSnapshot,
} from './types';

export const MAX_BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type FlushOutcome =
  /** Nothing is left to send (some records may need a person). */
  | { kind: 'done' }
  /** No answer, a timeout or a 5xx: try again after a backoff. */
  | { kind: 'unreachable' }
  /** 429: try again after this many seconds. */
  | { kind: 'rate-limited'; seconds: number }
  /** The queue stops until a person acts: the session ended (401) or the device was revoked (403). */
  | { kind: 'blocked'; failure: EntryFailure };

export interface SyncDeps {
  store: TillStore;
  call: ApiClient['call'];
  now: () => Date;
}

const STOPPING_CODES = new Set(['DEVICE_REVOKED', 'DEVICE_CREDENTIAL_INVALID']);

function failureOf(error: ApiError): EntryFailure {
  return { code: error.code, message: error.message, correlationId: error.correlationId };
}

/** How a refused request ends the pass, or null when it is a refusal of these records only. */
function stopFor(error: unknown): FlushOutcome | null {
  if (!(error instanceof ApiError)) return { kind: 'unreachable' };
  if (error.status === 0 || error.status >= 500) return { kind: 'unreachable' };
  if (error.status === 429) return { kind: 'rate-limited', seconds: error.retryAfter ?? 30 };
  if (error.status === 401 || STOPPING_CODES.has(error.code)) {
    return { kind: 'blocked', failure: failureOf(error) };
  }
  return null;
}

const isPending = (entry: QueueEntry) => PENDING_STATUSES.includes(entry.localStatus);

export async function flushQueue(deps: SyncDeps): Promise<FlushOutcome> {
  const { store, call, now } = deps;
  let snapshot = await store.read();
  const device = snapshot.device;
  if (device === null) return { kind: 'done' };

  const at = () => now().toISOString();
  const reached = async () => {
    const meta = (await store.read()).meta;
    await store.saveMeta({ ...meta, lastReachedServerAt: at() });
  };
  const mark = (entries: QueueEntry[], change: Partial<QueueEntry>) =>
    store.putEntries(entries.map((entry) => ({ ...entry, ...change }) as QueueEntry));

  // 1. Shifts opened on the till, alone and first.
  for (const entry of snapshot.entries) {
    if (entry.kind !== 'SHIFT_OPEN' || !isPending(entry)) continue;
    const sending = {
      ...entry,
      localStatus: 'SENDING' as const,
      attempts: entry.attempts + 1,
      lastAttemptAt: at(),
    };
    await store.putEntries([sending]);
    try {
      const shift = await call(
        'openShift',
        { body: entry.payload },
        { idempotencyKey: entry.payload.id },
      );
      await reached();
      await store.putEntries([
        {
          ...sending,
          localStatus: 'APPLIED',
          serverResult: shift,
          confirmedAt: at(),
          failure: null,
        },
      ]);
      const current = (await store.read()).shift;
      if (current !== null && current.id === shift.id) {
        await store.saveShift({
          ...current,
          shiftSeq: shift.shiftSeq,
          shiftNo: shift.shiftNo,
          confirmed: true,
        });
      }
      const meta = (await store.read()).meta;
      await store.saveMeta({ ...meta, lastShiftSeq: shift.shiftSeq });
    } catch (error) {
      const stop = stopFor(error);
      if (stop !== null) {
        await store.putEntries([{ ...sending, localStatus: 'QUEUED' }]);
        return stop;
      }
      await reached();
      await store.putEntries([
        { ...sending, localStatus: 'FAILED_PERMANENT', failure: failureOf(error as ApiError) },
      ]);
    }
  }

  // 2. Each shift's sales and cash movements, once its open has reached the server.
  for (;;) {
    snapshot = await store.read();
    const opening = new Map(
      snapshot.entries
        .filter((e) => e.kind === 'SHIFT_OPEN')
        .map((e) => [e.shiftId, e.localStatus]),
    );
    const sendable = snapshot.entries.filter((entry) => {
      if (entry.kind === 'SHIFT_OPEN' || !isPending(entry)) return false;
      const open = opening.get(entry.shiftId);
      return open === undefined || CONFIRMED_STATUSES.includes(open);
    });
    if (sendable.length === 0) break;
    const shiftId = sendable[0]?.shiftId ?? '';
    const sales = sendable
      .filter((e): e is SaleEntry => e.kind === 'SALE' && e.shiftId === shiftId)
      .sort((a, b) => a.payload.deviceCounter - b.payload.deviceCounter)
      .slice(0, MAX_BATCH);
    const movements = sendable.filter((e) => e.kind === 'CASH_MOVEMENT' && e.shiftId === shiftId);
    const batch: QueueEntry[] = [...sales, ...movements];
    const sentAt = at();
    await store.putEntries(
      batch.map(
        (e) =>
          ({
            ...e,
            localStatus: 'SENDING',
            attempts: e.attempts + 1,
            lastAttemptAt: sentAt,
          }) as QueueEntry,
      ),
    );
    try {
      const result = await call('syncOfflineSales', {
        body: {
          deviceId: device.deviceId,
          shiftId,
          sales: sales.map((e) => e.payload),
          ...(movements.length > 0
            ? {
                cashMovements: movements.flatMap((e) =>
                  e.kind === 'CASH_MOVEMENT' ? [e.payload] : [],
                ),
              }
            : {}),
        },
      });
      const confirmedAt = at();
      const outcomes: Record<string, number> = {};
      const bySale = new Map(result.results.map((item) => [item.clientSaleId, item]));
      const byMovement = new Map(result.cashMovementResults.map((item) => [item.clientId, item]));
      const marked = batch.map((entry): QueueEntry => {
        const base = { ...entry, attempts: entry.attempts + 1, lastAttemptAt: sentAt };
        if (entry.kind === 'SALE') {
          const item = bySale.get(entry.id);
          if (item === undefined) return { ...base, localStatus: 'QUEUED' } as QueueEntry;
          outcomes[item.outcome] = (outcomes[item.outcome] ?? 0) + 1;
          const rejected = item.outcome === 'REJECTED_INTEGRITY';
          return {
            ...entry,
            attempts: base.attempts,
            lastAttemptAt: sentAt,
            localStatus: item.outcome,
            serverResult: item,
            confirmedAt: rejected ? null : confirmedAt,
            failure: rejected
              ? {
                  code: 'REJECTED_INTEGRITY',
                  message: item.exceptions.map((exception) => exception.summary).join(' '),
                  correlationId: '',
                }
              : null,
          };
        }
        if (entry.kind === 'CASH_MOVEMENT') {
          const item = byMovement.get(entry.id);
          if (item === undefined) return { ...base, localStatus: 'QUEUED' } as QueueEntry;
          outcomes[`CASH_${item.outcome}`] = (outcomes[`CASH_${item.outcome}`] ?? 0) + 1;
          return item.outcome === 'REJECTED'
            ? {
                ...entry,
                attempts: base.attempts,
                lastAttemptAt: sentAt,
                localStatus: 'FAILED_PERMANENT',
                serverResult: item,
                failure: {
                  code: 'CASH_MOVEMENT_REJECTED',
                  message: item.reason ?? '',
                  correlationId: '',
                },
              }
            : {
                ...entry,
                attempts: base.attempts,
                lastAttemptAt: sentAt,
                localStatus: item.outcome,
                serverResult: item,
                confirmedAt,
                failure: null,
              };
        }
        return base as QueueEntry;
      });
      await store.putEntries(marked);
      const meta = (await store.read()).meta;
      await store.saveMeta({
        ...meta,
        counterGaps: result.counterGaps,
        lastReachedServerAt: confirmedAt,
      });
      await store.appendSyncLog(
        { at: confirmedAt, batchSize: sales.length, status: 200, outcomes },
        new Date(now().getTime() - WEEK_MS).toISOString(),
      );
      // A batch the server answered but did not account for is not sent again in this pass.
      if (marked.every((entry) => entry.localStatus === 'QUEUED')) break;
    } catch (error) {
      const stop = stopFor(error);
      await store.appendSyncLog(
        {
          at: at(),
          batchSize: sales.length,
          status: error instanceof ApiError ? error.status : 0,
          outcomes: {},
        },
        new Date(now().getTime() - WEEK_MS).toISOString(),
      );
      if (stop !== null) {
        await mark(batch, { localStatus: 'QUEUED' });
        return stop;
      }
      await reached();
      await mark(batch, { localStatus: 'FAILED_PERMANENT', failure: failureOf(error as ApiError) });
    }
  }

  // 3. The server's total for each sale it took, against the till's.
  await reconcile(deps);

  // 4. Records confirmed more than a day ago.
  snapshot = await store.read();
  const cutoff = new Date(now().getTime() - DAY_MS).toISOString();
  const expired = snapshot.entries.filter(
    (entry) => entry.confirmedAt !== null && entry.confirmedAt < cutoff && !needsAttention(entry),
  );
  if (expired.length > 0) await store.removeEntries(expired.map((entry) => entry.id));
  return { kind: 'done' };
}

/** Reads back the server's total for synced sales whose total has not been read yet. */
async function reconcile({ store, call }: SyncDeps): Promise<void> {
  const waiting = (await store.read()).entries.filter(
    (entry): entry is SaleEntry =>
      entry.kind === 'SALE' &&
      CONFIRMED_STATUSES.includes(entry.localStatus) &&
      entry.serverTotalPesewas === null &&
      (entry.serverResult?.orderId ?? null) !== null,
  );
  for (const entry of waiting) {
    try {
      const order = await call('getOrder', { path: { id: entry.serverResult?.orderId ?? '' } });
      const serverTotal = order.finalTotalPesewas ?? order.estimatedTotalPesewas;
      await store.putEntries([{ ...entry, serverTotalPesewas: serverTotal }]);
    } catch {
      // Read again on the next pass; the sale itself is safe on the server.
      return;
    }
  }
}

/** A record a person must look at: refused, or applied with a stock or price exception, or a total that differs. */
export function needsAttention(entry: QueueEntry): boolean {
  if (entry.localStatus === 'REJECTED_INTEGRITY' || entry.localStatus === 'FAILED_PERMANENT')
    return true;
  if (entry.kind !== 'SALE') return false;
  if (entry.localStatus === 'APPLIED_WITH_EXCEPTION') return true;
  return totalDiffers(entry);
}

export function totalDiffers(entry: SaleEntry): boolean {
  return entry.serverTotalPesewas !== null && entry.serverTotalPesewas !== entry.localTotalPesewas;
}

/** How many records are still waiting to be sent. */
export function pendingCount(snapshot: TillSnapshot): number {
  return snapshot.entries.filter(isPending).length;
}

/**
 * The wait before the next attempt after `attempt` failures in a row (section 6.4): 5 seconds, doubling
 * each time to a ceiling of 5 minutes, with 20 percent random jitter either way. `random` is in [0, 1).
 */
export function backoffMs(attempt: number, random: number): number {
  const base = Math.min(5000 * 2 ** Math.max(0, attempt), 300_000);
  return base * (0.8 + 0.4 * random);
}
