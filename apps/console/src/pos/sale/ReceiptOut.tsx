import { Bluetooth, MessageSquareText, Printer as PrinterIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '@hakorem/ui';
import type { SaleEntry } from '../offline/types';
import { useTill } from '../offline/till';
import { getPrinter, usePrinter, type PrinterSupport } from '../printer/bluetooth';
import { encodeReceipt, type PrintWords } from '../printer/escpos';

/**
 * How the customer gets their receipt (ADR 0045): the digital receipt first, by a link that works on every
 * phone (2.24.0); then a 58 mm Bluetooth printer where this browser can drive one. Nothing here holds up
 * the sale or waits on the network: the sale is already complete when this shows.
 *
 * The receipt SMS (2.41.0, CR-033 point 3): the farm sends the link by SMS when a sale that names a phone
 * and whose token the server kept syncs. The sync's answer says nothing of the message (`receiptMessage`
 * was not added), so the till says when the SMS goes, never that it arrived, and that none goes for a sale
 * with no link or a refused one.
 */
export function ReceiptOut({ entry, copy = false }: { entry: SaleEntry; copy?: boolean }) {
  const { t } = useTranslation('pos');
  return (
    <section
      aria-labelledby={`receipt-out-${entry.id}`}
      className="grid gap-3"
      data-slot="receipt-out"
    >
      <h3 id={`receipt-out-${entry.id}`} className="text-lg font-semibold">
        {t('done.receiptHeading')}
      </h3>
      <DigitalReceipt entry={entry} />
      <PrintReceipt entry={entry} copy={copy} />
    </section>
  );
}

function DigitalReceipt({ entry }: { entry: SaleEntry }) {
  const { t } = useTranslation('pos');
  const phone = entry.receipt.customerPhone;
  const link = entry.receipt.link ?? null;
  const recorded = entry.serverResult !== null;
  const refused =
    entry.serverResult?.exceptions.some((e) => e.kind === 'RECEIPT_TOKEN_REFUSED') === true;
  return (
    <div className="grid gap-2 rounded-md border border-border p-3" data-slot="digital-receipt">
      <p className="flex items-center gap-2 font-semibold">
        <MessageSquareText aria-hidden="true" className="size-icon-md" />
        {t('digital.title')}
      </p>
      <p data-slot="sms-status">
        {phone === null
          ? t('digital.noPhone')
          : link === null || refused
            ? t('digital.smsNoLink', { phone })
            : recorded
              ? t('digital.smsSent', { phone })
              : t('digital.smsWaiting', { phone })}
      </p>
      {link !== null && refused ? (
        <Alert severity="warning" title={t('digital.linkRefused')}>
          {t('digital.linkRefusedBody')}
        </Alert>
      ) : link !== null ? (
        <div className="grid gap-1">
          <p className="font-semibold">{t('digital.link')}</p>
          <a href={link} className="break-all text-accent-text underline" data-slot="receipt-link">
            {link}
          </a>
          <p className="text-sm text-fg-muted" data-slot="receipt-link-state">
            {recorded ? t('digital.linkLive') : t('digital.linkBody')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">{t('digital.noLink')}</p>
      )}
    </div>
  );
}

function usePrintWords(entry: SaleEntry): PrintWords {
  const { t } = useTranslation('pos');
  return {
    business: t('receipt.business'),
    copy: t('receipt.printCopy'),
    register: t('receipt.register', {
      name: entry.receipt.registerName,
      code: entry.receipt.registerCode,
    }),
    cashier: t('receipt.cashier', { name: entry.receipt.cashierName }),
    buyer:
      entry.receipt.buyer != null
        ? t('receipt.buyer', { name: entry.receipt.buyer.name, tin: entry.receipt.buyer.tin })
        : null,
    saleReference: t('receipt.provisional'),
    receiptNo: t('receipt.official'),
    receiptNoFollows: t('receipt.officialFollows'),
    total: t('receipt.total'),
    change: t('receipt.change'),
    handed: (name) => t('receipt.handed', { name }),
    unverified: t('receipt.unverified'),
    reference: t('receipt.reference'),
    link: t('receipt.link'),
    thanks: t('receipt.thanks'),
  };
}

function PrintReceipt({ entry, copy }: { entry: SaleEntry; copy: boolean }) {
  const { t } = useTranslation('pos');
  const state = usePrinter();
  const { snapshot } = useTill();
  const words = usePrintWords(entry);
  const [support, setSupport] = useState<PrinterSupport | null>(null);
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    let live = true;
    void getPrinter()
      .support()
      .then((answer) => {
        if (live) setSupport(answer);
      });
    return () => {
      live = false;
    };
  }, []);

  const print = () => {
    setPrinted(false);
    void getPrinter()
      .print(
        encodeReceipt({
          receipt: entry.receipt,
          officialNo: entry.serverResult?.receiptNo ?? null,
          copy,
          link: entry.receipt.link ?? null,
          words,
          uoms: snapshot?.pack?.uoms ?? [],
        }),
      )
      .then(setPrinted);
  };
  const name = state.status === 'ready' || state.status === 'printing' ? state.name : '';

  return (
    <div className="grid gap-2 rounded-md border border-border p-3" data-slot="printer">
      <p className="flex items-center gap-2 font-semibold">
        <PrinterIcon aria-hidden="true" className="size-icon-md" />
        {t('printer.title')}
      </p>
      {support === null ? (
        <p role="status">{t('printer.checking')}</p>
      ) : support === 'unsupported' ? (
        <p data-slot="printer-unsupported">{t('printer.unsupported')}</p>
      ) : support === 'off' ? (
        <p>{t('printer.off')}</p>
      ) : (
        <>
          <p className="text-sm text-fg-muted">{t('printer.optional')}</p>
          <div className="flex flex-wrap gap-2">
            {state.status === 'ready' || state.status === 'printing' ? (
              <Button
                size="lg"
                loading={state.status === 'printing'}
                loadingLabel={t('printer.printing')}
                onClick={print}
              >
                <PrinterIcon aria-hidden="true" />
                {name === '' ? t('printer.printUnnamed') : t('printer.print', { name })}
              </Button>
            ) : state.status === 'failed' && state.reason === 'print' ? (
              <Button size="lg" onClick={print}>
                <PrinterIcon aria-hidden="true" />
                {t('printer.printUnnamed')}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                loading={state.status === 'connecting'}
                loadingLabel={t('printer.connecting')}
                onClick={() => void getPrinter().connect()}
              >
                <Bluetooth aria-hidden="true" />
                {t('printer.connect')}
              </Button>
            )}
          </div>
          {printed && state.status === 'ready' ? (
            <p role="status">{t('printer.printed', { name: state.name })}</p>
          ) : null}
          {state.status === 'failed' ? (
            state.reason === 'cancelled' ? (
              <p role="status">{t('printer.cancelled')}</p>
            ) : (
              <Alert
                severity="critical"
                title={
                  state.reason === 'print' ? t('printer.printFailed') : t('printer.connectFailed')
                }
              >
                {state.reason === 'print'
                  ? t('printer.printFailedBody')
                  : t('printer.connectFailedBody')}
              </Alert>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
