import type { Metadata } from 'next';
import { ListingFilters, ListingResults, type ListingParams } from '../../components/Listing';
import { getT } from '../../i18n/server';
import { load } from '../../lib/api';
import { AVAILABILITIES, oneOf, PAGE_SIZE, SORTS } from '../../lib/shop';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [query, t] = await Promise.all([searchParams, getT('storefront')]);
  const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
  return {
    title: q === '' ? t('listing.allTitle') : t('search.resultsFor', { q }),
    alternates: { canonical: '/search' },
    // A search result is not a page to index; the categories and products are.
    robots: q === '' ? undefined : { index: false, follow: true },
  };
}

/**
 * Search, and the whole shop when nothing is searched (FR-SHP-001): one read of the catalogue with `q`,
 * the same filters as a category, and the API's cursor for more.
 */
export default async function SearchPage({ searchParams }: Props) {
  const [query, t] = await Promise.all([searchParams, getT('storefront')]);
  const q = typeof query['q'] === 'string' ? query['q'].trim().slice(0, 100) : '';
  const listing: ListingParams = {
    q: q === '' ? undefined : q,
    availability: oneOf(AVAILABILITIES, query['availability']),
    sort: oneOf(SORTS, query['sort']),
    cursor: typeof query['cursor'] === 'string' ? query['cursor'] : undefined,
  };
  const page = await load('listCatalogue', {
    query: {
      limit: PAGE_SIZE,
      ...(listing.q ? { q: listing.q } : {}),
      ...(listing.availability ? { availability: listing.availability } : {}),
      ...(listing.sort ? { sort: listing.sort } : {}),
      ...(listing.cursor ? { cursor: listing.cursor } : {}),
    },
  });
  const title = q === '' ? t('listing.allTitle') : t('search.resultsFor', { q });
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <h1 className="text-3xl font-bold text-balance">{title}</h1>
      <ListingFilters base="/search" params={listing} t={t} />
      <ListingResults
        page={page}
        base="/search"
        params={listing}
        label={title}
        emptyTitle={q === '' ? t('listing.empty.title') : t('search.empty.title', { q })}
        emptyBody={q === '' ? t('listing.empty.body') : t('search.empty.body')}
        t={t}
      />
    </div>
  );
}
