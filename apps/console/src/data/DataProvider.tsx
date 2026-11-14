import { QueryClientProvider } from '@hakorem/data';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { queryClient } from './api';
import { attachSession } from './session';

/**
 * The one QueryClientProvider (ADR 0022), mounted once beside the one UIProvider. It also connects the
 * data layer to the session: a 401 anywhere refreshes through `AuthProvider` once and retries (ADR 0021),
 * and when the session ends, signed out or expired, every cached answer is dropped, so the next person at
 * a shared counter tablet never sees the last one's data.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { refreshSession, expire } = auth;
  // Re-attached whenever the session's CSRF token changes (every refresh rotates it).
  const csrfToken = auth.session?.csrfToken ?? null;
  useEffect(
    () =>
      attachSession({
        refresh: refreshSession,
        onExpired: expire,
        getCsrfToken: () => csrfToken,
      }),
    [refreshSession, expire, csrfToken],
  );

  const ended = auth.status === 'anonymous' || auth.status === 'expired';
  useEffect(() => {
    if (ended) queryClient.clear();
  }, [ended]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
