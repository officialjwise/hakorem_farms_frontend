import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PinVerifier, TillPinPolicy } from '../../requested/tillPin';
import {
  NO_ATTEMPTS,
  afterFailure,
  approvers,
  lockoutRemainingMs,
  pinMatches,
  pinShapeOk,
} from './pin';

const POLICY: TillPinPolicy = {
  minDigits: 4,
  maxDigits: 6,
  maxAttempts: 5,
  lockoutSeconds: 300,
  idleLockSeconds: 120,
};

/** A verifier made the way CR-032 asks the server to make one, by Node's own PBKDF2. */
function verifier(pin: string, overrides: Partial<PinVerifier> = {}): PinVerifier {
  const salt = Buffer.from('hakorem-till-salt-0001');
  return {
    principalId: '019a7a86-ac02-78a8-ade0-935170bb0c2f',
    displayName: 'Adwoa Darko',
    version: 3,
    algorithm: 'PBKDF2-SHA256',
    iterations: 1000,
    salt: salt.toString('base64'),
    hash: pbkdf2Sync(pin, salt, 1000, 32, 'sha256').toString('base64'),
    approves: [],
    ...overrides,
  };
}

describe('checking a PIN on the till (CR-032)', () => {
  it('accepts the PIN the verifier was made from, computed independently', async () => {
    expect(await pinMatches('4821', verifier('4821'))).toBe(true);
  });

  it('refuses any other PIN, including one digit off and the right digits with one more', async () => {
    const made = verifier('4821');
    expect(await pinMatches('4822', made)).toBe(false);
    expect(await pinMatches('48210', made)).toBe(false);
    expect(await pinMatches('', made)).toBe(false);
  });

  it('refuses every PIN against an algorithm it does not know', async () => {
    const made = verifier('4821', { algorithm: 'ARGON2ID' as PinVerifier['algorithm'] });
    expect(await pinMatches('4821', made)).toBe(false);
  });

  it('takes four to six digits only, before any hashing', () => {
    expect(pinShapeOk('482', POLICY)).toBe(false);
    expect(pinShapeOk('4821', POLICY)).toBe(true);
    expect(pinShapeOk('482193', POLICY)).toBe(true);
    expect(pinShapeOk('4821934', POLICY)).toBe(false);
    expect(pinShapeOk('48a1', POLICY)).toBe(false);
    expect(pinShapeOk(' 4821', POLICY)).toBe(false);
  });
});

describe('the attempt limit and the lockout', () => {
  const now = new Date('2026-11-16T10:00:00.000Z');

  it('counts wrong PINs up to the limit, then locks that person out for the policy time', () => {
    let attempts = NO_ATTEMPTS;
    for (let i = 1; i < POLICY.maxAttempts; i += 1) {
      attempts = afterFailure(attempts, POLICY, now);
      expect(attempts).toEqual({ failures: i, lockedUntil: null });
    }
    attempts = afterFailure(attempts, POLICY, now);
    expect(attempts).toEqual({ failures: 0, lockedUntil: '2026-11-16T10:05:00.000Z' });
    expect(lockoutRemainingMs(attempts, now)).toBe(300_000);
  });

  it('ends the lockout at its time, and not a millisecond before', () => {
    const locked = { failures: 0, lockedUntil: '2026-11-16T10:05:00.000Z' };
    expect(lockoutRemainingMs(locked, new Date('2026-11-16T10:04:59.999Z'))).toBe(1);
    expect(lockoutRemainingMs(locked, new Date('2026-11-16T10:05:00.000Z'))).toBe(0);
    expect(lockoutRemainingMs(NO_ATTEMPTS, now)).toBe(0);
  });

  it('offers as approvers only the people whose verifier lists the approval', () => {
    const cashier = verifier('4821');
    const manager = verifier('9034', {
      principalId: 'm',
      displayName: 'Kwame Asante',
      approves: ['OFFLINE_MOBILE_MONEY', 'CASH_DROP_WITNESS'],
    });
    const witness = verifier('7710', {
      principalId: 'w',
      displayName: 'Esi Owusu',
      approves: ['CASH_DROP_WITNESS'],
    });
    const all = [cashier, manager, witness];
    expect(approvers(all, 'OFFLINE_MOBILE_MONEY').map((v) => v.displayName)).toEqual([
      'Kwame Asante',
    ]);
    expect(approvers(all, 'CASH_DROP_WITNESS').map((v) => v.displayName)).toEqual([
      'Kwame Asante',
      'Esi Owusu',
    ]);
  });
});
