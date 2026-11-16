import { HandCoins, PackageCheck, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IconChip } from '@hakorem/ui';
import { LoadFailed } from '../components/LoadFailed';
import { ProductGrid } from '../components/ProductGrid';
import { getT } from '../i18n/server';
import { getShopCategories, load } from '../lib/api';
import { Hero } from '../marketing/Hero';
import { categoryIcon, categorySlug, PAGE_SIZE } from '../lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return { title: { absolute: t('meta.title') }, alternates: { canonical: '/' } };
}

/**
 * The home page: what the farm sells and how to start, the categories with their counts, what is in the
 * shop now, and how weighed items are charged. Two reads, in parallel, on the server; the page ships no
 * script of its own.
 */
export default async function HomePage() {
  const [t, categories, products] = await Promise.all([
    getT('storefront'),
    getShopCategories(),
    load('listCatalogue', { query: { limit: PAGE_SIZE - 4 } }),
  ]);
  const top = categories.ok ? categories.data.data.filter((c) => c.parentCode === null) : [];
  const steps = [
    { icon: PackageCheck, title: t('home.how.oneTitle'), body: t('home.how.oneBody') },
    { icon: Scale, title: t('home.how.twoTitle'), body: t('home.how.twoBody') },
    { icon: HandCoins, title: t('home.how.threeTitle'), body: t('home.how.threeBody') },
  ];
  return (
    <>
      <Hero t={t} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8">
        <section aria-labelledby="browse-title" className="grid gap-4">
          <h2 id="browse-title" className="text-2xl font-bold">
            {t('home.browse')}
          </h2>
          {categories.ok ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {top.map((category) => {
                const Icon = categoryIcon(category);
                return (
                  <li key={category.code}>
                    <Link
                      href={`/c/${categorySlug(category.code)}`}
                      className="flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm outline-focus outline-offset-2 hover-enabled:bg-surface-hover focus-visible:outline-2"
                    >
                      <IconChip icon={Icon} tone="sand" size="lg" />
                      <span className="grid min-w-0">
                        <span className="font-semibold text-balance">{category.name}</span>
                        <span className="text-sm text-fg-muted">
                          {t('home.productCount', { count: category.productCount })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <LoadFailed
              error={categories.error}
              title={t('home.categoriesError')}
              retryHref="/"
              t={t}
            />
          )}
        </section>

        <section aria-labelledby="fresh-title" className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="fresh-title" className="text-2xl font-bold">
              {t('home.fresh')}
            </h2>
            <Link href="/search" className="text-accent-text underline underline-offset-4">
              {t('home.seeAll')}
            </Link>
          </div>
          {products.ok ? (
            <ProductGrid items={products.data.data} t={t} label={t('home.fresh')} />
          ) : (
            <LoadFailed
              error={products.error}
              title={t('listing.error.title')}
              retryHref="/"
              t={t}
            />
          )}
        </section>

        <section
          aria-labelledby="how-title"
          className="grid gap-4 rounded-2xl border-2 border-accent bg-accent-subtle p-5"
        >
          <h2 id="how-title" className="text-2xl font-bold text-accent-subtle-fg">
            {t('home.how.title')}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <IconChip icon={icon} tone="accent" size="md" />
                <span className="grid gap-1">
                  <span className="font-semibold">{title}</span>
                  <span className="text-fg-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
