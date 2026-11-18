/**
 * The driver's screens, on a phone (F11, ADR 0055): the run's stops in order, each customer's address and
 * phone, proof of delivery with the cash the customer paid, a failed attempt with its reason, and the cash
 * the driver carries. Every screen reads the run this phone keeps (`useDriverRun`), so a run goes on with
 * no signal; what the driver records is kept here first and sent when the signal returns, exactly once.
 *
 * One module, loaded on demand when `/driver` first opens: every driver screen arrives with the run, so
 * each opens later with no signal.
 */
import {
  Banknote,
  CircleCheck,
  CircleX,
  Clock,
  CloudOff,
  CloudUpload,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Truck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogActions,
  EmptyState,
  ErrorState,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  PhotoInput,
  QuantityDisplay,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  StatusBadge,
  formatDateTime,
  formatMoney,
  type PhotoValue,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { consoleApi } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useReferenceCopy } from '../lib/RequestReference';
import { PermissionGate } from '../routing/gates';
import { OfflineIndicator } from '../shells/OfflineIndicator';
import { asPlaces, isExactlyOne } from '../stock/units';
import {
  AlreadyRecorded,
  browserDriverStore,
  configureDriverRun,
  getDriverRun,
  useDriverRun,
  type DriverRun,
  type Position,
} from './offline/run';
import { isPending, pendingCount } from './offline/sync';
import { toAccuracyMetres, toCoordinate } from './position';
import type { Delivery, DriverEntry, DriverRecords, ProofEntry, UnitName } from './offline/types';

/** The one run of this document, made when the driver's frame first opens. */
function ensureRun(): DriverRun {
  return (
    getDriverRun() ?? configureDriverRun({ store: browserDriverStore(), call: consoleApi.call })
  );
}

/**
 * The run and its state. The run is made before the first read, so every screen subscribes to it from
 * its first render; the frame starts it.
 */
function useRun() {
  const run = ensureRun();
  const state = useDriverRun();
  return { state, run };
}

/** "4 crates", "1 egg": the unit's own words, kept on the phone with the run. */
function unitWords(units: readonly UnitName[]) {
  const byCode = new Map(units.map((u) => [u.code, u]));
  return {
    places: (code: string) => asPlaces(byCode.get(code)?.displayDecimals),
    after: (code: string, quantity: string) => {
      const unit = byCode.get(code);
      if (unit === undefined) return code;
      return isExactlyOne(quantity) ? unit.singularName : unit.pluralName;
    },
  };
}

/** The phone's position for the proof, if it gives one within a few seconds. Never required. */
function readPosition(): Promise<Position | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator))
    return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const latitude = toCoordinate(p.coords.latitude);
        const longitude = toCoordinate(p.coords.longitude);
        resolve(
          latitude === null || longitude === null
            ? null
            : { latitude, longitude, accuracyM: toAccuracyMetres(p.coords.accuracy) },
        );
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

// ─── The frame ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * The driver's frame: full screen, no sidebar, large touch targets, light by default (daylight on a
 * phone screen, as at the till, A-F0-03). It says whether there is signal and what waits to be sent.
 */
export function DriverShell() {
  const { t } = useTranslation(['driver', 'shell']);
  const auth = useAuth();
  const navigate = useNavigate();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const { state, run } = useRun();
  const waiting = state.snapshot === null ? 0 : pendingCount(state.snapshot.entries);

  useEffect(() => {
    void run.start().then(() => {
      if (run.getState().sync.blocked !== null) run.resume();
    });
    const online = () => run.online();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [run]);

  const signOut = async () => {
    setSignOutOpen(false);
    // The queue stays on the phone and is sent when a driver signs in again.
    await auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div data-shell="driver" className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <p className="text-xl font-semibold">{t('frame.title')}</p>
        <OfflineIndicator />
        <span role="status" data-slot="driver-queue">
          {waiting === 0 ? (
            <StatusBadge tone="good" icon={CloudUpload} label={t('frame.allSent')} />
          ) : (
            <StatusBadge
              tone="warning"
              icon={CloudUpload}
              label={t('frame.waiting', { count: waiting })}
            />
          )}
        </span>
        <div className="ms-auto">
          <Dialog
            open={signOutOpen}
            onOpenChange={setSignOutOpen}
            title={t('frame.signOutTitle')}
            description={
              waiting > 0 ? t('frame.signOutWaiting', { count: waiting }) : t('frame.signOutBody')
            }
            closeLabel={t('frame.cancel')}
            icon={LogOut}
            iconTone="critical"
            trigger={
              <Button variant="secondary" size="lg">
                <LogOut aria-hidden="true" />
                {t('frame.signOut')}
              </Button>
            }
            footer={
              <DialogActions cancelLabel={t('frame.cancel')} onCancel={() => setSignOutOpen(false)}>
                <Button variant="danger" onClick={() => void signOut()}>
                  <LogOut aria-hidden="true" />
                  {t('frame.signOutConfirm')}
                </Button>
              </DialogActions>
            }
          />
        </div>
      </header>
      <nav
        aria-label={t('frame.navLabel')}
        className="flex flex-wrap gap-2 border-b border-border bg-surface px-4 py-2"
      >
        {(
          [
            ['/driver', 'frame.nav.run'],
            ['/driver/cash', 'frame.nav.cash'],
          ] as const
        ).map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end
            className="rounded-md px-3 py-2 font-semibold text-fg hover:bg-surface-hover aria-[current=page]:bg-accent-subtle aria-[current=page]:underline"
          >
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <SyncState />
      <main id="main" className="grid min-w-0 flex-1 content-start gap-4 p-4">
        <PermissionGate>
          <Outlet />
        </PermissionGate>
      </main>
    </div>
  );
}

/** What the queue is doing, in words that stay: no signal, a session that ended, a store that failed. */
function SyncState() {
  const { t } = useTranslation('driver');
  const { state, run } = useRun();
  const waiting = state.snapshot === null ? 0 : pendingCount(state.snapshot.entries);
  if (state.storeError !== null) {
    return (
      <div className="px-4 pt-3">
        <Alert severity="critical" title={t('sync.storeError')}>
          {state.storeError}
        </Alert>
      </div>
    );
  }
  if (state.sync.blocked !== null) {
    return (
      <div className="px-4 pt-3" data-slot="driver-blocked">
        <Alert
          severity="warning"
          title={t('sync.blocked', { count: waiting })}
          actions={
            <Button asChild variant="secondary">
              <Link to="/login?next=%2Fdriver">{t('sync.signIn')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (waiting > 0 && state.sync.unreachable) {
    return (
      <div className="px-4 pt-3" data-slot="driver-unreachable">
        <Alert
          severity="warning"
          title={t('sync.noSignal', { count: waiting })}
          actions={
            <Button variant="secondary" onClick={() => run.online()}>
              <CloudUpload aria-hidden="true" />
              {t('sync.tryNow')}
            </Button>
          }
        >
          {state.sync.nextAttemptAt === null
            ? null
            : t('sync.nextTry', { when: formatDateTime(state.sync.nextAttemptAt) })}
        </Alert>
      </div>
    );
  }
  return null;
}

// ─── The run ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The four states of a screen that reads the kept run: loading until the first read, the error or denial
 * when nothing was ever kept, and otherwise the kept run, with words when it could not be read again.
 */
function KeptRun({ children }: { children: (records: DriverRecords) => ReactNode }) {
  const { t } = useTranslation(['driver', 'common', 'shell']);
  const referenceCopy = useReferenceCopy();
  const { state, run } = useRun();
  const records = state.snapshot?.records ?? null;
  const read = state.read;
  if (records === null || (records.readAt === null && read.kind !== 'failed')) {
    return <Skeleton label={t('run.loading')} shape="block" className="h-48" />;
  }
  if (records.readAt === null && read.kind === 'failed') {
    if (read.error.status === 403) {
      return (
        <ErrorState
          icon={Lock}
          title={t('run.denied')}
          description={t('common:states.deniedBody')}
        />
      );
    }
    const description = read.error.status === 0 ? t('run.errorOffline') : read.error.message;
    const action = <Button onClick={() => void run.refresh()}>{t('common:states.retry')}</Button>;
    return read.error.correlationId === '' ? (
      <ErrorState title={t('run.error')} description={description} action={action} />
    ) : (
      <ErrorState
        title={t('run.error')}
        description={description}
        reference={read.error.correlationId}
        referenceLabel={t('common:states.reference')}
        referenceCopy={referenceCopy}
        action={action}
      />
    );
  }
  return (
    <>
      {read.kind === 'failed' ? (
        <p role="status" data-slot="kept-copy" className="text-control-sm text-fg-muted">
          {t('run.kept', { when: formatDateTime(records.readAt) })}
        </p>
      ) : null}
      {children(records)}
    </>
  );
}

/** How a stop stands: the record on this phone first, then what the server last said. */
function useStopWords() {
  const { t } = useTranslation('driver');
  return (serverStatus: string, entries: readonly DriverEntry[]) => {
    const closing = entries.filter((e) => e.kind !== 'ON_THE_WAY' && e.localStatus !== 'REJECTED');
    const last = closing.at(-1);
    const refused = entries.filter((e) => e.kind !== 'ON_THE_WAY' && e.localStatus === 'REJECTED');
    if (last !== undefined) {
      const sent = last.localStatus === 'APPLIED';
      if (last.kind === 'PROOF') {
        return sent
          ? { tone: 'good' as const, icon: CircleCheck, label: t('status.deliveredSent') }
          : { tone: 'warning' as const, icon: CloudOff, label: t('status.deliveredWaiting') };
      }
      return sent
        ? { tone: 'critical' as const, icon: CircleX, label: t('status.failedSent') }
        : { tone: 'warning' as const, icon: CloudOff, label: t('status.failedWaiting') };
    }
    if (refused.length > 0) {
      return { tone: 'critical' as const, icon: TriangleAlert, label: t('status.refused') };
    }
    const onTheWay = entries.some((e) => e.kind === 'ON_THE_WAY');
    if (onTheWay && serverStatus !== 'DELIVERED' && serverStatus !== 'FAILED') {
      return { tone: 'info' as const, icon: Truck, label: t('status.OUT_FOR_DELIVERY') };
    }
    const tone =
      serverStatus === 'DELIVERED'
        ? ('good' as const)
        : serverStatus === 'FAILED' || serverStatus === 'RETURNED' || serverStatus === 'CANCELLED'
          ? ('critical' as const)
          : ('info' as const);
    return {
      tone,
      icon: serverStatus === 'DELIVERED' ? CircleCheck : Clock,
      label: t(`status.${serverStatus}`, { defaultValue: serverStatus }),
    };
  };
}

/** Today's run: each stop in the order to visit, with its slot, area, cash to collect and state. */
export function DriverRunScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { state } = useRun();
  const words = useStopWords();
  const entries = state.snapshot?.entries ?? [];
  return (
    <section aria-labelledby="run-title" className="grid gap-4">
      <h1 id="run-title" className="text-2xl font-semibold">
        {t('run.title')}
      </h1>
      <KeptRun>
        {(records) => {
          const route = records.route;
          if (route === null || route.stops.length === 0) {
            return <EmptyState title={t('run.empty')} description={t('run.emptyBody')} />;
          }
          const stops = [...route.stops].sort((a, b) => a.stopNo - b.stopNo);
          return (
            <>
              <p className="text-fg-muted">
                {t('run.summary', {
                  date: route.routeDate,
                  vehicle: route.vehicle.name,
                  count: stops.length,
                })}
              </p>
              <p>
                {t('run.cashDue')} <MoneyDisplay pesewas={route.codDueTotalPesewas} strong />
              </p>
              <ol className="grid gap-3" aria-label={t('run.stops')}>
                {stops.map((stop) => {
                  const d = stop.delivery;
                  const mine = entries.filter((e) => e.deliveryId === d.id);
                  const status = words(d.status, mine);
                  return (
                    <li key={d.id}>
                      <Card>
                        <CardBody className="grid gap-2">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {t('run.stopNo', { number: stop.stopNo })}
                            </span>
                            <Link
                              to={`/driver/stops/${d.id}`}
                              className="text-lg font-semibold text-accent-text underline"
                            >
                              {d.recipientName}
                            </Link>
                          </p>
                          <p className="text-fg-muted">
                            {t('run.areaSlot', {
                              area: d.area,
                              from: d.slotStartsAt,
                              to: d.slotEndsAt,
                            })}
                          </p>
                          <p>
                            {d.codDuePesewas === 0 ? (
                              t('run.nothingToCollect')
                            ) : (
                              <>
                                {t('run.collect')} <MoneyDisplay pesewas={d.codDuePesewas} />
                              </>
                            )}
                          </p>
                          <StatusBadge tone={status.tone} icon={status.icon} label={status.label} />
                        </CardBody>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </>
          );
        }}
      </KeptRun>
    </section>
  );
}

// ─── One stop ───────────────────────────────────────────────────────────────────────────────────────────

function useStop(id: string): { delivery: Delivery | null; entries: DriverEntry[] } {
  const { state } = useRun();
  const delivery = state.snapshot?.records.deliveries[id] ?? null;
  const entries = (state.snapshot?.entries ?? []).filter((e) => e.deliveryId === id);
  return { delivery, entries };
}

/** A stop not on this phone's run (an old link, another driver's stop). */
function StopNotFound() {
  const { t } = useTranslation(['driver', 'common']);
  return (
    <EmptyState
      title={t('stop.notFound')}
      description={t('stop.notFoundBody')}
      action={
        <Link to="/driver" className="text-accent-text underline">
          {t('stop.back')}
        </Link>
      }
    />
  );
}

/** What this phone recorded for the stop, and what the server said about it, in words that stay. */
function RecordState({
  entry,
  delivery,
  reasonName,
}: {
  entry: DriverEntry;
  delivery: Delivery;
  reasonName: (code: string) => string;
}) {
  const { t } = useTranslation('driver');
  if (entry.kind === 'ON_THE_WAY') return null;
  const waiting = isPending(entry);
  const what =
    entry.kind === 'PROOF'
      ? t('record.proof', {
          name: entry.payload.recipientName,
          when: formatDateTime(entry.payload.capturedAt),
          cash: formatMoney(entry.payload.codCollectedPesewas),
        })
      : t('record.failure', {
          reason: reasonName(entry.payload.failureReasonCode),
          when: formatDateTime(entry.payload.occurredAt),
        });
  if (entry.localStatus === 'REJECTED') {
    return (
      <Alert severity="critical" title={t('record.rejected')}>
        <p>{what}</p>
        <p>{entry.failure?.message ?? ''}</p>
        <p>{t('record.rejectedNext')}</p>
      </Alert>
    );
  }
  return (
    <Alert
      severity={waiting ? 'warning' : 'good'}
      title={waiting ? t('record.waiting') : t('record.sent')}
    >
      <p>{what}</p>
      {entry.kind === 'PROOF' && entry.payload.codCollectedPesewas !== delivery.codDuePesewas ? (
        <p>{t('record.cashDiffers', { due: formatMoney(delivery.codDuePesewas) })}</p>
      ) : null}
      {entry.serverReason !== null && entry.serverOutcome === 'APPLIED_WITH_EXCEPTION' ? (
        <p>{t('record.exception', { reason: entry.serverReason })}</p>
      ) : null}
    </Alert>
  );
}

/** One stop: who, where, how to call them, what goes, the cash to collect, and what to record. */
export function DriverStopScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { id = '' } = useParams();
  const { run } = useRun();
  const { delivery, entries } = useStop(id);
  const [onTheWayFailed, setOnTheWayFailed] = useState(false);
  return (
    <KeptRun>
      {(records) => {
        if (delivery === null) return <StopNotFound />;
        const units = unitWords(records.units);
        const closing = entries.filter(
          (e) => e.kind !== 'ON_THE_WAY' && e.localStatus !== 'REJECTED',
        );
        const done =
          closing.length > 0 ||
          ['DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'].includes(delivery.status);
        const onTheWay =
          entries.some((e) => e.kind === 'ON_THE_WAY') || delivery.status === 'OUT_FOR_DELIVERY';
        const a = delivery.address;
        const position =
          delivery.latitude === null || delivery.longitude === null
            ? null
            : `${delivery.latitude},${delivery.longitude}`;
        return (
          <article aria-labelledby="stop-title" className="grid gap-4">
            <Link to="/driver" className="text-accent-text underline">
              {t('stop.back')}
            </Link>
            <h1 id="stop-title" className="text-2xl font-semibold">
              {delivery.recipientName}
            </h1>
            {entries.map((entry) => (
              <RecordState
                key={entry.id}
                entry={entry}
                delivery={delivery}
                reasonName={(code) =>
                  records.reasons.find((r) => r.code === code)?.description ?? code
                }
              />
            ))}
            <Card>
              <CardBody className="grid gap-3">
                <p className="text-lg">
                  {t('stop.collect')} <MoneyDisplay pesewas={delivery.codDuePesewas} strong />
                </p>
                <Button asChild size="lg" variant="secondary">
                  <a href={`tel:${delivery.recipientPhone}`}>
                    <Phone aria-hidden="true" />
                    {t('stop.call', { phone: delivery.recipientPhone })}
                  </a>
                </Button>
                <address className="grid gap-1 not-italic">
                  <span>{a.line1}</span>
                  <span>{`${a.area}, ${a.city}`}</span>
                  {a.digitalAddress === null ? null : (
                    <span>{t('stop.digitalAddress', { code: a.digitalAddress })}</span>
                  )}
                  {a.directions === null ? null : (
                    <span>{t('stop.directions', { directions: a.directions })}</span>
                  )}
                </address>
                {position === null ? null : (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${position}`}
                    className="flex items-center gap-2 text-accent-text underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin aria-hidden="true" />
                    {t('stop.map')}
                  </a>
                )}
                {delivery.slot === null ? null : (
                  <p>
                    {t('stop.slot', { from: delivery.slot.startsAt, to: delivery.slot.endsAt })}
                  </p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle asChild>
                  <h2>{t('stop.contents')}</h2>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="grid gap-1">
                  {delivery.contents.map((line, index) => (
                    <li key={`${line.name}-${index}`} className="flex flex-wrap gap-2">
                      <QuantityDisplay
                        quantity={line.quantity}
                        unit={units.after(line.uom, line.quantity)}
                        places={units.places(line.uom)}
                        strong
                      />
                      <span>{line.name}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            {done ? null : (
              <div className="grid gap-3">
                {onTheWay ? null : (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      setOnTheWayFailed(false);
                      run.markOnTheWay(delivery.id).catch(() => setOnTheWayFailed(true));
                    }}
                  >
                    <Truck aria-hidden="true" />
                    {t('stop.onTheWay')}
                  </Button>
                )}
                {onTheWayFailed ? (
                  <p role="alert" className="text-critical-fg">
                    {t('stop.notKept')}
                  </p>
                ) : null}
                <Button asChild size="lg">
                  <Link to={`/driver/stops/${delivery.id}/delivered`}>
                    <CircleCheck aria-hidden="true" />
                    {t('stop.delivered')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to={`/driver/stops/${delivery.id}/not-delivered`}>
                    <CircleX aria-hidden="true" />
                    {t('stop.notDelivered')}
                  </Link>
                </Button>
                <p className="text-control-sm text-fg-muted" data-slot="part-delivery">
                  {t('stop.partDelivery')}
                </p>
              </div>
            )}
          </article>
        );
      }}
    </KeptRun>
  );
}

// ─── Proof of delivery ──────────────────────────────────────────────────────────────────────────────────

/**
 * Proof of delivery: who took it, a photograph, and the cash the customer paid, confirmed with the exact
 * amounts first. Kept on the phone and sent when there is signal. A signature is not asked for: the
 * contract takes a signature or a photograph, and a photograph needs no new component (A-F11-03).
 */
export function DriverProofScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { run } = useRun();
  const { delivery, entries } = useStop(id);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [photoFailure, setPhotoFailure] = useState<string | null>(null);

  return (
    <KeptRun>
      {() => {
        if (delivery === null) return <StopNotFound />;
        const due = delivery.codDuePesewas;
        const collects = due > 0;
        const closed = entries.some((e) => e.kind !== 'ON_THE_WAY' && e.localStatus !== 'REJECTED');
        if (closed) {
          return (
            <Alert severity="info" title={t('proof.already')}>
              <Link to={`/driver/stops/${id}`} className="text-accent-text underline">
                {t('stop.backToStop')}
              </Link>
            </Alert>
          );
        }
        const nameError = tried && name.trim() === '' ? t('proof.nameMissing') : undefined;
        const photoError =
          photoFailure ?? (tried && photo === null ? t('proof.photoMissing') : undefined);
        const cashError = tried && collects && cash === null ? t('proof.cashMissing') : undefined;
        const open = async () => {
          setTried(true);
          if (name.trim() === '' || photo === null || (collects && cash === null)) return;
          setPosition(await readPosition());
          setFailure(null);
          setConfirming(true);
        };
        const received = collects ? (cash ?? 0) : 0;
        const confirm = async () => {
          if (photo === null) return;
          setSaving(true);
          try {
            await run.recordProof({
              deliveryId: delivery.id,
              recipientName: name,
              photoLocalId: photo.fileId,
              codCollectedPesewas: received,
              position,
            });
            setConfirming(false);
            navigate(`/driver/stops/${delivery.id}`);
          } catch (error) {
            setFailure(error instanceof AlreadyRecorded ? t('proof.already') : t('proof.notKept'));
          } finally {
            setSaving(false);
          }
        };
        return (
          <section aria-labelledby="proof-title" className="grid gap-4">
            <Link to={`/driver/stops/${id}`} className="text-accent-text underline">
              {t('stop.backToStop')}
            </Link>
            <h1 id="proof-title" className="text-2xl font-semibold">
              {t('proof.title', { name: delivery.recipientName })}
            </h1>
            <p>
              {collects ? (
                <>
                  {t('stop.collect')} <MoneyDisplay pesewas={due} strong />
                </>
              ) : (
                t('run.nothingToCollect')
              )}
            </p>
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void open();
              }}
            >
              <Field
                label={t('proof.name')}
                hint={t('proof.nameHint')}
                error={nameError}
                required
                requiredLabel={t('common:field.required')}
              >
                <Input
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field
                label={t('proof.photo')}
                hint={t('proof.photoHint')}
                error={photoError}
                required
                requiredLabel={t('common:field.required')}
              >
                <PhotoInput
                  value={photo}
                  onChange={(next) => {
                    setPhotoFailure(null);
                    setPhoto(next);
                  }}
                  upload={(file) => run.keepPhoto(file)}
                  onUploadError={() => setPhotoFailure(t('proof.photoNotKept'))}
                  capture="environment"
                  chooseLabel={t('common:photo.choose')}
                  replaceLabel={t('common:photo.replace')}
                  removeLabel={t('common:photo.remove')}
                  busyLabel={t('proof.photoKeeping')}
                  previewAlt={t('common:photo.preview')}
                />
              </Field>
              {collects ? (
                <Field
                  label={t('proof.cash')}
                  hint={t('proof.cashHint', { due: formatMoney(due) })}
                  error={cashError}
                  required
                  requiredLabel={t('common:field.required')}
                >
                  <MoneyInput value={cash} onValueChange={setCash} />
                </Field>
              ) : null}
              <Button type="submit" size="lg">
                <CircleCheck aria-hidden="true" />
                {t('proof.review')}
              </Button>
            </form>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t('proof.confirmTitle')}
              body={t('proof.confirmBody', { name: name.trim() })}
              consequence={t('proof.consequence')}
              confirmLabel={t('proof.confirm')}
              pendingLabel={t('proof.saving')}
              pending={saving}
              onConfirm={() => void confirm()}
              error={null}
              failedTitle={t('proof.notKept')}
              icon={Banknote}
            >
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
                <dt>{t('proof.due')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={due} />
                </dd>
                <dt className="font-semibold">{t('proof.received')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={received} strong />
                </dd>
                <dt>{t('proof.where')}</dt>
                <dd className="text-end">
                  {position === null ? t('proof.noPosition') : t('proof.position')}
                </dd>
              </dl>
              {received !== due ? <Alert severity="warning" title={t('proof.differs')} /> : null}
              {failure === null ? null : (
                <p role="alert" className="text-critical-fg">
                  {failure}
                </p>
              )}
            </ConfirmDialog>
          </section>
        );
      }}
    </KeptRun>
  );
}

// ─── A failed attempt ───────────────────────────────────────────────────────────────────────────────────

/**
 * Not delivered: the customer refused it, nobody was in, the address was wrong. The reason is from the
 * server's `DELIVERY_FAILURE` list, kept on the phone; what happens next is the driver's choice of the
 * two the contract offers. Kept and sent when there is signal.
 */
export function DriverFailureScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { run } = useRun();
  const { delivery, entries } = useStop(id);
  const [reason, setReason] = useState('');
  const [next, setNext] = useState<'REATTEMPT' | 'RETURN_TO_STOCK' | ''>('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <KeptRun>
      {(records) => {
        if (delivery === null) return <StopNotFound />;
        const closed = entries.some((e) => e.kind !== 'ON_THE_WAY' && e.localStatus !== 'REJECTED');
        if (closed) {
          return (
            <Alert severity="info" title={t('proof.already')}>
              <Link to={`/driver/stops/${id}`} className="text-accent-text underline">
                {t('stop.backToStop')}
              </Link>
            </Alert>
          );
        }
        const reasons = records.reasons;
        const chosen = reasons.find((r) => r.code === reason);
        const open = async () => {
          setTried(true);
          if (reason === '' || next === '') return;
          setPosition(await readPosition());
          setFailure(null);
          setConfirming(true);
        };
        const confirm = async () => {
          if (next === '') return;
          setSaving(true);
          try {
            await run.recordFailure({
              deliveryId: delivery.id,
              failureReasonCode: reason,
              nextAction: next,
              position,
            });
            setConfirming(false);
            navigate(`/driver/stops/${delivery.id}`);
          } catch (error) {
            setFailure(
              error instanceof AlreadyRecorded ? t('proof.already') : t('failure.notKept'),
            );
          } finally {
            setSaving(false);
          }
        };
        return (
          <section aria-labelledby="failure-title" className="grid gap-4">
            <Link to={`/driver/stops/${id}`} className="text-accent-text underline">
              {t('stop.backToStop')}
            </Link>
            <h1 id="failure-title" className="text-2xl font-semibold">
              {t('failure.title', { name: delivery.recipientName })}
            </h1>
            {reasons.length === 0 ? (
              <Alert severity="warning" title={t('failure.noReasons')} />
            ) : null}
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void open();
              }}
            >
              <Field
                label={t('failure.reason')}
                error={tried && reason === '' ? t('failure.reasonMissing') : undefined}
                required
                requiredLabel={t('common:field.required')}
              >
                <Select
                  value={reason}
                  onValueChange={setReason}
                  placeholder={t('failure.choose')}
                  options={reasons.map((r) => ({ value: r.code, label: r.description }))}
                />
              </Field>
              <fieldset className="grid gap-2">
                <legend id="failure-next" className="font-semibold">
                  {t('failure.next')}
                </legend>
                <RadioGroup
                  aria-labelledby="failure-next"
                  value={next}
                  onValueChange={(value) =>
                    setNext(value === 'RETURN_TO_STOCK' ? 'RETURN_TO_STOCK' : 'REATTEMPT')
                  }
                >
                  <Radio value="REATTEMPT" label={t('failure.reattempt')} />
                  <Radio value="RETURN_TO_STOCK" label={t('failure.returnToStock')} />
                </RadioGroup>
                {tried && next === '' ? (
                  <p role="alert" className="text-critical-fg">
                    {t('failure.nextMissing')}
                  </p>
                ) : null}
              </fieldset>
              <Button type="submit" size="lg">
                <CircleX aria-hidden="true" />
                {t('failure.review')}
              </Button>
            </form>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={t('failure.confirmTitle')}
              body={t('failure.confirmBody', {
                name: delivery.recipientName,
                reason: chosen?.description ?? reason,
              })}
              consequence={
                next === 'RETURN_TO_STOCK' ? t('failure.returnBody') : t('failure.reattemptBody')
              }
              confirmLabel={t('failure.confirm')}
              pendingLabel={t('proof.saving')}
              pending={saving}
              onConfirm={() => void confirm()}
              error={null}
              failedTitle={t('failure.notKept')}
              destructive
            >
              {failure === null ? null : (
                <p role="alert" className="text-critical-fg">
                  {failure}
                </p>
              )}
            </ConfirmDialog>
          </section>
        );
      }}
    </KeptRun>
  );
}

// ─── The cash the driver carries ────────────────────────────────────────────────────────────────────────

/**
 * What the driver carries: the server's figure for today, and each collection recorded on this phone that
 * the server has not counted yet, shown one by one (never added to its figure here). The cash is handed in
 * at a till shift, where a cashier counts it into the drawer; it is never typed in as loose cash.
 */
export function DriverCashScreen() {
  const { t } = useTranslation(['driver', 'common']);
  const { state } = useRun();
  const entries = state.snapshot?.entries ?? [];
  const unsent = entries.filter(
    (e): e is ProofEntry => e.kind === 'PROOF' && isPending(e) && e.payload.codCollectedPesewas > 0,
  );
  return (
    <section aria-labelledby="cash-title" className="grid gap-4">
      <h1 id="cash-title" className="text-2xl font-semibold">
        {t('cash.title')}
      </h1>
      <KeptRun>
        {(records) => {
          const cash = records.cash;
          return (
            <>
              <Card>
                <CardBody className="grid gap-2">
                  {cash === null ? (
                    <p>{t('cash.notRead')}</p>
                  ) : (
                    <>
                      <p className="text-lg">
                        {t('cash.carrying')} <MoneyDisplay pesewas={cash.expectedPesewas} strong />
                      </p>
                      <p className="text-control-sm text-fg-muted">
                        {t('cash.asOf', { date: cash.date, when: formatDateTime(records.readAt) })}
                      </p>
                      {cash.reconciled ? <p>{t('cash.reconciled')}</p> : null}
                    </>
                  )}
                </CardBody>
              </Card>
              <Alert severity="info" title={t('cash.handIn')}>
                {t('cash.handInBody')}
              </Alert>
              {unsent.length === 0 ? null : (
                <Card>
                  <CardHeader>
                    <CardTitle asChild>
                      <h2>{t('cash.unsentTitle')}</h2>
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="grid gap-2">
                    <p className="text-fg-muted">{t('cash.unsentBody')}</p>
                    <ul className="grid gap-1" aria-label={t('cash.unsentTitle')}>
                      {unsent.map((e) => (
                        <li key={e.id} className="flex flex-wrap justify-between gap-2">
                          <span>{records.deliveries[e.deliveryId]?.recipientName ?? ''}</span>
                          <MoneyDisplay pesewas={e.payload.codCollectedPesewas} />
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}
              {cash === null || cash.collections.length === 0 ? null : (
                <Card>
                  <CardHeader>
                    <CardTitle asChild>
                      <h2>{t('cash.countedTitle')}</h2>
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <ul className="grid gap-1" aria-label={t('cash.countedTitle')}>
                      {cash.collections.map((c, index) => (
                        <li
                          key={`${c.deliveryNo ?? ''}-${index}`}
                          className="flex flex-wrap justify-between gap-2"
                        >
                          <span>{c.recipientName}</span>
                          <MoneyDisplay pesewas={c.amountPesewas} />
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}
            </>
          );
        }}
      </KeptRun>
    </section>
  );
}
