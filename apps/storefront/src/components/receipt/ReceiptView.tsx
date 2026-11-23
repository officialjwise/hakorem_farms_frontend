import { MessageCircle, Phone } from 'lucide-react';
import { Fragment } from 'react';
import type { components } from '@hakorem/api-client';
import { Button, MoneyDisplay, QuantityDisplay, WeightDisplay, formatDateTime } from '@hakorem/ui';
import type { Loaded } from '../../lib/api';
import { phoneForDisplay, telHref, whatsAppHref } from '../../lib/phone';
import type { ShopT } from '../../lib/present';

type S = components['schemas'];
export type PublicReceipt = S['PublicReceipt'];
type Line = S['PublicReceiptLine'];

/** A weight is shown to three places, anything counted whole (CR-003); the API's string either way. */
function places(uom: string): 0 | 3 {
  return uom === 'KG' ? 3 : 0;
}

/** The unit after a quantity, one or many, in the shop's words; an unknown unit shows its code. */
function unitWords(t: ShopT, line: Pick<Line, 'quantity' | 'saleUom'>): string {
  const one = /^1(\.0+)?$/.test(line.quantity);
  const key = one ? `receipt.uomOne.${line.saleUom}` : `receipt.uomOther.${line.saleUom}`;
  return t(key as 'receipt.uomOne.CRATE', { defaultValue: line.saleUom });
}

/** An instant in Accra time (ADR 0027), the exact instant kept in the markup. */
function When({ instant, t }: { instant: string; t: ShopT }) {
  return <time dateTime={instant}>{t('receipt.when', { when: formatDateTime(instant) })}</time>;
}

/**
 * A counter sale's digital receipt as the API answers it for its link (CR-033, ADR 0045): the business, the
 * official receipt number beside the sale reference the till printed, the lines as charged, the total, the
 * tenders as the till took them and the change it gave. Every figure is the API's; nothing is added here.
 * A server component: the receipt needs no script to be read or printed.
 */
export function ReceiptView({ receipt, t }: { receipt: PublicReceipt; t: ShopT }) {
  const { business } = receipt;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="text-3xl font-bold text-balance">{t('receipt.title')}</h1>
        {business === null ? null : (
          <section aria-labelledby="receipt-business" className="grid gap-1">
            <h2 id="receipt-business" className="sr-only">
              {t('receipt.business')}
            </h2>
            <address className="grid gap-1 not-italic">
              <span className="text-lg font-semibold">{business.name}</span>
              <span>{business.address}</span>
              <span>
                <a
                  href={telHref(business.phone)}
                  className="inline-flex min-h-control items-center text-accent-text underline"
                >
                  {t('receipt.call', { phone: phoneForDisplay(business.phone) })}
                </a>
              </span>
            </address>
          </section>
        )}
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-fg-muted">{t('receipt.receiptNo')}</dt>
          <dd className="font-semibold break-words">{receipt.receiptNo}</dd>
          <dt className="text-fg-muted">{t('receipt.saleReference')}</dt>
          <dd className="font-semibold break-words">{receipt.saleReference}</dd>
          <dt className="text-fg-muted">{t('receipt.soldAt')}</dt>
          <dd>
            <When instant={receipt.occurredAt} t={t} />
          </dd>
        </dl>
      </div>

      <section aria-labelledby="receipt-lines" className="grid gap-3">
        <h2 id="receipt-lines" className="text-xl font-bold">
          {t('receipt.linesLabel')}
        </h2>
        <ul className="grid gap-3">
          {receipt.lines.map((line, index) => (
            <li
              key={`${line.name}-${index}`}
              className="grid gap-1 rounded-lg border border-border bg-surface p-4 print:break-inside-avoid"
            >
              <p className="font-semibold">{line.name}</p>
              {line.stockUnitIdentifier === null ? null : (
                <p className="text-fg-muted">
                  {t('receipt.stockUnit', { id: line.stockUnitIdentifier })}
                </p>
              )}
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
                <dt className="text-fg-muted">{t('receipt.columns.quantity')}</dt>
                <dd className="text-end">
                  <QuantityDisplay
                    quantity={line.quantity}
                    unit={unitWords(t, line)}
                    places={places(line.saleUom)}
                  />
                </dd>
                {line.weightKg === null ? null : (
                  <>
                    <dt className="text-fg-muted">{t('receipt.columns.weight')}</dt>
                    <dd className="text-end">
                      <WeightDisplay kilograms={line.weightKg} />
                    </dd>
                  </>
                )}
                <dt className="text-fg-muted">{t('receipt.columns.unitPrice')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={line.unitPricePesewas} />
                </dd>
                <dt className="text-fg-muted">{t('receipt.columns.amount')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={line.amountPesewas} strong />
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="receipt-payment" className="grid gap-3">
        <h2 id="receipt-payment" className="text-xl font-bold">
          {t('receipt.paymentLabel')}
        </h2>
        <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 print:break-inside-avoid">
          <dt className="text-lg font-bold">{t('receipt.total')}</dt>
          <dd className="text-end text-lg">
            <MoneyDisplay pesewas={receipt.totalPesewas} strong />
          </dd>
          {receipt.tenders.map((tender, index) => (
            <Fragment key={`${tender.name}-${index}`}>
              <dt>{tender.name}</dt>
              <dd className="text-end">
                <MoneyDisplay pesewas={tender.amountPesewas} />
              </dd>
              {tender.unverified ? (
                <dd className="col-span-2 ps-4 text-fg-muted">{t('receipt.unverified')}</dd>
              ) : null}
              {tender.tenderedPesewas === null ? null : (
                <>
                  <dt className="ps-4 text-fg-muted">{t('receipt.tendered')}</dt>
                  <dd className="text-end">
                    <MoneyDisplay pesewas={tender.tenderedPesewas} />
                  </dd>
                </>
              )}
            </Fragment>
          ))}
          <dt>{t('receipt.change')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={receipt.changePesewas} />
          </dd>
        </dl>
        <p className="text-fg-muted">
          {t('receipt.validUntil', { when: formatDateTime(receipt.validUntil) })}
        </p>
      </section>
    </div>
  );
}

/**
 * Every link that reads nothing (CR-033: never sent, mistyped, guessed, expired, revoked, another sale's,
 * or one whose sale has not reached the farm yet), in one answer: what may be wrong, that a sale just made
 * may not have synced, and how to reach the shop. It shows nothing of any sale and does not repeat the link.
 */
export function ReceiptNotFound({ profile, t }: { profile: Loaded<S['ShopProfile']>; t: ShopT }) {
  const shop = profile.ok ? profile.data : null;
  return (
    <div className="grid gap-3">
      <h1 className="text-3xl font-bold text-balance">{t('receipt.notFoundTitle')}</h1>
      <p className="max-w-prose">{t('receipt.notFoundMistyped')}</p>
      <p className="max-w-prose">{t('receipt.notFoundNotYet')}</p>
      <p className="max-w-prose text-fg-muted">
        {shop === null ? t('receipt.contactWithoutNumber') : t('receipt.contactWithNumber')}
      </p>
      {shop === null ? null : (
        <ul aria-label={t('receipt.contact')} className="flex flex-wrap gap-3 print:hidden">
          <li>
            <Button asChild>
              <a href={telHref(shop.phone)}>
                <Phone aria-hidden="true" />
                {t('receipt.call', { phone: phoneForDisplay(shop.phone) })}
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
                  aria-label={t('receipt.whatsappLabel', { phone: phoneForDisplay(shop.whatsapp) })}
                >
                  <MessageCircle aria-hidden="true" />
                  {t('receipt.whatsapp', { phone: phoneForDisplay(shop.whatsapp) })}
                </a>
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
