/**
 * F11: picking. The pick lists waiting, and one pick list: crates and eggs picked against the order in the
 * order's own units, eggs found cracked written off with their reason, a line short or substituted only
 * once the customer agrees (as the server allows: a smaller quantity or a substitute is proposed, and the
 * order waits for the answer), then packed, and dispatched onto a van or handed over for collection. Every
 * amount and the cash to collect come from the API. The Storekeeper reads the order through the store's
 * own view (2.29.0), which carries no money, so the pick screen shows none to them.
 */
import { PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FilterMenu,
  IconChip,
  Input,
  MutationFailure,
  NOT_APPLICABLE,
  QuantityDisplay,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
  WeightDisplay,
  WeightInput,
  formatDateTime,
  formatQuantity,
  useTableView,
  type FailureLike,
  type QueryLike,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { newRecordId } from '../lib/clientId';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey, uniqueById } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet } from '../stock/filters';
import { ProductPicker, type ProductRef as PickedProduct } from '../stock/LinesEditor';
import { compareQuantity, gapBetween, toQuantity, useUnits } from '../stock/units';
import {
  FULFILMENT_STATUSES,
  FulfilmentStatusBadge,
  OrderTotals,
  type Fulfilment,
  type Order,
  type OrderView,
  type PickOrder,
} from './presentation';
import { canProposeShort, checkShortPick, orderReadFor } from './pickRules';

type S = components['schemas'];
type PickListLine = S['PickListLine'];
/** What the pick screen reads of an order line, the same in the whole order and the store's view. */
type PickOrderLine = Pick<
  OrderView['lines'][number],
  'id' | 'qtyOrdered' | 'qtyFulfilled' | 'uom' | 'lineStatus'
>;
type ShortPickInput = { path: { id: string }; body: S['ShortPickCreate'] };
type Units = ReturnType<typeof useUnits>;

/** The pick lists, oldest first as the API gives them, by status and pick location. */
export function FulfilmentsScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const pages = useCursorPages();
  const [status, setStatus] = useState(ANY);
  // 2.25.0 lists the states, so the filter sends only one of them.
  const chosenStatus = FULFILMENT_STATUSES.find((s) => s === status);
  const list = useApiQuery('listFulfilments', {
    query: {
      ...(chosenStatus === undefined ? {} : { status: chosenStatus }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('fulfilments.loading'),
    emptyTitle: t('fulfilments.empty'),
    emptyDescription: t('fulfilments.emptyBody'),
    errorTitle: t('fulfilments.error'),
    deniedTitle: t('fulfilments.denied'),
  });
  const view = useTableView<Fulfilment>([
    {
      id: 'fulfilment',
      rowHeader: true,
      head: t('columns.pickList'),
      sortValue: (f) => f.fulfilmentNo ?? f.id,
      cell: (f) => (
        <span className="flex items-center gap-3">
          <IconChip icon={PackageCheck} tone="info" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/fulfilments/${f.id}`} className="text-accent-text underline">
              {f.fulfilmentNo ?? t('fulfilments.unnumbered')}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {t('fulfilments.forOrder', { order: f.order.number ?? '' })}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (f) => f.status,
      cell: (f) => <FulfilmentStatusBadge kind="fulfilment" status={f.status} />,
    },
    {
      id: 'location',
      head: t('columns.location'),
      sortValue: (f) => f.pickLocation.name,
      cell: (f) => f.pickLocation.name,
    },
    {
      id: 'picker',
      head: t('columns.picker'),
      sortValue: (f) => f.picker?.displayName ?? '',
      cell: (f) => f.picker?.displayName ?? NOT_APPLICABLE,
    },
  ]);
  return (
    <section aria-labelledby="fulfilments-title" className="grid gap-4">
      <PageHeader title={t('fulfilments.title')} titleId="fulfilments-title" />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('fulfilments.title')}
        exportName={t('fulfilments.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('fulfilments.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                pages.reset();
              },
            }}
          >
            <FilterSelect
              anyLabel={t('filters.any')}
              label={t('filters.status')}
              value={status}
              onChange={(value) => {
                setStatus(value);
                pages.reset();
              }}
              options={FULFILMENT_STATUSES.map((s) => ({
                value: s,
                label: t(`status.fulfilment.${s}`),
              }))}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** "2 crates", "30 eggs": a quantity in a line's own unit. */
function InUnit({ quantity, uom, units }: { quantity: string; uom: string; units: Units }) {
  return (
    <QuantityDisplay
      quantity={quantity}
      unit={units.after(uom, quantity)}
      places={units.places(uom)}
    />
  );
}

/** One pick list: what to pick, what was picked, cracked eggs, a substitute, packing and dispatch. */
export function PickScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const units = useUnits();
  const fulfilment = useApiQuery('getFulfilment', { path: { id } });
  const orderId = fulfilment.data?.order.id ?? '';
  const read = orderReadFor(auth.can);
  const full = useApiQuery(
    'getOrder',
    { path: { id: orderId } },
    { enabled: orderId !== '' && read === 'full' },
  );
  // 2.29.0: the Storekeeper, who cannot call getOrder, reads the order it picks through the store's view.
  const store = useApiQuery(
    'getOrderFulfilmentView',
    { path: { id: orderId } },
    { enabled: orderId !== '' && read === 'store' },
  );
  const orderQuery: QueryLike<PickOrder, FailureLike> = read === 'store' ? store : full;
  const order: PickOrder | null = read === 'none' ? null : (orderQuery.data ?? null);
  // Only the whole order carries money; the store's view has none to show.
  const money: Order | null = read === 'full' ? (full.data ?? null) : null;
  const canOpenOrder = auth.can('ord.order.read');
  const labels = useStateLabels({
    loading: t('pick.loading'),
    emptyTitle: t('pick.notFound'),
    errorTitle: t('pick.error'),
    deniedTitle: t('pick.denied'),
  });
  const orderLabels = useStateLabels({
    loading: t('pick.orderLoading'),
    emptyTitle: t('order.notFound'),
    errorTitle: t('pick.orderError'),
    deniedTitle: t('pick.orderDenied'),
    deniedDescription: t('pick.orderDeniedBody'),
  });
  const proposed =
    money?.pendingConsent?.kind === 'SHORT_PICK' ? money.pendingConsent.proposed : null;
  const back = (
    <Link to="/fulfilments" className="text-accent-text underline">
      {t('pick.back')}
    </Link>
  );
  if (fulfilment.error?.status === 404) {
    return (
      <EmptyState
        title={t('pick.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={fulfilment}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(f) => (
        <article aria-labelledby="pick-title" className="grid gap-4">
          {back}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              title={f.fulfilmentNo ?? t('fulfilments.unnumbered')}
              titleId="pick-title"
            />
            <FulfilmentStatusBadge kind="fulfilment" status={f.status} />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {canOpenOrder ? (
              <Link to={`/orders/${f.order.id}/fulfilment`} className="text-accent-text underline">
                {t('pick.order', { order: f.order.number ?? '' })}
              </Link>
            ) : (
              <span>{t('pick.order', { order: f.order.number ?? '' })}</span>
            )}
            <span>{t('pick.from', { location: f.pickLocation.name })}</span>
            {f.picker === null ? null : (
              <span>{t('pick.picker', { name: f.picker.displayName })}</span>
            )}
          </p>
          {order === null ? (
            <QueryBoundary
              query={orderQuery}
              labels={orderLabels}
              denied={read === 'none'}
              isEmpty={() => false}
              loadingFallback={
                <Skeleton label={orderLabels.loading} shape="block" className="h-12" />
              }
            >
              {() => null}
            </QueryBoundary>
          ) : null}
          {f.withinTolerance === false ? (
            <Alert severity="warning" title={t('pick.overTolerance')}>
              <AnswerWhere orderId={f.order.id} canOpenOrder={canOpenOrder} />
            </Alert>
          ) : null}
          {order?.status === 'AWAITING_CUSTOMER' ? (
            <Alert
              severity="warning"
              title={
                proposed === null
                  ? t('pick.awaiting')
                  : t('pick.awaitingShort', {
                      quantity: formatQuantity(proposed.quantity, {
                        places: units.places(proposed.uom),
                      }),
                      unit: units.after(proposed.uom, proposed.quantity),
                      product: proposed.productName,
                    })
              }
            >
              <AnswerWhere orderId={f.order.id} canOpenOrder={canOpenOrder} />
            </Alert>
          ) : null}
          <PickLines fulfilment={f} order={order} canOpenOrder={canOpenOrder} />
          <Picked fulfilment={f} />
          {order === null ? null : <NextStep fulfilment={f} order={order} money={money} />}
        </article>
      )}
    </QueryBoundary>
  );
}

/**
 * Where the customer's answer is recorded: the order's page, for someone who may open it. The Storekeeper
 * cannot (it holds no `ord.order.read`), so it is told who does instead of being sent to a denied page.
 */
function AnswerWhere({ orderId, canOpenOrder }: { orderId: string; canOpenOrder: boolean }) {
  const { t } = useTranslation('fulfilment');
  return canOpenOrder ? (
    <Link to={`/orders/${orderId}/fulfilment`} className="text-accent-text underline">
      {t('pick.recordAnswer')}
    </Link>
  ) : (
    <p>{t('pick.answerElsewhere')}</p>
  );
}

interface LineEntry {
  qty: string;
  weight: string | null;
  stockUnitId: string;
}

/**
 * What to pick, line by line, and the form to record it. A line is picked exactly as the pick list asks:
 * fewer is a short pick and more is not on the order, so either is refused here and the way forward is a
 * substitute or a smaller quantity offered to the customer, which the server holds the order for.
 */
function PickLines({
  fulfilment: f,
  order,
  canOpenOrder,
}: {
  fulfilment: Fulfilment;
  order: PickOrder | null;
  canOpenOrder: boolean;
}) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const auth = useAuth();
  const units = useUnits();
  const keyFor = useIntentKey();
  const shortKeyFor = useIntentKey();
  const record = useApiMutation('recordPicks', {
    invalidates: [
      'getFulfilment',
      'getOrder',
      'getOrderFulfilmentView',
      'listFulfilments',
      'listOrders',
    ],
  });
  const shortPick = useApiMutation('proposeShortPick', {
    invalidates: [
      'getOrder',
      'getOrderFulfilmentView',
      'getFulfilment',
      'listOrders',
      'listFulfilments',
      'listOrderHistory',
    ],
  });
  const shortLabels = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('shortPick.failed'),
    errorTitle: t('shortPick.failed'),
    deniedTitle: t('shortPick.failed'),
  });
  const [entries, setEntries] = useState<Record<string, LineEntry>>({});
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState(false);
  const [picksFor, setPicksFor] = useState<{ ids: Record<string, string>; text: string } | null>(
    null,
  );
  const [cracked, setCracked] = useState<PickListLine | null>(null);
  const [substitute, setSubstitute] = useState<PickListLine | null>(null);
  // The line a short pick was last proposed for: a refusal stays on it once the dialog is closed.
  const [short, setShort] = useState<{ line: PickListLine; open: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const picking =
    (f.status === 'PICK_LIST' || f.status === 'PICKING') && auth.can('ord.fulfilment.pick');
  const orderLines: readonly PickOrderLine[] = order?.lines ?? [];
  const lineOf = (orderLineId: string) => orderLines.find((l) => l.id === orderLineId) ?? null;
  const shortOrderLine = short === null ? null : lineOf(short.line.orderLineId);
  const set = (lineId: string, change: Partial<LineEntry>) =>
    setEntries((all) => ({
      ...all,
      [lineId]: { qty: '', weight: null, stockUnitId: '', ...all[lineId], ...change },
    }));

  /** Each typed line as the contract's `Quantity`, and why it is refused, if it is. */
  const checked = f.pickList.map((line) => {
    const entry = entries[line.orderLineId];
    const typed = entry?.qty.trim() ?? '';
    if (typed === '') return { line, entry, qty: null, error: undefined };
    const qty = toQuantity(typed);
    if (qty === null) return { line, entry, qty: null, error: t('pick.qtyInvalid') };
    const order = compareQuantity(qty, line.qtyToPick);
    if (order < 0) return { line, entry, qty, error: t('pick.short') };
    if (order > 0) return { line, entry, qty, error: t('pick.over') };
    if (line.estimatedWeightKg !== null && (entry?.weight ?? null) === null) {
      return { line, entry, qty, error: undefined, weightError: t('pick.weightMissing') };
    }
    return { line, entry, qty, error: undefined };
  });
  const ready = checked.filter(
    (c) => c.qty !== null && c.error === undefined && !('weightError' in c),
  );
  const blocked = checked.some((c) => c.error !== undefined || 'weightError' in c);

  const openConfirm = () => {
    setTried(true);
    setDone(false);
    if (blocked || ready.length === 0) return;
    const text = JSON.stringify(ready.map((c) => [c.line.orderLineId, c.qty, c.entry?.weight]));
    // One client id per pick, made once for what is being confirmed, so a retry stores each pick once.
    setPicksFor((current) =>
      current?.text === text
        ? current
        : {
            text,
            ids: Object.fromEntries(ready.map((c) => [c.line.orderLineId, newRecordId()])),
          },
    );
    setOpen(true);
  };
  const input =
    picksFor === null
      ? null
      : {
          path: { id: f.id },
          body: {
            picks: ready.map((c) => ({
              id: picksFor.ids[c.line.orderLineId] ?? newRecordId(),
              orderLineId: c.line.orderLineId,
              qty: c.qty ?? '0.000',
              ...(c.entry?.stockUnitId ? { stockUnitId: c.entry.stockUnitId } : {}),
              ...(c.entry?.weight
                ? { weightKg: c.entry.weight, weightSource: 'MANUAL' as const }
                : {}),
            })),
          },
        };

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('pick.toPick')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-4">
        {done ? <Alert severity="good" title={t('pick.recorded')} /> : null}
        {f.pickList.length === 0 ? <p>{t('pick.nothing')}</p> : null}
        <ul className="grid gap-4">
          {checked.map((c) => {
            const { line } = c;
            const orderLine = lineOf(line.orderLineId);
            const unitName = units.many(line.uom);
            return (
              <li key={line.orderLineId} className="grid gap-3 rounded-lg border border-border p-3">
                <p className="font-semibold">{line.product.name}</p>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
                  <dt className="text-fg-muted">{t('pick.toPickLine')}</dt>
                  <dd>
                    <InUnit quantity={line.qtyToPick} uom={line.uom} units={units} />
                  </dd>
                  {orderLine === null ? null : (
                    <>
                      <dt className="text-fg-muted">{t('pick.ordered')}</dt>
                      <dd>
                        <InUnit quantity={orderLine.qtyOrdered} uom={orderLine.uom} units={units} />
                      </dd>
                      <dt className="text-fg-muted">{t('pick.pickedSoFar')}</dt>
                      <dd>
                        <InUnit
                          quantity={orderLine.qtyFulfilled}
                          uom={orderLine.uom}
                          units={units}
                        />
                      </dd>
                    </>
                  )}
                  {line.estimatedWeightKg === null ? null : (
                    <>
                      <dt className="text-fg-muted">{t('pick.estimatedWeight')}</dt>
                      <dd>
                        <WeightDisplay kilograms={line.estimatedWeightKg} />
                      </dd>
                    </>
                  )}
                </dl>
                {picking ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label={t('pick.qty', { unit: unitName })}
                      hint={t('pick.qtyHint', {
                        quantity: formatQuantity(line.qtyToPick, {
                          places: units.places(line.uom),
                        }),
                        unit: units.after(line.uom, line.qtyToPick),
                      })}
                      error={tried ? c.error : undefined}
                    >
                      <Input
                        inputMode="decimal"
                        value={c.entry?.qty ?? ''}
                        onChange={(event) => set(line.orderLineId, { qty: event.target.value })}
                      />
                    </Field>
                    {line.estimatedWeightKg === null ? null : (
                      <Field
                        label={t('pick.weight')}
                        error={tried && 'weightError' in c ? c.weightError : undefined}
                      >
                        <WeightInput
                          value={c.entry?.weight ?? null}
                          onValueChange={(weight) => set(line.orderLineId, { weight })}
                        />
                      </Field>
                    )}
                    {line.suggestedStockUnits.length === 0 ? null : (
                      <Field label={t('pick.lot')} hint={t('pick.lotHint')}>
                        <Select
                          value={c.entry?.stockUnitId ?? ''}
                          onValueChange={(stockUnitId) => set(line.orderLineId, { stockUnitId })}
                          placeholder={t('pick.lotAny')}
                          options={line.suggestedStockUnits.map((u) => ({
                            value: u.id,
                            label: u.identifier,
                          }))}
                        />
                      </Field>
                    )}
                  </div>
                ) : null}
                {picking ? (
                  <div className="flex flex-wrap gap-2">
                    {auth.can('inv.adjustment.create') ? (
                      <Button variant="secondary" onClick={() => setCracked(line)}>
                        {t('cracked.open')}
                      </Button>
                    ) : null}
                    {order !== null &&
                    orderLine !== null &&
                    canProposeShort(order.status, orderLine.lineStatus, line.estimatedWeightKg) ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          shortPick.reset();
                          setShort({ line, open: true });
                        }}
                      >
                        {t('shortPick.open')}
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setSubstitute(line)}>
                      {t('substitute.open')}
                    </Button>
                  </div>
                ) : null}
                {short !== null && !short.open && short.line.orderLineId === line.orderLineId ? (
                  <MutationFailure error={shortPick.error} labels={shortLabels} />
                ) : null}
              </li>
            );
          })}
        </ul>
        {picking && f.pickList.length > 0 ? (
          <div className="grid gap-2">
            {tried && ready.length === 0 && !blocked ? (
              <p role="alert" className="text-critical-fg">
                {t('pick.noneTyped')}
              </p>
            ) : null}
            <div>
              <Button onClick={openConfirm}>
                <PackageCheck aria-hidden="true" />
                {t('pick.record')}
              </Button>
            </div>
          </div>
        ) : null}
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={t('pick.confirmTitle')}
          body={t('pick.confirmBody', { order: f.order.number ?? '' })}
          confirmLabel={t('pick.record')}
          pendingLabel={t('actions.working')}
          pending={record.isPending}
          error={record.error}
          failedTitle={t('pick.failed')}
          onConfirm={() => {
            if (input === null) return;
            record
              .mutateAsync(input, { idempotencyKey: keyFor(input) })
              .then(() => {
                setOpen(false);
                setEntries({});
                setPicksFor(null);
                setTried(false);
                setDone(true);
              })
              .catch(() => undefined);
          }}
        >
          <ul className="grid gap-1">
            {ready.map((c) => (
              <li key={c.line.orderLineId} className="flex flex-wrap gap-2">
                <InUnit quantity={c.qty ?? '0.000'} uom={c.line.uom} units={units} />
                <span>{c.line.product.name}</span>
                {c.entry?.weight ? <WeightDisplay kilograms={c.entry.weight} /> : null}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
        {cracked === null ? null : (
          <CrackedDialog line={cracked} fulfilment={f} onClose={() => setCracked(null)} />
        )}
        {substitute === null || order === null ? null : (
          <SubstituteDialog
            line={substitute}
            orderId={order.id}
            canOpenOrder={canOpenOrder}
            onClose={() => setSubstitute(null)}
          />
        )}
        {short === null || !short.open || order === null || shortOrderLine === null ? null : (
          <ShortPickDialog
            line={short.line}
            orderLine={shortOrderLine}
            orderId={order.id}
            canOpenOrder={canOpenOrder}
            pending={shortPick.isPending}
            error={shortPick.error}
            propose={(input) =>
              shortPick.mutateAsync(input, { idempotencyKey: shortKeyFor(input) })
            }
            onClose={() => setShort({ line: short.line, open: false })}
          />
        )}
      </CardBody>
    </Card>
  );
}

/** What the pick list holds already, line by line as the API records it, with each line's price. */
function Picked({ fulfilment: f }: { fulfilment: Fulfilment }) {
  const { t } = useTranslation('fulfilment');
  const units = useUnits();
  if (f.lines.length === 0) return null;
  const uomOf = (orderLineId: string) =>
    f.pickList.find((l) => l.orderLineId === orderLineId)?.uom ?? '';
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('pick.pickedTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="grid gap-1">
          {f.lines.map((line) => (
            <li key={line.id} className="flex flex-wrap gap-2">
              <InUnit quantity={line.qty} uom={uomOf(line.orderLineId)} units={units} />
              <span>{line.product.name}</span>
              {line.stockUnit === null ? null : (
                <span className="text-fg-muted">{line.stockUnit.identifier}</span>
              )}
              {line.weightKg === null ? null : <WeightDisplay kilograms={line.weightKg} />}
            </li>
          ))}
        </ul>
        {f.pickedAt === null ? null : (
          <p className="mt-2 text-control-sm text-fg-muted">
            {t('pick.pickedAt', { when: formatDateTime(f.pickedAt) })}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

type CrackedOutcome = { kind: 'posted'; number: string } | { kind: 'waiting' };

/**
 * Eggs found broken or cracked while picking: written off from the pick location with the reason, in the
 * product's own unit (eggs), valued by the server from the stock's cost. A write-off over the threshold
 * waits for a second person. The pick itself still needs the full quantity, or the customer's agreement
 * to less (CR-054 asks for the breakage to be named on the pick).
 */
function CrackedDialog({
  line,
  fulfilment: f,
  onClose,
}: {
  line: PickListLine;
  fulfilment: Fulfilment;
  onClose: () => void;
}) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const units = useUnits();
  const keyFor = useIntentKey();
  const product = useApiQuery('getProduct', { path: { id: line.product.id } });
  const reasons = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'STOCK_ADJUSTMENT', limit: 100 } },
    { staleClass: 'reference' },
  );
  const create = useApiMutation('createStockAdjustment');
  const submit = useApiMutation('submitStockAdjustment', {
    invalidates: ['listStockOnHand', 'getFulfilment'],
  });
  const [count, setCount] = useState('');
  const [reason, setReason] = useState('BREAKAGE');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<CrackedOutcome | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const baseUom = product.data?.baseUom ?? '';
  const qty = toQuantity(count);
  const options = uniqueById((reasons.data?.items ?? []).map((r) => ({ ...r, id: r.code }))).map(
    (r) => ({ value: r.code, label: r.description }),
  );
  const chosen = reasons.data?.items.find((r) => r.code === reason);
  const needsNote = chosen?.requiresNote === true;
  const qtyError =
    tried && (qty === null || compareQuantity(qty, '0.000') <= 0)
      ? t('cracked.countMissing')
      : undefined;
  const noteError = tried && needsNote && note.trim() === '' ? t('cracked.noteMissing') : undefined;
  const body =
    qty === null
      ? null
      : {
          locationId: f.pickLocation.id,
          reasonCode: reason,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
          lines: [{ productId: line.product.id, direction: 'LOSS' as const, qty }],
        };
  const failure = create.error ?? submit.error;
  const send = async () => {
    if (body === null) return;
    // The draft is made once per intent; a retry after a refused submit sends the same draft again.
    const id: string =
      draftId ??
      (await create
        .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
        .then((adjustment) => adjustment.id));
    setDraftId(id);
    const answer = await submit.mutateAsync(
      { path: { id } },
      { idempotencyKey: keyFor({ submit: id }) },
    );
    setOutcome(
      isApprovalPending(answer)
        ? { kind: 'waiting' }
        : { kind: 'posted', number: (answer as S['StockAdjustment']).adjustmentNo ?? '' },
    );
    setConfirming(false);
  };
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('cracked.title', { product: line.product.name })}
      body={t('cracked.body', { location: f.pickLocation.name })}
      consequence={confirming ? t('cracked.consequence') : undefined}
      confirmLabel={
        outcome !== null
          ? t('cracked.close')
          : confirming
            ? t('cracked.confirm')
            : t('cracked.review')
      }
      pendingLabel={t('actions.working')}
      pending={create.isPending || submit.isPending}
      error={outcome === null ? failure : null}
      failedTitle={t('cracked.failed')}
      onConfirm={() => {
        if (outcome !== null) {
          onClose();
          return;
        }
        setTried(true);
        if (qty === null || compareQuantity(qty, '0.000') <= 0) return;
        if (needsNote && note.trim() === '') return;
        if (!confirming) {
          setConfirming(true);
          return;
        }
        void send().catch(() => undefined);
      }}
    >
      {outcome === null ? (
        <div className="grid gap-3">
          <Field
            label={t('cracked.count', { unit: baseUom === '' ? '' : units.many(baseUom) })}
            hint={t('cracked.countHint')}
            error={qtyError}
            required
            requiredLabel={t('common:field.required')}
          >
            <Input
              inputMode="numeric"
              value={count}
              disabled={confirming}
              onChange={(event) => setCount(event.target.value)}
            />
          </Field>
          <Field label={t('cracked.reason')}>
            <Select
              value={reason}
              onValueChange={setReason}
              disabled={confirming}
              options={options.length === 0 ? [{ value: 'BREAKAGE', label: 'BREAKAGE' }] : options}
            />
          </Field>
          {needsNote ? (
            <Field
              label={t('cracked.note')}
              error={noteError}
              required
              requiredLabel={t('common:field.required')}
            >
              <Textarea
                rows={2}
                value={note}
                disabled={confirming}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          ) : (
            <Field label={t('cracked.note')}>
              <Textarea
                rows={2}
                value={note}
                disabled={confirming}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          )}
          {confirming && qty !== null && baseUom !== '' ? (
            <p className="font-semibold">
              {t('cracked.writeOff')}{' '}
              <QuantityDisplay
                quantity={qty}
                unit={units.after(baseUom, qty)}
                places={units.places(baseUom)}
                strong
              />
            </p>
          ) : null}
        </div>
      ) : outcome.kind === 'posted' ? (
        <Alert severity="good" title={t('cracked.posted', { number: outcome.number })}>
          {t('cracked.stillPick')}
        </Alert>
      ) : (
        <Alert severity="warning" title={t('cracked.waiting')}>
          {t('cracked.stillPick')}
        </Alert>
      )}
    </ConfirmDialog>
  );
}

/**
 * A line that cannot be picked in full: offer the customer another product in its place. The server moves
 * the order to wait for the customer and tells them; nothing is substituted until their answer is recorded
 * on the order's page. Fewer of the same product is a short pick (`ShortPickDialog`): the server refuses
 * it here (`SAME_PRODUCT`), so it is stopped before it is sent. The quantity is in the line's unit.
 */
function SubstituteDialog({
  line,
  orderId,
  canOpenOrder,
  onClose,
}: {
  line: PickListLine;
  orderId: string;
  canOpenOrder: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const units = useUnits();
  const keyFor = useIntentKey();
  const propose = useApiMutation('proposeSubstitution', {
    invalidates: [
      'getOrder',
      'getOrderFulfilmentView',
      'getFulfilment',
      'listOrders',
      'listOrderHistory',
    ],
  });
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const qty = toQuantity(count);
  const same = product !== null && product.id === line.product.id;
  const productError =
    product === null
      ? t('substitute.productMissing')
      : same
        ? t('substitute.sameProduct')
        : undefined;
  const ok =
    product !== null &&
    !same &&
    qty !== null &&
    compareQuantity(qty, '0.000') > 0 &&
    note.trim() !== '';
  const input =
    !ok || product === null || qty === null
      ? null
      : {
          path: { id: orderId },
          body: {
            lineId: line.orderLineId,
            productId: product.id,
            quantity: qty,
            note: note.trim(),
          },
        };
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('substitute.title', { product: line.product.name })}
      body={t('substitute.body')}
      consequence={sent ? undefined : t('substitute.consequence')}
      confirmLabel={sent ? t('cracked.close') : t('substitute.send')}
      pendingLabel={t('actions.working')}
      pending={propose.isPending}
      error={sent ? null : propose.error}
      failedTitle={t('substitute.failed')}
      onConfirm={() => {
        if (sent) {
          onClose();
          return;
        }
        setTried(true);
        if (input === null) return;
        propose
          .mutateAsync(input, { idempotencyKey: keyFor(input) })
          .then(() => setSent(true))
          .catch(() => undefined);
      }}
    >
      {sent ? (
        <Alert severity="good" title={t('substitute.sent')}>
          <AnswerWhere orderId={orderId} canOpenOrder={canOpenOrder} />
        </Alert>
      ) : (
        <div className="grid gap-3">
          <p>
            {t('substitute.ordered')}{' '}
            <InUnit quantity={line.qtyToPick} uom={line.uom} units={units} />
          </p>
          <ProductPicker
            label={t('substitute.product')}
            value={product}
            onChange={setProduct}
            error={tried || same ? productError : undefined}
          />
          <Field
            label={t('substitute.qty', { unit: units.many(line.uom) })}
            hint={t('substitute.qtyHint')}
            error={
              tried && (qty === null || compareQuantity(qty, '0.000') <= 0)
                ? t('substitute.qtyMissing')
                : undefined
            }
            required
            requiredLabel={t('common:field.required')}
          >
            <Input inputMode="decimal" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field
            label={t('substitute.note')}
            hint={t('substitute.noteHint')}
            error={tried && note.trim() === '' ? t('substitute.noteMissing') : undefined}
            required
            requiredLabel={t('common:field.required')}
          >
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      )}
    </ConfirmDialog>
  );
}

/**
 * Fewer of a line than was ordered, proposed to the customer (2.25.0, CR-054 point 2): in the line's own
 * unit, at least nothing and less than ordered. The server moves the order to wait for the customer and
 * tells them; the line packs at that quantity only once they agree, and their refusal cancels the line.
 * Nothing is packed or sent while the order waits. Checked first, then confirmed with what is short.
 */
function ShortPickDialog({
  line,
  orderLine,
  orderId,
  canOpenOrder,
  pending,
  error,
  propose,
  onClose,
}: {
  line: PickListLine;
  orderLine: PickOrderLine;
  orderId: string;
  canOpenOrder: boolean;
  pending: boolean;
  error: FailureLike | null;
  propose: (input: ShortPickInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const units = useUnits();
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const uom = orderLine.uom;
  const ordered = orderLine.qtyOrdered;
  const check = checkShortPick(count, ordered);
  const orderedWords = {
    quantity: formatQuantity(ordered, { places: units.places(uom) }),
    unit: units.after(uom, ordered),
  };
  const qtyError = !tried
    ? undefined
    : check.error === 'missing'
      ? t('shortPick.qtyMissing')
      : check.error === 'invalid'
        ? t('pick.qtyInvalid')
        : check.error === 'notLess'
          ? t('shortPick.notLess', orderedWords)
          : undefined;
  const noteError = tried && note.trim() === '' ? t('shortPick.noteMissing') : undefined;
  const input: ShortPickInput | null =
    check.error !== null || note.trim() === ''
      ? null
      : {
          path: { id: orderId },
          body: { lineId: line.orderLineId, quantity: check.qty, note: note.trim() },
        };
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('shortPick.title', { product: line.product.name })}
      body={t('shortPick.body')}
      consequence={confirming && !sent ? t('shortPick.consequence') : undefined}
      confirmLabel={
        sent ? t('cracked.close') : confirming ? t('shortPick.send') : t('shortPick.review')
      }
      pendingLabel={t('actions.working')}
      pending={pending}
      error={sent ? null : error}
      failedTitle={t('shortPick.failed')}
      onConfirm={() => {
        if (sent) {
          onClose();
          return;
        }
        setTried(true);
        if (input === null) return;
        if (!confirming) {
          setConfirming(true);
          return;
        }
        propose(input)
          .then(() => setSent(true))
          .catch(() => undefined);
      }}
    >
      {sent ? (
        <Alert severity="good" title={t('shortPick.sent')}>
          <AnswerWhere orderId={orderId} canOpenOrder={canOpenOrder} />
        </Alert>
      ) : (
        <div className="grid gap-3">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-fg-muted">{t('shortPick.ordered')}</dt>
            <dd>
              <InUnit quantity={ordered} uom={uom} units={units} />
            </dd>
            <dt className="text-fg-muted">{t('pick.pickedSoFar')}</dt>
            <dd>
              <InUnit quantity={orderLine.qtyFulfilled} uom={uom} units={units} />
            </dd>
          </dl>
          <Field
            label={t('shortPick.qty', { unit: units.many(uom) })}
            hint={t('shortPick.qtyHint', orderedWords)}
            error={qtyError}
            required
            requiredLabel={t('common:field.required')}
          >
            <Input
              inputMode="decimal"
              value={count}
              disabled={confirming}
              onChange={(event) => setCount(event.target.value)}
            />
          </Field>
          <Field
            label={t('shortPick.note')}
            hint={t('shortPick.noteHint')}
            error={noteError}
            required
            requiredLabel={t('common:field.required')}
          >
            <Textarea
              rows={2}
              maxLength={500}
              value={note}
              disabled={confirming}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {confirming && input !== null ? (
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 font-semibold">
              <dt>{t('shortPick.canSend')}</dt>
              <dd>
                <InUnit quantity={input.body.quantity} uom={uom} units={units} />
              </dd>
              <dt>{t('shortPick.shortBy')}</dt>
              <dd>
                <InUnit
                  quantity={gapBetween(ordered, input.body.quantity)}
                  uom={uom}
                  units={units}
                />
              </dd>
            </dl>
          ) : null}
        </div>
      )}
    </ConfirmDialog>
  );
}

/**
 * Pack once picked; then dispatch onto a van for a delivery, or hand over for a collection. The store's
 * view of the order has no money (`money` null), so the confirmations show the totals only to someone who
 * reads the whole order.
 */
function NextStep({
  fulfilment: f,
  order: o,
  money,
}: {
  fulfilment: Fulfilment;
  order: PickOrder;
  money: Order | null;
}) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const pack = useApiMutation('packFulfilment', {
    invalidates: [
      'getFulfilment',
      'getOrder',
      'getOrderFulfilmentView',
      'listFulfilments',
      'listOrders',
    ],
  });
  const dispatch = useApiMutation('dispatchFulfilment', {
    invalidates: ['getFulfilment', 'getOrder', 'listFulfilments', 'listOrders', 'listDeliveries'],
  });
  const collect = useApiMutation('collectFulfilment', {
    invalidates: ['getFulfilment', 'getOrder', 'listFulfilments', 'listOrders'],
  });
  const people = useDriversAndVans(o.branchId, f.status === 'PACKED');
  const [packages, setPackages] = useState('');
  const [driver, setDriver] = useState('');
  const [van, setVan] = useState('');
  const [open, setOpen] = useState<'pack' | 'dispatch' | 'collect' | null>(null);
  const [tried, setTried] = useState(false);
  const waiting = o.status === 'AWAITING_CUSTOMER' || f.withinTolerance === false;
  const packageCount = /^\d{1,3}$/.test(packages.trim()) ? Number(packages.trim()) : null;

  if (f.status === 'PICKING' && auth.can('ord.fulfilment.pick')) {
    const input = packageCount === null ? null : { path: { id: f.id }, body: { packageCount } };
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('pack.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3">
          {waiting ? <p>{t('pack.waiting')}</p> : null}
          <Field
            label={t('pack.count')}
            hint={t('pack.countHint')}
            error={
              tried && (packageCount === null || packageCount < 1)
                ? t('pack.countMissing')
                : undefined
            }
          >
            <Input
              inputMode="numeric"
              value={packages}
              onChange={(e) => setPackages(e.target.value)}
            />
          </Field>
          <div>
            <Button
              disabled={waiting}
              onClick={() => {
                setTried(true);
                if (packageCount !== null && packageCount >= 1) setOpen('pack');
              }}
            >
              {t('pack.record')}
            </Button>
          </div>
          <ConfirmDialog
            open={open === 'pack'}
            onOpenChange={(next) => setOpen(next ? 'pack' : null)}
            title={t('pack.confirmTitle')}
            body={t('pack.confirmBody', { count: packageCount ?? 0 })}
            confirmLabel={t('pack.record')}
            pendingLabel={t('actions.working')}
            pending={pack.isPending}
            error={pack.error}
            failedTitle={t('pack.failed')}
            onConfirm={() => {
              if (input === null) return;
              pack
                .mutateAsync(input, { idempotencyKey: keyFor(input) })
                .then(() => setOpen(null))
                .catch(() => undefined);
            }}
          />
        </CardBody>
      </Card>
    );
  }

  if (f.status === 'PACKED' && auth.can('ord.fulfilment.dispatch')) {
    if (o.fulfilmentMode === 'COLLECTION') {
      const input = { path: { id: f.id } };
      return (
        <Card>
          <CardBody className="grid gap-3">
            <div>
              <Button disabled={waiting} onClick={() => setOpen('collect')}>
                {t('collect.record')}
              </Button>
            </div>
            <ConfirmDialog
              open={open === 'collect'}
              onOpenChange={(next) => setOpen(next ? 'collect' : null)}
              title={t('collect.confirmTitle')}
              body={t('collect.confirmBody', { order: o.orderNo ?? '' })}
              confirmLabel={t('collect.record')}
              pendingLabel={t('actions.working')}
              pending={collect.isPending}
              error={collect.error}
              failedTitle={t('collect.failed')}
              onConfirm={() => {
                collect
                  .mutateAsync(input, { idempotencyKey: keyFor(input) })
                  .then(() => setOpen(null))
                  .catch(() => undefined);
              }}
            >
              {money === null ? null : <OrderTotals order={money} />}
            </ConfirmDialog>
          </CardBody>
        </Card>
      );
    }
    const body = {
      ...(driver === '' ? {} : { driverId: driver }),
      ...(van === '' ? {} : { vehicleLocationId: van }),
    };
    const input = { path: { id: f.id }, body };
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('dispatch.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3">
          {waiting ? <p>{t('pack.waiting')}</p> : null}
          <p>{t('dispatch.body')}</p>
          <DriverVanFields
            people={people}
            driver={driver}
            van={van}
            onDriver={setDriver}
            onVan={setVan}
          />
          <div>
            <Button disabled={waiting} onClick={() => setOpen('dispatch')}>
              <Truck aria-hidden="true" />
              {t('dispatch.record')}
            </Button>
          </div>
          <ConfirmDialog
            open={open === 'dispatch'}
            onOpenChange={(next) => setOpen(next ? 'dispatch' : null)}
            title={t('dispatch.confirmTitle')}
            body={t('dispatch.confirmBody', { order: o.orderNo ?? '' })}
            consequence={t('dispatch.consequence')}
            confirmLabel={t('dispatch.record')}
            pendingLabel={t('actions.working')}
            pending={dispatch.isPending}
            error={dispatch.error}
            failedTitle={t('dispatch.failed')}
            onConfirm={() => {
              dispatch
                .mutateAsync(input, { idempotencyKey: keyFor(input) })
                .then(() => setOpen(null))
                .catch(() => undefined);
            }}
          >
            {money === null ? null : <OrderTotals order={money} />}
          </ConfirmDialog>
        </CardBody>
      </Card>
    );
  }
  if (f.status === 'DISPATCHED' || f.status === 'COLLECTED') {
    return (
      <Alert
        severity="good"
        title={
          f.status === 'DISPATCHED'
            ? t('dispatch.done', { when: formatDateTime(f.dispatchedAt) })
            : t('collect.done')
        }
      />
    );
  }
  return null;
}

/** The drivers (people holding the Driver role) and the vans of a branch, for dispatch and runs. */
export function useDriversAndVans(branchId: string, enabled = true) {
  const auth = useAuth();
  const users = useApiAllPages(
    'listUsers',
    { query: { realm: 'STAFF', status: 'ACTIVE', limit: 100 } },
    { staleClass: 'reference', enabled: enabled && auth.can('iam.user.read') },
  );
  const vans = useApiAllPages(
    'listLocations',
    { query: { branchId, kind: 'VEHICLE', limit: 100 } },
    { staleClass: 'reference', enabled },
  );
  return {
    canListDrivers: auth.can('iam.user.read'),
    drivers: uniqueById(users.data?.items ?? []).filter((u) =>
      u.grants.some((g) => g.roleCode === 'DRIVER'),
    ),
    vans: uniqueById(vans.data?.items ?? []).filter((l) => l.kind === 'VEHICLE'),
  };
}

export function DriverVanFields({
  people,
  driver,
  van,
  onDriver,
  onVan,
  driverError,
  vanError,
}: {
  people: ReturnType<typeof useDriversAndVans>;
  driver: string;
  van: string;
  onDriver: (id: string) => void;
  onVan: (id: string) => void;
  driverError?: string;
  vanError?: string;
}) {
  const { t } = useTranslation('fulfilment');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label={t('dispatch.driver')}
        hint={people.canListDrivers ? undefined : t('dispatch.driversHidden')}
        error={driverError}
      >
        <Select
          value={driver}
          onValueChange={onDriver}
          placeholder={t('dispatch.chooseDriver')}
          options={people.drivers.map((d) => ({ value: d.id, label: d.displayName }))}
        />
      </Field>
      <Field label={t('dispatch.van')} error={vanError}>
        <Select
          value={van}
          onValueChange={onVan}
          placeholder={t('dispatch.chooseVan')}
          options={people.vans.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))}
        />
      </Field>
    </div>
  );
}
