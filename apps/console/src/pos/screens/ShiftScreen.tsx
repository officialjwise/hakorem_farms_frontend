import type { components } from '@hakorem/api-client';
import { Banknote, ClipboardCheck, FileText, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  QueryBoundary,
  Select,
  Skeleton,
  formatDateTime,
} from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../../data/api';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { useIntentKey } from '../../lib/queries';
import { useStateLabels } from '../../lib/states';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { pendingCount } from '../offline/sync';
import { getTill, useTill } from '../offline/till';
import type { OfflinePack, ShiftRecord, TillSnapshot } from '../offline/types';

type Shift = components['schemas']['Shift'];
type ShiftReport = components['schemas']['ShiftReport'];
type MovementKind = 'CASH_DROP' | 'PAY_OUT' | 'PAY_IN';

/**
 * The shift on this till (FR-POS shift management): what it holds, cash drops, pay-outs and pay-ins (queued,
 * so they work offline), the X report, and the close. The close is blind and online (OFFLINE_SYNC section 2):
 * the cashier declares the count before the expected figures are shown, and only once every sale has been
 * sent; then a supervisor who is not the cashier signs it off, which posts the over or short and gives the
 * Z report.
 */
export function ShiftScreen() {
  const { t } = useTranslation('pos');
  const till = useTill();
  const snapshot = till.snapshot;
  if (snapshot === null) return <Skeleton label={t('sale.loading')} shape="block" />;
  const shift = snapshot.shift;
  if (snapshot.device === null || shift === null || snapshot.pack === null) {
    return (
      <EmptyState
        icon={Banknote}
        title={t('shift.none')}
        action={
          <Button asChild size="lg">
            <Link to={snapshot.device === null ? '/pos' : '/pos/shift/open'}>
              {snapshot.device === null ? t('toSale') : t('sale.noShift.action')}
            </Link>
          </Button>
        }
      />
    );
  }
  return <OpenShift snapshot={snapshot} shift={shift} pack={snapshot.pack} />;
}

function OpenShift({
  snapshot,
  shift,
  pack,
}: {
  snapshot: TillSnapshot;
  shift: ShiftRecord;
  pack: OfflinePack;
}) {
  const { t } = useTranslation('pos');
  const auth = useAuth();
  const online = useOnlineStatus();
  const server = useApiQuery(
    'getShift',
    { path: { id: shift.id } },
    { enabled: online && shift.confirmed },
  );
  const sales = snapshot.entries.filter((e) => e.kind === 'SALE' && e.shiftId === shift.id).length;
  const status = server.data?.status ?? 'OPEN';
  const isCashier = auth.session?.principal.id === shift.cashierId;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="shift-title" className="grid gap-2">
        <h2 id="shift-title" className="text-2xl font-bold">
          {shift.shiftNo !== null
            ? t('shift.titleNo', { number: shift.shiftNo })
            : t('shift.title')}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>{t('shift.cashier')}</dt>
          <dd>{shift.cashierName}</dd>
          <dt>{t('shift.openedAt')}</dt>
          <dd>{formatDateTime(shift.openedAt)}</dd>
          <dt>{t('shift.float')}</dt>
          <dd>
            <MoneyDisplay pesewas={shift.openingFloatPesewas} />
          </dd>
          <dt>{t('shift.salesHere')}</dt>
          <dd>{sales}</dd>
          <dt>{t('shift.status')}</dt>
          <dd>{t(`shift.statuses.${status}`)}</dd>
        </dl>
        {!shift.confirmed ? <Alert severity="warning" title={t('shift.notOnServer')} /> : null}
      </section>
      {status === 'OPEN' && isCashier ? <CashMovement pack={pack} online={online} /> : null}
      {online && shift.confirmed && auth.can('pos.shift.report') ? (
        <Report shiftId={shift.id} kind="X" />
      ) : null}
      {status === 'OPEN' && isCashier && auth.can('pos.shift.close') ? (
        <Close
          snapshot={snapshot}
          shift={shift}
          pack={pack}
          online={online}
          onClosed={() => void server.refetch()}
        />
      ) : null}
      {server.data !== undefined && status !== 'OPEN' ? (
        <Closing
          shift={server.data}
          isCashier={isCashier}
          onApproved={() => void server.refetch()}
        />
      ) : null}
    </div>
  );
}

function CashMovement({ pack, online }: { pack: OfflinePack; online: boolean }) {
  const { t } = useTranslation('pos');
  const [kind, setKind] = useState<MovementKind>('CASH_DROP');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const fetched = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'CASH_MOVEMENT' } },
    { enabled: online },
  );
  const reasons = [
    ...pack.reasonCodes.filter((code) => code.domain === 'CASH_MOVEMENT'),
    ...(fetched.data?.items ?? []).filter(
      (code) => !pack.reasonCodes.some((p) => p.code === code.code),
    ),
  ];
  const needsReason = kind !== 'CASH_DROP';
  const ready = amount !== null && amount > 0 && (!needsReason || reason !== '');

  return (
    <section
      aria-labelledby="cash-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id="cash-title" className="text-lg font-semibold">
        {t('cash.title')}
      </h3>
      <Field label={t('cash.kind')}>
        <Select
          value={kind}
          onValueChange={(value) => setKind(value as MovementKind)}
          options={(['CASH_DROP', 'PAY_OUT', 'PAY_IN'] as const).map((value) => ({
            value,
            label: t(`queue.cash.${value}`),
          }))}
        />
      </Field>
      <Field
        label={t('cash.amount')}
        error={tried && (amount === null || amount === 0) ? t('cash.amountError') : undefined}
      >
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      {needsReason ? (
        <Field
          label={t('cash.reason')}
          hint={reasons.length === 0 ? t('cash.noReasons') : undefined}
          error={tried && reason === '' ? t('cash.reasonError') : undefined}
        >
          <Select
            value={reason}
            onValueChange={setReason}
            placeholder={t('cash.reasonPlaceholder')}
            options={reasons.map((code) => ({ value: code.code, label: code.description }))}
          />
        </Field>
      ) : null}
      <Field label={t('cash.note')}>
        <Input value={note} onChange={(event) => setNote(event.target.value)} autoComplete="off" />
      </Field>
      <Button
        variant="secondary"
        onClick={() => {
          setTried(true);
          setRecorded(null);
          if (ready) setConfirming(true);
        }}
      >
        {t('cash.review')}
      </Button>
      {recorded !== null ? <Alert severity="good" title={recorded} /> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('cash.confirmTitle', { kind: t(`queue.cash.${kind}`) })}
        body={online ? t('cash.confirmBody') : t('cash.confirmOffline')}
        confirmLabel={t('cash.record')}
        pendingLabel={t('cash.recording')}
        pending={false}
        error={null}
        failedTitle={t('cash.failed')}
        onConfirm={() => {
          if (amount === null) return;
          void getTill()
            .recordCashMovement({
              kind,
              amountPesewas: amount,
              ...(needsReason ? { reasonCode: reason } : {}),
              ...(note.trim() !== '' ? { note: note.trim() } : {}),
            })
            .then(() => {
              setConfirming(false);
              setRecorded(t('cash.recorded', { kind: t(`queue.cash.${kind}`) }));
              setAmount(null);
              setReason('');
              setNote('');
              setTried(false);
            });
        }}
      >
        <p className="flex items-baseline justify-between text-xl font-bold">
          <span>{t(`queue.cash.${kind}`)}</span>
          <MoneyDisplay pesewas={amount ?? 0} />
        </p>
      </ConfirmDialog>
    </section>
  );
}

function Report({ shiftId, kind }: { shiftId: string; kind: 'X' | 'Z' }) {
  const { t } = useTranslation('pos');
  const [open, setOpen] = useState(kind === 'Z');
  const x = useApiQuery(
    'getShiftXReport',
    { path: { id: shiftId } },
    { enabled: open && kind === 'X' },
  );
  const z = useApiQuery(
    'getShiftZReport',
    { path: { id: shiftId } },
    { enabled: open && kind === 'Z' },
  );
  const query = kind === 'X' ? x : z;
  const labels = useStateLabels({
    loading: t('report.loading'),
    emptyTitle: t('report.empty'),
    errorTitle: t('report.failed'),
    deniedTitle: t('report.denied'),
  });
  return (
    <section
      aria-labelledby={`report-${kind}`}
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id={`report-${kind}`} className="text-lg font-semibold">
        {t(`report.title${kind}`)}
      </h3>
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <FileText aria-hidden="true" />
          {t('report.show')}
        </Button>
      ) : (
        <QueryBoundary query={query} labels={labels} isEmpty={() => false}>
          {(report: ShiftReport) => <ReportBody report={report} />}
        </QueryBoundary>
      )}
    </section>
  );
}

function ReportBody({ report }: { report: ShiftReport }) {
  const { t } = useTranslation('pos');
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      <dt>{t('report.generated')}</dt>
      <dd className="text-end">{formatDateTime(report.generatedAt)}</dd>
      <dt>{t('report.sales', { count: report.salesCount })}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={report.grossSalesPesewas} />
      </dd>
      {report.byMethod.map((row) => (
        <Pair
          key={row.paymentMethod.id}
          term={t('report.method', { name: row.paymentMethod.name, count: row.count })}
          pesewas={row.amountPesewas}
        />
      ))}
      {report.cashMovements.map((row) => (
        <Pair
          key={row.kind}
          term={t(`report.movement.${row.kind}`, { defaultValue: row.kind })}
          pesewas={row.amountPesewas}
        />
      ))}
      <Pair term={t('report.voids', { count: report.voidsCount })} pesewas={report.voidsPesewas} />
      <Pair
        term={t('report.overrides', { count: report.overridesCount })}
        pesewas={report.overridesPesewas}
      />
      <Pair term={t('report.refunds')} pesewas={report.refundsPesewas} />
    </dl>
  );
}

function Pair({ term, pesewas }: { term: string; pesewas: number }) {
  return (
    <>
      <dt>{term}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={pesewas} />
      </dd>
    </>
  );
}

function Close({
  snapshot,
  shift,
  pack,
  online,
  onClosed,
}: {
  snapshot: TillSnapshot;
  shift: ShiftRecord;
  pack: OfflinePack;
  online: boolean;
  onClosed: () => void;
}) {
  const { t } = useTranslation('pos');
  const close = useApiMutation('closeShift', { invalidates: ['getShift', 'listShifts'] });
  const keyFor = useIntentKey();
  const [declared, setDeclared] = useState<Record<string, number | null>>({});
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);
  const waiting = pendingCount(snapshot);
  const complete = pack.paymentMethods.every((method) => declared[method.id] != null);
  const blocked = !online
    ? 'offline'
    : waiting > 0
      ? 'queue'
      : !shift.confirmed
        ? 'notOnServer'
        : null;

  return (
    <section
      aria-labelledby="close-title"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h3 id="close-title" className="text-lg font-semibold">
        {t('closeShift.title')}
      </h3>
      <p>{t('closeShift.blind')}</p>
      {blocked !== null ? (
        <Alert severity="warning" title={t(`closeShift.blocked.${blocked}`, { count: waiting })} />
      ) : null}
      {pack.paymentMethods.map((method) => (
        <Field
          key={method.id}
          label={t('closeShift.counted', { name: method.name })}
          error={tried && declared[method.id] == null ? t('closeShift.countError') : undefined}
        >
          <MoneyInput
            value={declared[method.id] ?? null}
            onValueChange={(value) =>
              setDeclared((current) => ({ ...current, [method.id]: value }))
            }
          />
        </Field>
      ))}
      <Button
        size="lg"
        disabled={blocked !== null}
        onClick={() => {
          setTried(true);
          close.reset();
          if (complete) setConfirming(true);
        }}
      >
        <LockKeyhole aria-hidden="true" />
        {t('closeShift.review')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('closeShift.confirmTitle')}
        body={t('closeShift.confirmBody')}
        consequence={t('closeShift.consequence')}
        confirmLabel={t('closeShift.confirm')}
        pendingLabel={t('closeShift.closing')}
        pending={close.isPending}
        error={close.error}
        failedTitle={t('closeShift.failed')}
        onConfirm={() => {
          const body = {
            declared: pack.paymentMethods.map((method) => ({
              paymentMethodId: method.id,
              declaredPesewas: declared[method.id] ?? 0,
            })),
            lastDeviceCounter: shift.lastCounter,
          };
          close
            .mutateAsync(
              { path: { id: shift.id }, body },
              { idempotencyKey: keyFor({ shift: shift.id, ...body }) },
            )
            .then(() => {
              setConfirming(false);
              onClosed();
            })
            .catch(() => undefined);
        }}
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          {pack.paymentMethods.map((method) => (
            <Pair
              key={method.id}
              term={t('closeShift.counted', { name: method.name })}
              pesewas={declared[method.id] ?? 0}
            />
          ))}
        </dl>
      </ConfirmDialog>
    </section>
  );
}

/** After the blind count: what was expected, the over or short in words, and the supervisor's sign-off. */
function Closing({
  shift,
  isCashier,
  onApproved,
}: {
  shift: Shift;
  isCashier: boolean;
  onApproved: () => void;
}) {
  const { t } = useTranslation('pos');
  const auth = useAuth();
  const approve = useApiMutation('approveShiftClose', { invalidates: ['getShift', 'listShifts'] });
  const keyFor = useIntentKey();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const mayApprove =
    auth.can('pos.shift.close.approve') && !isCashier && shift.status === 'CLOSING';
  return (
    <section
      aria-labelledby="closing-title"
      className="grid gap-3 rounded-lg border-2 border-border-strong bg-surface p-4"
    >
      <h3 id="closing-title" className="text-lg font-semibold">
        {shift.status === 'CLOSED' ? t('closing.closed') : t('closing.title')}
      </h3>
      <dl className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="font-semibold">{t('closing.method')}</dt>
        <dd className="text-end font-semibold">{t('closing.declared')}</dd>
        <dd className="text-end font-semibold">{t('closing.expected')}</dd>
        <dd className="text-end font-semibold">{t('closing.variance')}</dd>
        {shift.tenders.map((tender) => (
          <TenderCount key={tender.paymentMethod.id} tender={tender} />
        ))}
      </dl>
      {shift.overShortDirection !== null && shift.overShortPesewas !== null ? (
        <p className="text-lg font-semibold" data-slot="over-short">
          {t(`closing.direction.${shift.overShortDirection}`)}{' '}
          <MoneyDisplay pesewas={shift.overShortPesewas} />
        </p>
      ) : null}
      {shift.status === 'CLOSING' ? (
        isCashier ? (
          <p>{t('closing.waitSupervisor')}</p>
        ) : mayApprove ? (
          <>
            <Field label={t('closing.reason')} hint={t('closing.reasonHint')}>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button
              size="lg"
              disabled={reason.trim() === ''}
              onClick={() => {
                approve.reset();
                setConfirming(true);
              }}
            >
              <ClipboardCheck aria-hidden="true" />
              {t('closing.approve')}
            </Button>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t('closing.confirmTitle')}
              body={t('closing.confirmBody', { name: shift.cashier.displayName })}
              confirmLabel={t('closing.approve')}
              pendingLabel={t('closing.approving')}
              pending={approve.isPending}
              error={approve.error}
              failedTitle={t('closing.failed')}
              onConfirm={() => {
                const body = { reason: reason.trim() };
                approve
                  .mutateAsync(
                    { path: { id: shift.id }, body },
                    { idempotencyKey: keyFor({ shift: shift.id, ...body }) },
                  )
                  .then(async () => {
                    setConfirming(false);
                    await getTill().endShift();
                    onApproved();
                  })
                  .catch(() => undefined);
              }}
            />
          </>
        ) : (
          <p>{t('closing.needsSupervisor')}</p>
        )
      ) : null}
      {shift.status === 'CLOSED' ? <Report shiftId={shift.id} kind="Z" /> : null}
    </section>
  );
}

function TenderCount({ tender }: { tender: Shift['tenders'][number] }) {
  const { t } = useTranslation('pos');
  return (
    <>
      <dt>{tender.paymentMethod.name}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={tender.declaredPesewas} />
      </dd>
      <dd className="text-end">
        {tender.expectedPesewas === null ? (
          t('closing.hidden')
        ) : (
          <MoneyDisplay pesewas={tender.expectedPesewas} />
        )}
      </dd>
      <dd className="text-end">
        {tender.variancePesewas === null || tender.varianceDirection === null ? (
          t('closing.hidden')
        ) : (
          <>
            {t(`closing.direction.${tender.varianceDirection}`)}{' '}
            <MoneyDisplay pesewas={tender.variancePesewas} />
          </>
        )}
      </dd>
    </>
  );
}
