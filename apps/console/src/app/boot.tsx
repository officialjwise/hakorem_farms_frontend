import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { createI18n } from '@hakorem/i18n';
import { AuthProvider, type SignInRealm } from '../auth/AuthProvider';
import { authClient } from '../auth/client';
import { ErrorBoundary } from './ErrorBoundary';
import '../styles.css';

type Namespaces = Parameters<typeof createI18n>[0]['namespaces'];

/**
 * Starts one console document (ADR 0030). Each entry passes its own routes and only the catalogue
 * namespaces its screens use, so the till loads neither the back office's screens nor their words.
 */
export async function boot({
  routes,
  namespaces,
  realm = 'STAFF',
  serviceWorker = true,
}: {
  routes: RouteObject[];
  namespaces: Namespaces;
  /** Who this document signs in (ADR 0058): staff, or an investor in the portal. */
  realm?: SignInRealm;
  /** Whether this document registers the console's service worker. The investor portal does not (ADR 0058). */
  serviceWorker?: boolean;
}) {
  const i18n = await createI18n({ namespaces });
  const root = document.getElementById('root');
  if (root === null) throw new Error('#root is missing from the document.');
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <AuthProvider client={authClient} realm={realm}>
            <RouterProvider router={createBrowserRouter(routes)} />
          </AuthProvider>
        </ErrorBoundary>
      </I18nextProvider>
    </StrictMode>,
  );
  if (serviceWorker) registerServiceWorker();
}

/** A minimal service worker so the console is installable. Its caching strategy is F13 (ADR 0013). */
function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('[console] service worker registration failed', error);
      });
    };
    // boot() is async, so the page may already have finished loading by now.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
