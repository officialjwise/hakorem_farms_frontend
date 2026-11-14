import { ApiError, NetworkError } from './errors';

/** What the data layer needs from whoever owns the session. */
export interface SessionHooks {
  /**
   * Exchange the refresh cookie for a new access cookie. Resolve when the session is fresh again, throw an
   * `ApiError` when the server ended the session (401), and throw anything else (or a `NetworkError`)
   * when the server could not be reached.
   */
  refresh: () => Promise<void>;
  /** Called once when a refresh is refused, or a freshly refreshed session is still refused. Show session expiry. */
  onExpired: () => void;
  /** The CSRF token of the current session, for `X-CSRF-Token`. Null when there is no session. */
  getCsrfToken: () => string | null;
}

export type RefreshOutcome = 'refreshed' | 'expired' | 'unreachable';

export interface SessionRefresher {
  /** Resolves when the refresh the caller joined (or started) is over. Never rejects. */
  refresh: () => Promise<RefreshOutcome>;
  /** The refresh in flight, if any, so a request about to start can wait for it instead of failing with a stale cookie. */
  inFlight: () => Promise<RefreshOutcome> | null;
  /** How many refreshes have finished. A request notes it when it is sent. */
  generation: () => number;
  /** How the most recent finished refresh ended. */
  lastOutcome: () => RefreshOutcome;
}

/**
 * The 401 single flight (ADR 0021). A request that was sent before a refresh finished and is refused
 * after it is not a reason to refresh again: the caller compares `generation()` with the value it noted
 * when it sent the request, and reuses `lastOutcome()`.
 * However many requests get a 401 at the same moment, exactly one
 * refresh runs and they all share its result. Every refresh rotates the refresh token, so a second
 * concurrent one would be read as token reuse and revoke the session (API.md 3.3).
 */
export function createSessionRefresher(
  hooks: Pick<SessionHooks, 'refresh' | 'onExpired'>,
): SessionRefresher {
  let current: Promise<RefreshOutcome> | null = null;
  let generation = 0;
  let last: RefreshOutcome = 'refreshed';

  const run = async (): Promise<RefreshOutcome> => {
    try {
      await hooks.refresh();
      return 'refreshed';
    } catch (error) {
      if (error instanceof ApiError && !(error instanceof NetworkError)) {
        hooks.onExpired();
        return 'expired';
      }
      return 'unreachable';
    }
  };

  return {
    refresh() {
      current ??= run()
        .then((outcome) => {
          generation += 1;
          last = outcome;
          return outcome;
        })
        .finally(() => {
          current = null;
        });
      return current;
    },
    inFlight: () => current,
    generation: () => generation,
    lastOutcome: () => last,
  };
}
