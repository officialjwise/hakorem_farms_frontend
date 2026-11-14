import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../components/Providers';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { getT } from '../i18n/server';
import { SITE_URL } from '../lib/site';
import { readTheme } from '../lib/theme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('meta.title'), template: t('meta.titleTemplate', { page: '%s' }) },
    description: t('meta.description'),
    applicationName: t('meta.siteName'),
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: t('meta.siteName'),
      title: t('meta.title'),
      description: t('meta.description'),
      locale: 'en_GH',
      url: '/',
    },
    twitter: { card: 'summary', title: t('meta.title'), description: t('meta.description') },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const t = await getT('shell');
  const theme = await readTheme();
  return (
    // data-theme is set here, on the server, so the first paint is already the right theme (ADR 0015).
    <html
      lang="en"
      data-density="comfortable"
      {...(theme === 'system' ? {} : { 'data-theme': theme })}
    >
      <body className="font-sans">
        <Providers
          theme={theme}
          toastLabels={{
            region: t('toast.region'),
            announcement: t('toast.announcement'),
            close: t('toast.close'),
          }}
        >
          <div className="flex min-h-dvh flex-col">
            <a
              href="#main"
              className="sr-only rounded-md bg-surface px-3 py-2 text-fg focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-popover"
            >
              {t('app.skipToContent')}
            </a>
            <SiteHeader />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none"
            >
              {children}
            </main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
