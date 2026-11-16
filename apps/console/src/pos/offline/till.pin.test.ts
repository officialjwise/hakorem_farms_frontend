import { pbkdf2Sync } from 'node:crypto';
import type { ApiClient, RequestedOperation } from '@hakorem/api-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PinVerifier, TillPinVerifiers } from '../../requested/tillPin';
import type { CartLine } from './cart';
import { memoryStore } from './store';
import { Till } from './till';
import type { DeviceRecord, OfflinePack, OfflineSale } from './types';

const DEVICE: DeviceRecord = {
  deviceId: '019a7a95-0000-7000-8000-000000000001',
  deviceLabel: 'Counter tablet',
  registerId: '019a7a94-15a3-7248-9781-2d5f347aa63d',
  registerCode: 'T2',
  registerName: 'Shop till 2',
  branchId: '019a7a84-0000-7000-8000-000000000001',
  credential: 'hkdev_T2.test',
  enrolledAt: '2026-11-13T06:00:00Z',
};
const CASH = { id: 'cash', code: 'CASH', name: 'Cash', kind: 'CASH' };
const MOMO = { id: 'momo', code: 'MOMO', name: 'Mobile money', kind: 'MOBILE_MONEY' };
const CASHIER = '019a7a86-ac02-78a8-ade0-935170bb0c2f';
const SUPERVISOR = '019a7a86-3046-711a-a652-1a7389f79351';

/** Five crates of eggs at 6,200: OFFLINE_SYNC 9.9. */
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
  quantity: '5.000',
  weightKg: null,
  weightSource: null,
  listUnitPricePesewas: 6200,
  floorUnitPricePesewas: 6200,
  ceilingUnitPricePesewas: 6200,
  agreedUnitPricePesewas: 6200,
  varianceReasonCode: null,
};

function verifier(
  principalId: string,
  displayName: string,
  pin: string,
  approves: PinVerifier['approves'],
): PinVerifier {
  const salt = Buffer.from(`salt-${principalId}`);
  return {
    principalId,
    displayName,
    version: approves.length > 0 ? 7 : 2,
    algorithm: 'PBKDF2-SHA256',
    iterations: 1000,
    salt: salt.toString('base64'),
    hash: pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('base64'),
    approves,
  };
}

const ISSUED: TillPinVerifiers = {
  registerId: DEVICE.registerId,
  issuedAt: '2026-11-16T09:00:00Z',
  policy: { minDigits: 4, maxDigits: 6, maxAttempts: 3, lockoutSeconds: 300, idleLockSeconds: 120 },
  verifiers: [
    verifier(CASHIER, 'Adwoa Darko', '4821', []),
    verifier(SUPERVISOR, 'Akua Mensah', '903412', ['OFFLINE_MOBILE_MONEY', 'CASH_DROP_WITNESS']),
  ],
};

function harness() {
  let time = new Date('2026-11-16T11:50:00Z').getTime();
  const sent: { operation: string; body?: unknown }[] = [];
  const requested: string[] = [];
  const call = (async (operation: string, input?: { body?: unknown; path?: { id?: string } }) => {
    sent.push({ operation, body: input?.body });
    if (operation === 'getOfflinePack') return { policy: {} } as unknown as OfflinePack;
    if (operation === 'openShift')
      return { id: (input?.body as { id: string }).id, shiftSeq: 311, shiftNo: 'SH-311' };
    throw new Error('unreachable');
  }) as unknown as ApiClient['call'];
  const callRequested = (async (operation: RequestedOperation) => {
    requested.push(operation.operationId);
    return structuredClone(ISSUED);
  }) as ApiClient['callRequested'];
  const store = memoryStore({ device: DEVICE });
  const till = new Till({
    store,
    call,
    callRequested,
    now: () => new Date(time),
    random: () => 0.5,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
  return { till, sent, requested, advance: (ms: number) => (time += ms) };
}

async function ready(h: ReturnType<typeof harness>) {
  await h.till.start();
  await h.till.openShift({
    cashierId: CASHIER,
    cashierName: 'Adwoa Darko',
    openingFloatPesewas: 20000,
  });
  await h.till.refreshPack();
}

describe('the till PIN (CR-032, built against the request)', () => {
  const before = process.env.HK_REQUESTED_CONTRACT;
  beforeEach(() => {
    process.env.HK_REQUESTED_CONTRACT = 'CR-032';
  });
  afterEach(() => {
    if (before === undefined) delete process.env.HK_REQUESTED_CONTRACT;
    else process.env.HK_REQUESTED_CONTRACT = before;
  });

  it('fetches the verifiers with the pack and keeps them on the device', async () => {
    const h = harness();
    await ready(h);
    expect(h.requested).toEqual(['listTillPinVerifiers']);
    expect(h.till.getState().snapshot?.localAuth?.verifiers).toHaveLength(2);
    expect(h.till.canLock()).toBe(true);
  });

  it('asks for no verifiers in a build not switched on for CR-032, and then the till cannot lock', async () => {
    process.env.HK_REQUESTED_CONTRACT = '';
    const h = harness();
    await ready(h);
    expect(h.requested).toEqual([]);
    expect(h.till.canLock()).toBe(false);
    await h.till.lock();
    expect(h.till.getState().snapshot?.meta.locked).toBe(false);
  });

  it('locks, stays locked on a wrong PIN, and opens on the cashier’s PIN with no request sent', async () => {
    const h = harness();
    await ready(h);
    const sentBefore = h.sent.length;
    await h.till.lock();
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    expect(await h.till.unlock('4820')).toEqual({ kind: 'wrong', attemptsLeft: 2 });
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    // The supervisor's PIN does not open the cashier's till.
    expect((await h.till.unlock('903412')).kind).toBe('wrong');
    expect((await h.till.unlock('4821')).kind).toBe('ok');
    expect(h.till.getState().snapshot?.meta.locked).toBe(false);
    expect(h.sent.length).toBe(sentBefore);
    // A right PIN clears the count.
    expect(h.till.getState().snapshot?.meta.pinAttempts[CASHIER]).toEqual({
      failures: 0,
      lockedUntil: null,
    });
  });

  it('locks the cashier out at the limit, refuses even the right PIN until the time is up, then opens', async () => {
    const h = harness();
    await ready(h);
    await h.till.lock();
    await h.till.unlock('1111');
    await h.till.unlock('2222');
    expect(await h.till.unlock('3333')).toEqual({
      kind: 'locked-out',
      until: '2026-11-16T11:55:00.000Z',
    });
    expect(await h.till.unlock('4821')).toEqual({
      kind: 'locked-out',
      until: '2026-11-16T11:55:00.000Z',
    });
    h.advance(300_000);
    expect((await h.till.unlock('4821')).kind).toBe('ok');
  });

  it('costs no attempt for something that is not a PIN', async () => {
    const h = harness();
    await ready(h);
    expect(await h.till.unlock('48')).toEqual({ kind: 'not-a-pin' });
    expect(h.till.getState().snapshot?.meta.pinAttempts[CASHIER]).toBeUndefined();
  });

  it('takes OFFLINE_SYNC 9.9: 31,000 as 20,000 unverified mobile money on the supervisor’s PIN and 11,000 cash from 15,000', async () => {
    const h = harness();
    await ready(h);
    expect((await h.till.checkPin(CASHIER, '4821', 'OFFLINE_MOBILE_MONEY')).kind).toBe(
      'no-verifier',
    );
    const approved = await h.till.checkPin(SUPERVISOR, '903412', 'OFFLINE_MOBILE_MONEY');
    if (approved.kind !== 'ok' || approved.record === null) throw new Error('not approved');
    expect(approved.record).toEqual({
      approval: 'OFFLINE_MOBILE_MONEY',
      principalId: SUPERVISOR,
      displayName: 'Akua Mensah',
      verifierVersion: 7,
      at: '2026-11-16T11:50:00.000Z',
    });
    const entry = await h.till.completeSale({
      lines: [EGGS],
      cashMethod: CASH,
      others: [
        {
          method: MOMO,
          paymentMethodId: MOMO.id,
          amountPesewas: 20000,
          unverifiedMobileMoney: {
            payerPhone: '+233245550142',
            network: 'MTN',
            providerReference: 'MP261113.1149.C41872',
            approvedById: SUPERVISOR,
          },
        },
      ],
      cashHandedPesewas: 15000,
      customerPhone: null,
      approvals: [approved.record],
    });
    const sale: OfflineSale = entry.payload;
    expect(entry.localTotalPesewas).toBe(31000);
    expect(sale.tenders).toEqual([
      {
        paymentMethodId: 'momo',
        amountPesewas: 20000,
        unverifiedMobileMoney: {
          payerPhone: '+233245550142',
          network: 'MTN',
          providerReference: 'MP261113.1149.C41872',
          approvedById: SUPERVISOR,
        },
      },
      { paymentMethodId: 'cash', amountPesewas: 11000, tenderedPesewas: 15000 },
    ]);
    expect(entry.receipt.changePesewas).toBe(4000);
    expect(entry.receipt.tenders[0]).toMatchObject({
      unverified: true,
      reference: 'MP261113.1149.C41872',
    });
    expect(entry.approvals).toEqual([approved.record]);
  });

  it('records a cash drop’s witness by id, with the verifier version beside it', async () => {
    const h = harness();
    await ready(h);
    const witnessed = await h.till.checkPin(SUPERVISOR, '903412', 'CASH_DROP_WITNESS');
    if (witnessed.kind !== 'ok' || witnessed.record === null) throw new Error('not witnessed');
    const drop = await h.till.recordCashMovement(
      { kind: 'CASH_DROP', amountPesewas: 50000, witnessId: SUPERVISOR },
      [witnessed.record],
    );
    expect(drop.payload).toMatchObject({ kind: 'CASH_DROP', witnessId: SUPERVISOR });
    expect(drop.approvals?.[0]?.verifierVersion).toBe(7);
  });

  it('forgets the verifiers and the lock when the shift ends', async () => {
    const h = harness();
    await ready(h);
    await h.till.lock();
    await h.till.endShift();
    const snapshot = h.till.getState().snapshot;
    expect(snapshot?.localAuth).toBeNull();
    expect(snapshot?.meta.locked).toBe(false);
  });
});
