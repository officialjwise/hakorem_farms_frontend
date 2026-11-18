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
  Skeleton,
  formatDateTime,
  type FailureLike,
} from '@hakorem/ui';
import { useAuth } from '../../auth/AuthProvider';
import { shownFailure, useStepUp } from '../../auth/StepUp';
import { useApiMutation, useApiQuery } from '../../data/api';
import { ConfirmDialog } from '../../lib/ConfirmDialog';
import { useIntentKey } from '../../lib/queries';
import { RequestReference } from '../../lib/RequestReference';
import { useStateLabels } from '../../lib/states';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { pendingCount } from '../offline/sync';
import { getTill, useTill } from '../offline/till';
import {
  CONFIRMED_STATUSES,
  type OfflinePack,
  type ShiftRecord,
  type TillSnapshot,
} from '../offline/types';
import { CashMoved } from '../shift/CashMoved';
import { CashMovementForm } from '../shift/CashMovementForm';

type Shift = components['schemas']['Shift'];
type ShiftReport = components['schemas']['ShiftReport'];

/**
 * The shift on this till (FR-POS-015 to FR-POS-019, contract 2.5.0): what it holds, the cash moved on it,
 * cash drops, pay-outs and pay-ins, the X report, and the close. The close is blind and online
 * (OFFLINE_SYNC section 2): the cashier declares the count before any expected figure is shown, and only
 * once every sale has been sent; the API's answer then shows what was expected and the over or short. A
 * supervisor who is not the cashier signs it off with a fresh step-up, which posts the over or short and
 * stores the Z report. This screen and its words (`posShift`) load on demand, never with the till.
 */
export function ShiftScreen() {
  const { t } = useTranslation(['posShift', 'pos']);
  const till = useTill();
  // Kept here: signing the close off frees the till at once, and the Z report is still read afterwards.
  const [closed, setClosed] = useState<Shift | null>(null);
  const snapshot = till.snapshot;
  if (snapshot === null) return <Skeleton label={t('pos:sale.loading')} shape="block" />;
  if (closed !== null) return <ClosedShift shift={closed} />;
  const shift = snapshot.shift;
  if (snapshot.device === null || shift === null || snapshot.pack === null) {
    return (
      <EmptyState
        icon={Banknote}
        title={t('shift.none')}
        action={
          <Button asChild size="lg">
            <Link to={snapshot.device === null ? '/pos' : '/pos/shift/open'}>
              {snapshot.device === null ? t('pos:toSale') : t('pos:sale.noShift.action')}
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <OpenShift snapshot={snapshot} shift={shift} pack={snapshot.pack} onSignedOff={setClosed} />
  );
}

function OpenShift({
  snapshot,
  shift,
  pack,
  onSignedOff,
}: {
  snapshot: TillSnapshot;
  shift: ShiftRecord;
  pack: OfflinePack;
  onSignedOff: (shift: Shift) => void;
}) {
  const { t } = useTranslation(['posShift', 'pos']);
  const auth = useAuth();
  const online = useOnlineStatus();
  const server = useApiQuery(
    'getShift',
    { path: { id: shift.id } },
    { enabled: online && shift.confirmed },
  );
  // The close's own answer reveals the expected figures at once; the shift read afterwards carries on from it.
  const [answered, setAnswered] = useState<Shift | null>(null);
  const known =
    answered !== null && (server.data === undefined || server.data.status === 'OPEN')
      ? answered
      : server.data;
  const sales = snapshot.entries.filter((e) => e.kind === 'SALE' && e.shiftId === shift.id).length;
  const confirmedMovements = snapshot.entries.filter(
    (e) =>
      e.kind === 'CASH_MOVEMENT' &&
      e.shiftId === shift.id &&
      CONFIRMED_STATUSES.includes(e.localStatus),
  ).length;
  const status = known?.status ?? 'OPEN';
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
      {status === 'OPEN' && isCashier && auth.can('pos.cash.move') ? (
        <CashMovementForm shift={shift} pack={pack} online={online} />
      ) : null}
      {online && shift.confirmed && auth.can('pos.shift.read') ? (
        <CashMoved
          shiftId={shift.id}
          confirmed={confirmedMovements}
          reasons={pack.reasonCodes.filter((code) => code.domain === 'CASH_MOVEMENT')}
        />
      ) : null}
      {online && shift.confirmed && auth.can('pos.shift.report') ? (
        <Report shiftId={shift.id} kind="X" />
      ) : null}
      {status === 'OPEN' && isCashier && auth.can('pos.shift.close') ? (
        <Close
          snapshot={snapshot}
          shift={shift}
          pack={pack}
          online={online}
          onClosed={(closing) => {
            setAnswered(closing);
            void server.refetch();
          }}
        />
      ) : null}
      {known !== undefined && status !== 'OPEN' ? (
        <Closing
          shift={known}
          isCashier={isCashier}
          onApproved={async (signedOff) => {
            onSignedOff(signedOff);
            await getTill().endShift();
          }}
        />
      ) : null}
    </div>
  );
}

/** A write that failed, said on the page after its dialog is closed, with its reference. */
function StillRefused({ title, error }: { title: string; error: FailureLike | null }) {
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

function Report({ shiftId, kind }: { shiftId: string; kind: 'X' | 'Z' }) {
  const { t } = useTranslation('posShift');
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
      {kind === 'X' ? <p className="text-sm text-fg-muted">{t('report.xBlind')}</p> : null}
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
  const { t } = useTranslation('posShift');
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
      {/* 2.6.0: drops taken while no supervisor was signed in, which reach the exception report. */}
      <Pair
        term={t('report.unwitnessed', { count: report.unwitnessedDropsCount })}
        pesewas={report.unwitnessedDropsPesewas}
      />
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
  onClosed: (shift: Shift) => void;
}) {
  const { t } = useTranslation('posShift');
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
      {!confirming ? <StillRefused title={t('closeShift.failed')} error={close.error} /> : null}
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
            .then((closing) => {
              setConfirming(false);
              onClosed(closing);
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
  onApproved: (shift: Shift) => Promise<void>;
}) {
  const { t } = useTranslation('posShift');
  const auth = useAuth();
  const approve = useApiMutation('approveShiftClose', { invalidates: ['getShift', 'listShifts'] });
  const stepUp = useStepUp();
  const keyFor = useIntentKey();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const mayApprove =
    auth.can('pos.shift.close.approve') && !isCashier && shift.status === 'CLOSING';
  const refused = shownFailure(approve.error);
  return (
    <section
      aria-labelledby="closing-title"
      className="grid gap-3 rounded-lg border-2 border-border-strong bg-surface p-4"
    >
      <h3 id="closing-title" className="text-lg font-semibold">
        {shift.status === 'CLOSED' ? t('closing.closed') : t('closing.title')}
      </h3>
      <Counted shift={shift} />
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
            <p className="text-sm text-fg-muted">{t('closing.stepUp')}</p>
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
            {!confirming ? <StillRefused title={t('closing.failed')} error={refused} /> : null}
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t('closing.confirmTitle')}
              body={t('closing.confirmBody', { name: shift.cashier.displayName })}
              confirmLabel={t('closing.approve')}
              pendingLabel={t('closing.approving')}
              pending={approve.isPending}
              error={refused}
              failedTitle={t('closing.failed')}
              onConfirm={() => {
                const body = { reason: reason.trim() };
                void stepUp
                  .run(() =>
                    approve.mutateAsync(
                      { path: { id: shift.id }, body },
                      { idempotencyKey: keyFor({ shift: shift.id, ...body }) },
                    ),
                  )
                  .then(async (signedOff) => {
                    if (signedOff === null) return;
                    setConfirming(false);
                    await onApproved(signedOff);
                  })
                  .catch(() => undefined);
              }}
            />
            {stepUp.dialog}
          </>
        ) : (
          <p>{t('closing.needsSupervisor')}</p>
        )
      ) : null}
    </section>
  );
}

/** Each tender as declared against what was expected, and the shift's over or short, from the API. */
function Counted({ shift }: { shift: Shift }) {
  const { t } = useTranslation('posShift');
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shift.tenders.map((tender) => (
          <TenderCount key={tender.paymentMethod.id} tender={tender} />
        ))}
      </ul>
      {shift.overShortDirection !== null && shift.overShortPesewas !== null ? (
        <p className="text-lg font-semibold" data-slot="over-short">
          {t(`closing.direction.${shift.overShortDirection}`)}{' '}
          <MoneyDisplay pesewas={shift.overShortPesewas} />
        </p>
      ) : null}
    </>
  );
}

/** The shift as signed off: who signed it, the count, and the stored Z report. The till is free again. */
function ClosedShift({ shift }: { shift: Shift }) {
  const { t } = useTranslation(['posShift', 'pos']);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="closed-title" className="grid gap-3">
        <h2 id="closed-title" className="text-2xl font-bold">
          {shift.shiftNo !== null
            ? t('closing.closedNo', { number: shift.shiftNo })
            : t('closing.closed')}
        </h2>
        <Alert
          severity="good"
          title={
            shift.closeApprovedBy !== null
              ? t('closing.signedOffBy', { name: shift.closeApprovedBy.displayName })
              : t('closing.closed')
          }
        >
          {t('closing.tillFree')}
        </Alert>
        <Counted shift={shift} />
      </section>
      <Report shiftId={shift.id} kind="Z" />
      <div>
        <Button asChild size="lg">
          <Link to="/pos">{t('pos:toSale')}</Link>
        </Button>
      </div>
    </div>
  );
}

function TenderCount({ tender }: { tender: Shift['tenders'][number] }) {
  const { t } = useTranslation('posShift');
  return (
    <li className="rounded-md border border-border p-3">
      <p className="font-semibold">{tender.paymentMethod.name}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt>{t('closing.declared')}</dt>
        <dd className="text-end">
          <MoneyDisplay pesewas={tender.declaredPesewas} />
        </dd>
        <dt>{t('closing.expected')}</dt>
        <dd className="text-end">
          {tender.expectedPesewas === null ? (
            t('closing.hidden')
          ) : (
            <MoneyDisplay pesewas={tender.expectedPesewas} />
          )}
        </dd>
        <dt>{t('closing.variance')}</dt>
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
      </dl>
    </li>
  );
}
