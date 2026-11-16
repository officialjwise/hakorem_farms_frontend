/**
 * The till's requests against the REAL Prism mock (ADR 0019), which validates every request body, header
 * and security scheme against the contract and answers 422 for a body that breaks it. So these prove the
 * shapes the till sends are the contract's: the shift it opens, a sale built by the till and its batch,
 * a cash movement, a held sale, the close, the enrolment and a return. They cannot prove what only the real
 * API does (exactly once by id, counter gaps, the hash check): Prism keeps no state.
 */
import { ApiError, createApiClient } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import { newRecordId } from '../../lib/clientId';
import type { CartLine } from './cart';
import { buildSale } from './sale';
import { memoryStore } from './store';
import { Till } from './till';
import type { DeviceRecord, OfflineSale, ShiftRecord } from './types';

const MOCK = 'http://127.0.0.1:4010';
const api = createApiClient({
  baseUrl: MOCK,
  // Prism checks the security schemes are present: the staff cookie, and the till's credential where the
  // contract asks for it, which the client sends from the session hooks as the till does (ADR 0044).
  headers: { Cookie: '__Host-hk_s_at=x' },
  session: {
    refresh: () => Promise.resolve(),
    onExpired: () => undefined,
    getCsrfToken: () => 'csrf-token',
    getDeviceCredential: () => 'hkdev_T1.test',
  },
});

const REGISTER = '019a7a94-15a3-7248-9781-2d5f347aa63d';
const DEVICE: DeviceRecord = {
  deviceId: '019af9a1-1a1f-7d1b-9253-da889a7e5366',
  deviceLabel: 'Counter tablet',
  registerId: REGISTER,
  registerCode: 'T1',
  registerName: 'Shop till 1',
  branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
  credential: 'hkdev_T1.test',
  enrolledAt: '2026-11-16T06:00:00Z',
};
const CASH = {
  id: '019a7a92-a26f-7b9f-90d7-c2c5802e3ba3',
  code: 'CASH',
  name: 'Cash',
  kind: 'CASH',
};
const GOAT: CartLine = {
  key: 'goat',
  productId: '019a7a8d-137d-74bf-b9f8-54cda260cdab',
  productName: 'Goat',
  saleUom: 'HEAD',
  priceBasis: 'PER_HEAD',
  taxCategoryId: '019a7a8a-6af3-7b33-906b-bc092d2a34e7',
  stockUnitId: '019a7a8f-5f3a-70a1-a5d9-12ebaa838bc9',
  stockUnitIdentifier: 'G-0142',
  gradeId: null,
  quantity: '1.000',
  weightKg: '26.400',
  weightSource: 'ESTIMATE',
  listUnitPricePesewas: 85000,
  floorUnitPricePesewas: 12000,
  ceilingUnitPricePesewas: 195000,
  agreedUnitPricePesewas: 82000,
  varianceReasonCode: 'REGULAR_CUSTOMER',
};
const BEEF: CartLine = {
  ...GOAT,
  key: 'beef',
  productId: '019a7a8e-29e4-7dbe-82f7-e4c0e9995d9e',
  productName: 'Beef, 15 kg pack',
  saleUom: 'PACK',
  priceBasis: 'PER_KG',
  stockUnitId: null,
  stockUnitIdentifier: null,
  weightKg: '15.250',
  weightSource: 'MANUAL',
  listUnitPricePesewas: 3000,
  agreedUnitPricePesewas: 3000,
  varianceReasonCode: null,
};

function shift(): ShiftRecord {
  return {
    id: newRecordId(),
    registerId: REGISTER,
    cashierId: '019a7a86-ac02-78a8-ade0-935170bb0c2f',
    cashierName: 'Adwoa Darko',
    openingFloatPesewas: 20000,
    openedAt: new Date().toISOString(),
    shiftSeq: 312,
    shiftNo: null,
    referenceSeq: 312,
    lastCounter: 0,
    discountGivenPesewas: 0,
    confirmed: true,
  };
}

describe('the till speaks the contract (Prism validates every body)', () => {
  it('opens a shift with a client id, offline-style', async () => {
    const id = newRecordId();
    const opened = await api.call(
      'openShift',
      {
        body: {
          id,
          registerId: REGISTER,
          openingFloatPesewas: 20000,
          openedAt: new Date().toISOString(),
        },
      },
      { idempotencyKey: id },
    );
    expect(opened.status).toBe('OPEN');
  });

  it('downloads the offline pack the till sells from', async () => {
    const pack = await api.call('getOfflinePack', { path: { id: REGISTER } });
    expect(pack.products.length).toBeGreaterThan(0);
    expect(pack.policy.offlineTenderMethodIds.length).toBeGreaterThan(0);
  });

  it('sends a sale the till built, with its counter, reference and hash, in a batch', async () => {
    const { entry } = await buildSale({
      device: DEVICE,
      shift: shift(),
      lines: [GOAT, BEEF],
      cashMethod: CASH,
      others: [],
      cashHandedPesewas: 130000,
      customerPhone: null,
      now: new Date(),
    });
    expect(entry.localTotalPesewas).toBe(127750);
    const result = await api.call('syncOfflineSales', {
      body: { deviceId: DEVICE.deviceId, shiftId: entry.shiftId, sales: [entry.payload] },
    });
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('is refused by the mock for a body that breaks the contract, so the passes above mean something', async () => {
    const { entry } = await buildSale({
      device: DEVICE,
      shift: shift(),
      lines: [GOAT],
      cashMethod: CASH,
      others: [],
      cashHandedPesewas: 82000,
      customerPhone: null,
      now: new Date(),
    });
    const broken = {
      ...entry.payload,
      lines: [{ ...entry.payload.lines[0], quantity: '1' }],
    } as OfflineSale;
    const refused = await api
      .call('syncOfflineSales', {
        body: { deviceId: DEVICE.deviceId, shiftId: entry.shiftId, sales: [broken] },
      })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).status).toBe(422);
  });

  it('is refused without the till credential where the contract asks for it (ADR 0044)', async () => {
    const browser = createApiClient({
      baseUrl: MOCK,
      headers: { Cookie: '__Host-hk_s_at=x' },
      session: {
        refresh: () => Promise.resolve(),
        onExpired: () => undefined,
        getCsrfToken: () => 'csrf-token',
      },
    });
    const refused = await browser
      .call('syncOfflineSales', {
        body: { deviceId: DEVICE.deviceId, shiftId: newRecordId(), sales: [] },
      })
      .then(() => null)
      .catch((error: unknown) => error);
    expect((refused as ApiError).status).toBe(401);
    // A read that does not name the scheme needs no credential.
    await expect(browser.call('listRegisters', {})).resolves.toBeDefined();
  });

  it('runs a whole pass through the till against the mock: the batch is accepted', async () => {
    const store = memoryStore({ device: DEVICE, shift: shift() });
    const till = new Till({
      store,
      call: api.call,
      setTimer: () => 0,
      clearTimer: () => undefined,
    });
    await till.start();
    await till.completeSale({
      lines: [BEEF],
      cashMethod: CASH,
      others: [],
      cashHandedPesewas: 50000,
      customerPhone: null,
    });
    await till.recordCashMovement({ kind: 'CASH_DROP', amountPesewas: 10000 });
    await till.flush();
    const snapshot = await store.read();
    // Prism answers with the contract's example sales, not these, so they stay queued; the batch was valid.
    expect(snapshot.syncLog.at(-1)?.status).toBe(200);
    expect(snapshot.entries.every((e) => e.failure === null)).toBe(true);
  });

  it('records a cash movement, holds a sale, declares a close and enrols a device in the contract shapes', async () => {
    const shiftId = '019a7a93-f6b4-7865-8d9d-8f27bac90805';
    const movement = newRecordId();
    await api.call(
      'recordCashMovement',
      {
        path: { id: shiftId },
        body: {
          id: movement,
          kind: 'PAY_OUT',
          amountPesewas: 2500,
          reasonCode: 'FUEL',
          occurredAt: new Date().toISOString(),
        },
      },
      { idempotencyKey: movement },
    );
    const held = newRecordId();
    await api.call(
      'holdSale',
      {
        path: { id: REGISTER },
        body: { id: held, label: 'Auntie Esi', payload: { lines: [BEEF] } },
      },
      { idempotencyKey: held },
    );
    const closed = await api.call(
      'closeShift',
      {
        path: { id: shiftId },
        body: {
          declared: [{ paymentMethodId: CASH.id, declaredPesewas: 822500 }],
          lastDeviceCounter: 18,
        },
      },
      { idempotencyKey: newRecordId() },
    );
    expect(closed.status).toBe('CLOSING');
    const enrolled = await api.call(
      'enrolDevice',
      { path: { id: REGISTER }, body: { deviceLabel: 'Counter tablet' } },
      { idempotencyKey: newRecordId() },
    );
    expect(enrolled.deviceCredential).not.toBe('');
  });

  it('takes a return against a receipt in the contract shape', async () => {
    const created = await api.call(
      'createReturn',
      {
        body: {
          orderId: '019a7aac-216c-721a-8753-2a7ecd11a35c',
          kind: 'RETURN',
          reasonCode: 'CHANGED_MIND',
          refundDestination: 'CASH',
          lines: [
            {
              orderLineId: '019a7aef-eb2b-7d93-92cc-e21079f25aee',
              qty: '1.000',
              disposition: 'RESTOCK',
            },
          ],
        },
      },
      { idempotencyKey: newRecordId() },
    );
    expect(created.id).toBeTruthy();
  });
});
