import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useMatches } from 'react-router';
import { Button, ErrorState, Skeleton } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { isRouteHandle } from './handle';

/** The permission-denied state: words, a lock, and the permission the page needs. Never a redirect (BUILD_PROMPT F1). */
export function PermissionDenied({ permission }: { permission?: string | null }) {
  const { t } = useTranslation('shell');
  const action = (
    <Button asChild variant="secondary">
      <Link to="/">{t('denied.home')}</Link>
    </Button>
  );
  return permission ? (
    <ErrorState
      icon={Lock}
      title={t('denied.title')}
      description={t('denied.body')}
      reference={permission}
      referenceLabel={t('denied.permission')}
      action={action}
    />
  ) : (
    <ErrorState
      icon={Lock}
      title={t('denied.title')}
      description={t('denied.body')}
      action={action}
    />
  );
}

/**
 * Decides whether the route being rendered is allowed. The route declares its permission in `handle`
 * (see handle.ts). A route that declares nothing is denied: deny by default.
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const matches = useMatches();
  const handle = matches.at(-1)?.handle;
  if (!isRouteHandle(handle)) return <PermissionDenied />;
  if (handle.permission !== null && !auth.can(handle.permission)) {
    return <PermissionDenied permission={handle.permission} />;
  }
  return children;
}

/**
 * Everything behind sign-in. It owns the four session states so no screen repeats them:
 * loading, error (the check could not reach the server), expired (said in words), and anonymous
 * (the one place a redirect is right: to the sign-in screen, remembering where the user was going).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const { t } = useTranslation(['shell', 'auth']);

  switch (auth.status) {
    case 'loading':
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <div className="w-full max-w-sm">
            <Skeleton label={t('shell:session.checking')} className="h-24" shape="block" />
          </div>
        </div>
      );
    case 'error':
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <ErrorState
            title={t('shell:session.error')}
            description={t('shell:session.errorBody')}
            action={<Button onClick={auth.retry}>{t('shell:session.retry')}</Button>}
          />
        </div>
      );
    case 'expired':
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <ErrorState
            title={t('auth:expired.title')}
            description={t('auth:expired.body')}
            action={
              <Button asChild>
                <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
                  {t('auth:expired.signIn')}
                </Link>
              </Button>
            }
          />
        </div>
      );
    case 'anonymous':
      return (
        <Navigate
          to={
            auth.signedOut
              ? '/login'
              : `/login?next=${encodeURIComponent(location.pathname + location.search)}`
          }
          replace
        />
      );
    case 'authenticated':
      // A session of another realm (an investor's in the back office, staff in the investor portal) is
      // said in words and never used (ADR 0058).
      if (auth.session !== null && auth.session.realm !== auth.realm) {
        const portal = auth.realm === 'INVESTOR';
        return (
          <div className="grid min-h-dvh place-items-center p-6">
            <ErrorState
              icon={Lock}
              title={t(portal ? 'shell:session.staffInPortal' : 'shell:session.investorInConsole')}
              description={t(
                portal ? 'shell:session.staffInPortalBody' : 'shell:session.investorInConsoleBody',
              )}
              action={
                <Button onClick={() => void auth.logout()}>{t('shell:session.signOut')}</Button>
              }
            />
          </div>
        );
      }
      if (auth.session?.mustChangePassword) return <Navigate to="/change-password" replace />;
      return children;
  }
}
