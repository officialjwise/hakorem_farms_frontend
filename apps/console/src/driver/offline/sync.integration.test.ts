/**
 * The driver's requests against the REAL Prism mock (ADR 0019), which validates every request body, header
 * and security scheme against the contract and answers 422 for a body that breaks it. So these prove the
 * shapes the phone sends are the contract's: "on my way", the proof's photograph, and proofs and failures
 * in `syncDriverEvents`. They cannot prove exactly once by id: Prism keeps no state, and its example
 * answer names other client ids, so the phone keeps its records queued after it (the unit tests and the
 * e2e gate prove the rest).
 */
import { ApiError, createApiClient, type ApiClient } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import { DriverRun } from './run';
import { memoryDriverStore } from './store';

const MOCK = 'http://127.0.0.1:4010';
const api = createApiClient({
  baseUrl: MOCK,
  headers: { Cookie: '__Host-hk_s_at=x' },
  session: {
    refresh: () => Promise.resolve(),
    onExpired: () => undefined,
    getCsrfToken: () => 'csrf-token',
    getDeviceCredential: () => null,
  },
});

const DELIVERY = '019a7b08-ee6c-7c81-81b9-d0ebe01149c9';
const OTHER = '019a7b09-2c4a-7048-a580-0d5ad3738638';

/** The real client, recording what each operation answered or refused. */
function recording() {
  const answers: { operation: string; status: number }[] = [];
  const call = (async (operation: string, ...rest: unknown[]) => {
    try {
      const result = await (api.call as (...args: unknown[]) => Promise<unknown>)(
        operation,
        ...rest,
      );
      answers.push({ operation, status: 200 });
      return result;
    } catch (error) {
      answers.push({ operation, status: error instanceof ApiError ? error.status : -1 });
      throw error;
    }
  }) as ApiClient['call'];
  return { call, answers };
}

describe('the driver speaks the contract (Prism validates every body)', () => {
  it('reads the run, every stop, the cash, the reasons and the units', async () => {
    const { call, answers } = recording();
    const run = new DriverRun({ store: memoryDriverStore(), call });
    await run.start();
    await run.refresh();
    expect(run.getState().read.kind).toBe('read');
    expect(answers.every((a) => a.status === 200)).toBe(true);
    expect(answers.map((a) => a.operation)).toEqual(
      expect.arrayContaining([
        'getMyRoute',
        'getMyDelivery',
        'getMyCashSummary',
        'listReasonCodes',
      ]),
    );
  });

  it('sends "on my way", the photograph and the proof and failure batch in the contract shapes', async () => {
    const { call, answers } = recording();
    const run = new DriverRun({
      store: memoryDriverStore(),
      call,
      setTimer: () => 0,
      clearTimer: () => undefined,
    });
    await run.start();
    await run.markOnTheWay(DELIVERY);
    const photo = await run.keepPhoto(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    );
    await run.recordProof({
      deliveryId: DELIVERY,
      recipientName: 'Asantewaa Boateng',
      photoLocalId: photo,
      codCollectedPesewas: 24000,
      position: { latitude: '5.705940', longitude: '-0.159080', accuracyM: 9 },
    });
    await run.recordFailure({
      deliveryId: OTHER,
      failureReasonCode: 'CUSTOMER_NOT_AVAILABLE',
      nextAction: 'REATTEMPT',
      position: null,
    });
    await run.flush();
    const sent = answers.filter((a) =>
      ['markOnTheWay', 'uploadFile', 'syncDriverEvents'].includes(a.operation),
    );
    expect(sent.map((a) => a.operation)).toEqual(
      expect.arrayContaining(['markOnTheWay', 'uploadFile', 'syncDriverEvents']),
    );
    // Accepted: not a 400 or 422 among them.
    expect(sent.filter((a) => a.status !== 200)).toEqual([]);
    // Prism's answer names its example's ids, not these: nothing is marked from it.
    const entries = run.getState().snapshot?.entries ?? [];
    expect(entries.filter((e) => e.localStatus === 'REJECTED')).toEqual([]);
  });

  it('is refused by the mock for a body that breaks the contract, so the passes above mean something', async () => {
    const refused = await api
      .call('syncDriverEvents', {
        body: {
          proofs: [
            {
              deliveryId: DELIVERY,
              // A float of cedis where the contract takes integer pesewas.
              proof: {
                id: '019a7b0a-be6d-70d5-b60d-162c01708f09',
                recipientName: 'x',
                codCollectedPesewas: 240.5,
                capturedAt: '2026-11-18T11:52:00Z',
              },
            },
          ],
          failures: [],
        },
      })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ApiError);
    expect([400, 422]).toContain((refused as ApiError).status);
  });
});
