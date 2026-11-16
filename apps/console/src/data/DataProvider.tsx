import { QueryClientProvider } from '@hakorem/data';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { queryClient } from './api';
import { attachRefusalWords } from './refusals';
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

  // Refusals in words (ADR 0038): the client reads them from the catalogue the app is showing.
  const { i18n } = useTranslation('common');
  useEffect(() => {
    // No catalogue mounted (a test of the data layer alone): the server's sentences stay.
    if (typeof i18n?.t !== 'function') return undefined;
    // The keys are built from the codes the server sends, so they are looked up untyped.
    const lookup = i18n.t.bind(i18n) as unknown as (key: string, options: { ns: string }) => string;
    return attachRefusalWords((key) =>
      i18n.exists(key, { ns: 'common' }) ? lookup(key, { ns: 'common' }) : null,
    );
  }, [i18n]);

  const ended = auth.status === 'anonymous' || auth.status === 'expired';
  useEffect(() => {
    if (ended) queryClient.clear();
  }, [ended]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
