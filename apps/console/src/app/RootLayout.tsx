import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router';
import { UIProvider, type ThemePreference } from '@hakorem/ui';
import { DataProvider } from '../data/DataProvider';
import { themePreference, usePreference } from '../lib/preferences';
import { isRouteHandle } from '../routing/handle';

/**
 * The one UIProvider (ADR 0006), mounted at the root route so it sits inside the router and every shell and
 * auth screen shares it. The back office follows the theme chosen in its header (system, light or dark). The POS defaults to
 * light, because daylight on a counter screen washes dark themes out (assumption A-F0-03).
 *
 * `data-theme` is also set on <html>, so the page background and the area outside UIProvider's own element
 * follow the theme, not just the subtree.
 */
export function RootLayout() {
  const { t } = useTranslation('shell');
  const matches = useMatches();
  const handle = matches.at(-1)?.handle;
  const pos = isRouteHandle(handle) && handle.shell === 'pos';
  // The back office follows the person's choice (system by default); the till stays light.
  const chosen = usePreference(themePreference);
  const theme: ThemePreference = pos ? 'light' : chosen;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.setAttribute('data-density', 'compact');
  }, [theme]);

  return (
    <DataProvider>
      <UIProvider
        theme={theme}
        density="compact"
        toastLabels={{
          region: t('toast.region'),
          announcement: t('toast.announcement'),
          close: t('toast.close'),
        }}
      >
        <Outlet />
      </UIProvider>
    </DataProvider>
  );
}
