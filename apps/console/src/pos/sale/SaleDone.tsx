import { ScanBarcode } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert, Button, MoneyDisplay } from '@hakorem/ui';
import type { SaleEntry } from '../offline/types';
import { EntryStatus, Receipt } from '../presentation';
import { LazyReceiptOut } from '../parts';

/**
 * The sale just completed: the change to hand over, where the sale is (queued on this till, or sent with its
 * official number), and how the customer gets the receipt: digitally, and on a printer where there is one
 * (ADR 0045). A sale the server refused, or took with an exception, says so here in words and stays on the
 * queue screen for a manager.
 */
export function SaleDone({ entry, onNext }: { entry: SaleEntry; onNext: () => void }) {
  const { t } = useTranslation('pos');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const officialNo = entry.serverResult?.receiptNo ?? null;
  const exceptions = entry.serverResult?.exceptions ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(20rem,26rem)]" data-slot="sale-done">
      <section aria-labelledby="done-title" className="grid content-start gap-4">
        <h2 id="done-title" ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t('done.title')}
        </h2>
        <p className="flex flex-wrap items-baseline gap-2 text-xl">
          <span>{t('done.change')}</span>
          <strong data-slot="done-change">
            <MoneyDisplay pesewas={entry.receipt.changePesewas} />
          </strong>
        </p>
        <div className="flex flex-wrap items-center gap-2" data-slot="done-status">
          <EntryStatus entry={entry} />
          <span>
            {officialNo !== null
              ? t('done.sent', { number: officialNo })
              : entry.localStatus === 'QUEUED' || entry.localStatus === 'SENDING'
                ? t('done.queued', { ref: entry.receipt.provisionalRef })
                : null}
          </span>
        </div>
        {entry.failure !== null ? (
          <Alert severity="critical" title={t('done.refused')}>
            {entry.failure.message}
          </Alert>
        ) : null}
        {exceptions.length > 0 ? (
          <Alert severity="warning" title={t('done.exceptions')}>
            <ul>
              {exceptions.map((exception) => (
                <li key={`${exception.kind}-${exception.summary}`}>{exception.summary}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onNext}>
            <ScanBarcode aria-hidden="true" />
            {t('done.next')}
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link to="/pos/queue">{t('done.queue')}</Link>
          </Button>
        </div>
        <LazyReceiptOut entry={entry} />
      </section>
      <Receipt receipt={entry.receipt} officialNo={officialNo} />
    </div>
  );
}
