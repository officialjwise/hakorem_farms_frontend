/**
 * The auth module's types, all taken from the generated client (ADR 0018). Nothing here is hand-written
 * against the contract: the shapes are the contract's schemas, `ApiError` and `NetworkError` are the data
 * layer's (ADR 0020), and the request bodies are read off the operations themselves, so a contract change
 * is a type error here and in the stub.
 *
 * The stub still runs behind `auth/client.ts` until F3 swaps in the real client (ADR 0012).
 */
import type { OperationInput, components } from '@hakorem/api-client';

export { ApiError, NetworkError } from '@hakorem/api-client';

/** Schema `Realm`. The console only uses STAFF. */
export type Realm = components['schemas']['Realm'];
/** Schema `GrantSummary`. */
export type GrantSummary = components['schemas']['GrantSummary'];
/** Schema `SessionInfo`. Returned by loginStaff, verifyTotp, refreshSession and getCurrentSession. */
export type SessionInfo = components['schemas']['SessionInfo'];
/** Schema `LoginResult`. */
export type LoginResult = components['schemas']['LoginResult'];
export type LoginStatus = LoginResult['status'];
/** Schema `ErrorDetail`. `field` is a JSON pointer, or null. */
export type ErrorDetail = components['schemas']['ErrorDetail'];

type BodyOf<
  Op extends
    'loginStaff' | 'verifyTotp' | 'changePassword' | 'requestPasswordReset' | 'resetPassword',
> = OperationInput<Op> extends { body: infer Body } ? Body : never;

/**
 * What the app needs from authentication. Each method names its contract operation id. The stub and the
 * real client both implement it, so screens never know which one is behind it (ADR 0012).
 *
 * Cookies and the CSRF token are the client's business: no method takes or returns one, because in the
 * browser the cookies are HttpOnly and the CSRF token travels in a header the client attaches.
 */
export interface AuthClient {
  /** operationId `loginStaff`: POST /auth/staff/login. */
  loginStaff(input: BodyOf<'loginStaff'>): Promise<LoginResult>;
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
  /** operationId `requestPasswordReset`: POST /auth/password/reset-request, with realm STAFF added by the client. */
  requestPasswordReset(input: Omit<BodyOf<'requestPasswordReset'>, 'realm'>): Promise<void>;
  /** operationId `resetPassword`: POST /auth/password/reset. */
  resetPassword(input: BodyOf<'resetPassword'>): Promise<void>;
}
