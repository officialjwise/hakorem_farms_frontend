import type { Metadata } from 'next';
import { LoadFailed } from '../../../components/LoadFailed';
import { ReceiptNotFound, ReceiptView } from '../../../components/receipt/ReceiptView';
import { getT } from '../../../i18n/server';
import { getShopProfile, load } from '../../../lib/api';
import { isReceiptToken } from '../../../lib/receiptToken';

interface Props {
  params: Promise<{ token: string }>;
}

/** Rendered for each request and never kept by a shared cache: the answer is one customer's receipt. */
export const dynamic = 'force-dynamic';

/**
 * A receipt's private link: never indexed, never followed, and the link is not sent on as a referrer to any
 * page it opens (next.config.ts sends the same as headers).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('storefront');
  return {
    title: t('meta.receiptTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/**
 * The digital receipt a customer opens from the link the till printed or showed (CR-033, ADR 0045). The
 * till made the token; the link reads once the sale has synced. The token is the only thing this page
 * sends, and only when it has the shape the till makes (base64url, 22 to 86 characters): anything else is
 * answered as the server answers every dead link, 404, without a request. It is never logged here. A
 * server read, so the receipt shows on a slow phone with no script. A public page: there is no
 * permission-denied state beyond the one 404 answer.
 */
export default async function ReceiptByLinkPage({ params }: Props) {
  const { token } = await params;
  const [t, receipt] = await Promise.all([
    getT('storefront'),
    isReceiptToken(token) ? load('getPublicReceipt', { path: { token } }) : null,
  ]);
  if (receipt === null || (!receipt.ok && receipt.error.status === 404)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ReceiptNotFound profile={await getShopProfile()} t={t} />
      </div>
    );
  }
  if (!receipt.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LoadFailed
          error={receipt.error}
          title={t('receipt.errorTitle')}
          retryHref={`/r/${encodeURIComponent(token)}`}
          t={t}
        />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <ReceiptView receipt={receipt.data} t={t} />
    </div>
  );
}
