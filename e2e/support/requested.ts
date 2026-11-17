/**
 * The server side of the contract requests the e2e build is built against (ADR 0046): CR-032's PIN
 * verifiers and CR-033's receipt fields, answered in exactly the requested shape. Nothing here is in the
 * contract yet; each answer goes when its request lands.
 */
import { pbkdf2Sync } from 'node:crypto';
import {
  LIST_TILL_PIN_VERIFIERS,
  REPORT_TILL_PIN_EVENTS,
  type TillPinEvent,
  type TillPinVerifiers,
} from '../../apps/console/src/requested/tillPin';
import type { FakeApi } from './fakeApi';

export const PEOPLE = {
  cashier: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', name: 'Adwoa Darko', pin: '4821' },
  manager: { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', name: 'Kwabena Owusu', pin: '903412' },
} as const;

/** The mobile money method in `getOfflinePack`'s example. */
export const MOMO_METHOD_ID = '019a7a92-c15e-7582-aabb-60fcf9dfd9da';

/** Three tries: the server's limit is lower than the owner's five, so it wins. No lockout time. */
export const PIN_POLICY: TillPinVerifiers['policy'] = {
  minDigits: 4,
  maxDigits: 6,
  maxAttempts: 3,
  idleLockSeconds: 120,
};

/** The owner's floor (2026-11-17). */
const ITERATIONS = 600_000;
const hashes = new Map<string, string>();

/**
 * A verifier made as CR-032 asks the server to make one: PBKDF2-SHA256 at 600,000 iterations, a random-
 * looking 16-byte-plus salt each, never the PIN. `weak` makes one below the floor, which the till refuses.
 */
function verifier(
  person: (typeof PEOPLE)[keyof typeof PEOPLE],
  version: number,
  approves: TillPinVerifiers['verifiers'][number]['approves'],
  lockedOut: boolean,
  weak = false,
) {
  const salt = Buffer.from(`e2e-salt-${person.id}`);
  const iterations = weak ? 10_000 : ITERATIONS;
  const key = `${person.id}-${String(iterations)}`;
  const hash =
    hashes.get(key) ?? pbkdf2Sync(person.pin, salt, iterations, 32, 'sha256').toString('base64');
  hashes.set(key, hash);
  return {
    principalId: person.id,
    displayName: person.name,
    version,
    algorithm: 'PBKDF2-SHA256' as const,
    iterations,
    salt: salt.toString('base64'),
    hash,
    approves,
    lockedOut,
  };
}

export interface TillPinServer {
  issued: number;
  /** Each `reportTillPinEvents` body the till sent, in order. */
  reports: TillPinEvent[][];
  /** Who the server holds locked out on the till. */
  lockedOut: Set<string>;
}

/**
 * CR-032: the till's verifiers, the cashier's and the manager's (who may approve both offline actions and
 * sign a locked cashier out), and the events the till reports. The server keeps a lockout once told and a
 * supervisor's sign-out ends it. `weakCashier` sends the cashier's verifier below the owner's floor.
 */
export function installTillPins(
  api: FakeApi,
  options: { weakCashier?: boolean } = {},
): TillPinServer {
  const server: TillPinServer = { issued: 0, reports: [], lockedOut: new Set() };
  const answer = (path: string): TillPinVerifiers => ({
    registerId: path.split('/')[2] ?? '',
    issuedAt: new Date().toISOString(),
    policy: PIN_POLICY,
    verifiers: [
      verifier(PEOPLE.cashier, 2, [], server.lockedOut.has(PEOPLE.cashier.id), options.weakCashier),
      verifier(
        PEOPLE.manager,
        7,
        ['OFFLINE_MOBILE_MONEY', 'CASH_DROP_WITNESS', 'SUPERVISOR_SIGN_OUT'],
        server.lockedOut.has(PEOPLE.manager.id),
      ),
    ],
  });
  api.respondRequested(LIST_TILL_PIN_VERIFIERS, (_request, path) => {
    server.issued += 1;
    return answer(path);
  });
  api.respondRequested(REPORT_TILL_PIN_EVENTS, (request, path) => {
    const { events } = request as { events: TillPinEvent[] };
    server.reports.push(events);
    for (const event of events) {
      if (event.kind === 'LOCKED_OUT') server.lockedOut.add(event.principalId);
      else server.lockedOut.delete(event.principalId);
    }
    return answer(path);
  });
  return server;
}

/** CR-033: the receipt page the till builds the link from. */
export const RECEIPT_LINK_TEMPLATE = 'https://hakoremfarms.com/r/{saleId}';
