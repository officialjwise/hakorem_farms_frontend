import { Menu, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { PAGE_TITLE_SLOT_ID } from '../lib/ScreenHeader';
import { Button, Sheet } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { POS_NAV } from '../routing/nav';
import { PermissionGate } from '../routing/gates';
import {
  AccountMenu,
  BranchSwitcher,
  GlobalSearch,
  Notifications,
  ThemeToggle,
} from './header/HeaderTools';
import { Sidebar, SidebarLinks } from './Sidebar';

/**
 * The back office frame (F5b, F5c): a top bar with the menu (a sheet below 64rem), the page's title, search,
 * the branch every screen is scoped to, the till, theme, notifications and the account; a grouped sidebar;
 * and a permission-gated main area.
 */
export function BackOfficeShell() {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div data-shell="back-office" className="flex min-h-dvh">
      {/* First in the tab order, before the sidebar's links. */}
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-fg focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-popover"
      >
        {t('app.skipToContent')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface px-4 py-2.5 print:hidden sm:flex-nowrap">
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
          {/*
            The page's h1 lands here (lib/ScreenHeader), as the reference puts the title in the top bar. On a
            phone it takes its own line beneath the tools, so it is never cut to a letter.
          */}
          <div
            id={PAGE_TITLE_SLOT_ID}
            className="order-last flex w-full min-w-0 items-center sm:order-none sm:w-auto sm:flex-1"
          />
          <div className="ms-auto flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <GlobalSearch />
            <BranchSwitcher />
            {auth.can(POS_NAV.permission ?? '') ? (
              <Button asChild size="sm">
                <Link to={POS_NAV.path}>
                  <ScanBarcode aria-hidden="true" />
                  {/* Icon only below 80rem, so the page title has room; the name stays for assistive technology. */}
                  <span className="sr-only xl:not-sr-only">{t('backOffice.openPos')}</span>
                </Link>
              </Button>
            ) : null}
            <ThemeToggle className="hidden sm:inline-flex" />
            <Notifications />
            <AccountMenu />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <main
            id="main"
            tabIndex={-1}
            aria-label={t('backOffice.mainLabel')}
            className="min-w-0 flex-1 p-4 outline-none lg:p-6"
          >
            <PermissionGate>
              <Outlet />
            </PermissionGate>
          </main>
        </div>
      </div>
    </div>
  );
}
