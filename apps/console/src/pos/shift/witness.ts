/**
 * Who witnesses a cash drop, by the owner's rule (2026-11-18) and what this till can know.
 *
 * - **A witness is a supervisor's PIN on this till**, checked on the device by the till PIN's rules
 *   (`pin/pin.ts`: the hash floor, at most five tries, no timer). Naming a supervisor without their PIN is
 *   not a witness, so the till never sends a `witnessId` it did not prove that way.
 * - **When no supervisor is signed in at the branch, the drop goes ahead marked unwitnessed** (2.6.0:
 *   `recordCashMovement` takes a drop with no `witnessId` then, and refuses one with `WITNESS_REQUIRED`
 *   while a supervisor is signed in).
 * - **Who is signed in comes from the server** (CR-050's read, behind its switch). Offline, or in a build
 *   without the read, the till cannot know: a PIN is taken if a supervisor is there, and without one the
 *   drop is sent unwitnessed and the server decides.
 *
 * Nothing here is sent anywhere: it decides what the form asks for.
 */
import type { components } from '@hakorem/api-client';
import type { PinVerifier } from '../../requested/tillPin';

type PrincipalRef = components['schemas']['PrincipalRef'];

/** Why the till cannot know who is signed in at the branch. */
export type Unknowable = 'offline' | 'cannot-see';

export type WitnessRule =
  /** The till is asking the server who is signed in. */
  | { kind: 'checking' }
  /** The till could not find out who is signed in: it asks again before recording. */
  | { kind: 'read-failed' }
  /** No supervisor is signed in at the branch: no witness is asked for, and the drop is unwitnessed. */
  | { kind: 'none-signed-in' }
  /** A supervisor is signed in: the drop needs a supervisor's PIN on this till. */
  | { kind: 'pin-required'; signedIn: PrincipalRef[] }
  /** A supervisor is signed in, and this till holds no supervisor's PIN: the drop cannot be recorded. */
  | { kind: 'no-pin-here'; signedIn: PrincipalRef[] }
  /** The till cannot know: a supervisor who is there enters their PIN; without one, it goes unwitnessed. */
  | { kind: 'pin-optional'; why: Unknowable }
  /** The till cannot know and holds no supervisor's PIN: sent unwitnessed, and the server decides. */
  | { kind: 'unwitnessed-unknown'; why: Unknowable };

export interface WitnessFacts {
  online: boolean;
  /** Whether the till may ask the server who is signed in: online, the shift on the server, CR-050 on. */
  canAsk: boolean;
  /** CR-050's answer while `canAsk`: undefined until it comes, or `'failed'`. */
  signedIn: PrincipalRef[] | undefined | 'failed';
  /** The supervisors whose PIN this till holds for a drop's witness, never the shift's own cashier. */
  approvers: readonly PinVerifier[];
}

export function witnessRule(facts: WitnessFacts): WitnessRule {
  if (!facts.canAsk) {
    const why: Unknowable = facts.online ? 'cannot-see' : 'offline';
    return facts.approvers.length > 0
      ? { kind: 'pin-optional', why }
      : { kind: 'unwitnessed-unknown', why };
  }
  if (facts.signedIn === undefined) return { kind: 'checking' };
  if (facts.signedIn === 'failed') return { kind: 'read-failed' };
  if (facts.signedIn.length === 0) return { kind: 'none-signed-in' };
  return facts.approvers.length > 0
    ? { kind: 'pin-required', signedIn: facts.signedIn }
    : { kind: 'no-pin-here', signedIn: facts.signedIn };
}

/** Whether the form offers the PIN field. */
export function asksForPin(rule: WitnessRule): boolean {
  return rule.kind === 'pin-required' || rule.kind === 'pin-optional';
}

/** Whether a drop may be recorded under this rule, with or without a PIN witness. */
export function mayRecord(rule: WitnessRule, witnessed: boolean): boolean {
  switch (rule.kind) {
    case 'checking':
    case 'read-failed':
    case 'no-pin-here':
      return false;
    case 'pin-required':
      return witnessed;
    case 'none-signed-in':
    case 'pin-optional':
    case 'unwitnessed-unknown':
      return true;
  }
}

/** Whether the server may still refuse an unwitnessed drop, because the till could not see who is in. */
export function serverDecides(rule: WitnessRule): boolean {
  return rule.kind === 'pin-optional' || rule.kind === 'unwitnessed-unknown';
}

/** The PINs that may witness a drop on this shift: a drop's witness approval, never the cashier's own. */
export function witnessApprovers(
  verifiers: readonly PinVerifier[],
  cashierId: string,
): PinVerifier[] {
  return verifiers.filter(
    (verifier) =>
      verifier.approves.includes('CASH_DROP_WITNESS') && verifier.principalId !== cashierId,
  );
}
