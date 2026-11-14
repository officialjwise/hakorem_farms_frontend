import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router';
import { createI18n } from '@hakorem/i18n';
import { ErrorBoundary } from './app/ErrorBoundary';
import { createRouter } from './app/routes';
import { AuthProvider } from './auth/AuthProvider';
import { authClient } from './auth/client';
import './styles.css';

async function main() {
  const i18n = await createI18n({ namespaces: ['common', 'shell', 'auth', 'iam', 'audit'] });
  const root = document.getElementById('root');
  if (root === null) throw new Error('#root is missing from index.html.');
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <AuthProvider client={authClient}>
            <RouterProvider router={createRouter()} />
          </AuthProvider>
        </ErrorBoundary>
      </I18nextProvider>
    </StrictMode>,
  );
  registerServiceWorker();
}

/** A minimal service worker so the console is installable. Its caching strategy is F13 (ADR 0013). */
function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('[console] service worker registration failed', error);
      });
    };
    // main() is async, so the page may already have finished loading by now.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}

void main();
