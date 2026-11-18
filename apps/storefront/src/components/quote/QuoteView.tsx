import { FileDown, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  MoneyDisplay,
  QuantityDisplay,
  StatusBadge,
  formatDateTime,
  formatMoney,
  type StatusTone,
} from '@hakorem/ui';
import type { Loaded } from '../../lib/api';
import { phoneForDisplay, telHref, whatsAppHref } from '../../lib/phone';
import type { ShopT } from '../../lib/present';

type S = components['schemas'];
export type PublicQuote = S['PublicQuote'];
type Line = S['PublicQuoteLine'];

const TONE: Record<PublicQuote['status'], StatusTone> = {
  ISSUED: 'info',
  ACCEPTED: 'good',
  DECLINED: 'warning',
  EXPIRED: 'critical',
  SUPERSEDED: 'warning',
};

/** A weight is shown to three places, anything counted whole (CR-003); the API's string either way. */
function places(uom: string): 0 | 3 {
  return uom === 'KG' ? 3 : 0;
}

/** The unit after a quantity, one or many, in the shop's words; an unknown unit shows its code. */
function unitWords(t: ShopT, line: Pick<Line, 'quantity' | 'uom'>): string {
  const one = /^1(\.0+)?$/.test(line.quantity);
  const key = one ? `quote.uomOne.${line.uom}` : `quote.uomOther.${line.uom}`;
  return t(key as 'quote.uomOne.CRATE', { defaultValue: line.uom });
}

/** "GH₵55.00 a crate": the line's price and what it multiplies, both the API's. */
function priceWords(t: ShopT, line: Line): string {
  const per =
    line.priceBasis === 'PER_UNIT'
      ? t(`price.uom.${line.uom}` as 'price.uom.UNIT', { defaultValue: line.uom })
      : t(`quote.perBasis.${line.priceBasis}`);
  return t('quote.per', { price: formatMoney(line.unitPricePesewas), per });
}

/**
 * The quote as the API answers it for its link: the lines, the delivery fee and the totals, every figure the
 * API's and nothing added here. A server component: the page needs no script to be read.
 */
export function QuoteView({ quote, t }: { quote: PublicQuote; t: ShopT }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-balance">
            {t('quote.title', { quoteNo: quote.quoteNo })}
          </h1>
          <StatusBadge tone={TONE[quote.status]} label={t(`quote.status.${quote.status}`)} />
        </div>
        <p className="text-fg-muted">
          {t('quote.version', { versionNo: quote.versionNo })} ·{' '}
          {t('quote.forCustomer', { name: quote.customerName })}
        </p>
        <p className="font-semibold">
          {t('quote.validUntil', { when: formatDateTime(quote.validUntil) })}
        </p>
      </div>

      <section aria-labelledby="quote-lines" className="grid gap-3">
        <h2 id="quote-lines" className="text-xl font-bold">
          {t('quote.linesLabel')}
        </h2>
        <ul className="grid gap-3">
          {quote.lines.map((line, index) => (
            <li
              key={`${line.description}-${index}`}
              className="grid gap-1 rounded-lg border border-border bg-surface p-4"
            >
              <p className="font-semibold">{line.description}</p>
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
                <dt className="text-fg-muted">{t('quote.columns.quantity')}</dt>
                <dd className="text-end">
                  <QuantityDisplay
                    quantity={line.quantity}
                    unit={unitWords(t, line)}
                    places={places(line.uom)}
                  />
                </dd>
                <dt className="text-fg-muted">{t('quote.columns.price')}</dt>
                <dd className="text-end tabular-nums">{priceWords(t, line)}</dd>
                <dt className="text-fg-muted">{t('quote.columns.lineTotal')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={line.lineNetPesewas} strong />
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="quote-totals" className="grid gap-3">
        <h2 id="quote-totals" className="text-xl font-bold">
          {t('quote.totalsLabel')}
        </h2>
        <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4">
          <dt>{t('quote.deliveryFee')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={quote.deliveryFeePesewas} />
          </dd>
          <dt>{t('quote.net')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={quote.netPesewas} />
          </dd>
          <dt>{t('quote.tax')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={quote.taxPesewas} />
          </dd>
          <dt className="text-lg font-bold">{t('quote.gross')}</dt>
          <dd className="text-end text-lg">
            <MoneyDisplay pesewas={quote.grossPesewas} strong />
          </dd>
        </dl>
        {quote.terms === null && quote.deliveryEstimate === null ? null : (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {quote.terms === null ? null : (
              <>
                <dt className="font-semibold">{t('quote.terms')}</dt>
                <dd>{quote.terms}</dd>
              </>
            )}
            {quote.deliveryEstimate === null ? null : (
              <>
                <dt className="font-semibold">{t('quote.deliveryEstimate')}</dt>
                <dd>{quote.deliveryEstimate}</dd>
              </>
            )}
          </dl>
        )}
        {quote.documentUrl === null ? null : (
          <p>
            <a
              href={quote.documentUrl}
              rel="noopener noreferrer"
              className="inline-flex min-h-control items-center gap-2 text-accent-text underline"
            >
              <FileDown aria-hidden="true" className="size-icon-sm" />
              {t('quote.document')}
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

/** How to ask again: a new request, and the shop's phone and WhatsApp when the API gives them. */
function AskAgain({ profile, t }: { profile: Loaded<S['ShopProfile']>; t: ShopT }) {
  const shop = profile.ok ? profile.data : null;
  return (
    <div className="grid gap-3">
      <div>
        <Button asChild size="lg">
          <Link href="/quote">{t('quote.askAgain')}</Link>
        </Button>
      </div>
      {shop === null ? null : (
        <ul aria-label={t('quote.contact')} className="flex flex-wrap gap-3">
          <li>
            <Button asChild variant="secondary">
              <a href={telHref(shop.phone)}>
                <Phone aria-hidden="true" />
                {t('quote.call', { phone: phoneForDisplay(shop.phone) })}
              </a>
            </Button>
          </li>
          {shop.whatsapp === null ? null : (
            <li>
              <Button asChild variant="secondary">
                <a
                  href={whatsAppHref(shop.whatsapp)}
                  rel="noopener noreferrer"
                  target="_blank"
                  aria-label={t('quote.whatsappLabel', { phone: phoneForDisplay(shop.whatsapp) })}
                >
                  <MessageCircle aria-hidden="true" />
                  {t('quote.whatsapp', { phone: phoneForDisplay(shop.whatsapp) })}
                </a>
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * What the quote's state means for the customer, in words, for every state but ISSUED (which offers the
 * answer instead). An expired or replaced quote cannot be accepted, and says how to get a current one.
 */
export function QuoteState({
  quote,
  profile,
  t,
}: {
  quote: PublicQuote;
  profile: Loaded<S['ShopProfile']>;
  t: ShopT;
}) {
  switch (quote.status) {
    case 'ISSUED':
      return null;
    case 'ACCEPTED':
      return (
        <Alert severity="good" title={t('quote.acceptedTitle')}>
          {t('quote.acceptedBody')}
        </Alert>
      );
    case 'DECLINED':
      return (
        <div className="grid gap-3">
          <Alert severity="info" title={t('quote.declinedTitle')}>
            {t('quote.declinedBody')}
          </Alert>
          <AskAgain profile={profile} t={t} />
        </div>
      );
    case 'EXPIRED':
      return (
        <div className="grid gap-3">
          <Alert severity="warning" title={t('quote.expiredTitle')}>
            {t('quote.expiredBody', { when: formatDateTime(quote.validUntil) })}
          </Alert>
          <AskAgain profile={profile} t={t} />
        </div>
      );
    case 'SUPERSEDED':
      return (
        <div className="grid gap-3">
          <Alert severity="warning" title={t('quote.supersededTitle')}>
            {t('quote.supersededBody')}
          </Alert>
          <AskAgain profile={profile} t={t} />
        </div>
      );
  }
}
