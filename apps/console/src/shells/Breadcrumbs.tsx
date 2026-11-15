import { ChevronRight, House } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useMatches } from 'react-router';
import { isRouteHandle } from '../routing/handle';

/** Breadcrumbs from the matched routes' `handle.crumb`. The last one is the current page. */
export function Breadcrumbs() {
  const { t } = useTranslation('shell');
  const matches = useMatches();
  const trail = matches.flatMap((match) =>
    isRouteHandle(match.handle) ? [{ path: match.pathname, key: match.handle.crumb }] : [],
  );
  // The dashboard is the root of every trail.
  const crumbs =
    trail[0]?.key === 'dashboard' ? trail : [{ path: '/', key: 'dashboard' as const }, ...trail];
  const unique = crumbs.filter(
    (crumb, index) => crumbs.findIndex((c) => c.key === crumb.key) === index,
  );

  return (
    <nav aria-label={t('backOffice.breadcrumb')} data-slot="breadcrumbs">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        {unique.map((crumb, index) => {
          const last = index === unique.length - 1;
          return (
            <Fragment key={crumb.key}>
              <li>
                {last ? (
                  <span aria-current="page" className="font-medium text-fg">
                    {t(`nav.${crumb.key}`)}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="inline-flex items-center gap-2 text-fg-muted hover:text-fg hover:underline"
                  >
                    {index === 0 ? (
                      <span className="grid size-7 place-items-center rounded-full bg-accent-subtle">
                        <House aria-hidden="true" className="size-icon-sm stroke-accent" />
                      </span>
                    ) : null}
                    {t(`nav.${crumb.key}`)}
                  </Link>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true">
                  <ChevronRight className="size-icon-sm rtl:rotate-180" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
