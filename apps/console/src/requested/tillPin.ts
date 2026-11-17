/**
 * CR-032, the till PIN, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046). Not in the contract yet:
 * these types are the request's, and this file goes when the contract carries it.
 *
 * The server issues each operator's PIN as a verifier; the till checks a PIN against it on the device and
 * the PIN never reaches the server. It unlocks the till and records approvals; it creates no session.
 */
import type { ApiClient, RequestedOperation } from '@hakorem/api-client';

/** `listTillPinVerifiers`: the verifiers for an enrolled till, with the signed-in staff session. */
export const LIST_TILL_PIN_VERIFIERS: RequestedOperation = {
  request: 'CR-032',
  operationId: 'listTillPinVerifiers',
  method: 'get',
  path: '/registers/{id}/pin-verifiers',
  permission: 'pos.shift.open',
  idempotent: false,
  csrf: 'none',
  public: false,
  body: 'none',
  device: true,
};

/** The rule every till applies, offline, the same way. */
export interface TillPinPolicy {
  /** 4. */
  minDigits: number;
  /** 6. */
  maxDigits: number;
  /**
   * Wrong PINs in a row before that person is locked out on this till: at most 5 (owner, 2026-11-17); the
   * till applies five if the server sends more. There is no lockout time: a lockout ends only when the
   * server says so, or when a supervisor signs the cashier out.
   */
  maxAttempts: number;
  /** The till locks itself after this long with no touch or key. */
  idleLockSeconds: number;
}

/**
 * What a PIN can approve on the till without the network. `SUPERVISOR_SIGN_OUT` signs a locked cashier out
 * and does nothing else: it never opens the till or sells as them (owner, 2026-11-17).
 */
export type PinApproval = 'OFFLINE_MOBILE_MONEY' | 'CASH_DROP_WITNESS' | 'SUPERVISOR_SIGN_OUT';

export interface PinVerifier {
  principalId: string;
  displayName: string;
  /** Rises each time the PIN is set or reset. Recorded on what the PIN approved, and checked at sync. */
  version: number;
  /** PBKDF2-HMAC-SHA256: the slow hash Web Crypto offers in every browser the till runs in. */
  algorithm: 'PBKDF2-SHA256';
  /** At least 600,000 (owner, 2026-11-17). The till refuses a verifier below it. */
  iterations: number;
  /** Base64, at least 16 random bytes, one per person. The till refuses a shorter one. */
  salt: string;
  /** Base64, 32 bytes: PBKDF2(PIN as UTF-8, salt, iterations). */
  hash: string;
  /** What this person may approve on this till offline, from their permissions at the register's branch. */
  approves: PinApproval[];
  /**
   * The server's word on whether this person is locked out of PIN checks on this till, after the till
   * reported a lockout (`reportTillPinEvents`). The till ends a lockout only when this is false.
   */
  lockedOut: boolean;
}

export interface TillPinVerifiers {
  registerId: string;
  issuedAt: string;
  policy: TillPinPolicy;
  /** The signed-in operator's, and each supervisor's at the register's branch. Never the PIN. */
  verifiers: PinVerifier[];
}

/**
 * `reportTillPinEvents`: what the till must tell the server about its PINs, sent when it reaches the server
 * and answered with the verifiers as they now stand, so the server decides when a lockout ends.
 */
export const REPORT_TILL_PIN_EVENTS: RequestedOperation = {
  request: 'CR-032',
  operationId: 'reportTillPinEvents',
  method: 'post',
  path: '/registers/{id}/pin-events',
  permission: 'pos.shift.open',
  idempotent: true,
  csrf: 'required',
  public: false,
  body: 'json',
  device: true,
};

/**
 * A person locked out after the policy's wrong tries; or a locked cashier signed out on a supervisor's
 * PIN, recorded with who did it and when (owner, 2026-11-17). Each made on the till with its own id.
 */
export interface TillPinEvent {
  /** UUIDv7 made on the till; a resend with the same id is the same event. */
  id: string;
  kind: 'LOCKED_OUT' | 'SUPERVISOR_SIGN_OUT';
  /** The person locked out, or the cashier signed out. */
  principalId: string;
  /** Their verifier's version on this till, or null when the till held none. */
  verifierVersion: number | null;
  /** SUPERVISOR_SIGN_OUT: the supervisor whose PIN signed the cashier out, and their verifier's version. */
  supervisorId: string | null;
  supervisorVerifierVersion: number | null;
  /** The till's clock, for the record; the server keeps its own time of arrival. */
  occurredAt: string;
}

export interface TillPinEventsInput {
  events: TillPinEvent[];
}

export function reportTillPinEvents(
  api: Pick<ApiClient, 'callRequested'>,
  registerId: string,
  input: TillPinEventsInput,
  idempotencyKey: string,
): Promise<TillPinVerifiers> {
  return api.callRequested(
    REPORT_TILL_PIN_EVENTS,
    { path: { id: registerId }, body: input },
    { idempotencyKey },
  ) as Promise<TillPinVerifiers>;
}

export function listTillPinVerifiers(
  api: Pick<ApiClient, 'callRequested'>,
  registerId: string,
): Promise<TillPinVerifiers> {
  return api.callRequested(LIST_TILL_PIN_VERIFIERS, {
    path: { id: registerId },
  }) as Promise<TillPinVerifiers>;
}
