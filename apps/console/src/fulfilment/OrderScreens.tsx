/**
 * F11: the order list, every channel in one, and an order's picking and delivery page. The order's
 * payment, invoice and credit are F10i's page at `/orders/:id`, linked from here; this page is the
 * fulfilment side: what was ordered and picked in the order's own units ("12 crates", "30 eggs"), the
 * customer's agreement when the server waits for it, the pick list, and the delivery.
 */
import { ShoppingBasket } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
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
  MoneyDisplay,
  NOT_APPLICABLE,
  QuantityDisplay,
  QueryBoundary,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  Textarea,
  ToolbarSearch,
  formatDateTime,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey, uniqueById } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useUnits } from '../stock/units';
import {
  CHANNELS,
  FulfilmentStatusBadge,
  ORDER_STATUSES,
  OrderTotals,
  type Order,
} from './presentation';

type S = components['schemas'];

/** The order's total as the API states it: the final one once weighed and dispatched, else the estimate. */
function OrderTotalCell({ order: o }: { order: Order }) {
  const { t } = useTranslation('fulfilment');
  return o.finalTotalPesewas === null ? (
    <span className="grid justify-items-end">
      <MoneyDisplay pesewas={o.estimatedTotalPesewas} />
      <span className="text-control-sm text-fg-muted">{t('orders.estimate')}</span>
    </span>
  ) : (
    <MoneyDisplay pesewas={o.finalTotalPesewas} />
  );
}

/** Every order, newest first, at the branches the reader reads orders at. */
export function OrdersScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const pages = useCursorPages();
  const [status, setStatus] = useState(ANY);
  const [channel, setChannel] = useState(ANY);
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const list = useApiQuery('listOrders', {
    query: {
      ...param('status', status),
      ...(channel === ANY ? {} : { channel: channel as Order['channel'] }),
      ...(q === '' ? {} : { q }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('orders.loading'),
    emptyTitle: t('orders.empty'),
    emptyDescription: t('orders.emptyBody'),
    errorTitle: t('orders.error'),
    deniedTitle: t('orders.denied'),
  });
  const view = useTableView<Order>([
    {
      id: 'order',
      rowHeader: true,
      head: t('columns.order'),
      sortValue: (o) => o.placedAt,
      cell: (o) => (
        <span className="flex items-center gap-3">
          <IconChip icon={ShoppingBasket} tone="info" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/orders/${o.id}/fulfilment`} className="text-accent-text underline">
              {o.orderNo ?? t('orders.unnumbered')}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {o.customer?.name ?? o.contactName ?? NOT_APPLICABLE}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (o) => o.status,
      cell: (o) => <FulfilmentStatusBadge kind="order" status={o.status} />,
    },
    {
      id: 'channel',
      head: t('columns.channel'),
      sortValue: (o) => o.channel,
      cell: (o) => t(`channel.${o.channel}`, { defaultValue: o.channel }),
    },
    {
      id: 'fulfilment',
      head: t('columns.fulfilment'),
      sortValue: (o) => o.fulfilmentMode,
      cell: (o) => (
        <span className="grid">
          <span>{t(`mode.${o.fulfilmentMode}`, { defaultValue: o.fulfilmentMode })}</span>
          {o.delivery?.slotDate == null ? null : (
            <span className="text-control-sm text-fg-muted">
              {t('orders.slot', {
                date: o.delivery.slotDate,
                from: o.delivery.slotStartsAt ?? '',
                to: o.delivery.slotEndsAt ?? '',
              })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'total',
      head: t('columns.total'),
      numeric: true,
      sortValue: (o) => o.finalTotalPesewas ?? o.estimatedTotalPesewas,
      cell: (o) => <OrderTotalCell order={o} />,
    },
    {
      id: 'placed',
      head: t('columns.placed'),
      sortValue: (o) => o.placedAt,
      cell: (o) => formatDateTime(o.placedAt),
    },
  ]);
  return (
    <section aria-labelledby="orders-title" className="grid gap-4">
      <PageHeader title={t('orders.title')} titleId="orders-title" />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('orders.title')}
        exportName={t('orders.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('orders.pages') }}
        toolbar={
          <>
            <ToolbarSearch
              label={t('orders.searchLabel')}
              placeholder={t('orders.searchPlaceholder')}
              value={typed}
              onValueChange={setTyped}
              onSubmit={(value) => {
                setQ(value);
                pages.reset();
              }}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={countSet(status, channel)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus(ANY);
                  setChannel(ANY);
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
                options={ORDER_STATUSES.map((s) => ({ value: s, label: t(`status.order.${s}`) }))}
              />
              <FilterSelect
                anyLabel={t('filters.any')}
                label={t('filters.channel')}
                value={channel}
                onChange={(value) => {
                  setChannel(value);
                  pages.reset();
                }}
                options={CHANNELS.map((c) => ({ value: c, label: t(`channel.${c}`) }))}
              />
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}

/** A term and its value in an order's summary. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-fg-muted">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One order's picking and delivery: its lines in their units, consent, the pick list and the delivery. */
export function OrderFulfilmentScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const { id = '' } = useParams();
  const units = useUnits();
  const order = useApiQuery('getOrder', { path: { id } });
  // Kept here: once the answer is recorded the order stops waiting and the consent card goes.
  const [consentDone, setConsentDone] = useState<boolean | null>(null);
  const labels = useStateLabels({
    loading: t('order.loading'),
    emptyTitle: t('order.notFound'),
    errorTitle: t('order.error'),
    deniedTitle: t('order.denied'),
  });
  const back = (
    <Link to="/orders" className="text-accent-text underline">
      {t('order.back')}
    </Link>
  );
  if (order.error?.status === 404) {
    return (
      <EmptyState
        title={t('order.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={order}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(o) => {
        const a = o.deliveryAddress;
        return (
          <article aria-labelledby="order-title" className="grid gap-4">
            {back}
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader title={o.orderNo ?? t('orders.unnumbered')} titleId="order-title" />
              <FulfilmentStatusBadge kind="order" status={o.status} />
            </div>
            <Link to={`/orders/${o.id}`} className="text-accent-text underline">
              {t('order.paymentPage')}
            </Link>
            <Card>
              <CardBody>
                <Facts
                  rows={[
                    [t('fields.customer'), o.customer?.name ?? o.contactName ?? NOT_APPLICABLE],
                    [t('fields.phone'), o.contactPhone ?? a?.recipientPhone ?? NOT_APPLICABLE],
                    [t('columns.channel'), t(`channel.${o.channel}`, { defaultValue: o.channel })],
                    [
                      t('fields.payment'),
                      t(`terms.${o.paymentTerms}`, { defaultValue: o.paymentTerms }),
                    ],
                    [
                      t('columns.fulfilment'),
                      t(`mode.${o.fulfilmentMode}`, { defaultValue: o.fulfilmentMode }),
                    ],
                    [
                      t('fields.address'),
                      a === null
                        ? NOT_APPLICABLE
                        : [a.line1, a.area, a.city, a.digitalAddress]
                            .filter((part) => part !== null && part !== '')
                            .join(', '),
                    ],
                    [t('fields.zone'), o.deliveryZone?.name ?? NOT_APPLICABLE],
                    [
                      t('fields.delivery'),
                      o.delivery === null ? (
                        t('order.noDelivery')
                      ) : (
                        <span key="d" className="flex flex-wrap items-center gap-2">
                          <span>
                            {o.delivery.slotDate === null
                              ? (o.delivery.deliveryNo ?? '')
                              : t('orders.slot', {
                                  date: o.delivery.slotDate,
                                  from: o.delivery.slotStartsAt ?? '',
                                  to: o.delivery.slotEndsAt ?? '',
                                })}
                          </span>
                          <FulfilmentStatusBadge kind="delivery" status={o.delivery.status} />
                        </span>
                      ),
                    ],
                  ]}
                />
              </CardBody>
            </Card>
            <TableContainer aria-label={t('order.lines')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.product')}</TableHead>
                    <TableHead numeric>{t('columns.ordered')}</TableHead>
                    <TableHead numeric>{t('columns.picked')}</TableHead>
                    <TableHead numeric>{t('columns.backordered')}</TableHead>
                    <TableHead>{t('columns.lineStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableRowHeader>{line.product.name}</TableRowHeader>
                      {(
                        [
                          ['ordered', line.qtyOrdered],
                          ['picked', line.qtyFulfilled],
                          ['backordered', line.qtyBackordered],
                        ] as const
                      ).map(([column, quantity]) => (
                        <TableCell key={column} numeric label={t(`columns.${column}`)}>
                          <QuantityDisplay
                            quantity={quantity}
                            unit={units.after(line.uom, quantity)}
                            places={units.places(line.uom)}
                          />
                        </TableCell>
                      ))}
                      <TableCell label={t('columns.lineStatus')}>
                        {t(`lineStatus.${line.lineStatus}`, { defaultValue: line.lineStatus })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Card>
              <CardBody>
                <OrderTotals order={o} />
              </CardBody>
            </Card>
            {consentDone === null ? null : (
              <Alert
                severity="good"
                title={consentDone ? t('consent.doneAccepted') : t('consent.doneDeclined')}
              />
            )}
            {o.status === 'AWAITING_CUSTOMER' ? (
              <ConsentCard order={o} onDone={setConsentDone} />
            ) : null}
            <PickListCard order={o} />
            <HistoryCard orderId={o.id} />
          </article>
        );
      }}
    </QueryBoundary>
  );
}

/**
 * The order waits for the customer (a substitute offered, or a weighed total over what they agreed): the
 * person who spoke to them records the answer and how it was given. Nothing changes on the order until
 * the server takes it.
 */
function ConsentCard({ order: o, onDone }: { order: Order; onDone: (accepted: boolean) => void }) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const record = useApiMutation('recordCustomerConsent', {
    invalidates: ['getOrder', 'listOrders', 'getFulfilment', 'listOrderHistory'],
  });
  const [kind, setKind] = useState<S['ConsentRecord']['kind'] | ''>('');
  const [accepted, setAccepted] = useState<'yes' | 'no' | ''>('');
  const [method, setMethod] = useState<S['ConsentRecord']['method'] | ''>('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState(false);
  if (!auth.can('ord.order.update')) {
    return <Alert severity="warning" title={t('consent.waiting')} />;
  }
  const body =
    kind === '' || accepted === '' || method === ''
      ? null
      : {
          kind,
          accepted: accepted === 'yes',
          method,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
        };
  const input = body === null ? null : { path: { id: o.id }, body };
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('consent.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-4">
        <p>{t('consent.body')}</p>
        <fieldset className="grid gap-2">
          <legend id="consent-kind" className="font-semibold">
            {t('consent.kind')}
          </legend>
          <RadioGroup
            aria-labelledby="consent-kind"
            value={kind}
            onValueChange={(v) => setKind(v === 'HIGHER_TOTAL' ? 'HIGHER_TOTAL' : 'SUBSTITUTION')}
          >
            <Radio value="SUBSTITUTION" label={t('consent.SUBSTITUTION')} />
            <Radio value="HIGHER_TOTAL" label={t('consent.HIGHER_TOTAL')} />
          </RadioGroup>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend id="consent-answer" className="font-semibold">
            {t('consent.answer')}
          </legend>
          <RadioGroup
            aria-labelledby="consent-answer"
            value={accepted}
            onValueChange={(v) => setAccepted(v === 'no' ? 'no' : 'yes')}
          >
            <Radio value="yes" label={t('consent.yes')} />
            <Radio value="no" label={t('consent.no')} />
          </RadioGroup>
        </fieldset>
        <Field
          label={t('consent.method')}
          error={tried && method === '' ? t('consent.methodMissing') : undefined}
          required
          requiredLabel={t('common:field.required')}
        >
          <Select
            value={method}
            onValueChange={(v) => setMethod(v as S['ConsentRecord']['method'])}
            placeholder={t('consent.chooseMethod')}
            options={(['PHONE', 'WHATSAPP', 'IN_PERSON', 'SIGNED_LINK'] as const).map((m) => ({
              value: m,
              label: t(`consent.methods.${m}`),
            }))}
          />
        </Field>
        <Field label={t('consent.note')} hint={t('consent.noteHint')}>
          <Textarea value={note} rows={2} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {tried && (kind === '' || accepted === '') ? (
          <p role="alert" className="text-critical-fg">
            {t('consent.missing')}
          </p>
        ) : null}
        <div>
          <Button
            onClick={() => {
              setTried(true);
              if (input !== null) setOpen(true);
            }}
          >
            {t('consent.record')}
          </Button>
        </div>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={t('consent.confirmTitle')}
          body={
            accepted === 'yes'
              ? t('consent.confirmYes', { kind: kind === '' ? '' : t(`consent.what.${kind}`) })
              : t('consent.confirmNo', { kind: kind === '' ? '' : t(`consent.what.${kind}`) })
          }
          confirmLabel={t('consent.record')}
          pendingLabel={t('actions.working')}
          pending={record.isPending}
          error={record.error}
          failedTitle={t('consent.failed')}
          onConfirm={() => {
            if (input === null) return;
            record
              .mutateAsync(input, { idempotencyKey: keyFor(input) })
              .then(() => {
                setOpen(false);
                onDone(input.body.accepted);
              })
              .catch(() => undefined);
          }}
        >
          <OrderTotals order={o} />
        </ConfirmDialog>
      </CardBody>
    </Card>
  );
}

/**
 * The order's pick list. The contract has no way to ask for one order's fulfilments, so the open ones are
 * read and this order's is found among them (CR-053 asks for `orderId`). Starting one names the location
 * the goods are picked from.
 */
function PickListCard({ order: o }: { order: Order }) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const keyFor = useIntentKey();
  const fulfilments = useApiAllPages(
    'listFulfilments',
    { query: { limit: 100 } },
    { enabled: auth.can('ord.fulfilment.read') },
  );
  const locations = useApiAllPages(
    'listLocations',
    { query: { branchId: o.branchId, limit: 100 } },
    { staleClass: 'reference', enabled: auth.can('ord.fulfilment.pick') },
  );
  const create = useApiMutation('createFulfilment', {
    invalidates: ['listFulfilments', 'getOrder', 'listOrders'],
  });
  const [location, setLocation] = useState('');
  const [open, setOpen] = useState(false);
  const mine = (fulfilments.data?.items ?? []).filter(
    (f) => f.order.id === o.id && f.status !== 'CANCELLED',
  );
  const canStart =
    auth.can('ord.fulfilment.pick') &&
    mine.length === 0 &&
    (o.status === 'CONFIRMED' || o.status === 'PICKING');
  const places = uniqueById(locations.data?.items ?? []).filter((l) => l.kind !== 'VEHICLE');
  const chosen = places.find((l) => l.id === location);
  const input = { path: { id: o.id }, body: { pickLocationId: location } };
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('pickList.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {!auth.can('ord.fulfilment.read') ? (
          <p>{t('pickList.denied')}</p>
        ) : fulfilments.isPending ? (
          <Skeleton label={t('pickList.loading')} shape="block" className="h-12" />
        ) : fulfilments.isError ? (
          <p role="alert">{t('pickList.error')}</p>
        ) : mine.length > 0 ? (
          <ul className="grid gap-2">
            {mine.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <Link to={`/fulfilments/${f.id}`} className="text-accent-text underline">
                  {t('pickList.open', { number: f.fulfilmentNo ?? '' })}
                </Link>
                <FulfilmentStatusBadge kind="fulfilment" status={f.status} />
                <span className="text-fg-muted">{f.pickLocation.name}</span>
              </li>
            ))}
          </ul>
        ) : canStart ? (
          <div className="grid gap-3">
            <Field label={t('pickList.location')} hint={t('pickList.locationHint')}>
              <Select
                value={location}
                onValueChange={setLocation}
                placeholder={t('pickList.chooseLocation')}
                options={places.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
            </Field>
            <div>
              <Button disabled={location === ''} onClick={() => setOpen(true)}>
                {t('pickList.start')}
              </Button>
            </div>
            <ConfirmDialog
              open={open}
              onOpenChange={setOpen}
              title={t('pickList.startTitle')}
              body={t('pickList.startBody', {
                order: o.orderNo ?? '',
                location: chosen?.name ?? '',
              })}
              confirmLabel={t('pickList.start')}
              pendingLabel={t('actions.working')}
              pending={create.isPending}
              error={create.error}
              failedTitle={t('pickList.startFailed')}
              onConfirm={() => {
                create
                  .mutateAsync(input, { idempotencyKey: keyFor(input) })
                  .then((f) => navigate(`/fulfilments/${f.id}`))
                  .catch(() => undefined);
              }}
            />
          </div>
        ) : (
          <p>{t('pickList.none', { status: t(`status.order.${o.status}`) })}</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Every status the order passed through, oldest first, with who and why. */
function HistoryCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation(['fulfilment', 'common']);
  const history = useApiQuery('listOrderHistory', { path: { id: orderId }, query: { limit: 100 } });
  const labels = useStateLabels({
    loading: t('history.loading'),
    emptyTitle: t('history.empty'),
    errorTitle: t('history.error'),
    deniedTitle: t('history.error'),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('history.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <QueryBoundary
          query={history}
          labels={labels}
          isEmpty={(page) => page.data.length === 0}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-16" />}
        >
          {(page) => (
            <ol className="grid gap-2">
              {page.data.map((change, index) => (
                <li key={`${change.occurredAt}-${index}`}>
                  <time dateTime={change.occurredAt}>{formatDateTime(change.occurredAt)}</time>{' '}
                  {t('history.change', {
                    to: t(`status.order.${change.toStatus}`, { defaultValue: change.toStatus }),
                    who: change.actor.displayName,
                  })}
                  {change.reason === null ? null : (
                    <span className="text-fg-muted"> {change.reason}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
