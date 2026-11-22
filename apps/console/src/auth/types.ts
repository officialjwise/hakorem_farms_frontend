/**
 * The auth module's types, all taken from the generated client (ADR 0018). Nothing here is hand-written
 * against the contract: the shapes are the contract's schemas, `ApiError` and `NetworkError` are the data
 * layer's (ADR 0020), and the request bodies are read off the operations themselves, so a contract change
 * is a type error here and in the client.
 *
 * Since F3 the console runs the real client behind `auth/client.ts` (ADR 0024).
 */
import type { OperationInput, components } from '@hakorem/api-client';

export { ApiError, NetworkError } from '@hakorem/api-client';

/** Schema `Realm`. The back office and the till sign staff in; the investor portal, investors (ADR 0058). */
export type Realm = components['schemas']['Realm'];
/** Schema `GrantSummary`. */
export type GrantSummary = components['schemas']['GrantSummary'];
/** Schema `SessionInfo`. Returned by loginStaff, verifyTotp, refreshSession and getCurrentSession. */
export type SessionInfo = components['schemas']['SessionInfo'];
/** Schema `LoginResult`. */
export type LoginResult = components['schemas']['LoginResult'];
export type LoginStatus = LoginResult['status'];
/** Schema `TotpEnrolment`: the secret, its otpauth URI and a QR image of it, shown once. */
export type TotpEnrolment = components['schemas']['TotpEnrolment'];
/** Schema `RecoveryCodes`: single-use codes, shown once when an enrolment is confirmed. */
export type RecoveryCodes = components['schemas']['RecoveryCodes'];
/** Schema `ErrorDetail`. `field` is a JSON pointer, or null. */
export type ErrorDetail = components['schemas']['ErrorDetail'];

type BodyOf<
  Op extends
    | 'loginStaff'
    | 'loginInvestor'
    | 'verifyTotp'
    | 'changePassword'
    | 'requestPasswordReset'
    | 'resetPassword'
    | 'stepUp'
    | 'startTotpEnrolment'
    | 'confirmTotpEnrolment',
> = OperationInput<Op> extends { body?: infer Body } ? NonNullable<Body> : never;

/**
 * What the app needs from authentication. Each method names its contract operation id. The real client
 * (`apiAuthClient.ts`) implements it, and tests may wrap it, so screens never know which one is behind it (ADR 0012).
 *
 * Cookies and the CSRF token are the client's business: no method takes or returns one, because in the
 * browser the cookies are HttpOnly and the CSRF token travels in a header the client attaches.
 */
export interface AuthClient {
  /** operationId `loginStaff`: POST /auth/staff/login. */
  loginStaff(input: BodyOf<'loginStaff'>): Promise<LoginResult>;
  /** operationId `loginInvestor`: POST /auth/investor/login, the investor portal's sign-in (ADR 0058). */
  loginInvestor(input: BodyOf<'loginInvestor'>): Promise<LoginResult>;
  /** operationId `verifyTotp`: POST /auth/totp/verify. */
  verifyTotp(input: BodyOf<'verifyTotp'>): Promise<LoginResult>;
  /** operationId `getCurrentSession`: GET /auth/session. Throws ApiError 401 UNAUTHENTICATED without a valid access cookie. */
  getCurrentSession(): Promise<SessionInfo>;
  /** operationId `refreshSession`: POST /auth/refresh. Rotates the refresh cookie. Throws ApiError 401 when there is no session. */
  refreshSession(): Promise<SessionInfo>;
  /** operationId `logout`: POST /auth/logout. */
  logout(): Promise<void>;
  /** operationId `changePassword`: POST /auth/password/change. */
  changePassword(input: BodyOf<'changePassword'>): Promise<void>;
  /**
   * operationId `requestPasswordReset`: POST /auth/password/reset-request, in the realm given, STAFF when
   * none is.
   */
  requestPasswordReset(
    input: Omit<BodyOf<'requestPasswordReset'>, 'realm'> & { realm?: 'STAFF' | 'INVESTOR' },
  ): Promise<void>;
  /** operationId `resetPassword`: POST /auth/password/reset. */
  resetPassword(input: BodyOf<'resetPassword'>): Promise<void>;
  /**
   * operationId `stepUp`: POST /auth/step-up. A TOTP code on the current session, answered with the session
   * and a new `steppedUpAt`. Needed before an operation the contract marks "Requires step-up" (API.md 3.4).
   */
  stepUp(input: BodyOf<'stepUp'>): Promise<SessionInfo>;
  /**
   * operationId `startTotpEnrolment`: POST /auth/totp/enrol. During sign-in, after TOTP_ENROLMENT_REQUIRED,
   * with the `challengeToken` in the body and no cookie (CR-006, answered). The secret is shown once.
   */
  startTotpEnrolment(input: BodyOf<'startTotpEnrolment'>): Promise<TotpEnrolment>;
  /**
   * operationId `confirmTotpEnrolment`: POST /auth/totp/confirm. A first code activates the authenticator
   * and answers the recovery codes, shown once. During sign-in it also sets the session cookies; the client
   * then reads the session with `getCurrentSession`.
   */
  confirmTotpEnrolment(input: BodyOf<'confirmTotpEnrolment'>): Promise<RecoveryCodes>;
}
