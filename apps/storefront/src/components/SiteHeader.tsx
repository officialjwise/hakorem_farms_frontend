import { Search, Sprout } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@hakorem/ui';
import { getT, getWords } from '../i18n/server';
import { getShopCategories } from '../lib/api';
import { categorySlug } from '../lib/shop';
import { CartButton } from './cart/CartButton';
import { SEARCH_INPUT_CLASSES } from './plainClasses';

/**
 * The public header (ADR 0040): a deep pine band, rendered as a dark island like the console's sidebar,
 * with the wordmark, the basket and the top-level categories; then the search on the sand page. A server
 * component: the links and the search are plain HTML that work before any script, which is what a page
 * on 3G needs. Only the basket is a client leaf. If the categories cannot be read, the band still offers
 * the whole shop.
 */
export async function SiteHeader({ query = '' }: { query?: string }) {
  const [t, categories, words] = await Promise.all([
    getT('storefront'),
    getShopCategories(),
    getWords('cart', 'price', 'refusals'),
  ]);
  const top = categories.ok ? categories.data.data.filter((c) => c.parentCode === null) : [];
  const navLink =
    'inline-flex h-control-md shrink-0 items-center rounded-full px-3 text-control-md font-medium text-fg underline-offset-4 outline-focus hover-enabled:bg-surface-hover hover:underline focus-visible:outline-2';
  return (
    <header>
      <div data-theme="dark" className="bg-panel text-fg">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 pb-2">
          <Link
            href="/"
            aria-label={t('header.home')}
            className="flex min-w-0 items-center gap-2 rounded-md outline-focus outline-offset-2 focus-visible:outline-2"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-subtle">
              <Sprout aria-hidden="true" className="size-icon-md stroke-accent" />
            </span>
            <span className="grid min-w-0">
              <span className="truncate text-lg leading-tight font-bold">{t('header.brand')}</span>
              <span className="hidden truncate text-sm text-fg-muted sm:block">
                {t('header.tagline')}
              </span>
            </span>
          </Link>
          <div className="ms-auto shrink-0">
            <CartButton words={words} />
          </div>
        </div>
        <nav aria-label={t('header.nav')} className="mx-auto max-w-6xl">
          <ul className="flex gap-1 overflow-x-auto px-2 pb-2">
            <li className="shrink-0">
              <Link href="/search" className={navLink}>
                {t('header.all')}
              </Link>
            </li>
            {top.map((category) => (
              <li key={category.code} className="shrink-0">
                <Link href={`/c/${categorySlug(category.code)}`} className={navLink}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-b border-border bg-shop-band">
        <form
          role="search"
          action="/search"
          method="get"
          className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3"
        >
          {/* The Search button beside it says what the field is for; the label names it for a screen reader. */}
          <label htmlFor="site-search" className="sr-only">
            {t('header.search.label')}
          </label>
          {/* A plain input in Input's look: Input is a client component, and the box needs no script. */}
          <input
            id="site-search"
            type="search"
            name="q"
            defaultValue={query}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('header.search.example')}
            className={SEARCH_INPUT_CLASSES}
          />
          {/* A plain submit in Button's styles: a server component passes no handler, and none is needed. */}
          <button type="submit" className={buttonVariants({ variant: 'primary' })}>
            <Search aria-hidden="true" />
            <span>{t('header.search.button')}</span>
          </button>
        </form>
      </div>
    </header>
  );
}
