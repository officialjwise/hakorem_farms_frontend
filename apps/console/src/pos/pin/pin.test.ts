import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PinVerifier, TillPinPolicy } from '../../requested/tillPin';
import {
  MAX_PIN_TRIES,
  MIN_PBKDF2_ITERATIONS,
  MIN_SALT_BYTES,
  NO_ATTEMPTS,
  afterFailure,
  approvers,
  effectivePolicy,
  pinMatches,
  pinShapeOk,
  verifierStrength,
} from './pin';

const POLICY: TillPinPolicy = { minDigits: 4, maxDigits: 6, maxAttempts: 5, idleLockSeconds: 120 };

/** One PBKDF2 at the floor, computed once: 600,000 iterations take a moment in Node too. */
const SALT = Buffer.from('hakorem-till-salt-0001');
const HASH_4821 = pbkdf2Sync('4821', SALT, MIN_PBKDF2_ITERATIONS, 32, 'sha256').toString('base64');

/** A verifier made the way CR-032 asks the server to make one, by Node's own PBKDF2. */
function verifier(overrides: Partial<PinVerifier> = {}): PinVerifier {
  return {
    principalId: '019a7a86-ac02-78a8-ade0-935170bb0c2f',
    displayName: 'Adwoa Darko',
    version: 3,
    algorithm: 'PBKDF2-SHA256',
    iterations: MIN_PBKDF2_ITERATIONS,
    salt: SALT.toString('base64'),
    hash: HASH_4821,
    approves: [],
    lockedOut: false,
    ...overrides,
  };
}

describe('checking a PIN on the till (CR-032)', () => {
  it('accepts the PIN the verifier was made from, computed independently', async () => {
    expect(await pinMatches('4821', verifier())).toBe(true);
  });

  it('refuses any other PIN, including one digit off and the right digits with one more', async () => {
    const made = verifier();
    expect(await pinMatches('4822', made)).toBe(false);
    expect(await pinMatches('48210', made)).toBe(false);
    expect(await pinMatches('', made)).toBe(false);
  });

  it('refuses every PIN against an algorithm it does not know', async () => {
    const made = verifier({ algorithm: 'ARGON2ID' as PinVerifier['algorithm'] });
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

describe('the floor on the hash (owner, 2026-11-17)', () => {
  it('is PBKDF2-SHA256, at least 600,000 iterations and a 16-byte salt', () => {
    expect(MIN_PBKDF2_ITERATIONS).toBe(600_000);
    expect(MIN_SALT_BYTES).toBe(16);
    expect(verifierStrength(verifier())).toBe('strong');
  });

  it('calls weak a verifier below the iteration floor, with a short or empty salt, or a wrong hash length', () => {
    expect(verifierStrength(verifier({ iterations: 599_999 }))).toBe('weak');
    expect(verifierStrength(verifier({ iterations: 1 }))).toBe('weak');
    expect(verifierStrength(verifier({ salt: Buffer.alloc(15).toString('base64') }))).toBe('weak');
    expect(verifierStrength(verifier({ salt: '' }))).toBe('weak');
    expect(verifierStrength(verifier({ salt: 'not base64!' }))).toBe('weak');
    expect(verifierStrength(verifier({ hash: Buffer.alloc(16).toString('base64') }))).toBe('weak');
    expect(verifierStrength(verifier({ algorithm: 'MD5' as PinVerifier['algorithm'] }))).toBe(
      'weak',
    );
    expect(verifierStrength(verifier({ iterations: Number.NaN as unknown as number }))).toBe(
      'weak',
    );
  });

  it('checks no PIN against a weak verifier, even the right one', async () => {
    const weakSalt = Buffer.from('short');
    const weak = verifier({
      iterations: 1000,
      salt: weakSalt.toString('base64'),
      hash: pbkdf2Sync('4821', weakSalt, 1000, 32, 'sha256').toString('base64'),
    });
    expect(await pinMatches('4821', weak)).toBe(false);
  });
});

describe('the attempt limit and the lockout (owner, 2026-11-17)', () => {
  it('allows at most five wrong tries whatever the server sends, and a lower server limit wins', () => {
    expect(MAX_PIN_TRIES).toBe(5);
    expect(effectivePolicy({ ...POLICY, maxAttempts: 10 }).maxAttempts).toBe(5);
    expect(effectivePolicy({ ...POLICY, maxAttempts: 3 }).maxAttempts).toBe(3);
    expect(effectivePolicy({ ...POLICY, maxAttempts: 0 }).maxAttempts).toBe(1);
    expect(effectivePolicy({ ...POLICY, maxAttempts: Number.NaN }).maxAttempts).toBe(5);
  });

  it('counts wrong PINs up to the limit, then locks that person out with no end time', () => {
    let attempts = NO_ATTEMPTS;
    for (let i = 1; i < POLICY.maxAttempts; i += 1) {
      attempts = afterFailure(attempts, POLICY);
      expect(attempts).toEqual({ failures: i, lockedOut: false });
    }
    attempts = afterFailure(attempts, POLICY);
    expect(attempts).toEqual({ failures: 5, lockedOut: true });
    // The device clock plays no part: there is nothing to wait for.
    expect(Object.keys(attempts)).not.toContain('lockedUntil');
  });

  it('offers as approvers only the people whose verifier lists the approval', () => {
    const cashier = verifier();
    const manager = verifier({
      principalId: 'm',
      displayName: 'Kwame Asante',
      approves: ['OFFLINE_MOBILE_MONEY', 'CASH_DROP_WITNESS', 'SUPERVISOR_SIGN_OUT'],
    });
    const witness = verifier({
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
    expect(approvers(all, 'SUPERVISOR_SIGN_OUT').map((v) => v.displayName)).toEqual([
      'Kwame Asante',
    ]);
  });
});
