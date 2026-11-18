import { EyeOff } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyDisplay, QueryBoundary, StatusBadge, formatDateTime } from '@hakorem/ui';
import { useApiAllPages } from '../../data/api';
import { useStateLabels } from '../../lib/states';

/**
 * The cash moved on the shift as the server holds it (`listShiftCashMovements`, 2.5.0): the float, each drop,
 * pay-out and pay-in, newest first, with who recorded it and, for a drop, who witnessed it or that nobody
 * did. Read again whenever another movement made on this till is confirmed (`confirmed`). A reason is said in
 * the words of the reasons the till holds, or by its code when it holds none for it.
 */
export function CashMoved({
  shiftId,
  confirmed,
  reasons,
}: {
  shiftId: string;
  confirmed: number;
  reasons: readonly { code: string; description: string }[];
}) {
  const { t } = useTranslation('posShift');
  const moved = useApiAllPages('listShiftCashMovements', { path: { id: shiftId } });
  const { refetch } = moved;
  useEffect(() => {
    if (confirmed > 0) void refetch();
  }, [confirmed, refetch]);
  const labels = useStateLabels({
    loading: t('moved.loading'),
    emptyTitle: t('moved.empty'),
    errorTitle: t('moved.failed'),
    deniedTitle: t('moved.denied'),
  });
  return (
    <section
      aria-labelledby="moved-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id="moved-title" className="text-lg font-semibold">
        {t('moved.title')}
      </h3>
      <QueryBoundary query={moved} labels={labels} isEmpty={(data) => data.items.length === 0}>
        {(data) => (
          <ul className="grid gap-2">
            {data.items.map((movement) => (
              <li
                key={movement.id}
                className="grid gap-1 rounded-md border border-border p-3"
                data-slot="cash-moved"
              >
                <p className="flex flex-wrap items-baseline justify-between gap-2 font-semibold">
                  <span>{t(`moved.kinds.${movement.kind}`)}</span>
                  <MoneyDisplay pesewas={movement.amountPesewas} />
                </p>
                <p className="text-sm text-fg-muted">
                  {formatDateTime(movement.occurredAt)} ·{' '}
                  {t('moved.by', { name: movement.actor.displayName })}
                  {movement.reasonCode !== null
                    ? ` · ${reasons.find((r) => r.code === movement.reasonCode)?.description ?? movement.reasonCode}`
                    : ''}
                </p>
                {movement.note !== null ? <p className="text-sm">{movement.note}</p> : null}
                {movement.kind === 'CASH_DROP' ? (
                  movement.witness !== null ? (
                    <p className="text-sm">
                      {t('cash.witnessed', { name: movement.witness.displayName })}
                    </p>
                  ) : (
                    <StatusBadge tone="warning" icon={EyeOff} label={t('cash.unwitnessedShort')} />
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </section>
  );
}
