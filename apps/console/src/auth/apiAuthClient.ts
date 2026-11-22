/**
 * The real staff auth client (ADR 0024), built on the generated API client (ADR 0018). It replaces the F1
 * stub behind `client.ts`. Each method is one operation of the contract, called through `call()`, so the
 * method, path, body and headers come from `contract/openapi.yaml` and nothing here calls `fetch`.
 *
 * Two things differ from the data layer's client, on purpose:
 *
 * - **A 401 is an answer here, not a reason to refresh.** These operations are the session's own:
 *   `getCurrentSession` answering 401 on boot means "no session", and `AuthProvider` decides what follows
 *   (try one refresh, then anonymous). If this client refreshed on a 401 the way the data layer does, a
 *   fresh visitor's boot check would run a refresh, have it refused, and land on "your session ended". So
 *   the session hooks below refuse every refresh and do nothing on expiry, and the 401 reaches the caller.
 * - **The CSRF token is the one the last session response carried** (`SessionInfo.csrfToken`, from
 *   loginStaff, verifyTotp, getCurrentSession, refreshSession or stepUp), held in memory only and forgotten on
 *   logout. Cookies are HttpOnly and the browser sends them itself (`credentials: 'include'`).
 */
import {
  ApiError,
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type SessionHooks,
} from '@hakorem/api-client';
import type { AuthClient, LoginResult, SessionInfo } from './types';

export interface ApiAuthClientOptions {
  /** From `apiBaseUrl()` (ADR 0019). */
  baseUrl: string;
  /** For tests. Defaults to the global `fetch`. */
  fetch?: ApiClientOptions['fetch'];
  /** For tests: sent on every request (the integration suite asks Prism for a status with `Prefer`). */
  headers?: Record<string, string>;
}

/** The refusal every refresh attempt from inside the auth client gets: see the header comment. */
const NO_REFRESH_HERE = () =>
  new ApiError({
    status: 401,
    code: 'UNAUTHENTICATED',
    message: 'The auth operations do not refresh on a 401; AuthProvider decides.',
    correlationId: '',
  });

export function createApiAuthClient(options: ApiAuthClientOptions): AuthClient {
  /** Held in memory only: the CSRF token the last session response carried. */
  let csrf: string | null = null;

  const hooks: SessionHooks = {
    refresh: () => Promise.reject(NO_REFRESH_HERE()),
    onExpired: () => undefined,
    getCsrfToken: () => csrf,
  };
  const api: ApiClient = createApiClient({
    baseUrl: options.baseUrl,
    session: hooks,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
  });

  const remember = (session: SessionInfo): SessionInfo => {
    csrf = session.csrfToken;
    return session;
  };
  const rememberLogin = (result: LoginResult): LoginResult => {
    if (result.session) remember(result.session);
    return result;
  };

  return {
    loginStaff: async (body) => rememberLogin(await api.call('loginStaff', { body })),
    loginInvestor: async (body) => rememberLogin(await api.call('loginInvestor', { body })),
    verifyTotp: async (body) => rememberLogin(await api.call('verifyTotp', { body })),
    getCurrentSession: async () => remember(await api.call('getCurrentSession')),
    refreshSession: async () => remember(await api.call('refreshSession')),
    logout: async () => {
      try {
        await api.call('logout');
      } finally {
        // Signed out in the UI whatever the answer (AuthProvider), so the token is no use any more.
        csrf = null;
      }
    },
    changePassword: async (body) => {
      await api.call('changePassword', { body });
    },
    requestPasswordReset: async ({ realm = 'STAFF', ...body }) => {
      await api.call('requestPasswordReset', { body: { ...body, realm } });
    },
    resetPassword: async (body) => {
      await api.call('resetPassword', { body });
    },
    stepUp: async (body) => remember(await api.call('stepUp', { body })),
    startTotpEnrolment: (body) => api.call('startTotpEnrolment', { body }),
    confirmTotpEnrolment: (body) => api.call('confirmTotpEnrolment', { body }),
  };
}
