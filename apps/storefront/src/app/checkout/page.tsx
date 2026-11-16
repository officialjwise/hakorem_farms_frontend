import type { Metadata } from 'next';
import { CheckoutFlow } from '../../components/checkout/CheckoutFlow';
import { getT, getWords } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return { title: t('meta.checkoutTitle'), robots: { index: false, follow: false } };
}

/**
 * The checkout route. The flow is a client component because the cart is the browser's: it is proved by
 * the guest cookie the API set, which this server never holds (contract 1.32.0).
 */
export default async function CheckoutPage() {
  const [t, words] = await Promise.all([
    getT('storefront'),
    getWords('checkout', 'cart', 'price', 'refusals'),
  ]);
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6">
      <h1 className="text-3xl font-bold">{t('checkout.title')}</h1>
      <CheckoutFlow words={words} />
    </div>
  );
}
