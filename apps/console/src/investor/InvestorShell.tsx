import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button, cn } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';

const LINKS = [
  { to: '/', key: 'summary', end: true },
  { to: '/capital', key: 'capital', end: false },
  { to: '/distributions', key: 'distributions', end: false },
  { to: '/statement', key: 'statement', end: false },
  { to: '/documents', key: 'documents', end: false },
] as const;

/**
 * The investor portal's frame (ADR 0058): the farm's name, who is signed in, the portal's five pages and
 * signing out. Nothing in it names an operation, a branch or another investor.
 */
export function InvestorShell() {
  const { t } = useTranslation(['investor', 'shell']);
  const auth = useAuth();
  const navigate = useNavigate();
  const name = auth.session?.principal.displayName ?? '';
  return (
    <div data-shell="investor" className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-fg focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-popover"
      >
        {t('shell:app.skipToContent')}
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="grid">
            <span className="font-semibold">{t('brand')}</span>
            <span className="text-control-sm text-fg-muted">{t('portal')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t('signedInAs', { name })}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await auth.logout();
                void navigate('/login', { replace: true });
              }}
            >
              <LogOut aria-hidden="true" />
              {t('signOut')}
            </Button>
          </div>
        </div>
        <nav aria-label={t('nav.label')} className="mx-auto max-w-5xl px-4">
          <ul className="flex gap-1 overflow-x-auto pb-2">
            {LINKS.map((link) => (
              <li key={link.key} className="shrink-0">
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold outline-focus outline-offset-2 focus-visible:outline-2',
                      isActive
                        ? 'bg-accent-subtle text-accent-text'
                        : 'text-fg hover:bg-surface-hover',
                    )
                  }
                >
                  {t(`nav.${link.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
