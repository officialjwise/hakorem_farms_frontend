import { pbkdf2Sync } from 'node:crypto';
import type { ApiClient, components } from '@hakorem/api-client';
import { describe, expect, it } from 'vitest';
import { MIN_PBKDF2_ITERATIONS, type TillPinEvent, type TillSignOut } from '../pin/pin';
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

type Verifier = components['schemas']['TillPinVerifier'];
type VerifierList = components['schemas']['TillPinVerifierList'];

/** A person as the fake server holds them: their PIN version, its material, its tries and its lock. */
interface Person {
  id: string;
  name: string;
  role: Verifier['role'];
  version: number;
  pin: string;
  iterations: number;
  salt: string;
  wrongTries: number;
  locked: boolean;
}

/** At the owner's floor (600,000 iterations, a 16-byte-plus salt), made by Node's own PBKDF2. */
function material(person: Person) {
  const salt = Buffer.from(person.salt);
  return {
    pinSalt: salt.toString('base64'),
    pinHash: pbkdf2Sync(person.pin, salt, person.iterations, 32, 'sha256').toString('base64'),
  };
}

const hashes = new Map<string, { pinSalt: string; pinHash: string }>();
function cachedMaterial(person: Person) {
  const key = `${person.id}:${person.pin}:${person.salt}:${String(person.iterations)}`;
  const made = hashes.get(key) ?? material(person);
  hashes.set(key, made);
  return made;
}

/**
 * The server's side of 2.17.0 as the till needs it (`listTillPinVerifiers`, `reportTillPinEvents`,
 * `setTillPin`): it counts every wrong try against a PIN version once, locks at its limit until a new PIN
 * is set, sends a locked PIN with no material, and takes a sign-out only for a cashier it holds locked.
 */
function fakeServer(options: { maxWrongTries?: number; weak?: string[] } = {}) {
  const max = options.maxWrongTries ?? 3;
  const people: Person[] = [
    {
      id: CASHIER,
      name: 'Adwoa Darko',
      role: 'OPERATOR',
      version: 2,
      pin: '4821',
      iterations: MIN_PBKDF2_ITERATIONS,
      salt: `salt-for-${CASHIER}`,
      wrongTries: 0,
      locked: false,
    },
    {
      id: SUPERVISOR,
      name: 'Akua Mensah',
      role: 'SUPERVISOR',
      version: 7,
      pin: '903412',
      iterations: MIN_PBKDF2_ITERATIONS,
      salt: `salt-for-${SUPERVISOR}`,
      wrongTries: 0,
      locked: false,
    },
  ];
  for (const person of people) {
    if (options.weak?.includes(person.id)) person.iterations = 1000;
  }
  const seen = new Set<string>();
  const server = {
    reachable: true,
    people,
    reports: [] as { events: TillPinEvent[]; signOuts: TillSignOut[] }[],
    signOutResults: [] as { id: string; outcome: string; reason: string | null }[],
    pinsSet: [] as unknown[],
    list(): VerifierList {
      return {
        registerId: DEVICE.registerId,
        asOf: '2026-11-16T11:50:00Z',
        policy: { maxWrongTries: max, lockedUntil: 'NEW_PIN_SET' },
        data: server.people.map((person) => ({
          principal: { id: person.id, displayName: person.name },
          role: person.role,
          version: person.version,
          algorithm: 'PBKDF2-SHA256',
          iterations: person.iterations,
          ...(person.locked ? { pinSalt: null, pinHash: null } : cachedMaterial(person)),
          wrongTries: person.wrongTries,
          locked: person.locked,
          priceOverrideLimitPerLinePesewas: person.role === 'SUPERVISOR' ? 5000 : 500,
        })),
      };
    },
    report(body: { events: TillPinEvent[]; signOuts?: TillSignOut[] }) {
      const signOuts = body.signOuts ?? [];
      server.reports.push({ events: body.events, signOuts });
      const eventResults = body.events.map((event) => {
        if (seen.has(event.id)) return { id: event.id, outcome: 'DUPLICATE', reason: null };
        seen.add(event.id);
        const person = server.people.find((p) => p.id === event.principalId);
        if (person === undefined || person.version !== event.pinVersion)
          return { id: event.id, outcome: 'REJECTED', reason: 'PIN_UNKNOWN' };
        if (event.outcome === 'FAILED') {
          person.wrongTries += 1;
          if (person.wrongTries >= max) person.locked = true;
        }
        return { id: event.id, outcome: 'APPLIED', reason: null };
      });
      const results = signOuts.map((signOut) => {
        const cashier = server.people.find((p) => p.id === signOut.cashierId);
        const result =
          cashier?.locked === true
            ? { id: signOut.id, outcome: 'APPLIED', reason: null }
            : { id: signOut.id, outcome: 'REJECTED', reason: 'CASHIER_NOT_LOCKED' };
        server.signOutResults.push(result);
        return result;
      });
      return {
        eventResults,
        signOutResults: results,
        locked: server.people
          .filter((p) => p.locked)
          .map((p) => ({ id: p.id, displayName: p.name })),
        serverTime: '2026-11-16T11:50:00Z',
      };
    },
    /** `setTillPin` for the cashier: the next version, its lock cleared, from the verifier sent. */
    setPin(body: { pinSalt: string; pinHash: string; iterations: number }) {
      server.pinsSet.push(body);
      const cashier = server.people.find((p) => p.id === CASHIER);
      if (cashier === undefined) throw new Error('no cashier');
      cashier.version += 1;
      cashier.wrongTries = 0;
      cashier.locked = false;
      cashier.salt = `set:${String(cashier.version)}`;
      return { version: cashier.version };
    },
  };
  return server;
}

function harness(server = fakeServer()) {
  let time = new Date('2026-11-16T11:50:00Z').getTime();
  const sent: { operation: string; body?: unknown }[] = [];
  const call = (async (operation: string, input?: { body?: unknown; path?: { id?: string } }) => {
    sent.push({ operation, body: input?.body });
    if (operation === 'getOfflinePack') return { policy: {} } as unknown as OfflinePack;
    if (operation === 'openShift')
      return { id: (input?.body as { id: string }).id, shiftSeq: 311, shiftNo: 'SH-311' };
    if (!server.reachable) throw new TypeError('Failed to fetch');
    if (operation === 'listTillPinVerifiers') return server.list();
    if (operation === 'reportTillPinEvents')
      return server.report(input?.body as { events: TillPinEvent[] });
    if (operation === 'setTillPin') {
      const { version } = server.setPin(
        input?.body as { pinSalt: string; pinHash: string; iterations: number },
      );
      const cashier = server.people.find((p) => p.id === CASHIER);
      // The fake's material for the new version is what the till sent.
      if (cashier !== undefined) {
        const body = input?.body as { pinSalt: string; pinHash: string };
        hashes.set(
          `${cashier.id}:${cashier.pin}:${cashier.salt}:${String(cashier.iterations)}`,
          body,
        );
      }
      return { version };
    }
    throw new Error('unreachable');
  }) as unknown as ApiClient['call'];
  const store = memoryStore({ device: DEVICE });
  const till = new Till({
    store,
    call,
    now: () => new Date(time),
    random: () => 0.5,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
  const operations = (name: string) => sent.filter((s) => s.operation === name);
  return { till, sent, operations, server, advance: (ms: number) => (time += ms) };
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

/** Lets the pass a PIN try started finish, as the browser would before the next tap. */
async function settled(h: ReturnType<typeof harness>) {
  await h.till.flush();
}

describe('the till PIN (CR-032, as 2.17.0 carries it)', () => {
  it('reads the verifiers with the pack and keeps them on the device', async () => {
    const h = harness();
    await ready(h);
    expect(h.operations('listTillPinVerifiers')).toHaveLength(1);
    const local = h.till.getState().snapshot?.localAuth;
    expect(local?.verifiers.map((v) => [v.displayName, v.role, v.approves.length])).toEqual([
      ['Adwoa Darko', 'OPERATOR', 0],
      ['Akua Mensah', 'SUPERVISOR', 4],
    ]);
    expect(local?.policy.maxAttempts).toBe(3);
    expect(h.till.canLock()).toBe(true);
  });

  it('locks, stays locked on a wrong PIN, and opens on the cashier’s PIN with no network', async () => {
    const h = harness();
    await ready(h);
    h.server.reachable = false;
    await h.till.lock();
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    expect(await h.till.unlock('4820')).toEqual({ kind: 'wrong', attemptsLeft: 2 });
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    // The supervisor's PIN does not open the cashier's till.
    expect((await h.till.unlock('903412')).kind).toBe('wrong');
    expect((await h.till.unlock('4821')).kind).toBe('ok');
    expect(h.till.getState().snapshot?.meta.locked).toBe(false);
    // A right PIN does not wipe a wrong try (2.17.0): one more wrong one locks it.
    expect(h.till.getState().snapshot?.meta.pinAttempts[CASHIER]).toEqual({
      version: 2,
      failures: 2,
      lockedOut: false,
    });
    // Every try is kept for the server, right or wrong, with what it was for.
    expect(
      h.till.getState().snapshot?.meta.pinEvents.map((e) => [e.outcome, e.purpose, e.pinVersion]),
    ).toEqual([
      ['FAILED', 'UNLOCK', 2],
      ['FAILED', 'UNLOCK', 2],
      ['SUCCEEDED', 'UNLOCK', 2],
    ]);
  });

  it('tells the server every try once it can be reached, before the queue, and only once', async () => {
    const h = harness();
    await ready(h);
    await h.till.lock();
    await h.till.unlock('4820');
    await settled(h);
    await h.till.unlock('4821');
    await settled(h);
    const sentEvents = h.server.reports.flatMap((r) => r.events);
    expect(sentEvents.map((e) => e.outcome)).toEqual(['FAILED', 'SUCCEEDED']);
    expect(new Set(sentEvents.map((e) => e.id)).size).toBe(2);
    expect(h.till.getState().snapshot?.meta.pinEvents).toEqual([]);
    expect(h.server.people[0]?.wrongTries).toBe(1);
  });

  it('locks the PIN at the server’s lower limit, and no time on the device clock ends it', async () => {
    const h = harness();
    await ready(h);
    h.server.reachable = false;
    await h.till.lock();
    expect(await h.till.unlock('1111')).toEqual({ kind: 'wrong', attemptsLeft: 2 });
    await h.till.unlock('2222');
    expect(await h.till.unlock('3333')).toEqual({ kind: 'locked-out' });
    expect(await h.till.unlock('4821')).toEqual({ kind: 'locked-out' });
    // A clock moved on a year changes nothing.
    h.advance(365 * 24 * 3600 * 1000);
    expect(await h.till.unlock('4821')).toEqual({ kind: 'locked-out' });
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    expect(h.till.pinLocked(CASHIER)).toBe(true);
    // The tries wait on the device for the server; a locked PIN is not tried again.
    expect(h.till.getState().snapshot?.meta.pinEvents).toHaveLength(3);
  });

  it('allows at most five wrong tries when the server sends more', async () => {
    const h = harness(fakeServer({ maxWrongTries: 10 }));
    await ready(h);
    h.server.reachable = false;
    expect(h.till.getState().snapshot?.localAuth?.policy.maxAttempts).toBe(5);
    await h.till.lock();
    for (const pin of ['1111', '2222', '3333', '4444']) {
      expect((await h.till.unlock(pin)).kind).toBe('wrong');
    }
    expect(await h.till.unlock('5555')).toEqual({ kind: 'locked-out' });
  });

  it('counts the wrong tries the server holds from other tills', async () => {
    const h = harness();
    const cashier = h.server.people[0];
    if (cashier === undefined) throw new Error('no cashier');
    cashier.wrongTries = 2;
    await ready(h);
    await h.till.lock();
    expect(await h.till.unlock('1111')).toEqual({ kind: 'locked-out' });
  });

  it('ends a lockout only with a new PIN: the server keeps it, and reaching it again changes nothing', async () => {
    const h = harness();
    await ready(h);
    h.server.reachable = false;
    for (const pin of ['1111', '2222', '3333']) await h.till.checkPin(CASHIER, pin);
    expect(await h.till.reachServer()).toBe(false);
    h.server.reachable = true;
    expect(await h.till.reachServer()).toBe(true);
    expect(h.server.people[0]).toMatchObject({ wrongTries: 3, locked: true });
    expect(h.till.getState().snapshot?.meta.pinEvents).toEqual([]);
    // The server sends the locked PIN with no material: kept as locked, never as weak.
    const kept = h.till
      .getState()
      .snapshot?.localAuth?.verifiers.find((v) => v.principalId === CASHIER);
    expect(kept).toMatchObject({ locked: true, salt: null, hash: null });
    expect(h.till.refusedVerifier(CASHIER)).toBe(false);
    expect(await h.till.checkPin(CASHIER, '4821')).toEqual({ kind: 'locked-out' });
    await h.till.reachServer();
    expect(await h.till.checkPin(CASHIER, '4821')).toEqual({ kind: 'locked-out' });
    expect(h.till.canLock()).toBe(false);
  });

  it('sets the cashier’s own PIN: the till sends only the verifier, and the new version opens it', async () => {
    const h = harness();
    await ready(h);
    for (const pin of ['1111', '2222', '3333']) await h.till.checkPin(CASHIER, pin);
    await settled(h);
    expect(h.till.pinLocked(CASHIER)).toBe(true);
    expect(await h.till.setOwnPin('12', 'intent-1')).toBe('not-a-pin');
    expect(h.operations('setTillPin')).toHaveLength(0);
    expect(await h.till.setOwnPin('7350', 'intent-1')).toBe('set');
    const set = h.operations('setTillPin')[0]?.body as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(['algorithm', 'iterations', 'pinHash', 'pinSalt']);
    expect(JSON.stringify(set)).not.toContain('7350');
    expect(set.iterations).toBe(600_000);
    expect(h.till.pinLocked(CASHIER)).toBe(false);
    expect(h.till.getState().snapshot?.meta.pinAttempts[CASHIER]).toEqual({
      version: 3,
      failures: 0,
      lockedOut: false,
    });
    expect((await h.till.checkPin(CASHIER, '7350')).kind).toBe('ok');
    expect((await h.till.checkPin(CASHIER, '4821')).kind).toBe('wrong');
  });

  it('keeps a lockout through a sign-out and the end of the shift', async () => {
    const h = harness();
    await ready(h);
    h.server.reachable = false;
    for (const pin of ['1111', '2222', '3333']) await h.till.checkPin(SUPERVISOR, pin);
    await h.till.forgetPins();
    await h.till.endShift();
    const meta = h.till.getState().snapshot?.meta;
    expect(meta?.pinAttempts[SUPERVISOR]).toEqual({ version: 7, failures: 3, lockedOut: true });
    expect(meta?.pinEvents).toHaveLength(3);
  });

  it('refuses to store or check a verifier below the floor, and names whose it was', async () => {
    const h = harness(fakeServer({ weak: [CASHIER, SUPERVISOR] }));
    await ready(h);
    const local = h.till.getState().snapshot?.localAuth;
    expect(local?.verifiers).toEqual([]);
    expect(local?.refused).toEqual([
      { principalId: CASHIER, displayName: 'Adwoa Darko' },
      { principalId: SUPERVISOR, displayName: 'Akua Mensah' },
    ]);
    expect(h.till.refusedVerifier(CASHIER)).toBe(true);
    // The cashier cannot lock the till with a PIN: only the online sign-in opens it.
    expect(h.till.canLock()).toBe(false);
    expect(await h.till.checkPin(CASHIER, '4821')).toEqual({ kind: 'weak-verifier' });
    expect(await h.till.checkPin(SUPERVISOR, '903412', 'CASH_DROP_WITNESS')).toEqual({
      kind: 'weak-verifier',
    });
  });

  it('signs a locked-out cashier out only on a supervisor’s PIN, sent after the tries that locked them', async () => {
    const h = harness();
    await ready(h);
    h.server.reachable = false;
    await h.till.lock();
    // While the cashier's PIN is not locked, there is no sign-out: the server would refuse it.
    expect(await h.till.supervisorSignOut(SUPERVISOR, '903412')).toEqual({ kind: 'no-verifier' });
    for (const pin of ['1111', '2222', '3333']) await h.till.unlock(pin);
    // The cashier is not offered, and cannot sign themselves out with their own PIN.
    expect(h.till.signOutSupervisors().map((v) => v.principalId)).toEqual([SUPERVISOR]);
    expect(await h.till.supervisorSignOut(CASHIER, '4821')).toEqual({ kind: 'no-verifier' });
    expect(await h.till.supervisorSignOut(SUPERVISOR, '111111')).toEqual({
      kind: 'wrong',
      attemptsLeft: 2,
    });
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
    h.advance(60_000);
    const outcome = await h.till.supervisorSignOut(SUPERVISOR, '903412');
    expect(outcome.kind).toBe('ok');
    const meta = h.till.getState().snapshot?.meta;
    // It never opens the till, and the cashier's PIN stays locked: the caller signs the session out.
    expect(meta?.locked).toBe(true);
    expect(h.till.pinLocked(CASHIER)).toBe(true);
    expect(meta?.pinSignOuts).toEqual([
      {
        id: expect.any(String) as string,
        cashierId: CASHIER,
        shiftId: h.till.getState().snapshot?.shift?.id,
        supervisorId: SUPERVISOR,
        supervisorPinVersion: 7,
        occurredAt: '2026-11-16T11:51:00.000Z',
      },
    ]);
    // Sent once the server can be reached, in one report with the tries before it.
    h.server.reachable = true;
    await h.till.reachServer();
    const report = h.server.reports[0];
    expect(report?.events.map((e) => [e.principalId === CASHIER, e.outcome, e.purpose])).toEqual([
      [true, 'FAILED', 'UNLOCK'],
      [true, 'FAILED', 'UNLOCK'],
      [true, 'FAILED', 'UNLOCK'],
      [false, 'FAILED', 'SIGN_OUT'],
      [false, 'SUCCEEDED', 'SIGN_OUT'],
    ]);
    expect(report?.signOuts).toHaveLength(1);
    expect(h.server.signOutResults).toEqual([
      { id: report?.signOuts[0]?.id, outcome: 'APPLIED', reason: null },
    ]);
    expect(h.till.getState().snapshot?.meta.pinSignOuts).toEqual([]);
  });

  it('leaves a locked cashier locked when no supervisor here can sign them out', async () => {
    const server = fakeServer();
    server.people.splice(1, 1);
    const h = harness(server);
    await ready(h);
    await h.till.lock();
    expect(h.till.signOutSupervisors()).toEqual([]);
    expect(await h.till.supervisorSignOut(SUPERVISOR, '903412')).toEqual({ kind: 'no-verifier' });
    expect(h.till.getState().snapshot?.meta.locked).toBe(true);
  });

  it('costs no attempt for something that is not a PIN', async () => {
    const h = harness();
    await ready(h);
    expect(await h.till.unlock('48')).toEqual({ kind: 'not-a-pin' });
    expect(h.till.getState().snapshot?.meta.pinEvents).toEqual([]);
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
            approvedByPinVersion: approved.record.verifierVersion,
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
          approvedByPinVersion: 7,
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

  it('records a cash drop’s witness by id and PIN version (2.17.0)', async () => {
    const h = harness();
    await ready(h);
    const witnessed = await h.till.checkPin(SUPERVISOR, '903412', 'CASH_DROP_WITNESS');
    if (witnessed.kind !== 'ok' || witnessed.record === null) throw new Error('not witnessed');
    const drop = await h.till.recordCashMovement(
      {
        kind: 'CASH_DROP',
        amountPesewas: 50000,
        witnessId: SUPERVISOR,
        witnessPinVersion: witnessed.record.verifierVersion,
      },
      [witnessed.record],
    );
    expect(drop.payload).toMatchObject({
      kind: 'CASH_DROP',
      witnessId: SUPERVISOR,
      witnessPinVersion: 7,
    });
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
