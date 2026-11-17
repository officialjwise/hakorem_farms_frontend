import type { Metadata } from 'next';
import Link from 'next/link';
import { LoadFailed } from '../../../components/LoadFailed';
import { QuoteAnswer } from '../../../components/quote/QuoteAnswer';
import { QuoteState, QuoteView } from '../../../components/quote/QuoteView';
import { getT, getWords } from '../../../i18n/server';
import { getShopProfile, load } from '../../../lib/api';

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * A quote's private link: never indexed, never followed, and the link is not sent on as a referrer to any
 * page it opens (next.config.ts sends the same as headers).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return {
    title: t('meta.quoteTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/**
 * The quote a customer opens from the link the farm sent (FR-QUO-003). The link carries the token the
 * server made for this version, and that token is the only thing this page sends: never the quote's number
 * or id, and it is never logged here. A server read, so the quote shows on a slow phone before any script;
 * the answer is the one island. Every state says in words what it means; a wrong token says only that the
 * link is not valid (CR-047).
 */
export default async function QuoteByLinkPage({ params }: Props) {
  const { token } = await params;
  const [t, quote, profile, words] = await Promise.all([
    getT('storefront'),
    load('viewQuoteByLink', { path: { token } }),
    getShopProfile(),
    getWords('quote', 'quoteRequest', 'refusals', 'cart'),
  ]);
  if (!quote.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        {quote.error.status === 404 || quote.error.status === 400 ? (
          <div className="grid gap-3">
            <h1 className="text-3xl font-bold text-balance">{t('quote.notFoundTitle')}</h1>
            <p className="max-w-prose text-fg-muted">{t('quote.notFoundBody')}</p>
            <p>
              <Link href="/quote" className="text-accent-text underline">
                {t('quote.askAgain')}
              </Link>
            </p>
          </div>
        ) : (
          <LoadFailed
            error={quote.error}
            title={t('quote.errorTitle')}
            retryHref={`/q/${encodeURIComponent(token)}`}
            t={t}
          />
        )}
      </div>
    );
  }
  const q = quote.data;
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 px-4 py-6">
      <QuoteState quote={q} profile={profile} t={t} />
      <QuoteView quote={q} t={t} />
      <QuoteAnswer
        token={token}
        quote={{
          quoteNo: q.quoteNo,
          versionNo: q.versionNo,
          status: q.status,
          grossPesewas: q.grossPesewas,
        }}
        words={words}
      />
    </div>
  );
}
