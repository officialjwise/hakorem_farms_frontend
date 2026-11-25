import { CircleAlert, CircleCheck, Clock, CloudUpload, Copy, ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MoneyDisplay, StatusBadge, formatDateTime, formatWeight } from '@hakorem/ui';
import type { components } from '@hakorem/api-client';
import { needsAttention, totalDiffers } from './offline/sync';
import { useTill } from './offline/till';
import type { LocalStatus, QueueEntry, ReceiptContent } from './offline/types';
import { quantityText } from './units';

export { quantityText, unitName } from './units';

type OfflineUom = components['schemas']['OfflineUom'];

/** A queue record's state in words and icon, never colour alone (CLAUDE.md, "A control or state with no words"). */
export function EntryStatus({ entry }: { entry: QueueEntry }) {
  const { t } = useTranslation('pos');
  const status: LocalStatus = entry.localStatus;
  if (entry.kind === 'SALE' && totalDiffers(entry)) {
    return (
      <StatusBadge
        tone="critical"
        variant="strong"
        icon={CircleAlert}
        label={t('status.totalDiffers')}
      />
    );
  }
  switch (status) {
    case 'QUEUED':
      return <StatusBadge tone="warning" icon={Clock} label={t('status.QUEUED')} />;
    case 'SENDING':
      return <StatusBadge tone="info" icon={CloudUpload} label={t('status.SENDING')} />;
    case 'APPLIED':
      return <StatusBadge tone="good" icon={CircleCheck} label={t('status.APPLIED')} />;
    case 'DUPLICATE':
      return <StatusBadge tone="good" icon={Copy} label={t('status.DUPLICATE')} />;
    case 'APPLIED_WITH_EXCEPTION':
      return (
        <StatusBadge
          tone="warning"
          variant="strong"
          icon={CircleAlert}
          label={t('status.APPLIED_WITH_EXCEPTION')}
        />
      );
    case 'REJECTED_INTEGRITY':
      return (
        <StatusBadge
          tone="critical"
          variant="strong"
          icon={ShieldX}
          label={t('status.REJECTED_INTEGRITY')}
        />
      );
    case 'FAILED_PERMANENT':
      return (
        <StatusBadge
          tone="critical"
          variant="strong"
          icon={ShieldX}
          label={t('status.FAILED_PERMANENT')}
        />
      );
  }
}

export { needsAttention };

/** The units the till's pack names, for `unitName` and `quantityText`. Empty before a pack is read. */
export function usePackUnits(): readonly OfflineUom[] {
  return useTill().snapshot?.pack?.uoms ?? [];
}

/**
 * The customer's receipt as the till shows it on screen (ADR 0045). The sale reference is labelled as a
 * sale reference, never as a receipt number; the official number follows when the sale is recorded. The
 * printed form is the 58 mm ESC/POS one (`printer/escpos.ts`). A copy says so at the top, and it is never a
 * new receipt.
 */
export function Receipt({
  receipt,
  officialNo,
  copy = false,
}: {
  receipt: ReceiptContent;
  /** The official receipt number, once the server has allocated it. */
  officialNo: string | null;
  copy?: boolean;
}) {
  const { t } = useTranslation('pos');
  const units = usePackUnits();
  return (
    <article
      aria-label={t('receipt.label', { ref: receipt.provisionalRef })}
      data-slot="receipt"
      className="mx-auto grid w-full max-w-sm gap-2 rounded-md border border-border bg-surface p-3 font-mono text-sm text-fg"
    >
      {copy ? (
        <p
          className="border-2 border-border-strong p-1 text-center font-bold"
          data-slot="receipt-copy"
        >
          {t('receipt.copyMarker')}
        </p>
      ) : null}
      <header className="text-center">
        <p className="font-bold">{t('receipt.business')}</p>
        <p>{t('receipt.register', { name: receipt.registerName, code: receipt.registerCode })}</p>
        <p>{formatDateTime(receipt.occurredAt)}</p>
        <p>{t('receipt.cashier', { name: receipt.cashierName })}</p>
        {receipt.buyer != null ? (
          <p data-slot="receipt-buyer">
            {t('receipt.buyer', { name: receipt.buyer.name, tin: receipt.buyer.tin })}
          </p>
        ) : null}
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        <dt>{t('receipt.provisional')}</dt>
        <dd className="text-end font-bold">{receipt.provisionalRef}</dd>
        <dt>{t('receipt.official')}</dt>
        <dd className="text-end">{officialNo ?? t('receipt.officialFollows')}</dd>
      </dl>
      <table className="w-full border-y border-dashed border-border-strong">
        <caption className="sr-only">{t('receipt.lines')}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('receipt.item')}</th>
            <th scope="col">{t('receipt.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <tr key={`${line.name}-${String(index)}`} className="align-top">
              <td className="py-1">
                <span className="block">{line.name}</span>
                <span className="block text-fg-muted">
                  {line.stockUnitIdentifier !== null ? `${line.stockUnitIdentifier} · ` : ''}
                  {line.weightKg !== null
                    ? formatWeight(line.weightKg)
                    : quantityText(line.quantity, line.saleUom, units)}
                  {' @ '}
                  <MoneyDisplay pesewas={line.unitPricePesewas} />
                </span>
              </td>
              <td className="py-1 text-end">
                <MoneyDisplay pesewas={line.amountPesewas} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2">
        <dt className="font-bold">{t('receipt.total')}</dt>
        <dd className="text-end font-bold">
          <MoneyDisplay pesewas={receipt.totalPesewas} />
        </dd>
        {receipt.tenders.map((tender, index) => (
          <TenderRows key={`${tender.name}-${String(index)}`} tender={tender} />
        ))}
        <dt>{t('receipt.change')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={receipt.changePesewas} />
        </dd>
      </dl>
      <footer className="grid gap-1 text-center text-xs">
        <p>{t('receipt.thanks')}</p>
      </footer>
    </article>
  );
}

function TenderRows({ tender }: { tender: ReceiptContent['tenders'][number] }) {
  const { t } = useTranslation('pos');
  return (
    <>
      <dt>{tender.name}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={tender.amountPesewas} />
      </dd>
      {tender.unverified === true ? (
        <dd className="col-span-2 text-xs" data-slot="receipt-unverified">
          {t('receipt.unverified')}
          {tender.reference !== undefined && tender.reference !== null
            ? ` · ${t('receipt.reference')} ${tender.reference}`
            : ''}
        </dd>
      ) : null}
      {tender.tenderedPesewas !== null ? (
        <>
          <dt>{t('receipt.handed', { name: tender.name })}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={tender.tenderedPesewas} />
          </dd>
        </>
      ) : null}
    </>
  );
}
