import { ApiError, NetworkError, type ApiClient } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import type { CartLine } from './cart';
import { canonicalJson, sha256Hex } from './payloadHash';
import { memoryStore } from './store';
import { backoffMs, flushQueue, needsAttention, MAX_BATCH } from './sync';
import { Till } from './till';
import type { DeviceRecord, OfflineSale, SaleEntry } from './types';

const DEVICE: DeviceRecord = {
  deviceId: '019a7a95-0000-7000-8000-000000000001',
  deviceLabel: 'Counter tablet',
  registerId: '019a7a94-15a3-7248-9781-2d5f347aa63d',
  registerCode: 'T1',
  registerName: 'Shop till 1',
  branchId: '019a7a84-0000-7000-8000-000000000001',
  credential: 'hkdev_T1.test',
  enrolledAt: '2026-11-16T06:00:00Z',
};
const CASH = {
  id: '019a7a92-a26f-7b9f-90d7-c2c5802e3ba3',
  code: 'CASH',
  name: 'Cash',
  kind: 'CASH',
};
const EGGS: CartLine = {
  key: 'eggs',
  productId: '019a7a8d-ae28-7631-8b69-6be302d5e4c0',
  productName: 'Eggs, big, crate of 30',
  saleUom: 'CRATE',
  priceBasis: 'PER_UNIT',
  taxCategoryId: 't',
  stockUnitId: null,
  stockUnitIdentifier: null,
  gradeId: null,
  quantity: '8.000',
  weightKg: null,
  weightSource: null,
  listUnitPricePesewas: 6200,
  floorUnitPricePesewas: 6200,
  ceilingUnitPricePesewas: 6200,
  agreedUnitPricePesewas: 6200,
  varianceReasonCode: null,
};

interface Sent {
  operation: string;
  input: { body?: unknown; path?: { id?: string } };
  key?: string;
}

type Script = (sent: Sent) => unknown;

/** A clock that moves only when told, and an API that answers from a script and records each call. */
function harness(script: Script) {
  let time = new Date('2026-11-16T09:00:00Z').getTime();
  const sent: Sent[] = [];
  const call = (async (
    operation: string,
    input?: Sent['input'],
    options?: { idempotencyKey?: string },
  ) => {
    const entry: Sent = {
      operation,
      input: structuredClone(input ?? {}),
      key: options?.idempotencyKey,
    };
    sent.push(entry);
    return script(entry);
  }) as unknown as ApiClient['call'];
  const store = memoryStore({ device: DEVICE });
  const timers: { run: () => void; ms: number }[] = [];
  const till = new Till({
    store,
    call,
    now: () => new Date(time),
    random: () => 0.5,
    setTimer: (run, ms) => {
      timers.push({ run, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  });
  return {
    till,
    store,
    sent,
    timers,
    call,
    advance: (ms: number) => {
      time += ms;
    },
    syncs: () => sent.filter((s) => s.operation === 'syncOfflineSales'),
  };
}

/** The server: applies each sale once by id, answers a resend DUPLICATE, as section 9.7 says. */
function server(overrides: Partial<Record<string, (sent: Sent) => unknown>> = {}) {
  const applied = new Map<string, string>();
  /** Every batch that reached the server, answered or not. */
  const received: Sent[] = [];
  let receipt = 6200;
  const script: Script = (s) => {
    if (s.operation === 'syncOfflineSales') received.push(s);
    const override = overrides[s.operation];
    if (override !== undefined) return override(s);
    if (s.operation === 'openShift') {
      const body = s.input.body as { id: string };
      return { id: body.id, shiftSeq: 311, shiftNo: 'SH-311' };
    }
    if (s.operation === 'syncOfflineSales') {
      const body = s.input.body as { shiftId: string; sales: OfflineSale[] };
      return {
        shiftId: body.shiftId,
        results: body.sales.map((sale) => {
          const first = applied.get(sale.id);
          const receiptNo = first ?? `RCP-2026-DDW-T1-00${String((receipt += 1))}`;
          applied.set(sale.id, receiptNo);
          return {
            clientSaleId: sale.id,
            deviceCounter: sale.deviceCounter,
            outcome: first === undefined ? 'APPLIED' : 'DUPLICATE',
            orderId: `order-${sale.id}`,
            orderNo: `SO-${String(sale.deviceCounter)}`,
            receiptNo,
            exceptions: [],
          };
        }),
        cashMovementResults: [],
        counterGaps: [],
        serverTime: '2026-11-16T09:00:00Z',
      };
    }
    if (s.operation === 'getOrder')
      return { finalTotalPesewas: null, estimatedTotalPesewas: 49600 };
    if (s.operation === 'getHealth') return { status: 'ok' };
    throw new Error(`unexpected ${s.operation}`);
  };
  return { script, applied, received };
}

async function openWithShift(h: ReturnType<typeof harness>) {
  await h.till.start();
  await h.till.openShift({
    cashierId: 'c1',
    cashierName: 'Adwoa Darko',
    openingFloatPesewas: 20000,
  });
}

const sale = (h: ReturnType<typeof harness>, lines: CartLine[] = [EGGS], handed = 50000) =>
  h.till.completeSale({
    lines,
    cashMethod: CASH,
    others: [],
    cashHandedPesewas: handed,
    customerPhone: null,
  });

describe('a sale on the queue', () => {
  it('opens the shift first, alone, keyed by its own id; then sends the sale once', async () => {
    const s = server();
    const h = harness(s.script);
    await openWithShift(h);
    expect(h.sent[0]).toMatchObject({ operation: 'openShift' });
    const open = h.sent[0]?.input.body as { id: string; openingFloatPesewas: number };
    expect(h.sent[0]?.key).toBe(open.id);
    expect(open.openingFloatPesewas).toBe(20000);

    const entry = await sale(h);
    await h.till.flush();
    expect(h.syncs()).toHaveLength(1);
    const batch = h.syncs()[0]?.input.body as {
      deviceId: string;
      shiftId: string;
      sales: OfflineSale[];
    };
    expect(batch.deviceId).toBe(DEVICE.deviceId);
    expect(batch.shiftId).toBe(open.id);
    expect(batch.sales).toHaveLength(1);
    const sent = batch.sales[0] as OfflineSale;
    expect(sent).toMatchObject({ id: entry.id, deviceCounter: 1, provisionalRef: 'P-T1-1-0001' });
    expect(sent.tenders).toEqual([
      { paymentMethodId: CASH.id, amountPesewas: 49600, tenderedPesewas: 50000 },
    ]);
    // The hash covers every field the server receives but the hash itself.
    const { payloadHash, ...rest } = sent;
    expect(payloadHash).toBe(await sha256Hex(canonicalJson(rest as never)));

    const after = h.till.getState().snapshot?.entries.find((e) => e.id === entry.id) as SaleEntry;
    expect(after.localStatus).toBe('APPLIED');
    expect(after.serverResult?.receiptNo).toBe('RCP-2026-DDW-T1-006201');
    expect(after.receipt.changePesewas).toBe(400);
    // Another pass sends nothing: the sale is confirmed.
    await h.till.flush();
    expect(h.syncs()).toHaveLength(1);
  });

  it('queues while there is no network, and the resend after a lost answer lands once', async () => {
    let online = true;
    let loseNextAnswer = false;
    const s = server();
    const h = harness((sent) => {
      if (!online) throw new NetworkError();
      const answer = s.script(sent);
      if (sent.operation === 'syncOfflineSales' && loseNextAnswer) {
        loseNextAnswer = false;
        // The server applied the batch; the answer never reached the till.
        throw new NetworkError('TIMEOUT');
      }
      return answer;
    });
    await openWithShift(h);
    online = false;
    const first = await sale(h);
    const second = await sale(h, [{ ...EGGS, quantity: '2.000' }], 12400);
    await h.till.flush();
    const queued = h.till.getState().snapshot?.entries.filter((e) => e.kind === 'SALE');
    expect(queued?.map((e) => e.localStatus)).toEqual(['QUEUED', 'QUEUED']);
    expect(h.till.getState().sync.unreachable).toBe(true);
    expect(h.till.getState().sync.nextAttemptAt).not.toBeNull();
    expect(s.received).toHaveLength(0);

    // The network comes back: the server applies both and the answer is lost on the way back.
    online = true;
    loseNextAnswer = true;
    h.till.online();
    // The pass that lost its answer, then the one asked for meanwhile, which resends the same batch.
    await h.till.flush();
    expect(s.applied.size).toBe(2);

    const sent = s.received.map((x) => (x.input.body as { sales: OfflineSale[] }).sales);
    expect(sent).toHaveLength(2);
    // The same two sales, with the same ids, counters and hashes, both times.
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[0]?.map((x) => x.deviceCounter)).toEqual([1, 2]);
    const done = (await h.store.read()).entries.filter((e): e is SaleEntry => e.kind === 'SALE');
    expect(done.map((e) => [e.id, e.localStatus])).toEqual([
      [first.id, 'DUPLICATE'],
      [second.id, 'DUPLICATE'],
    ]);
    // Exactly once on the server: two sales, two receipt numbers.
    expect(new Set(s.applied.values()).size).toBe(2);
  });

  it('never sends a sale the server refused for its integrity again, and shows it to a person', async () => {
    const s = server({
      syncOfflineSales: (sent) => {
        const body = sent.input.body as { shiftId: string; sales: OfflineSale[] };
        return {
          shiftId: body.shiftId,
          results: body.sales.map((x) => ({
            clientSaleId: x.id,
            deviceCounter: x.deviceCounter,
            outcome: 'REJECTED_INTEGRITY',
            orderId: null,
            orderNo: null,
            receiptNo: null,
            exceptions: [{ kind: 'SYNC_REJECTED', summary: 'Payload hash does not match.' }],
          })),
          cashMovementResults: [],
          counterGaps: [],
          serverTime: '',
        };
      },
    });
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await h.till.flush();
    await h.till.flush();
    expect(h.syncs()).toHaveLength(1);
    const entry = h.till.getState().snapshot?.entries.find((e) => e.kind === 'SALE');
    expect(entry?.localStatus).toBe('REJECTED_INTEGRITY');
    expect(entry?.failure?.message).toBe('Payload hash does not match.');
    expect(entry !== undefined && needsAttention(entry)).toBe(true);
  });

  it('stops the queue and keeps it when the device is revoked', async () => {
    const s = server({
      syncOfflineSales: () => {
        throw new ApiError({
          status: 403,
          code: 'DEVICE_REVOKED',
          message: 'Revoked.',
          correlationId: 'c',
        });
      },
    });
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await h.till.flush();
    expect(h.till.getState().sync.blocked?.code).toBe('DEVICE_REVOKED');
    expect(h.till.getState().snapshot?.entries.find((e) => e.kind === 'SALE')?.localStatus).toBe(
      'QUEUED',
    );
  });

  it('marks a batch FAILED_PERMANENT on another 4xx, with the reference, and never retries it', async () => {
    const s = server({
      syncOfflineSales: () => {
        throw new ApiError({
          status: 404,
          code: 'NOT_FOUND',
          message: 'No such shift.',
          correlationId: 'corr-1',
        });
      },
    });
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await h.till.flush();
    await h.till.flush();
    const entry = h.till.getState().snapshot?.entries.find((e) => e.kind === 'SALE');
    expect(entry?.localStatus).toBe('FAILED_PERMANENT');
    expect(entry?.failure).toEqual({
      code: 'NOT_FOUND',
      message: 'No such shift.',
      correlationId: 'corr-1',
    });
    expect(h.syncs()).toHaveLength(1);
  });

  it('sends 501 sales in two batches of 500 and 1, in counter order', async () => {
    let online = true;
    const s = server();
    const h = harness((sent) => {
      if (!online) throw new NetworkError();
      return s.script(sent);
    });
    await openWithShift(h);
    online = false;
    for (let i = 0; i < MAX_BATCH + 1; i += 1) await sale(h, [EGGS], 49600);
    await h.till.flush();
    online = true;
    h.till.online();
    await h.till.flush();
    const batches = s.received.map((x) => (x.input.body as { sales: OfflineSale[] }).sales);
    expect(batches.map((b) => b.length)).toEqual([500, 1]);
    expect(batches[0]?.[0]?.deviceCounter).toBe(1);
    expect(batches[0]?.[499]?.deviceCounter).toBe(500);
    expect(batches[1]?.[0]?.deviceCounter).toBe(501);
    expect(s.applied.size).toBe(501);
  }, 30_000);

  it('flags a sale whose total on the server differs from the till, and leaves the server figure standing', async () => {
    const s = server({
      getOrder: () => ({ finalTotalPesewas: 49000, estimatedTotalPesewas: 49000 }),
    });
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await h.till.flush();
    const entry = h.till
      .getState()
      .snapshot?.entries.find((e): e is SaleEntry => e.kind === 'SALE');
    expect(entry?.localTotalPesewas).toBe(49600);
    expect(entry?.serverTotalPesewas).toBe(49000);
    expect(entry !== undefined && needsAttention(entry)).toBe(true);
  });

  it('removes a confirmed record 24 hours after the server confirmed it, not before', async () => {
    const s = server();
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await h.till.flush();
    expect(h.till.getState().snapshot?.entries.filter((e) => e.kind === 'SALE')).toHaveLength(1);
    await flushQueue({ store: h.store, call: h.call, now: () => new Date('2026-11-17T08:59:00Z') });
    expect((await h.store.read()).entries.filter((e) => e.kind === 'SALE')).toHaveLength(1);
    await flushQueue({ store: h.store, call: h.call, now: () => new Date('2026-11-17T09:01:00Z') });
    expect((await h.store.read()).entries.filter((e) => e.kind === 'SALE')).toHaveLength(0);
  });
});

describe('the device counter', () => {
  it('runs 1, 2, 3 on the shift and survives a reload of the store', async () => {
    const s = server();
    const h = harness(s.script);
    await openWithShift(h);
    await sale(h);
    await sale(h);
    const again = new Till({ store: h.store, call: h.call });
    await again.start();
    const third = await again.completeSale({
      lines: [EGGS],
      cashMethod: CASH,
      others: [],
      cashHandedPesewas: 49600,
      customerPhone: null,
    });
    expect(third.payload.deviceCounter).toBe(3);
    expect(third.payload.provisionalRef).toBe('P-T1-1-0003');
  });

  it('is not consumed by a sale the tenders do not cover', async () => {
    const h = harness(server().script);
    await openWithShift(h);
    await expect(sale(h, [EGGS], 1000)).rejects.toThrow();
    expect((await sale(h)).payload.deviceCounter).toBe(1);
  });

  it('refuses a second window that would reuse a counter', async () => {
    const h = harness(server().script);
    await openWithShift(h);
    const stale = new Till({ store: h.store, call: h.call });
    await stale.start();
    await sale(h);
    await expect(
      stale.completeSale({
        lines: [EGGS],
        cashMethod: CASH,
        others: [],
        cashHandedPesewas: 49600,
        customerPhone: null,
      }),
    ).rejects.toThrow(/counter/);
  });
});

describe('backoff', () => {
  it('starts at 5 s, doubles to a 5 min ceiling, with 20 percent jitter either way', () => {
    expect(backoffMs(0, 0.5)).toBe(5000);
    expect(backoffMs(1, 0.5)).toBe(10000);
    expect(backoffMs(10, 0.5)).toBe(300000);
    expect(backoffMs(0, 0)).toBe(4000);
    expect(backoffMs(0, 0.999999)).toBeCloseTo(6000, 0);
  });
});
