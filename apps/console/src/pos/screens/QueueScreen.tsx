import { CloudUpload, KeyRound, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, MoneyDisplay, Skeleton, formatDateTime } from '@hakorem/ui';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { needsAttention, pendingCount, totalDiffers } from '../offline/sync';
import { getTill, useTill } from '../offline/till';
import type { QueueEntry, SaleEntry } from '../offline/types';
import { EntryStatus, Receipt } from '../presentation';
import { LazyReceiptOut } from '../parts';
import { RequestReference } from '../../lib/RequestReference';

/**
 * The till's queue (OFFLINE_SYNC section 6): every sale, cash movement and shift open on this device that the
 * server has not confirmed, or confirmed in the last 24 hours. A record the server refused stays here in
 * words, with its reference, for a manager; a sale whose total on the server differs from the till's says
 * both figures. Counter gaps the server reports are shown. A PIN that approved a record is named with its
 * verifier version (CR-032). A copy of a provisional receipt prints marked as
 * a copy. Permission: the till's (`pos.sale.create`).
 */
export function QueueScreen() {
  const { t } = useTranslation(['posScreens', 'pos']);
  const till = useTill();
  const online = useOnlineStatus();
  const [copy, setCopy] = useState<SaleEntry | null>(null);
  const snapshot = till.snapshot;
  if (snapshot === null) return <Skeleton label={t('pos:sale.loading')} shape="block" />;
  const waiting = pendingCount(snapshot);
  const attention = snapshot.entries.filter(needsAttention);
  const { sync } = till;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{t('queue.title')}</h2>
        <Button
          size="lg"
          disabled={waiting === 0 || sync.sending}
          loading={sync.sending}
          loadingLabel={t('queue.sending')}
          onClick={() => getTill().kick()}
        >
          <CloudUpload aria-hidden="true" />
          {t('queue.sendNow')}
        </Button>
      </div>
      <section aria-labelledby="queue-summary" className="grid gap-2" data-slot="queue-summary">
        <h3 id="queue-summary" className="sr-only">
          {t('queue.summary')}
        </h3>
        <p role="status">
          {waiting === 0 ? t('queue.allSent') : t('queue.waiting', { count: waiting })}
        </p>
        {sync.lastPassAt !== null ? (
          <p className="text-sm text-fg-muted">
            {t('queue.lastPass', { at: formatDateTime(sync.lastPassAt) })}
          </p>
        ) : null}
        {waiting > 0 && sync.nextAttemptAt !== null ? (
          <p className="text-sm text-fg-muted">
            {online
              ? t('queue.nextAttempt', { at: formatDateTime(sync.nextAttemptAt) })
              : t('queue.offline')}
          </p>
        ) : null}
        {sync.blocked !== null ? (
          <Alert
            severity="critical"
            title={t(
              sync.blocked.code === 'UNAUTHENTICATED'
                ? 'queue.blocked.session'
                : 'queue.blocked.device',
            )}
          >
            {sync.blocked.message}
            {sync.blocked.correlationId !== '' ? (
              <>
                {' '}
                {t('pos:referenceLabel')} <RequestReference value={sync.blocked.correlationId} />
              </>
            ) : null}
          </Alert>
        ) : null}
        {snapshot.meta.counterGaps.length > 0 ? (
          <Alert
            severity="critical"
            title={t('queue.gaps', { counters: snapshot.meta.counterGaps.join(', ') })}
          >
            {t('queue.gapsBody')}
          </Alert>
        ) : null}
        {attention.length > 0 ? (
          <Alert severity="warning" title={t('queue.attention', { count: attention.length })}>
            {t('queue.attentionBody')}
          </Alert>
        ) : null}
      </section>
      {snapshot.entries.length === 0 ? (
        <EmptyState
          icon={CloudUpload}
          title={t('queue.empty')}
          description={t('queue.emptyBody')}
        />
      ) : (
        <ol className="grid gap-2" aria-label={t('queue.records')}>
          {[...snapshot.entries].reverse().map((entry) => (
            <Row key={entry.id} entry={entry} onCopy={setCopy} />
          ))}
        </ol>
      )}
      {copy !== null ? (
        <section aria-label={t('queue.copyTitle')} className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCopy(null)}>
              {t('pos:close')}
            </Button>
          </div>
          <Receipt receipt={copy.receipt} officialNo={copy.serverResult?.receiptNo ?? null} copy />
          <LazyReceiptOut entry={copy} copy />
        </section>
      ) : null}
    </div>
  );
}

function Row({ entry, onCopy }: { entry: QueueEntry; onCopy: (entry: SaleEntry) => void }) {
  const { t } = useTranslation(['posScreens', 'pos']);
  return (
    <li
      className="grid gap-1 rounded-md border border-border bg-surface p-3"
      data-slot="queue-record"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {entry.kind === 'SALE'
            ? t('queue.sale', { ref: entry.payload.provisionalRef })
            : entry.kind === 'CASH_MOVEMENT'
              ? t(`queue.cash.${entry.payload.kind}`)
              : t('queue.shiftOpen')}
        </p>
        <EntryStatus entry={entry} />
      </div>
      <p className="text-sm text-fg-muted">
        {formatDateTime(entry.createdLocalAt)}
        {entry.attempts > 0 ? ` · ${t('queue.attempts', { count: entry.attempts })}` : ''}
      </p>
      {entry.kind === 'SALE' ? (
        <>
          <p>
            {t('queue.total')} <MoneyDisplay pesewas={entry.localTotalPesewas} />
            {entry.serverResult?.receiptNo != null
              ? ` · ${t('queue.receiptNo', { number: entry.serverResult.receiptNo })}`
              : ''}
          </p>
          {totalDiffers(entry) && entry.serverTotalPesewas !== null ? (
            <Alert severity="critical" title={t('queue.differs')}>
              {t('queue.differsTill')} <MoneyDisplay pesewas={entry.localTotalPesewas} />.{' '}
              {t('queue.differsServer')} <MoneyDisplay pesewas={entry.serverTotalPesewas} />.{' '}
              {t('queue.differsBody')}
            </Alert>
          ) : null}
          {(entry.serverResult?.exceptions ?? []).length > 0 ? (
            <ul className="text-sm text-warning-fg">
              {(entry.serverResult?.exceptions ?? []).map((exception) => (
                <li key={`${exception.kind}-${exception.summary}`}>{exception.summary}</li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button
              variant="ghost"
              onClick={() => onCopy(entry)}
              aria-label={t('queue.copyNamed', { ref: entry.payload.provisionalRef })}
            >
              <ReceiptText aria-hidden="true" />
              {t('queue.copy')}
            </Button>
          </div>
        </>
      ) : entry.kind === 'CASH_MOVEMENT' ? (
        <p>
          <MoneyDisplay pesewas={entry.payload.amountPesewas} />
        </p>
      ) : (
        <p>
          {t('queue.float')} <MoneyDisplay pesewas={entry.payload.openingFloatPesewas} />
        </p>
      )}
      {entry.kind !== 'SHIFT_OPEN' && (entry.approvals ?? []).length > 0 ? (
        <ul className="grid gap-1 text-sm" data-slot="queue-approvals">
          {(entry.approvals ?? []).map((record) => (
            <li
              key={`${record.approval}-${record.principalId}`}
              className="flex items-center gap-1"
            >
              <KeyRound aria-hidden="true" className="size-icon-sm" />
              {t('queue.approvedBy', {
                what: t(`queue.approval.${record.approval}`),
                name: record.displayName,
                version: record.verifierVersion,
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.failure !== null ? (
        <Alert severity="critical" title={t('queue.refused')}>
          {entry.failure.message}
          {entry.failure.correlationId !== '' ? (
            <>
              {' '}
              {t('pos:referenceLabel')} <RequestReference value={entry.failure.correlationId} />
            </>
          ) : null}
        </Alert>
      ) : null}
    </li>
  );
}
