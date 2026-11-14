import Link from 'next/link';
import { CATEGORIES } from '../lib/catalogue';
import { getT } from '../i18n/server';
import { CartDrawer } from './CartDrawer';

/**
 * The public header. A server component: the category links are plain anchors that work without
 * JavaScript, which is what a slow 3G page needs. Only the cart drawer is a client component.
 */
export async function SiteHeader() {
  const t = await getT('storefront');
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          aria-label={t('header.home')}
          className="text-lg font-semibold text-fg outline-focus outline-offset-2 focus-visible:outline-2"
        >
          {t('header.brand')}
        </Link>
        <div className="ms-auto">
          <CartDrawer
            count={0}
            labels={{
              open: t('header.cartCount', { count: 0 }),
              title: t('cart.title'),
              close: t('cart.close'),
              emptyTitle: t('cart.emptyTitle'),
              emptyBody: t('cart.emptyBody'),
              checkout: t('cart.checkout'),
              continueShopping: t('cart.continue'),
            }}
          />
        </div>
      </div>
      <nav aria-label={t('header.nav')} className="mx-auto max-w-6xl px-4 pb-2">
        <ul className="flex flex-wrap gap-x-1 gap-y-1">
          {CATEGORIES.map(({ slug, key }) => (
            <li key={slug}>
              <Link
                href={`/c/${slug}`}
                className="inline-flex min-h-control-md items-center rounded-md px-3 text-control-md text-accent-text underline-offset-4 outline-focus hover:underline focus-visible:outline-2"
              >
                {t(`nav.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
