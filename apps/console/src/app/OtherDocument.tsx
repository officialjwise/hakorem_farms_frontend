import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Button, ErrorState, Skeleton } from '@hakorem/ui';

/**
 * How this document leaves for the other one. `loadedAt` is the path this document was served for, read
 * once when the script first runs. Tests replace both.
 */
export const documentNavigation = {
  loadedAt: typeof window === 'undefined' ? '' : window.location.pathname,
  replace: (url: string) => window.location.replace(url),
};

/**
 * A path the other document owns (ADR 0030, `entryFor`). An in-app navigation that lands here, such as the
 * POS link in the back office or "Back office" on the till, is finished by the browser: the history entry
 * the router just pushed is replaced by the other document at the same address, so Back still works.
 *
 * If this document was SERVED for this path, the server routed the address to the wrong document, and
 * reloading would only fetch the same one again. That is said in words instead of looping.
 */
export function OtherDocument() {
  const { t } = useTranslation('shell');
  const location = useLocation();
  const target = `${location.pathname}${location.search}${location.hash}`;
  const wrongDocument = location.pathname === documentNavigation.loadedAt;

  useEffect(() => {
    if (!wrongDocument) documentNavigation.replace(target);
  }, [wrongDocument, target]);

  if (wrongDocument) {
    return (
      <main id="main" className="grid min-h-dvh place-items-center p-6">
        <ErrorState
          title={t('handOff.wrongTitle')}
          description={t('handOff.wrongBody')}
          action={
            <Button asChild variant="secondary">
              <Link to="/">{t('notFound.home')}</Link>
            </Button>
          }
        />
      </main>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <Skeleton label={t('handOff.opening')} shape="block" />
      </div>
    </div>
  );
}
