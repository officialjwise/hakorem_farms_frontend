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
  /** Wrong PINs in a row before that person is locked out on this till. */
  maxAttempts: number;
  /** How long the lockout lasts. */
  lockoutSeconds: number;
  /** The till locks itself after this long with no touch, scan or key. */
  idleLockSeconds: number;
}

/** What a PIN can approve on the till without the network. */
export type PinApproval = 'OFFLINE_MOBILE_MONEY' | 'CASH_DROP_WITNESS';

export interface PinVerifier {
  principalId: string;
  displayName: string;
  /** Rises each time the PIN is set or reset. Recorded on what the PIN approved, and checked at sync. */
  version: number;
  /** PBKDF2-HMAC-SHA256: the slow hash Web Crypto offers in every browser the till runs in. */
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  /** Base64, at least 16 bytes. */
  salt: string;
  /** Base64, 32 bytes: PBKDF2(PIN as UTF-8, salt, iterations). */
  hash: string;
  /** What this person may approve on this till offline, from their permissions at the register's branch. */
  approves: PinApproval[];
}

export interface TillPinVerifiers {
  registerId: string;
  issuedAt: string;
  policy: TillPinPolicy;
  /** The signed-in operator's, and each supervisor's at the register's branch. Never the PIN. */
  verifiers: PinVerifier[];
}

export function listTillPinVerifiers(
  api: Pick<ApiClient, 'callRequested'>,
  registerId: string,
): Promise<TillPinVerifiers> {
  return api.callRequested(LIST_TILL_PIN_VERIFIERS, {
    path: { id: registerId },
  }) as Promise<TillPinVerifiers>;
}
