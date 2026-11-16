import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ApiError, components } from '@hakorem/api-client';
import { Button, EmptyState } from '@hakorem/ui';
import type { ShopT } from '../lib/present';
import { AVAILABILITIES, SORTS, type Sort } from '../lib/shop';
import { LoadFailed } from './LoadFailed';
import { ProductGrid } from './ProductGrid';

type CataloguePage = components['schemas']['CataloguePage'];
type Availability = (typeof AVAILABILITIES)[number];

/** A listing's state in its address: every filter is a link, so it works with no script at all. */
export interface ListingParams {
  q?: string;
  availability?: Availability;
  sort?: Sort;
  cursor?: string;
}

export function listingHref(
  base: string,
  params: ListingParams,
  change: ListingParams = {},
): string {
  const next = { ...params, cursor: undefined, ...change };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== '' && !(key === 'sort' && value === 'RELEVANCE')) {
      query.set(key, value);
    }
  }
  const text = query.toString();
  return text === '' ? base : `${base}?${text}`;
}

const chip =
  'inline-flex h-control-md items-center rounded-full border px-3 text-control-md outline-focus outline-offset-2 focus-visible:outline-2';
const off = `${chip} border-border-strong bg-surface text-fg hover-enabled:bg-surface-hover`;
const on = `${chip} edge-accent border-accent bg-accent-subtle font-semibold text-accent-subtle-fg`;

/** One row of filter links, the chosen one marked in words (aria-current) as well as in its fill. */
function ChoiceRow({
  label,
  choices,
}: {
  label: string;
  choices: { href: string; label: string; current: boolean }[];
}) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-semibold text-fg-muted">{label}</p>
      {/* One scrolling row each on a phone, so the products start near the top; wrapped from 640 px. */}
      <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {choices.map((choice) => (
          <li key={choice.href} className="shrink-0">
            <Link
              href={choice.href}
              aria-current={choice.current ? 'true' : undefined}
              className={choice.current ? on : off}
              scroll={false}
            >
              {choice.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The availability and sort filters, as links over the same address. */
export function ListingFilters({
  base,
  params,
  t,
}: {
  base: string;
  params: ListingParams;
  t: ShopT;
}) {
  return (
    <section
      aria-label={t('listing.filters')}
      className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2"
    >
      <ChoiceRow
        label={t('listing.availability')}
        choices={[
          {
            href: listingHref(base, params, { availability: undefined }),
            label: t('listing.anyAvailability'),
            current: params.availability === undefined,
          },
          ...AVAILABILITIES.filter((a) => a !== 'OUT_OF_STOCK').map((availability) => ({
            href: listingHref(base, params, { availability }),
            label: t(`availability.${availability}`),
            current: params.availability === availability,
          })),
        ]}
      />
      <ChoiceRow
        label={t('listing.sort')}
        choices={SORTS.map((sort) => ({
          href: listingHref(base, params, { sort }),
          label: t(`listing.sorts.${sort}`),
          current: (params.sort ?? 'RELEVANCE') === sort,
        }))}
      />
    </section>
  );
}

/**
 * A listing's products in their four states: the cards, the empty state with a way out, and the error
 * with its reference and a retry. Loading is the route's `loading.tsx`. A public listing has nothing to
 * deny. Paging is by the API's cursor, forward, with a way back to the first products.
 */
export function ListingResults({
  page,
  base,
  params,
  label,
  emptyTitle,
  emptyBody,
  t,
}: {
  page: { ok: true; data: CataloguePage } | { ok: false; error: ApiError };
  base: string;
  params: ListingParams;
  label: string;
  emptyTitle: string;
  emptyBody: string;
  t: ShopT;
}) {
  if (!page.ok) {
    return (
      <LoadFailed
        error={page.error}
        title={t('listing.error.title')}
        retryHref={listingHref(base, params, { cursor: params.cursor })}
        t={t}
      />
    );
  }
  const filtered =
    params.availability !== undefined || (params.sort ?? 'RELEVANCE') !== 'RELEVANCE';
  if (page.data.data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyBody}
        action={
          filtered ? (
            <Button asChild variant="secondary">
              <Link href={listingHref(base, { q: params.q })}>{t('listing.empty.action')}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  const next = page.data.page.hasMore ? page.data.page.nextCursor : null;
  return (
    <div className="grid gap-6">
      <ProductGrid items={page.data.data} t={t} label={label} />
      {next === null && params.cursor === undefined ? null : (
        <nav aria-label={t('listing.paging')} className="flex flex-wrap justify-center gap-3">
          {params.cursor === undefined ? null : (
            <Button asChild variant="secondary">
              <Link href={listingHref(base, params)}>
                <ArrowLeft aria-hidden="true" />
                {t('listing.firstPage')}
              </Link>
            </Button>
          )}
          {next === null ? null : (
            <Button asChild>
              <Link href={listingHref(base, params, { cursor: next })}>
                {t('listing.more')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
