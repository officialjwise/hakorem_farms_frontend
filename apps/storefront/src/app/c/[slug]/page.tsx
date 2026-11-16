import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingFilters, ListingResults, type ListingParams } from '../../../components/Listing';
import { LoadFailed } from '../../../components/LoadFailed';
import { getT } from '../../../i18n/server';
import { getShopCategories, load } from '../../../lib/api';
import {
  AVAILABILITIES,
  categoryBySlug,
  categorySlug,
  oneOf,
  PAGE_SIZE,
  SORTS,
} from '../../../lib/shop';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, categories, t] = await Promise.all([
    params,
    getShopCategories(),
    getT('storefront'),
  ]);
  const category = categories.ok ? categoryBySlug(categories.data.data, slug) : undefined;
  if (category === undefined) return {};
  const path = `/c/${categorySlug(category.code)}`;
  return {
    title: category.name,
    description: t('meta.categoryDescription', { category: category.name }),
    alternates: { canonical: path },
    openGraph: { title: category.name, url: path },
  };
}

/**
 * A category's products (FR-SHP-001): one read of the catalogue for the category, with the availability
 * and sort filters as links and the API's cursor for more. Loading is `loading.tsx`; an unknown category
 * is the layout's 404.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, query, categories, t] = await Promise.all([
    params,
    searchParams,
    getShopCategories(),
    getT('storefront'),
  ]);
  const base = `/c/${slug}`;
  if (!categories.ok) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <LoadFailed
          error={categories.error}
          title={t('listing.error.title')}
          retryHref={base}
          t={t}
        />
      </div>
    );
  }
  const category = categoryBySlug(categories.data.data, slug);
  if (category === undefined) return null;
  const listing: ListingParams = {
    availability: oneOf(AVAILABILITIES, query['availability']),
    sort: oneOf(SORTS, query['sort']),
    cursor: typeof query['cursor'] === 'string' ? query['cursor'] : undefined,
  };
  const children = categories.data.data.filter((c) => c.parentCode === category.code);
  const page = await load('listCatalogue', {
    query: {
      category: category.code,
      limit: PAGE_SIZE,
      ...(listing.availability ? { availability: listing.availability } : {}),
      ...(listing.sort ? { sort: listing.sort } : {}),
      ...(listing.cursor ? { cursor: listing.cursor } : {}),
    },
  });
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <nav aria-label={t('product.breadcrumb')} className="text-sm">
        <ol className="flex flex-wrap gap-1 text-fg-muted">
          <li>
            <Link href="/" className="text-accent-text underline underline-offset-4">
              {t('product.shop')}
            </Link>
            <span aria-hidden="true"> / </span>
          </li>
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold text-balance">{category.name}</h1>
        <p className="text-fg-muted">{t('listing.count', { count: category.productCount })}</p>
      </div>
      {children.length === 0 ? null : (
        <nav aria-label={t('listing.subcategories')}>
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => (
              <li key={child.code}>
                <Link
                  href={`/c/${categorySlug(child.code)}`}
                  className="inline-flex h-control-md items-center rounded-full border border-border-strong bg-surface px-3 text-control-md text-fg outline-focus outline-offset-2 hover-enabled:bg-surface-hover focus-visible:outline-2"
                >
                  {child.name} ({child.productCount})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ListingFilters base={base} params={listing} t={t} />
      <ListingResults
        page={page}
        base={base}
        params={listing}
        label={category.name}
        emptyTitle={t('listing.empty.title')}
        emptyBody={t('listing.empty.body')}
        t={t}
      />
    </div>
  );
}
