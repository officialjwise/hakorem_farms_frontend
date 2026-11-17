/**
 * The server side of the contract requests the e2e build is built against (ADR 0046): CR-032's PIN
 * verifiers and CR-033's receipt fields, answered in exactly the requested shape. Nothing here is in the
 * contract yet; each answer goes when its request lands.
 */
import { pbkdf2Sync } from 'node:crypto';
import {
  LIST_TILL_PIN_VERIFIERS,
  type TillPinVerifiers,
} from '../../apps/console/src/requested/tillPin';
import type { FakeApi } from './fakeApi';

export const PEOPLE = {
  cashier: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', name: 'Adwoa Darko', pin: '4821' },
  manager: { id: '019a7a86-4f35-7afd-b035-b8ab03a83188', name: 'Kwabena Owusu', pin: '903412' },
} as const;

/** The mobile money method in `getOfflinePack`'s example. */
export const MOMO_METHOD_ID = '019a7a92-c15e-7582-aabb-60fcf9dfd9da';

export const PIN_POLICY: TillPinVerifiers['policy'] = {
  minDigits: 4,
  maxDigits: 6,
  maxAttempts: 3,
  lockoutSeconds: 300,
  idleLockSeconds: 120,
};

/** A verifier made as CR-032 asks the server to make one: PBKDF2-SHA256, a salt each, never the PIN. */
function verifier(
  person: (typeof PEOPLE)[keyof typeof PEOPLE],
  version: number,
  approves: TillPinVerifiers['verifiers'][number]['approves'],
) {
  const salt = Buffer.from(`e2e-salt-${person.id}`);
  return {
    principalId: person.id,
    displayName: person.name,
    version,
    algorithm: 'PBKDF2-SHA256' as const,
    iterations: 10_000,
    salt: salt.toString('base64'),
    hash: pbkdf2Sync(person.pin, salt, 10_000, 32, 'sha256').toString('base64'),
    approves,
  };
}

/** CR-032: the till's verifiers, the cashier's and the manager's (who may approve both offline actions). */
export function installTillPins(api: FakeApi): { issued: number } {
  const counter = { issued: 0 };
  api.respondRequested(LIST_TILL_PIN_VERIFIERS, (_request, path) => {
    counter.issued += 1;
    const registerId = path.split('/')[2] ?? '';
    const answer: TillPinVerifiers = {
      registerId,
      issuedAt: new Date().toISOString(),
      policy: PIN_POLICY,
      verifiers: [
        verifier(PEOPLE.cashier, 2, []),
        verifier(PEOPLE.manager, 7, ['OFFLINE_MOBILE_MONEY', 'CASH_DROP_WITNESS']),
      ],
    };
    return answer;
  });
  return counter;
}

/** CR-033: the receipt page the till builds the link from. */
export const RECEIPT_LINK_TEMPLATE = 'https://hakoremfarms.com/r/{saleId}';

/**
 * CR-034: the server gives each product its SKU. The fake adds one to the body the screen sent (without a
 * SKU) before Prism, whose 1.x validation still requires it, answers; the bodies the screen sent are kept.
 */
export function installServerSku(api: FakeApi): { sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  let next = 1;
  api.serverFills('createProduct', (body) => {
    sent.push(body);
    return { ...body, sku: `PRD-${String(next++).padStart(4, '0')}` };
  });
  return { sent };
}
