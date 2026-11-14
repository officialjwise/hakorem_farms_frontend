import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, EmptyState } from '@hakorem/ui';
import { getT } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return { title: t('meta.checkoutTitle'), robots: { index: false, follow: false } };
}

/** The checkout route skeleton. Checkout itself (address, delivery slot, payment) is F7. */
export default async function CheckoutPage() {
  const t = await getT('storefront');
  return (
    <section aria-labelledby="checkout-title" className="grid gap-4">
      <h1 id="checkout-title" className="text-3xl font-semibold">
        {t('checkout.title')}
      </h1>
      <p className="text-fg-muted">{t('checkout.body')}</p>
      <EmptyState
        title={t('checkout.empty.title')}
        description={t('checkout.empty.body')}
        action={
          <Button asChild variant="secondary">
            <Link href="/">{t('checkout.back')}</Link>
          </Button>
        }
      />
    </section>
  );
}
