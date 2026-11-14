import { LogOut, Menu, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button, Sheet } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { BACK_OFFICE_NAV, POS_NAV } from '../routing/nav';
import { PermissionGate } from '../routing/gates';
import { Breadcrumbs } from './Breadcrumbs';

const NAV_LINK =
  'flex min-h-control-md items-center gap-2 border-s-4 border-transparent px-3 text-control-md text-fg ' +
  'outline-focus outline-offset-[-2px] focus-visible:outline-2 hover:bg-surface-hover ' +
  'aria-[current=page]:border-accent aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold aria-[current=page]:text-accent-subtle-fg';

/** The back office frame: header, sidebar (a sheet below 64rem), breadcrumbs and a permission-gated main area. */
export function BackOfficeShell() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [...BACK_OFFICE_NAV, POS_NAV].filter(
    (item) => item.permission === null || auth.can(item.permission),
  );
  const links = (
    <ul className="grid gap-1">
      {items.map(({ key, path, icon: Icon }) => (
        <li key={key}>
          <NavLink
            to={path}
            end={path === '/'}
            className={NAV_LINK}
            onClick={() => setMenuOpen(false)}
          >
            <Icon aria-hidden="true" className="size-icon-md" />
            {t(`nav.${key}`)}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const signOut = async () => {
    await auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div data-shell="back-office" className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-fg focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-popover"
      >
        {t('app.skipToContent')}
      </a>
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="lg:hidden">
          <Sheet
            side="start"
            open={menuOpen}
            onOpenChange={setMenuOpen}
            title={t('backOffice.menu')}
            closeLabel={t('backOffice.closeMenu')}
            trigger={
              <Button variant="ghost" iconOnly aria-label={t('backOffice.menu')}>
                <Menu />
              </Button>
            }
          >
            <nav aria-label={t('backOffice.navLabel')}>{links}</nav>
          </Sheet>
        </div>
        <Link to="/" className="text-lg font-semibold outline-focus focus-visible:outline-2">
          {t('app.name')}
        </Link>
        <div className="ms-auto flex items-center gap-2">
          {auth.can(POS_NAV.permission ?? '') ? (
            <Button asChild variant="secondary" size="sm">
              <Link to={POS_NAV.path}>
                <ScanBarcode aria-hidden="true" />
                {t('backOffice.openPos')}
              </Link>
            </Button>
          ) : null}
          <span className="hidden text-sm text-fg-muted sm:inline">
            {t('backOffice.signedInAs', { name: auth.session?.principal.displayName ?? '' })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            {t('backOffice.signOut')}
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('backOffice.navLabel')}
          className="hidden w-56 shrink-0 border-e border-border bg-surface p-2 lg:block"
        >
          {links}
        </nav>
        <main
          id="main"
          tabIndex={-1}
          aria-label={t('backOffice.mainLabel')}
          className="min-w-0 flex-1 p-4 outline-none"
        >
          <div className="mb-4">
            <Breadcrumbs />
          </div>
          <PermissionGate>
            <Outlet />
          </PermissionGate>
        </main>
      </div>
    </div>
  );
}
