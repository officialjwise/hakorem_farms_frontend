/**
 * The till PIN on the device (OFFLINE_SYNC.md section 3, CR-032 as 2.17.0 carries it, ADR 0047, ADR 0057):
 * a PIN is checked against the verifier the person's own till made when they set it, here, and never sent
 * anywhere. The owner's conditions (2026-11-17), with the contract's rules on top:
 *
 * - **A floor on the hash.** PBKDF2-SHA256 with at least 600,000 iterations and a salt of at least 16
 *   bytes, and a 32-byte hash. A weaker verifier is refused: not stored, never checked.
 * - **At most five wrong tries**, whatever the server sends; a lower server limit wins. Every try against
 *   a PIN version counts, on every till, and a right one does not wipe a wrong one (2.17.0).
 * - **No timer.** A lockout never ends with time, since the device clock can be changed. It ends only when
 *   its owner sets a new PIN (`policy.lockedUntil` `NEW_PIN_SET`): a new version, with no tries against it.
 *
 * A PIN unlocks the till and approves what its owner's role at the branch lets them; it creates no session
 * and authorises nothing on the server.
 */
import type { components } from '@hakorem/api-client';

type Schemas = components['schemas'];
export type TillPinVerifier = Schemas['TillPinVerifier'];
export type TillPinVerifierList = Schemas['TillPinVerifierList'];
export type TillPinEvent = Schemas['TillPinEvent'];
export type TillSignOut = Schemas['TillSignOut'];
export type TillPinSet = Schemas['TillPinSet'];

/** OWASP's floor for PBKDF2-HMAC-SHA256 (owner, 2026-11-17), and the cost this till sets a PIN at. */
export const MIN_PBKDF2_ITERATIONS = 600_000;
/** A random salt per person, at least this long (owner, 2026-11-17), and the length this till makes. */
export const MIN_SALT_BYTES = 16;
/** The length of the hash 2.17.0 takes. */
export const HASH_BYTES = 32;
/** Wrong tries before a lockout, at most (owner, 2026-11-17). */
export const MAX_PIN_TRIES = 5;
/** Four to six digits (the owner, 2026-11-16). The till sets the PIN, so the rule is the till's (A-F10-14). */
export const PIN_MIN_DIGITS = 4;
export const PIN_MAX_DIGITS = 6;
/** The till locks itself after this long untouched (A-F10-14: 2.17.0 carries no idle time). */
export const IDLE_LOCK_SECONDS = 120;

/**
 * What a PIN can approve on the till without the network. `SUPERVISOR_SIGN_OUT` signs a locked cashier out
 * and does nothing else: it never opens the till or sells as them (owner, 2026-11-17). `PRICE_OVERRIDE`
 * approves one line's price beyond the cashier's own limit, up to the supervisor's own (2.17.0).
 */
export type PinApproval =
  'OFFLINE_MOBILE_MONEY' | 'CASH_DROP_WITNESS' | 'SUPERVISOR_SIGN_OUT' | 'PRICE_OVERRIDE';

/** The rule every till applies, offline, the same way. */
export interface TillPinPolicy {
  minDigits: number;
  maxDigits: number;
  /** Wrong tries against a PIN version before it is locked: the server's, at most five. */
  maxAttempts: number;
  idleLockSeconds: number;
}

/**
 * The till's view of one person's verifier, from `TillPinVerifier`. A supervisor (who holds
 * `pos.shift.close.approve` at the till's branch) may approve, witness a drop and sign a locked cashier
 * out; an operator's PIN only opens the till. A locked PIN carries no salt or hash.
 */
export interface PinVerifier {
  principalId: string;
  displayName: string;
  role: TillPinVerifier['role'];
  version: number;
  algorithm: string;
  iterations: number;
  salt: string | null;
  hash: string | null;
  approves: PinApproval[];
  /** The server's word: locked until its owner sets a new PIN. */
  locked: boolean;
  /** The wrong tries the server has counted against this version, on every till. */
  wrongTries: number;
  /**
   * The person's own price override limit per line at the branch: what their PIN may approve beyond a
   * cashier's limit offline, never more (2.17.0). Absent on a verifier an earlier build stored: then none.
   */
  priceOverrideLimitPerLinePesewas?: number;
}

const SUPERVISOR_APPROVES: PinApproval[] = [
  'OFFLINE_MOBILE_MONEY',
  'CASH_DROP_WITNESS',
  'SUPERVISOR_SIGN_OUT',
  'PRICE_OVERRIDE',
];

export function fromContract(verifier: TillPinVerifier): PinVerifier {
  return {
    principalId: verifier.principal.id,
    displayName: verifier.principal.displayName,
    role: verifier.role,
    version: verifier.version,
    algorithm: verifier.algorithm,
    iterations: verifier.iterations,
    salt: verifier.pinSalt,
    hash: verifier.pinHash,
    approves: verifier.role === 'SUPERVISOR' ? [...SUPERVISOR_APPROVES] : [],
    locked: verifier.locked,
    wrongTries: verifier.wrongTries,
    priceOverrideLimitPerLinePesewas: verifier.priceOverrideLimitPerLinePesewas,
  };
}

/** The server's limit with the owner's: never more than five, and at least one. */
export function tillPolicy(maxWrongTries: number | undefined): TillPinPolicy {
  const asked =
    maxWrongTries !== undefined && Number.isInteger(maxWrongTries) ? maxWrongTries : MAX_PIN_TRIES;
  return {
    minDigits: PIN_MIN_DIGITS,
    maxDigits: PIN_MAX_DIGITS,
    maxAttempts: Math.max(1, Math.min(MAX_PIN_TRIES, asked)),
    idleLockSeconds: IDLE_LOCK_SECONDS,
  };
}

export interface PinAttempts {
  /** The PIN version the tries are against: a new PIN starts with none. */
  version: number;
  /** Wrong tries against that version: the server's count and this till's not yet reported. */
  failures: number;
  /** Locked until a new PIN is set. */
  lockedOut: boolean;
}

/**
 * A person's tries as they stand: the server's count against the version it sent, and this till's wrong
 * tries against that version the server has not heard yet. Locked when the server says so or the count
 * reaches the limit.
 */
export function attemptsFor(
  verifier: PinVerifier,
  unreported: readonly TillPinEvent[],
  policy: TillPinPolicy,
): PinAttempts {
  const failures =
    verifier.wrongTries +
    unreported.filter(
      (event) =>
        event.principalId === verifier.principalId &&
        event.pinVersion === verifier.version &&
        event.outcome === 'FAILED',
    ).length;
  return {
    version: verifier.version,
    failures,
    lockedOut: verifier.locked || failures >= policy.maxAttempts,
  };
}

/** Digits only, as many as the policy allows. Checked before any hashing, so a typo costs no attempt. */
export function pinShapeOk(pin: string, policy: TillPinPolicy): boolean {
  return new RegExp(`^[0-9]{${String(policy.minDigits)},${String(policy.maxDigits)}}$`).test(pin);
}

/** One more wrong PIN. The one that reaches the limit locks that version, with no end time. */
export function afterFailure(attempts: PinAttempts, policy: TillPinPolicy): PinAttempts {
  const failures = attempts.failures + 1;
  return {
    version: attempts.version,
    failures,
    lockedOut: attempts.lockedOut || failures >= policy.maxAttempts,
  };
}

/** The bytes of a base64 string, or null when it is not one. */
function fromBase64(value: string | null): Uint8Array<ArrayBuffer> | null {
  if (value === null) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Whether the till may store and check this verifier: the owner's floor, judged on the device. A locked
 * PIN, which the server sends with no material, is not weak: it is locked.
 */
export function verifierStrength(verifier: PinVerifier): 'strong' | 'weak' | 'locked' {
  if (verifier.locked && verifier.salt === null && verifier.hash === null) return 'locked';
  const salt = fromBase64(verifier.salt);
  const hash = fromBase64(verifier.hash);
  const strong =
    verifier.algorithm === 'PBKDF2-SHA256' &&
    Number.isSafeInteger(verifier.iterations) &&
    verifier.iterations >= MIN_PBKDF2_ITERATIONS &&
    salt !== null &&
    salt.length >= MIN_SALT_BYTES &&
    hash !== null &&
    hash.length === HASH_BYTES;
  return strong ? 'strong' : 'weak';
}

/** Equal in time whatever the bytes, so how long a check takes says nothing about how close a PIN was. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

async function pbkdf2(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** PBKDF2-HMAC-SHA256 of the PIN with the verifier's salt and cost, compared with its hash. */
export async function pinMatches(pin: string, verifier: PinVerifier): Promise<boolean> {
  if (verifierStrength(verifier) !== 'strong') return false;
  const expected = fromBase64(verifier.hash);
  const salt = fromBase64(verifier.salt);
  if (expected === null || salt === null) return false;
  return sameBytes(await pbkdf2(pin, salt, verifier.iterations), expected);
}

/**
 * The verifier `setTillPin` takes for a PIN typed into this till (2.17.0): a fresh 16-byte salt from the
 * device's secure generator, 600,000 iterations, the 32-byte derived key. The PIN itself goes nowhere.
 */
export async function makeVerifier(
  pin: string,
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (bytes) =>
    crypto.getRandomValues(bytes),
): Promise<TillPinSet> {
  const salt = random(new Uint8Array(MIN_SALT_BYTES));
  const hash = await pbkdf2(pin, salt, MIN_PBKDF2_ITERATIONS);
  return {
    algorithm: 'PBKDF2-SHA256',
    iterations: MIN_PBKDF2_ITERATIONS,
    pinSalt: toBase64(salt),
    pinHash: toBase64(hash),
  };
}

/** Who may approve this on the till: the people whose role lets them. */
export function approvers(verifiers: readonly PinVerifier[], approval: PinApproval): PinVerifier[] {
  return verifiers.filter((verifier) => verifier.approves.includes(approval));
}

/**
 * Who may approve a line's discount beyond the cashier's limit (2.17.0): a supervisor of the branch, never
 * the shift's cashier, whose own per-line limit covers it. The server checks the same at sync.
 */
export function priceApprovers(
  verifiers: readonly PinVerifier[],
  cashierId: string,
  discountPesewas: number,
): PinVerifier[] {
  return verifiers.filter(
    (verifier) =>
      verifier.approves.includes('PRICE_OVERRIDE') &&
      verifier.principalId !== cashierId &&
      !verifier.locked &&
      (verifier.priceOverrideLimitPerLinePesewas ?? 0) >= discountPesewas,
  );
}

/** What a try was for, in the contract's words (`TillPinEvent.purpose`). */
export function purposeOf(approval: PinApproval | undefined): TillPinEvent['purpose'] {
  switch (approval) {
    case undefined:
      return 'UNLOCK';
    case 'OFFLINE_MOBILE_MONEY':
    case 'PRICE_OVERRIDE':
      return 'APPROVAL';
    case 'CASH_DROP_WITNESS':
      return 'WITNESS';
    case 'SUPERVISOR_SIGN_OUT':
      return 'SIGN_OUT';
  }
}
