import type { Metadata } from 'next';
import { QuoteRequestForm } from '../../components/quote/QuoteRequestForm';
import { getT, getWords } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return {
    title: t('meta.quoteRequestTitle'),
    description: t('meta.quoteRequestDescription'),
    alternates: { canonical: '/quote' },
  };
}

/**
 * Ask for a quote (FR-QUO-001): wholesale buyers, bakeries, kitchens, chop bars and shops buying crates in
 * bulk, and anyone buying live animals. The words arrive with the page; the form is the one client island,
 * and it brings the data layer with it (ADR 0041).
 */
export default async function QuoteRequestPage() {
  const [t, words] = await Promise.all([
    getT('storefront'),
    getWords('quoteRequest', 'refusals', 'cart'),
  ]);
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-4 py-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold text-balance">{t('quoteRequest.title')}</h1>
        <p id="request-intro" className="max-w-prose text-fg-muted">
          {t('quoteRequest.intro')}
        </p>
      </div>
      <QuoteRequestForm words={words} />
    </div>
  );
}
