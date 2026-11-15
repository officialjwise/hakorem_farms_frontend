import { Menu, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { Button, Sheet } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { POS_NAV } from '../routing/nav';
import { PermissionGate } from '../routing/gates';
import { Breadcrumbs } from './Breadcrumbs';
import {
  AccountMenu,
  BranchSwitcher,
  GlobalSearch,
  Notifications,
  ThemeToggle,
} from './header/HeaderTools';
import { Sidebar, SidebarLinks } from './Sidebar';

/**
 * The back office frame (F5b): a header with the menu (a sheet below 64rem), the name, breadcrumbs, search,
 * the branch every screen is scoped to, the till, theme, notifications and the account; a grouped sidebar;
 * and a permission-gated main area.
 */
export function BackOfficeShell() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div data-shell="back-office" className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-fg focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-popover"
      >
        {t('app.skipToContent')}
      </a>
      <header className="sticky top-0 z-sticky flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
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
            <nav aria-label={t('backOffice.navLabel')}>
              <SidebarLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
          </Sheet>
        </div>
        <Link
          to="/"
          className="hidden shrink-0 text-lg font-semibold text-accent-text outline-focus focus-visible:outline-2 sm:block"
        >
          {t('app.name')}
        </Link>
        <div className="ms-4 hidden min-w-0 xl:block">
          <Breadcrumbs />
        </div>
        <div className="ms-auto flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <GlobalSearch />
          <BranchSwitcher />
          {auth.can(POS_NAV.permission ?? '') ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to={POS_NAV.path}>
                <ScanBarcode aria-hidden="true" />
                {t('backOffice.openPos')}
              </Link>
            </Button>
          ) : null}
          <ThemeToggle className="hidden sm:inline-flex" />
          <Notifications />
          <AccountMenu />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main
          id="main"
          tabIndex={-1}
          aria-label={t('backOffice.mainLabel')}
          className="min-w-0 flex-1 p-4 outline-none"
        >
          <div className="mb-3 xl:hidden">
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
