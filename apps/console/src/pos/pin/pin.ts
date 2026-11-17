/**
 * The till PIN on the device (OFFLINE_SYNC.md section 3, CR-032, ADR 0047): a PIN is checked against the
 * verifier the server issued, here, and never sent anywhere. The owner's conditions (2026-11-17):
 *
 * - **A floor on the hash.** PBKDF2-SHA256 with at least 600,000 iterations and a salt of at least 16
 *   bytes, and a 32-byte hash. A weaker verifier is refused: not stored, never checked.
 * - **At most five wrong tries**, whatever the server sends; a lower server limit wins.
 * - **No timer.** A lockout never ends with time, since the device clock can be changed. It ends only when
 *   the server says so once the till reaches it, or when a supervisor signs the cashier out.
 *
 * A PIN unlocks the till and approves what the verifier says it may; it creates no session and authorises
 * nothing on the server.
 */
import type { PinApproval, PinVerifier, TillPinPolicy } from '../../requested/tillPin';

/** OWASP's floor for PBKDF2-HMAC-SHA256 (owner, 2026-11-17). */
export const MIN_PBKDF2_ITERATIONS = 600_000;
/** A random salt per person, at least this long (owner, 2026-11-17). */
export const MIN_SALT_BYTES = 16;
/** The length of the hash CR-032 asks for. */
export const HASH_BYTES = 32;
/** Wrong tries before a lockout, at most (owner, 2026-11-17). */
export const MAX_PIN_TRIES = 5;

export interface PinAttempts {
  /** Wrong PINs in a row since the last right one. */
  failures: number;
  /** Locked out of PIN checks on this till until the server or a supervisor ends it. */
  lockedOut: boolean;
}

export const NO_ATTEMPTS: PinAttempts = { failures: 0, lockedOut: false };

/** The server's policy with the owner's limit on tries: never more than five, and at least one. */
export function effectivePolicy(policy: TillPinPolicy): TillPinPolicy {
  const asked = Number.isInteger(policy.maxAttempts) ? policy.maxAttempts : MAX_PIN_TRIES;
  return { ...policy, maxAttempts: Math.max(1, Math.min(MAX_PIN_TRIES, asked)) };
}

/** Digits only, as many as the policy allows. Checked before any hashing, so a typo costs no attempt. */
export function pinShapeOk(pin: string, policy: TillPinPolicy): boolean {
  return new RegExp(`^[0-9]{${String(policy.minDigits)},${String(policy.maxDigits)}}$`).test(pin);
}

/** One more wrong PIN. The one that reaches the limit locks that person out, with no end time. */
export function afterFailure(attempts: PinAttempts, policy: TillPinPolicy): PinAttempts {
  const failures = attempts.failures + 1;
  return { failures, lockedOut: attempts.lockedOut || failures >= policy.maxAttempts };
}

/** The bytes of a base64 string, or null when it is not one. */
function fromBase64(value: string): Uint8Array<ArrayBuffer> | null {
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

/** Whether the till may store and check this verifier: the owner's floor, judged on the device. */
export function verifierStrength(verifier: PinVerifier): 'strong' | 'weak' {
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

/** PBKDF2-HMAC-SHA256 of the PIN with the verifier's salt and cost, compared with its hash. */
export async function pinMatches(pin: string, verifier: PinVerifier): Promise<boolean> {
  if (verifierStrength(verifier) === 'weak') return false;
  const expected = fromBase64(verifier.hash);
  const salt = fromBase64(verifier.salt);
  if (expected === null || salt === null) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: verifier.iterations },
    key,
    expected.length * 8,
  );
  return sameBytes(new Uint8Array(bits), expected);
}

/** Who may approve this on the till: the people whose verifier lists it. */
export function approvers(verifiers: readonly PinVerifier[], approval: PinApproval): PinVerifier[] {
  return verifiers.filter((verifier) => verifier.approves.includes(approval));
}
