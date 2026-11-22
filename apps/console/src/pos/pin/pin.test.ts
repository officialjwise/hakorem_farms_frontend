import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MAX_PIN_TRIES,
  MIN_PBKDF2_ITERATIONS,
  MIN_SALT_BYTES,
  afterFailure,
  approvers,
  attemptsFor,
  fromContract,
  makeVerifier,
  pinMatches,
  pinShapeOk,
  purposeOf,
  tillPolicy,
  verifierStrength,
  type PinAttempts,
  type PinVerifier,
  type TillPinEvent,
} from './pin';

const POLICY = tillPolicy(5);

/** One PBKDF2 at the floor, computed once: 600,000 iterations take a moment in Node too. */
const SALT = Buffer.from('hakorem-till-salt-0001');
const HASH_4821 = pbkdf2Sync('4821', SALT, MIN_PBKDF2_ITERATIONS, 32, 'sha256').toString('base64');

/** A verifier as 2.17.0's `listTillPinVerifiers` answers one, made by Node's own PBKDF2. */
function verifier(overrides: Partial<PinVerifier> = {}): PinVerifier {
  return {
    ...fromContract({
      principal: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', displayName: 'Adwoa Darko' },
      role: 'OPERATOR',
      version: 3,
      algorithm: 'PBKDF2-SHA256',
      iterations: MIN_PBKDF2_ITERATIONS,
      pinSalt: SALT.toString('base64'),
      pinHash: HASH_4821,
      wrongTries: 0,
      locked: false,
      priceOverrideLimitPerLinePesewas: 0,
    }),
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
    const made = verifier({ algorithm: 'ARGON2ID' });
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
    expect(verifierStrength(verifier({ algorithm: 'MD5' }))).toBe('weak');
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

describe('a locked PIN (2.17.0)', () => {
  it('is locked, not weak, when the server sends it with no salt or hash, and matches nothing', async () => {
    const locked = verifier({ locked: true, salt: null, hash: null });
    expect(verifierStrength(locked)).toBe('locked');
    expect(await pinMatches('4821', locked)).toBe(false);
  });
});

describe('setting a PIN on this till (setTillPin, 2.17.0)', () => {
  it('derives the verifier the server takes, which checks the PIN and nothing else', async () => {
    const made = await makeVerifier('4821');
    expect(made.algorithm).toBe('PBKDF2-SHA256');
    expect(made.iterations).toBe(600_000);
    expect(Buffer.from(made.pinSalt, 'base64')).toHaveLength(16);
    expect(Buffer.from(made.pinHash, 'base64')).toHaveLength(32);
    // Node's own PBKDF2 agrees with the till's, byte for byte.
    expect(made.pinHash).toBe(
      pbkdf2Sync('4821', Buffer.from(made.pinSalt, 'base64'), 600_000, 32, 'sha256').toString(
        'base64',
      ),
    );
    const back = verifier({ salt: made.pinSalt, hash: made.pinHash });
    expect(await pinMatches('4821', back)).toBe(true);
    expect(await pinMatches('4822', back)).toBe(false);
    expect(JSON.stringify(made)).not.toContain('4821');
  });

  it('takes a fresh salt from the secure generator each time', async () => {
    const a = await makeVerifier('4821');
    const b = await makeVerifier('4821');
    expect(a.pinSalt).not.toBe(b.pinSalt);
    expect(a.pinHash).not.toBe(b.pinHash);
  });
});

describe('the attempt limit and the lockout (owner, 2026-11-17; 2.17.0)', () => {
  it('allows at most five wrong tries whatever the server sends, and a lower server limit wins', () => {
    expect(MAX_PIN_TRIES).toBe(5);
    expect(tillPolicy(10).maxAttempts).toBe(5);
    expect(tillPolicy(3).maxAttempts).toBe(3);
    expect(tillPolicy(0).maxAttempts).toBe(1);
    expect(tillPolicy(Number.NaN).maxAttempts).toBe(5);
    expect(tillPolicy(undefined)).toMatchObject({ minDigits: 4, maxDigits: 6, maxAttempts: 5 });
  });

  it('counts wrong PINs up to the limit, then locks that version with no end time', () => {
    let attempts: PinAttempts = { version: 3, failures: 0, lockedOut: false };
    for (let i = 1; i < POLICY.maxAttempts; i += 1) {
      attempts = afterFailure(attempts, POLICY);
      expect(attempts).toEqual({ version: 3, failures: i, lockedOut: false });
    }
    attempts = afterFailure(attempts, POLICY);
    expect(attempts).toEqual({ version: 3, failures: 5, lockedOut: true });
    // The device clock plays no part: there is nothing to wait for.
    expect(Object.keys(attempts)).not.toContain('lockedUntil');
  });

  it("adds the till's unreported wrong tries against the version to the server's count", () => {
    const v = verifier({ wrongTries: 3 });
    const tries = (outcome: TillPinEvent['outcome'], pinVersion: number): TillPinEvent => ({
      id: crypto.randomUUID(),
      principalId: v.principalId,
      pinVersion,
      outcome,
      purpose: 'UNLOCK',
      occurredAt: '2026-11-19T09:00:00.000Z',
    });
    expect(attemptsFor(v, [tries('FAILED', 3)], POLICY)).toEqual({
      version: 3,
      failures: 4,
      lockedOut: false,
    });
    // A right try wipes nothing, and a try against an older version counts against that one only.
    expect(
      attemptsFor(v, [tries('FAILED', 3), tries('SUCCEEDED', 3), tries('FAILED', 2)], POLICY),
    ).toEqual({ version: 3, failures: 4, lockedOut: false });
    expect(attemptsFor(v, [tries('FAILED', 3), tries('FAILED', 3)], POLICY).lockedOut).toBe(true);
    expect(attemptsFor(verifier({ locked: true }), [], POLICY).lockedOut).toBe(true);
  });

  it("names what each try was for in the contract's words", () => {
    expect(purposeOf(undefined)).toBe('UNLOCK');
    expect(purposeOf('OFFLINE_MOBILE_MONEY')).toBe('APPROVAL');
    expect(purposeOf('CASH_DROP_WITNESS')).toBe('WITNESS');
    expect(purposeOf('SUPERVISOR_SIGN_OUT')).toBe('SIGN_OUT');
  });

  it("gives a supervisor's PIN every approval and an operator's none", () => {
    const cashier = verifier();
    const manager = fromContract({
      principal: { id: 'm', displayName: 'Kwame Asante' },
      role: 'SUPERVISOR',
      version: 1,
      algorithm: 'PBKDF2-SHA256',
      iterations: MIN_PBKDF2_ITERATIONS,
      pinSalt: SALT.toString('base64'),
      pinHash: HASH_4821,
      wrongTries: 0,
      locked: false,
      priceOverrideLimitPerLinePesewas: 5000,
    });
    const all = [cashier, manager];
    for (const approval of [
      'OFFLINE_MOBILE_MONEY',
      'CASH_DROP_WITNESS',
      'SUPERVISOR_SIGN_OUT',
    ] as const) {
      expect(approvers(all, approval).map((v) => v.displayName)).toEqual(['Kwame Asante']);
    }
  });
});
