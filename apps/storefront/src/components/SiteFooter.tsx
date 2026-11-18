import { Scale, Sprout } from 'lucide-react';
import Link from 'next/link';
import { getT } from '../i18n/server';
import { getShopCategories } from '../lib/api';
import { categorySlug } from '../lib/shop';

/** The footer: who the farm is, the categories again, and the one rule a customer must know. */
export async function SiteFooter() {
  const [t, categories] = await Promise.all([getT('storefront'), getShopCategories()]);
  const top = categories.ok ? categories.data.data.filter((c) => c.parentCode === null) : [];
  return (
    <footer aria-label={t('footer.label')} className="mt-auto" data-theme="dark">
      <div className="bg-panel text-fg">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-[2fr_1fr]">
          <div className="grid content-start gap-3">
            <p className="flex items-center gap-2 text-base font-semibold">
              <Sprout aria-hidden="true" className="size-icon-md stroke-accent" />
              {t('header.brand')}
            </p>
            <p className="max-w-prose text-fg-muted">{t('footer.about')}</p>
            <p className="flex max-w-prose items-start gap-2 text-fg-muted">
              <Scale aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 stroke-accent" />
              {t('footer.buyingByWeight')}
            </p>
          </div>
          <nav aria-label={t('footer.shop')} className="grid content-start gap-2">
            <p className="font-semibold">{t('footer.shop')}</p>
            <ul className="grid gap-1">
              <li>
                <Link
                  href="/quote"
                  className="inline-flex h-control-sm items-center text-accent-text underline"
                >
                  {t('footer.quote')}
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="inline-flex h-control-sm items-center text-accent-text underline"
                >
                  {t('header.all')}
                </Link>
              </li>
              {top.map((category) => (
                <li key={category.code}>
                  <Link
                    href={`/c/${categorySlug(category.code)}`}
                    className="inline-flex h-control-sm items-center text-accent-text underline"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-fg-muted sm:col-span-2">{t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
