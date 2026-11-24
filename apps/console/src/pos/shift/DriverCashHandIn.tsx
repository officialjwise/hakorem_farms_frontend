import type { components } from '@hakorem/api-client';
import { Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  Select,
  formatDateTime,
  type FailureLike,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../../data/api';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { useIntentKey } from '../../lib/queries';
import { RequestReference } from '../../lib/RequestReference';
import type { ShiftRecord } from '../offline/types';

type HandIn = components['schemas']['DriverCashReconciliation'];

const NOTE_MAX = 500;

/**
 * A driver hands in the cash collected on delivery at this shift (2.31.0, CR-057, `handInDriverCash`): the
 * cashier counts it blind into their own open shift, every collection the driver holds at the branch is
 * handed in once, and the server answers what was expected and any short or over. The count goes into the
 * drawer and is counted at the close like any cash the shift took. Online only: the operation is not in the
 * offline batch. The drivers are `listShiftDriverCashHolders` (2.35.0, CR-063): names and counts, never an
 * amount, so the count stays blind (A-F10-19, accepted by the owner on 2026-11-24).
 */
export function DriverCashHandIn({ shift, online }: { shift: ShiftRecord; online: boolean }) {
  const { t } = useTranslation(['posShift', 'pos']);
  const canAsk = online && shift.confirmed;
  const holders = useApiQuery(
    'listShiftDriverCashHolders',
    { path: { id: shift.id } },
    { enabled: canAsk, staleClass: 'live' },
  );
  const handIn = useApiMutation('handInDriverCash', {
    invalidates: ['getShift', 'getShiftXReport', 'listDriverCashReconciliations'],
  });
  const keyFor = useIntentKey();
  const [driverId, setDriverId] = useState('');
  const [counted, setCounted] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<HandIn[]>([]);

  const drivers = holders.data?.data ?? [];
  const driver = drivers.find((d) => d.driver.id === driverId) ?? null;
  const noteTooLong = note.trim().length > NOTE_MAX;
  const ready = driver !== null && counted !== null && !noteTooLong;
  const reset = () => {
    setDriverId('');
    setCounted(null);
    setNote('');
    setTried(false);
  };

  return (
    <section
      aria-labelledby="driver-cash-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
      data-slot="driver-cash"
    >
      <h3 id="driver-cash-title" className="flex items-center gap-2 text-lg font-semibold">
        <Truck aria-hidden="true" className="size-icon-md" />
        {t('driverCash.title')}
      </h3>
      <p>{t('driverCash.body')}</p>
      {done.map((answer) => (
        <HandedIn key={answer.id} answer={answer} />
      ))}
      {!canAsk ? (
        <Alert
          severity="warning"
          title={online ? t('driverCash.notOnServer') : t('driverCash.offline')}
        />
      ) : holders.isPending ? (
        <p role="status">{t('driverCash.loading')}</p>
      ) : holders.isError ? (
        <Alert severity="critical" title={t('driverCash.listFailed')}>
          {holders.error.message}{' '}
          <Button size="sm" variant="secondary" onClick={() => void holders.refetch()}>
            {t('driverCash.retry')}
          </Button>
        </Alert>
      ) : drivers.length === 0 ? (
        <p data-slot="driver-cash-none">{t('driverCash.none')}</p>
      ) : (
        <>
          <Field
            label={t('driverCash.driver')}
            error={tried && driver === null ? t('driverCash.driverError') : undefined}
          >
            <Select
              value={driverId}
              onValueChange={(value) => {
                setDriverId(value);
                handIn.reset();
              }}
              placeholder={t('driverCash.driverPlaceholder')}
              options={drivers.map((d) => ({
                value: d.driver.id,
                label: t('driverCash.driverOption', {
                  name: d.driver.displayName,
                  count: d.collections,
                }),
              }))}
            />
          </Field>
          <Field
            label={t('driverCash.counted')}
            hint={t('driverCash.countedHint')}
            error={tried && counted === null ? t('driverCash.countedError') : undefined}
          >
            <MoneyInput value={counted} onValueChange={setCounted} />
          </Field>
          <Field
            label={t('posShift:cash.note')}
            hint={t('driverCash.noteHint')}
            error={noteTooLong ? t('driverCash.noteTooLong', { max: NOTE_MAX }) : undefined}
          >
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button
            size="lg"
            onClick={() => {
              setTried(true);
              handIn.reset();
              if (ready) setConfirming(true);
            }}
          >
            {t('driverCash.review')}
          </Button>
        </>
      )}
      {!confirming ? <Refused title={t('driverCash.failed')} error={handIn.error} /> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('driverCash.confirmTitle')}
        body={t('driverCash.confirmBody', { name: driver?.driver.displayName ?? '' })}
        consequence={t('driverCash.consequence')}
        confirmLabel={t('driverCash.confirm')}
        pendingLabel={t('driverCash.sending')}
        pending={handIn.isPending}
        error={handIn.error}
        failedTitle={t('driverCash.failed')}
        onConfirm={() => {
          if (driver === null || counted === null) return;
          const trimmed = note.trim();
          const body = {
            driverId: driver.driver.id,
            declaredPesewas: counted,
            ...(trimmed !== '' ? { note: trimmed } : {}),
          };
          handIn
            .mutateAsync(
              { path: { id: shift.id }, body },
              { idempotencyKey: keyFor({ shift: shift.id, ...body }) },
            )
            .then((answer) => {
              setConfirming(false);
              setDone((current) => [answer, ...current]);
              reset();
              void holders.refetch();
            })
            .catch(() => undefined);
        }}
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>{t('driverCash.driver')}</dt>
          <dd className="text-end">{driver?.driver.displayName}</dd>
          <dt>{t('driverCash.counted')}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={counted ?? 0} />
          </dd>
        </dl>
      </ConfirmDialog>
    </section>
  );
}

/** The server's answer, kept on screen: what was expected, what was counted, and any short or over in words. */
function HandedIn({ answer }: { answer: HandIn }) {
  const { t } = useTranslation('posShift');
  const direction = answer.varianceDirection;
  return (
    <div
      className="grid gap-2 rounded-md border border-border p-3"
      data-slot="driver-cash-done"
      role="status"
    >
      <p className="font-semibold">{t('driverCash.done', { name: answer.driver.displayName })}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>{t('driverCash.expected')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.expectedPesewas} />
        </dd>
        <dt>{t('driverCash.counted')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.declaredPesewas} />
        </dd>
        <dt>{t(`driverCash.variance.${direction}`)}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={answer.variancePesewas} />
        </dd>
      </dl>
      {direction === 'SHORT' ? (
        <Alert severity="warning" title={t('driverCash.shortTitle')}>
          {t('driverCash.shortBody')}
        </Alert>
      ) : null}
      {answer.collections.length > 0 ? (
        <details>
          <summary>{t('driverCash.collections', { count: answer.collections.length })}</summary>
          <ul className="grid gap-1 pt-2">
            {answer.collections.map((c, index) => (
              <li key={c.deliveryNo ?? index} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t('driverCash.collection', {
                    delivery: c.deliveryNo ?? t('driverCash.unnumbered'),
                    recipient: c.recipientName,
                    at: formatDateTime(c.capturedAt),
                  })}
                </span>
                <MoneyDisplay pesewas={c.amountPesewas} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Refused({ title, error }: { title: string; error: FailureLike | null }) {
  const { t } = useTranslation('pos');
  if (error === null) return null;
  return (
    <Alert severity="critical" title={title}>
      {error.message}
      {error.correlationId !== '' ? (
        <>
          {' '}
          {t('referenceLabel')} <RequestReference value={error.correlationId} />
        </>
      ) : null}
    </Alert>
  );
}
