import Link from 'next/link';
import { CATEGORIES } from '../lib/catalogue';
import { getT } from '../i18n/server';

export async function SiteFooter() {
  const t = await getT('storefront');
  return (
    <footer
      aria-label={t('footer.label')}
      className="mt-auto border-t border-border bg-surface-sunken"
    >
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm text-fg-muted sm:grid-cols-2">
        <p>{t('footer.about')}</p>
        <nav aria-label={t('footer.shop')}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {CATEGORIES.map(({ slug, key }) => (
              <li key={slug}>
                <Link
                  href={`/c/${slug}`}
                  className="inline-flex h-control-md items-center text-accent-text underline"
                >
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="sm:col-span-2">{t('footer.rights')}</p>
      </div>
    </footer>
  );
}
