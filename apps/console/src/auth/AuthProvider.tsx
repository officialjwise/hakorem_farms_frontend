import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  NetworkError,
  type AuthClient,
  type LoginResult,
  type SessionInfo,
} from './types';

/**
 * What the app knows about the session.
 *
 * - `loading`: the first check on boot, before anything may render.
 * - `anonymous`: no session. Login screens.
 * - `authenticated`: a session, kept fresh by silent refresh.
 * - `expired`: there was a session and the server ended it. The screen says so in words (never a silent redirect).
 * - `error`: the check could not reach the server. The screen offers a retry.
 */
export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'expired' | 'error';

/** The step a sign-in is waiting on, after a first answer that was not AUTHENTICATED. */
export type PendingStep =
  { kind: 'totp'; challengeToken: string } | { kind: 'password-change' } | null;

export interface AuthApi {
  status: AuthStatus;
  session: SessionInfo | null;
  pending: PendingStep;
  /** True after the user chose to sign out, until the next sign-in. Decides whether sign-in remembers where they were. */
  signedOut: boolean;
  /** True when the signed-in user holds the permission. The server enforces regardless. */
  can: (permission: string) => boolean;
  login: (identifier: string, password: string) => Promise<LoginResult['status']>;
  verifyTotp: (code: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Refresh the session now, through the same one-at-a-time path as the silent timer. The data layer calls
   * it when any request gets a 401 (ADR 0021), so the timer and a 401 never run two refreshes.
   */
  refreshSession: () => Promise<void>;
  /** End the session in the UI: the server refused a refresh. Shows the session expiry screen. */
  expire: () => void;
  /** Re-run the boot check after an `error`. */
  retry: () => void;
  /** Drop a pending sign-in step and go back to the first screen. */
  cancelPending: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

/** Refresh this long before the access token expires. */
export const REFRESH_LEAD_MS = 60 * 1000;
/**
 * Never refresh silently more often than this. A session whose `accessExpiresAt` is already past by this
 * device's clock (a clock running ahead of the server's, or the mock's fixed example) would otherwise be
 * refreshed again the moment each refresh lands: hundreds of times a second (ADR 0024).
 */
export const MIN_REFRESH_INTERVAL_MS = 30 * 1000;
const RETRY_AFTER_NETWORK_ERROR_MS = 15 * 1000;

export interface AuthProviderProps {
  client: AuthClient;
  children: ReactNode;
  /** Overridable for tests. */
  now?: () => number;
}

/**
 * Holds the session, runs the boot check and keeps the session fresh. The refresh is silent: a timer fires
 * shortly before `accessExpiresAt`, and a returning tab refreshes at once if the timer was throttled.
 * Only one refresh runs at a time, in this tab and, through the Web Locks API, across tabs, because every
 * refresh rotates the token and a second one racing the first would revoke the session (API.md 3.3).
 */
const defaultNow = () => Date.now();

export function AuthProvider({ client, children, now = defaultNow }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [pending, setPending] = useState<PendingStep>(null);
  const [signedOut, setSignedOut] = useState(false);
  const inFlight = useRef<Promise<SessionInfo> | null>(null);
  /** When the last refresh succeeded, by `now()`. */
  const lastRefresh = useRef<number | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  const adopt = useCallback((next: SessionInfo) => {
    setSession(next);
    setStatus('authenticated');
    setPending(null);
    setSignedOut(false);
  }, []);

  /** One refresh at a time. A concurrent caller shares the same promise. */
  const refresh = useCallback((): Promise<SessionInfo> => {
    if (inFlight.current) return inFlight.current;
    const run = async (): Promise<SessionInfo> => client.refreshSession();
    const locked: Promise<SessionInfo> =
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('hk-session-refresh', run).then((session) => session)
        : run();
    const shared = locked
      .then((session) => {
        lastRefresh.current = now();
        return session;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = shared;
    return shared;
  }, [client, now]);

  // Boot: is there a session already (a reload keeps the cookies)?
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        adoptIf(live, await client.getCurrentSession());
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          try {
            adoptIf(live, await refresh());
          } catch (refreshError) {
            if (!live) return;
            // A NetworkError is an ApiError with status 0: no answer is not the same as a refused session.
            setStatus(
              refreshError instanceof ApiError && !(refreshError instanceof NetworkError)
                ? 'anonymous'
                : 'error',
            );
          }
        } else if (live) {
          setStatus('error');
        }
      }
    })();
    function adoptIf(isLive: boolean, next: SessionInfo) {
      if (isLive) adopt(next);
    }
    return () => {
      live = false;
    };
  }, [client, refresh, adopt, bootAttempt]);

  // Silent refresh while signed in.
  useEffect(() => {
    if (status !== 'authenticated' || session === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;

    const run = async () => {
      try {
        const next = await refresh();
        if (live) adopt(next);
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && error.status === 401) {
          setSession(null);
          setStatus('expired');
        } else if (error instanceof NetworkError || !(error instanceof ApiError)) {
          timer = setTimeout(() => void run(), RETRY_AFTER_NETWORK_ERROR_MS);
        }
      }
    };

    /** How long until the floor between refreshes allows another one. */
    const floor = () =>
      lastRefresh.current === null ? 0 : lastRefresh.current + MIN_REFRESH_INTERVAL_MS - now();
    const due = Date.parse(session.accessExpiresAt) - REFRESH_LEAD_MS - now();
    timer = setTimeout(() => void run(), Math.max(due, floor(), 0));

    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.parse(session.accessExpiresAt) - REFRESH_LEAD_MS <= now() &&
        floor() <= 0
      ) {
        clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status, session, refresh, adopt, now]);

  const login = useCallback<AuthApi['login']>(
    async (identifier, password) => {
      const result = await client.loginStaff({ identifier, password, deviceLabel: 'Console' });
      if (result.status === 'AUTHENTICATED' && result.session) {
        adopt(result.session);
      } else if (result.status === 'TOTP_REQUIRED' && result.challengeToken) {
        setPending({ kind: 'totp', challengeToken: result.challengeToken });
      } else if (result.status === 'PASSWORD_CHANGE_REQUIRED') {
        setPending({ kind: 'password-change' });
      } else {
        // TOTP_ENROLMENT_REQUIRED and VERIFICATION_REQUIRED are built with the users screens (F3).
        throw new ApiError({
          status: 422,
          code: 'UNSUPPORTED_LOGIN_STEP',
          message: 'This sign-in step is not available yet.',
          correlationId: '00000000-0000-0000-0000-000000000000',
        });
      }
      return result.status;
    },
    [client, adopt],
  );

  const verifyTotp = useCallback<AuthApi['verifyTotp']>(
    async (code) => {
      if (pending?.kind !== 'totp') throw new Error('No TOTP challenge is pending.');
      const result = await client.verifyTotp({ challengeToken: pending.challengeToken, code });
      if (result.status === 'AUTHENTICATED' && result.session) adopt(result.session);
    },
    [client, pending, adopt],
  );

  const changePassword = useCallback<AuthApi['changePassword']>(
    async (currentPassword, newPassword) => {
      await client.changePassword({ currentPassword, newPassword });
      // After a forced change the user signs in again with the new password (assumption A-F1-03).
      // The pending step is left for the screen to drop once it has navigated, so it does not redirect early.
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      setSession(null);
      setPending(null);
      setSignedOut(true);
      setStatus('anonymous');
    }
  }, [client]);

  const refreshSession = useCallback(async () => {
    adopt(await refresh());
  }, [refresh, adopt]);

  const expire = useCallback(() => {
    setSession(null);
    setPending(null);
    setStatus('expired');
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      status,
      session,
      pending,
      signedOut,
      can: (permission) => session?.permissions.includes(permission) ?? false,
      login,
      verifyTotp,
      changePassword,
      requestPasswordReset: (identifier) => client.requestPasswordReset({ identifier }),
      resetPassword: (token, newPassword) => client.resetPassword({ token, newPassword }),
      logout,
      refreshSession,
      expire,
      retry: () => {
        setStatus('loading');
        setBootAttempt((n) => n + 1);
      },
      cancelPending: () => setPending(null),
    }),
    [
      status,
      session,
      pending,
      signedOut,
      login,
      verifyTotp,
      changePassword,
      logout,
      refreshSession,
      expire,
      client,
    ],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (api === null) throw new Error('useAuth must be used inside AuthProvider.');
  return api;
}
