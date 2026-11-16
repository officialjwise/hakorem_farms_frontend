import { ApiError, type SessionHooks } from '@hakorem/api-client';

/**
 * The seam between the data layer and whoever owns the session. `DataProvider` attaches `AuthProvider`'s
 * refresh, expiry and CSRF token here when the app mounts; until then a 401 reads as "no session".
 */
let owner: SessionHooks | null = null;

/** Where the enrolled till's credential comes from (ADR 0044). Only the till document sets one. */
let deviceCredential: () => string | null = () => null;

export function attachDeviceCredential(source: () => string | null): void {
  deviceCredential = source;
}

export function attachSession(hooks: SessionHooks): () => void {
  owner = hooks;
  return () => {
    if (owner === hooks) owner = null;
  };
}

export const sessionHooks: SessionHooks = {
  refresh: () =>
    owner === null
      ? Promise.reject(
          new ApiError({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'There is no session to refresh.',
            correlationId: '',
          }),
        )
      : owner.refresh(),
  onExpired: () => owner?.onExpired(),
  getCsrfToken: () => owner?.getCsrfToken() ?? null,
  getDeviceCredential: () => deviceCredential(),
};
