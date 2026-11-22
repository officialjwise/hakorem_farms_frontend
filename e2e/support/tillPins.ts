/**
 * The till PIN's server side for the end-to-end suite (2.17.0, CR-032 as it landed): `listTillPinVerifiers`,
 * `reportTillPinEvents` and `setTillPin`, answered in the contract's shapes with the state Prism cannot
 * keep. The server counts every wrong try against a PIN version once, locks it at the policy's limit until
 * its owner sets a new PIN, sends a locked PIN with no salt or hash, and takes a supervisor's sign-out only
 * for a cashier it holds locked (`CASHIER_NOT_LOCKED`).
 */
import { pbkdf2Sync } from 'node:crypto';
import type { components } from '@hakorem/api-client';
import type { FakeApi } from './fakeApi';

type Schemas = components['schemas'];

export const PEOPLE = {
  cashier: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', name: 'Adwoa Darko', pin: '4821' },
  manager: { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', name: 'Kwabena Owusu', pin: '903412' },
} as const;

/** The mobile money method in `getOfflinePack`'s example. */
export const MOMO_METHOD_ID = '019a7a92-c15e-7582-aabb-60fcf9dfd9da';

/** Three tries: the server's limit is lower than the owner's five, so it wins. No lockout time. */
export const MAX_WRONG_TRIES = 3;

/** The owner's floor (2026-11-17). */
const ITERATIONS = 600_000;
const hashes = new Map<string, string>();

interface HeldPin {
  id: string;
  name: string;
  role: Schemas['TillPinVerifier']['role'];
  version: number;
  iterations: number;
  pinSalt: string;
  pinHash: string;
  wrongTries: number;
  locked: boolean;
}

/** A verifier as a till makes one when its owner sets the PIN: PBKDF2-SHA256, a 16-byte-plus salt. */
function held(
  person: (typeof PEOPLE)[keyof typeof PEOPLE],
  role: HeldPin['role'],
  version: number,
  weak: boolean,
): HeldPin {
  const salt = Buffer.from(`e2e-salt-${person.id}`);
  const iterations = weak ? 10_000 : ITERATIONS;
  const key = `${person.id}-${String(iterations)}`;
  const hash =
    hashes.get(key) ?? pbkdf2Sync(person.pin, salt, iterations, 32, 'sha256').toString('base64');
  hashes.set(key, hash);
  return {
    id: person.id,
    name: person.name,
    role,
    version,
    iterations,
    pinSalt: salt.toString('base64'),
    pinHash: hash,
    wrongTries: 0,
    locked: false,
  };
}

export interface TillPinServer {
  /** How many times the verifiers were read. */
  issued: number;
  /** Each `reportTillPinEvents` body the till sent, in order. */
  reports: Schemas['TillPinReport'][];
  /** Each `setTillPin` body, in order: the verifier the till made, never the PIN. */
  pinsSet: Schemas['TillPinSet'][];
  /** The PINs as the server holds them, by person. */
  pins: Map<string, HeldPin>;
}

/**
 * The cashier's PIN (an operator's, version 2) and the manager's (a supervisor's, version 7). `weakCashier`
 * holds the cashier's below the owner's floor, as a till of an older build might have set it.
 */
export function installTillPins(
  api: FakeApi,
  options: { weakCashier?: boolean } = {},
): TillPinServer {
  const server: TillPinServer = {
    issued: 0,
    reports: [],
    pinsSet: [],
    pins: new Map([
      [PEOPLE.cashier.id, held(PEOPLE.cashier, 'OPERATOR', 2, options.weakCashier === true)],
      [PEOPLE.manager.id, held(PEOPLE.manager, 'SUPERVISOR', 7, false)],
    ]),
  };
  const seen = new Set<string>();
  api.respond('listTillPinVerifiers', (_request, path): Schemas['TillPinVerifierList'] => {
    server.issued += 1;
    return {
      registerId: path.split('/')[2] ?? '',
      data: [...server.pins.values()].map((pin) => ({
        principal: { id: pin.id, displayName: pin.name },
        role: pin.role,
        version: pin.version,
        algorithm: 'PBKDF2-SHA256',
        iterations: pin.iterations,
        pinSalt: pin.locked ? null : pin.pinSalt,
        pinHash: pin.locked ? null : pin.pinHash,
        wrongTries: pin.wrongTries,
        locked: pin.locked,
        priceOverrideLimitPerLinePesewas: pin.role === 'SUPERVISOR' ? 10_000 : 2_000,
      })),
      policy: { maxWrongTries: MAX_WRONG_TRIES, lockedUntil: 'NEW_PIN_SET' },
      asOf: new Date().toISOString(),
    };
  });
  api.respond('reportTillPinEvents', (request): Schemas['TillPinReportResult'] => {
    const report = request as Schemas['TillPinReport'];
    server.reports.push(report);
    const eventResults = report.events.map((event) => {
      if (seen.has(event.id)) return { id: event.id, outcome: 'DUPLICATE' as const, reason: null };
      seen.add(event.id);
      const pin = server.pins.get(event.principalId);
      if (pin === undefined || pin.version !== event.pinVersion) {
        return { id: event.id, outcome: 'REJECTED' as const, reason: 'PIN_UNKNOWN' };
      }
      if (event.outcome === 'FAILED') {
        pin.wrongTries += 1;
        if (pin.wrongTries >= MAX_WRONG_TRIES) pin.locked = true;
      }
      return { id: event.id, outcome: 'APPLIED' as const, reason: null };
    });
    const signOutResults = (report.signOuts ?? []).map((signOut) => {
      if (seen.has(signOut.id))
        return { id: signOut.id, outcome: 'DUPLICATE' as const, reason: null };
      seen.add(signOut.id);
      return server.pins.get(signOut.cashierId)?.locked === true
        ? { id: signOut.id, outcome: 'APPLIED' as const, reason: null }
        : { id: signOut.id, outcome: 'REJECTED' as const, reason: 'CASHIER_NOT_LOCKED' };
    });
    return {
      eventResults,
      signOutResults,
      locked: [...server.pins.values()]
        .filter((pin) => pin.locked)
        .map((pin) => ({ id: pin.id, displayName: pin.name })),
      serverTime: new Date().toISOString(),
    };
  });
  // The signed-in cashier sets their own PIN: the next version, no tries, the lock gone.
  api.respond('setTillPin', (request): Schemas['TillPinStatus'] => {
    const body = request as Schemas['TillPinSet'];
    server.pinsSet.push(body);
    const pin = server.pins.get(PEOPLE.cashier.id);
    if (pin === undefined) throw new Error('No cashier PIN.');
    Object.assign(pin, {
      version: pin.version + 1,
      iterations: body.iterations,
      pinSalt: body.pinSalt,
      pinHash: body.pinHash,
      wrongTries: 0,
      locked: false,
    });
    return {
      principal: { id: pin.id, displayName: pin.name },
      version: pin.version,
      algorithm: body.algorithm,
      iterations: body.iterations,
      setAt: new Date().toISOString(),
      wrongTries: 0,
      locked: false,
    };
  });
  return server;
}
