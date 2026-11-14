/**
 * The auth module's types.
 *
 * These are a minimal local interface, NOT generated types, and NOT a hand-written client (F2 builds the
 * generated client). Every shape below mirrors a schema in contract/openapi.yaml 1.1.0, named in a comment.
 * F2 replaces these with the generated types; F3 replaces the stub with the real client (ADR 0012).
 */

/** Schema `Realm`. The console only uses STAFF. */
export type Realm = 'STAFF' | 'CUSTOMER' | 'INVESTOR';

/** Schema `GrantSummary`. */
export interface GrantSummary {
  roleCode: string;
  roleName: string;
  branchId: string;
  branchCode: string;
  locationId: string | null;
  locationCode: string | null;
}

/** Schema `SessionInfo`. Returned by loginStaff, verifyTotp, refreshSession and getCurrentSession. */
export interface SessionInfo {
  sessionId: string;
  realm: Realm;
  principal: { id: string; displayName: string };
  /** Sent as X-CSRF-Token on every state-changing request. */
  csrfToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  steppedUpAt: string | null;
  mustChangePassword: boolean;
  totpEnrolled: boolean;
  grants: GrantSummary[];
  /** Permission codes, the same strings as `x-permission` in the contract. */
  permissions: string[];
}

/** Schema `LoginResult`. `status` is the enum from the contract. */
export type LoginStatus =
  | 'AUTHENTICATED'
  | 'TOTP_REQUIRED'
  | 'TOTP_ENROLMENT_REQUIRED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'VERIFICATION_REQUIRED';

export interface LoginResult {
  status: LoginStatus;
  challengeToken: string | null;
  session: SessionInfo | null;
}

/** Schema `ErrorDetail`. `field` is a JSON pointer. */
export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

/** The contract's `Error` envelope (`{ error: { code, message, correlationId, details } }`), plus the HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;
  readonly details: ErrorDetail[];
  /** Seconds, from `Retry-After`, on a 429. */
  readonly retryAfter: number | undefined;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    correlationId: string;
    details?: ErrorDetail[];
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.details = init.details ?? [];
    this.retryAfter = init.retryAfter;
  }
}

/** A request that never reached the server (offline, DNS, refused). Distinct from an API answer. */
export class NetworkError extends Error {
  constructor() {
    super('The server could not be reached.');
    this.name = 'NetworkError';
  }
}

/**
 * What the app needs from authentication. Each method names its contract operation id. The stub and the
 * real client both implement it, so screens never know which one is behind it (ADR 0012).
 *
 * Cookies and the CSRF token are the client's business: no method takes or returns one, because in the
 * browser the cookies are HttpOnly and the CSRF token travels in a header the client attaches.
 */
export interface AuthClient {
  /** operationId `loginStaff`: POST /auth/staff/login. */
  loginStaff(input: {
    identifier: string;
    password: string;
    deviceLabel?: string;
  }): Promise<LoginResult>;
  /** operationId `verifyTotp`: POST /auth/totp/verify. */
  verifyTotp(input: { challengeToken: string; code: string }): Promise<LoginResult>;
  /** operationId `getCurrentSession`: GET /auth/session. Throws ApiError 401 UNAUTHENTICATED without a valid access cookie. */
  getCurrentSession(): Promise<SessionInfo>;
  /** operationId `refreshSession`: POST /auth/refresh. Rotates the refresh cookie. Throws ApiError 401 when there is no session. */
  refreshSession(): Promise<SessionInfo>;
  /** operationId `logout`: POST /auth/logout. */
  logout(): Promise<void>;
  /** operationId `changePassword`: POST /auth/password/change. */
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  /** operationId `requestPasswordReset`: POST /auth/password/reset-request, with realm STAFF added by the client. */
  requestPasswordReset(input: { identifier: string }): Promise<void>;
  /** operationId `resetPassword`: POST /auth/password/reset. */
  resetPassword(input: { token: string; newPassword: string }): Promise<void>;
}
