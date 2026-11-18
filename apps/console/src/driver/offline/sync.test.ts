import { ApiError, NetworkError, type ApiClient } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import { AlreadyRecorded, DriverRun } from './run';
import { memoryDriverStore } from './store';
import { driverBackoffMs, flushDriverQueue, pendingCount } from './sync';
import type { Delivery, Route } from './types';

const DELIVERY_A = '019a7b08-ee6c-7c81-81b9-d0ebe01149c9';
const DELIVERY_B = '019a7b09-2c4a-7048-a580-0d5ad3738638';
const FILE_ID = '019a7a94-915f-79d6-9f0f-a63d1b3e1f1b';

interface Sent {
  operation: string;
  input: { body?: unknown; path?: { id?: string }; query?: unknown };
  key?: string;
}

type Script = (sent: Sent) => unknown;

/**
 * A server that applies each proof and failure once by its client id, answers a resend `DUPLICATE`, and can
 * be told to lose an answer after acting on it, or to be unreachable.
 */
function server() {
  const applied = new Map<string, number>();
  let loseNext = false;
  let down = false;
  const script: Script = (sent) => {
    if (down) throw new NetworkError();
    if (sent.operation === 'uploadFile') return { id: FILE_ID };
    if (sent.operation === 'markOnTheWay') return {};
    if (sent.operation === 'syncDriverEvents') {
      const body = sent.input.body as {
        proofs: { deliveryId: string; proof: { id: string } }[];
        failures: { deliveryId: string; failure: { id: string } }[];
      };
      const items = [
        ...body.proofs.map((p) => ({ clientId: p.proof.id, deliveryId: p.deliveryId })),
        ...body.failures.map((f) => ({ clientId: f.failure.id, deliveryId: f.deliveryId })),
      ];
      const results = items.map((item) => {
        const seen = applied.has(item.clientId);
        applied.set(item.clientId, (applied.get(item.clientId) ?? 0) + (seen ? 0 : 1));
        return { ...item, outcome: seen ? 'DUPLICATE' : 'APPLIED', reason: null };
      });
      if (loseNext) {
        loseNext = false;
        throw new NetworkError();
      }
      return { results, serverTime: '2026-11-18T12:00:00Z' };
    }
    throw new Error(`unexpected ${sent.operation}`);
  };
  return {
    applied,
    script,
    loseNextAnswer: () => void (loseNext = true),
    setDown: (value: boolean) => void (down = value),
  };
}

function harness(script: Script) {
  let time = new Date('2026-11-18T09:00:00Z').getTime();
  const sent: Sent[] = [];
  const call = (async (
    operation: string,
    input?: Sent['input'],
    options?: { idempotencyKey?: string },
  ) => {
    sent.push({ operation, input: input ?? {}, key: options?.idempotencyKey });
    return script({ operation, input: input ?? {}, key: options?.idempotencyKey });
  }) as unknown as ApiClient['call'];
  const store = memoryDriverStore();
  const timers: { run: () => void; ms: number }[] = [];
  const run = new DriverRun({
    store,
    call,
    now: () => new Date(time),
    random: () => 0.5,
    setTimer: (fn, ms) => {
      timers.push({ run: fn, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  });
  return {
    run,
    store,
    sent,
    timers,
    call,
    flush: () => flushDriverQueue({ store, call, now: () => new Date(time) }),
    advance: (ms: number) => void (time += ms),
  };
}

const proof = (deliveryId: string, photoLocalId: string) => ({
  deliveryId,
  recipientName: '  Asantewaa Boateng ',
  photoLocalId,
  codCollectedPesewas: 24000,
  position: { latitude: '5.705940', longitude: '-0.159080', accuracyM: 9 },
});

describe('the driver queue (ADR 0055)', () => {
  it('uploads the photograph under its own id, then sends the proof with its client id once', async () => {
    const api = server();
    const h = harness(api.script);
    const photoId = await h.run.keepPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }));
    const entry = await h.run.recordProof(proof(DELIVERY_A, photoId));
    await h.run.flush();

    const upload = h.sent.find((s) => s.operation === 'uploadFile');
    expect(upload?.key).toBe(photoId);
    const sync = h.sent.find((s) => s.operation === 'syncDriverEvents');
    expect(sync?.input.body).toEqual({
      proofs: [
        {
          deliveryId: DELIVERY_A,
          proof: {
            id: entry.id,
            recipientName: 'Asantewaa Boateng',
            codCollectedPesewas: 24000,
            capturedAt: '2026-11-18T09:00:00.000Z',
            latitude: '5.705940',
            longitude: '-0.159080',
            positionAccuracyM: 9,
            photoFileId: FILE_ID,
          },
        },
      ],
      failures: [],
    });
    const after = await h.store.read();
    expect(after.entries[0]?.localStatus).toBe('APPLIED');
    expect(api.applied.get(entry.id)).toBe(1);
  });

  it('keeps everything queued with no signal, and sends it when the signal returns', async () => {
    const api = server();
    const h = harness(api.script);
    api.setDown(true);
    const photoId = await h.run.keepPhoto(new Blob(['jpeg']));
    await h.run.recordProof(proof(DELIVERY_A, photoId));
    await h.run.recordFailure({
      deliveryId: DELIVERY_B,
      failureReasonCode: 'CUSTOMER_REFUSED',
      nextAction: 'RETURN_TO_STOCK',
      position: null,
    });
    expect(await h.run.flush()).toEqual({ kind: 'unreachable' });
    expect(pendingCount((await h.store.read()).entries)).toBe(2);
    // A backoff is scheduled, and a probe.
    expect(h.timers.map((t) => t.ms)).toEqual(expect.arrayContaining([5000, 30_000]));

    api.setDown(false);
    expect(await h.run.flush()).toEqual({ kind: 'done' });
    const after = await h.store.read();
    expect(after.entries.map((e) => e.localStatus)).toEqual(['APPLIED', 'APPLIED']);
    expect([...api.applied.values()]).toEqual([1, 1]);
  });

  it('resends the same ids after a lost answer, and the server applies each once', async () => {
    const api = server();
    const h = harness(api.script);
    const photoId = await h.run.keepPhoto(new Blob(['jpeg']));
    // Recording a proof sends it at once: that first answer is lost after the server applied it.
    api.loseNextAnswer();
    const entry = await h.run.recordProof(proof(DELIVERY_A, photoId));
    await h.run.flush();
    // The pass the proof started lost its answer and left it queued; the pass after it resent it.
    expect(api.applied.get(entry.id)).toBe(1);
    const syncs = h.sent.filter((s) => s.operation === 'syncDriverEvents');
    expect(syncs).toHaveLength(2);
    const ids = syncs.map(
      (s) => (s.input.body as { proofs: { proof: { id: string } }[] }).proofs[0]?.proof.id,
    );
    expect(ids).toEqual([entry.id, entry.id]);
    // The photograph was uploaded once: its file id was kept after the first answer.
    expect(h.sent.filter((s) => s.operation === 'uploadFile')).toHaveLength(1);
    const after = (await h.store.read()).entries[0];
    expect(after?.localStatus).toBe('APPLIED');
    expect(after?.serverOutcome).toBe('DUPLICATE');
    expect(api.applied.get(entry.id)).toBe(1);
  });

  it('keeps a refusal in the server’s words, and an exception beside an applied proof', async () => {
    const h = harness((sent) => {
      if (sent.operation === 'uploadFile') return { id: FILE_ID };
      const body = sent.input.body as {
        proofs: { deliveryId: string; proof: { id: string } }[];
        failures: { deliveryId: string; failure: { id: string } }[];
      };
      return {
        results: [
          {
            clientId: body.proofs[0]?.proof.id,
            deliveryId: DELIVERY_A,
            outcome: 'APPLIED_WITH_EXCEPTION',
            reason: 'Cash collected differs from the amount due.',
          },
          {
            clientId: body.failures[0]?.failure.id,
            deliveryId: DELIVERY_B,
            outcome: 'REJECTED',
            reason: 'The delivery is not assigned to you.',
          },
        ],
        serverTime: '2026-11-18T12:00:00Z',
      };
    });
    const photoId = await h.run.keepPhoto(new Blob(['jpeg']));
    await h.run.recordProof(proof(DELIVERY_A, photoId));
    await h.run.recordFailure({
      deliveryId: DELIVERY_B,
      failureReasonCode: 'CUSTOMER_NOT_AVAILABLE',
      nextAction: 'REATTEMPT',
      position: null,
    });
    await h.run.flush();
    const entries = (await h.store.read()).entries;
    const a = entries.find((e) => e.kind === 'PROOF');
    const b = entries.find((e) => e.kind === 'FAILURE');
    expect(a?.localStatus).toBe('APPLIED');
    expect(a?.serverReason).toBe('Cash collected differs from the amount due.');
    expect(b?.localStatus).toBe('REJECTED');
    expect(b?.failure?.message).toBe('The delivery is not assigned to you.');
  });

  it('sends "on my way" first, keyed by its own id', async () => {
    const api = server();
    const h = harness(api.script);
    const way = await h.run.markOnTheWay(DELIVERY_A);
    const photoId = await h.run.keepPhoto(new Blob(['jpeg']));
    await h.run.recordProof(proof(DELIVERY_A, photoId));
    await h.run.flush();
    const order = h.sent.map((s) => s.operation);
    expect(order.indexOf('markOnTheWay')).toBeLessThan(order.indexOf('syncDriverEvents'));
    const sent = h.sent.find((s) => s.operation === 'markOnTheWay');
    expect(sent?.key).toBe(way.id);
    expect(sent?.input.path?.id).toBe(DELIVERY_A);
  });

  it('stops on an ended session and keeps the queue', async () => {
    const h = harness(() => {
      throw new ApiError({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Sign in again.',
        correlationId: 'c',
      });
    });
    await h.run.recordFailure({
      deliveryId: DELIVERY_B,
      failureReasonCode: 'CUSTOMER_NOT_AVAILABLE',
      nextAction: 'REATTEMPT',
      position: null,
    });
    const outcome = await h.run.flush();
    expect(outcome.kind).toBe('blocked');
    expect(h.run.getState().sync.blocked?.code).toBe('UNAUTHENTICATED');
    expect((await h.store.read()).entries[0]?.localStatus).toBe('QUEUED');
  });

  it('records one closing record per stop: a second proof or failure is refused on the phone', async () => {
    const api = server();
    api.setDown(true);
    const h = harness(api.script);
    const photoId = await h.run.keepPhoto(new Blob(['jpeg']));
    await h.run.recordProof(proof(DELIVERY_A, photoId));
    await expect(h.run.recordProof(proof(DELIVERY_A, photoId))).rejects.toBeInstanceOf(
      AlreadyRecorded,
    );
    await expect(
      h.run.recordFailure({
        deliveryId: DELIVERY_A,
        failureReasonCode: 'CUSTOMER_REFUSED',
        nextAction: 'RETURN_TO_STOCK',
        position: null,
      }),
    ).rejects.toBeInstanceOf(AlreadyRecorded);
  });

  it('backs off 5 s doubling to 5 minutes, with jitter', () => {
    expect(driverBackoffMs(0, 0.5)).toBe(5000);
    expect(driverBackoffMs(1, 0.5)).toBe(10_000);
    expect(driverBackoffMs(20, 0.5)).toBe(300_000);
    expect(driverBackoffMs(0, 0)).toBe(4000);
    expect(driverBackoffMs(0, 1)).toBeCloseTo(6000);
  });
});

describe('reading the run', () => {
  const route = {
    id: 'r',
    routeDate: '2026-11-18',
    stops: [
      { stopNo: 1, delivery: { id: DELIVERY_A } },
      { stopNo: 2, delivery: { id: DELIVERY_B } },
    ],
  } as unknown as Route;

  it('keeps the run and every stop, so the run goes on without signal', async () => {
    let down = false;
    const h = harness((sent) => {
      if (down) throw new NetworkError();
      switch (sent.operation) {
        case 'getMyRoute':
          return route;
        case 'getMyDelivery':
          return { id: sent.input.path?.id, recipientName: 'x' } as unknown as Delivery;
        case 'getMyCashSummary':
          return { expectedPesewas: 0 };
        case 'listReasonCodes':
          return {
            data: [{ code: 'CUSTOMER_REFUSED', description: 'Refused', requiresNote: false }],
          };
        case 'listUnitsOfMeasure':
          return {
            data: [
              {
                code: 'CRATE',
                singularName: 'crate',
                pluralName: 'crates',
                displayDecimals: 0,
              },
            ],
          };
        default:
          throw new Error(sent.operation);
      }
    });
    await h.run.start();
    await h.run.refresh();
    let records = (await h.store.read()).records;
    expect(Object.keys(records.deliveries)).toEqual([DELIVERY_A, DELIVERY_B]);
    expect(records.reasons[0]?.code).toBe('CUSTOMER_REFUSED');
    expect(records.units[0]?.pluralName).toBe('crates');

    down = true;
    await h.run.refresh();
    expect(h.run.getState().read.kind).toBe('failed');
    records = (await h.store.read()).records;
    expect(records.route?.id).toBe('r');
    expect(Object.keys(records.deliveries)).toHaveLength(2);
  });
});
