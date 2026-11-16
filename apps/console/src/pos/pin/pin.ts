/**
 * The till PIN on the device (OFFLINE_SYNC.md section 3, CR-032, ADR 0047): a PIN is checked against the
 * verifier the server issued, here, and never sent anywhere. A wrong PIN counts against that person on
 * this till; at the policy's limit they are locked out for the policy's time. A PIN unlocks the till and
 * approves what the verifier says it may; it creates no session and authorises nothing on the server.
 */
import type { PinApproval, PinVerifier, TillPinPolicy } from '../../requested/tillPin';

export interface PinAttempts {
  /** Wrong PINs in a row since the last right one or the last lockout. */
  failures: number;
  /** Until when this person may not try again on this till. */
  lockedUntil: string | null;
}

export const NO_ATTEMPTS: PinAttempts = { failures: 0, lockedUntil: null };

/** Digits only, as many as the policy allows. Checked before any hashing, so a typo costs no attempt. */
export function pinShapeOk(pin: string, policy: TillPinPolicy): boolean {
  return new RegExp(`^[0-9]{${String(policy.minDigits)},${String(policy.maxDigits)}}$`).test(pin);
}

/** Milliseconds until this person may try again; zero when they may. */
export function lockoutRemainingMs(attempts: PinAttempts, now: Date): number {
  if (attempts.lockedUntil === null) return 0;
  return Math.max(0, new Date(attempts.lockedUntil).getTime() - now.getTime());
}

/** One more wrong PIN. The one that reaches the limit starts the lockout and clears the count. */
export function afterFailure(attempts: PinAttempts, policy: TillPinPolicy, now: Date): PinAttempts {
  const failures = attempts.failures + 1;
  if (failures < policy.maxAttempts) return { failures, lockedUntil: null };
  return {
    failures: 0,
    lockedUntil: new Date(now.getTime() + policy.lockoutSeconds * 1000).toISOString(),
  };
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  if (verifier.algorithm !== 'PBKDF2-SHA256') return false;
  const expected = fromBase64(verifier.hash);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(verifier.salt),
      iterations: verifier.iterations,
    },
    key,
    expected.length * 8,
  );
  return sameBytes(new Uint8Array(bits), expected);
}

/** Who may approve this on the till: the people whose verifier lists it. */
export function approvers(verifiers: readonly PinVerifier[], approval: PinApproval): PinVerifier[] {
  return verifiers.filter((verifier) => verifier.approves.includes(approval));
}
