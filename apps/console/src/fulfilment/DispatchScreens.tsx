/**
 * F11: dispatch. The day's deliveries, and a run made from them for one driver and one van; the runs of a
 * day; and one run, its stops in the order to visit, put in a new order or started. The cash to collect is
 * the server's, fixed at dispatch.
 */
import { ArrowDown, ArrowUp, Route as RouteIcon, Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  DatePicker,
  EmptyState,
  Field,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  NOT_APPLICABLE,
  QueryBoundary,
  Skeleton,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiMutation, useApiQuery } from '../data/api';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { DriverVanFields, useDriversAndVans } from './PickScreens';
import {
  DELIVERY_STATUSES,
  FulfilmentStatusBadge,
  type Delivery,
  type Route,
} from './presentation';

/** Today in Accra, which is UTC all year (ADR 0027). */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The day's deliveries, and a run made from those not on one yet. */
export function DeliveriesScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const keyFor = useIntentKey();
  const pages = useCursorPages();
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState(ANY);
  const [chosen, setChosen] = useState<string[]>([]);
  const [driver, setDriver] = useState('');
  const [van, setVan] = useState('');
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState(false);
  const list = useApiQuery('listDeliveries', {
    query: {
      date,
      ...param('status', status),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  // The vans are the chosen branch's (ADR 0034); with all branches, the branch of the day's deliveries.
  const scope = useBranchScope();
  const branchId = scope.branchId ?? list.data?.data[0]?.branchId ?? '';
  const canPlan = auth.can('del.route.manage');
  const people = useDriversAndVans(branchId, canPlan && branchId !== '');
  const create = useApiMutation('createRoute', { invalidates: ['listRoutes', 'listDeliveries'] });
  const labels = useStateLabels({
    loading: t('deliveries.loading'),
    emptyTitle: t('deliveries.empty'),
    emptyDescription: t('deliveries.emptyBody'),
    errorTitle: t('deliveries.error'),
    deniedTitle: t('deliveries.denied'),
  });
  const plannable = (d: Delivery) => d.status === 'SCHEDULED' || d.status === 'ASSIGNED';
  const toggle = (id: string, on: boolean) =>
    setChosen((all) => (on ? [...all.filter((x) => x !== id), id] : all.filter((x) => x !== id)));
  const rows = list.data?.data ?? [];
  const chosenRows = chosen
    .map((id) => rows.find((d) => d.id === id))
    .filter((d): d is Delivery => d !== undefined);
  const view = useTableView<Delivery>([
    ...(canPlan
      ? [
          {
            id: 'choose',
            head: t('deliveries.choose'),
            cell: (d: Delivery) =>
              plannable(d) ? (
                <Checkbox
                  aria-label={t('deliveries.add', { name: d.recipientName })}
                  checked={chosen.includes(d.id)}
                  onCheckedChange={(on) => toggle(d.id, on === true)}
                />
              ) : (
                NOT_APPLICABLE
              ),
          },
        ]
      : []),
    {
      id: 'delivery',
      rowHeader: true,
      head: t('columns.delivery'),
      sortValue: (d) => d.slot?.startsAt ?? '',
      cell: (d) => (
        <span className="grid min-w-0">
          <span className="font-semibold">{d.recipientName}</span>
          <span className="text-control-sm font-normal text-fg-muted">
            {`${d.address.area}, ${d.deliveryZone.name}`}
          </span>
          <Link to={`/orders/${d.order.id}/fulfilment`} className="text-accent-text underline">
            {d.order.number ?? t('orders.unnumbered')}
          </Link>
        </span>
      ),
    },
    {
      id: 'slot',
      head: t('columns.slot'),
      sortValue: (d) => d.slot?.startsAt ?? '',
      cell: (d) =>
        d.slot === null
          ? NOT_APPLICABLE
          : t('deliveries.between', { from: d.slot.startsAt, to: d.slot.endsAt }),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (d) => d.status,
      cell: (d) => <FulfilmentStatusBadge kind="delivery" status={d.status} />,
    },
    {
      id: 'driver',
      head: t('columns.driver'),
      sortValue: (d) => d.driver?.displayName ?? '',
      cell: (d) => d.driver?.displayName ?? t('deliveries.noDriver'),
    },
    {
      id: 'cod',
      head: t('columns.cod'),
      numeric: true,
      sortValue: (d) => d.codDuePesewas,
      cell: (d) => <MoneyDisplay pesewas={d.codDuePesewas} />,
    },
  ]);
  const input = {
    body: { driverId: driver, routeDate: date, vehicleLocationId: van, deliveryIds: chosen },
  };
  return (
    <section aria-labelledby="deliveries-title" className="grid gap-4">
      <PageHeader title={t('deliveries.title')} titleId="deliveries-title" />
      <Field label={t('deliveries.date')}>
        <DatePicker
          value={date}
          onChange={(event) => {
            setDate(event.target.value || today());
            setChosen([]);
            pages.reset();
          }}
        />
      </Field>
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('deliveries.title')}
        exportName={t('deliveries.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('deliveries.pages') }}
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
              options={DELIVERY_STATUSES.map((s) => ({
                value: s,
                label: t(`status.delivery.${s}`),
              }))}
            />
          </FilterMenu>
        }
      />
      {canPlan ? (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t('plan.title')}</h2>
            </CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3">
            <p>{t('plan.body', { count: chosen.length })}</p>
            <DriverVanFields
              people={people}
              driver={driver}
              van={van}
              onDriver={setDriver}
              onVan={setVan}
              driverError={tried && driver === '' ? t('plan.driverMissing') : undefined}
              vanError={tried && van === '' ? t('plan.vanMissing') : undefined}
            />
            {tried && chosen.length === 0 ? (
              <p role="alert" className="text-critical-fg">
                {t('plan.noneChosen')}
              </p>
            ) : null}
            <div>
              <Button
                onClick={() => {
                  setTried(true);
                  if (chosen.length > 0 && driver !== '' && van !== '') setOpen(true);
                }}
              >
                <RouteIcon aria-hidden="true" />
                {t('plan.make')}
              </Button>
            </div>
            <ConfirmDialog
              open={open}
              onOpenChange={setOpen}
              title={t('plan.confirmTitle')}
              body={t('plan.confirmBody', {
                driver: people.drivers.find((d) => d.id === driver)?.displayName ?? '',
                van: people.vans.find((v) => v.id === van)?.name ?? '',
                date,
              })}
              confirmLabel={t('plan.make')}
              pendingLabel={t('actions.working')}
              pending={create.isPending}
              error={create.error}
              failedTitle={t('plan.failed')}
              onConfirm={() => {
                create
                  .mutateAsync(input, { idempotencyKey: keyFor(input) })
                  .then((route) => navigate(`/routes/${route.id}`))
                  .catch(() => undefined);
              }}
            >
              <ol className="grid list-decimal gap-1 ps-6">
                {chosenRows.map((d) => (
                  <li key={d.id}>
                    {d.recipientName}, <MoneyDisplay pesewas={d.codDuePesewas} />
                  </li>
                ))}
              </ol>
            </ConfirmDialog>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}

/** The runs of a day, each a driver, a van and its stops. */
export function RoutesScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const pages = useCursorPages();
  const [date, setDate] = useState(today);
  const list = useApiQuery('listRoutes', {
    query: { date, ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }) },
  });
  const labels = useStateLabels({
    loading: t('routes.loading'),
    emptyTitle: t('routes.empty'),
    emptyDescription: t('routes.emptyBody'),
    errorTitle: t('routes.error'),
    deniedTitle: t('routes.denied'),
  });
  const view = useTableView<Route>([
    {
      id: 'driver',
      rowHeader: true,
      head: t('columns.driver'),
      sortValue: (r) => r.driver.displayName,
      cell: (r) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Truck} tone="info" size="sm" />
          <Link to={`/routes/${r.id}`} className="text-accent-text underline">
            {t('routes.of', { driver: r.driver.displayName })}
          </Link>
        </span>
      ),
    },
    {
      id: 'van',
      head: t('columns.van'),
      sortValue: (r) => r.vehicle.name,
      cell: (r) => r.vehicle.name,
    },
    {
      id: 'stops',
      head: t('columns.stops'),
      numeric: true,
      sortValue: (r) => r.stops.length,
      cell: (r) => t('routes.stops', { count: r.stops.length }),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (r) => r.status,
      cell: (r) => <FulfilmentStatusBadge kind="route" status={r.status} />,
    },
    {
      id: 'cod',
      head: t('columns.cod'),
      numeric: true,
      sortValue: (r) => r.codDueTotalPesewas,
      cell: (r) => <MoneyDisplay pesewas={r.codDueTotalPesewas} />,
    },
  ]);
  return (
    <section aria-labelledby="routes-title" className="grid gap-4">
      <PageHeader title={t('routes.title')} titleId="routes-title" />
      <Field label={t('deliveries.date')}>
        <DatePicker
          value={date}
          onChange={(event) => {
            setDate(event.target.value || today());
            pages.reset();
          }}
        />
      </Field>
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('routes.title')}
        exportName={t('routes.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('routes.pages') }}
      />
    </section>
  );
}

/** One run: its stops in the order to visit, moved up or down while it is planned, and started. */
export function RouteScreen() {
  const { t } = useTranslation(['fulfilment', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const keyFor = useIntentKey();
  const route = useApiQuery('getRoute', { path: { id } });
  const reorder = useApiMutation('reorderRouteStops', { invalidates: ['getRoute', 'listRoutes'] });
  const start = useApiMutation('startRoute', { invalidates: ['getRoute', 'listRoutes'] });
  const [order, setOrder] = useState<string[] | null>(null);
  const [open, setOpen] = useState<'reorder' | 'start' | null>(null);
  const labels = useStateLabels({
    loading: t('route.loading'),
    emptyTitle: t('route.notFound'),
    errorTitle: t('route.error'),
    deniedTitle: t('routes.denied'),
  });
  const back = (
    <Link to="/routes" className="text-accent-text underline">
      {t('route.back')}
    </Link>
  );
  if (route.error?.status === 404) {
    return (
      <EmptyState
        title={t('route.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={route}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(r) => {
        const stops = [...r.stops].sort((a, b) => a.stopNo - b.stopNo);
        const ids = order ?? stops.map((s) => s.delivery.id);
        const byId = new Map(stops.map((s) => [s.delivery.id, s.delivery]));
        const planned = r.status === 'PLANNED' && auth.can('del.route.manage');
        const changed = order !== null && order.join() !== stops.map((s) => s.delivery.id).join();
        const move = (index: number, by: -1 | 1) => {
          const next = [...ids];
          const [item] = next.splice(index, 1);
          if (item !== undefined) next.splice(index + by, 0, item);
          setOrder(next);
        };
        const reorderInput = { path: { id: r.id }, body: { version: r.version, deliveryIds: ids } };
        const startInput = { path: { id: r.id } };
        return (
          <article aria-labelledby="route-title" className="grid gap-4">
            {back}
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader
                title={t('routes.of', { driver: r.driver.displayName })}
                titleId="route-title"
              />
              <FulfilmentStatusBadge kind="route" status={r.status} />
            </div>
            <p>{t('route.summary', { date: r.routeDate, van: r.vehicle.name })}</p>
            <p>
              {t('route.cod')} <MoneyDisplay pesewas={r.codDueTotalPesewas} strong />
            </p>
            {changed ? <Alert severity="info" title={t('route.unsaved')} /> : null}
            <ol className="grid gap-2" aria-label={t('route.stops')}>
              {ids.map((deliveryId, index) => {
                const d = byId.get(deliveryId);
                if (d === undefined) return null;
                return (
                  <li key={deliveryId}>
                    <Card>
                      <CardBody className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold">
                          {t('route.stopNo', { number: index + 1 })}
                        </span>
                        <span className="grid min-w-0 flex-1">
                          <span>{d.recipientName}</span>
                          <span className="text-control-sm text-fg-muted">
                            {t('route.areaSlot', {
                              area: d.area,
                              from: d.slotStartsAt,
                              to: d.slotEndsAt,
                            })}
                          </span>
                        </span>
                        <MoneyDisplay pesewas={d.codDuePesewas} />
                        <FulfilmentStatusBadge kind="delivery" status={d.status} />
                        {planned ? (
                          <span className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={index === 0}
                              aria-label={t('route.up', { name: d.recipientName })}
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp aria-hidden="true" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={index === ids.length - 1}
                              aria-label={t('route.down', { name: d.recipientName })}
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown aria-hidden="true" />
                            </Button>
                          </span>
                        ) : null}
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ol>
            {planned ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!changed} onClick={() => setOpen('reorder')}>
                  {t('route.saveOrder')}
                </Button>
                <Button disabled={changed} onClick={() => setOpen('start')}>
                  <Truck aria-hidden="true" />
                  {t('route.start')}
                </Button>
              </div>
            ) : null}
            <ConfirmDialog
              open={open === 'reorder'}
              onOpenChange={(next) => setOpen(next ? 'reorder' : null)}
              title={t('route.saveOrderTitle')}
              body={t('route.saveOrderBody')}
              confirmLabel={t('route.saveOrder')}
              pendingLabel={t('actions.working')}
              pending={reorder.isPending}
              error={reorder.error}
              failedTitle={t('route.saveFailed')}
              onConfirm={() => {
                reorder
                  .mutateAsync(reorderInput, { idempotencyKey: keyFor(reorderInput) })
                  .then(() => {
                    setOrder(null);
                    setOpen(null);
                  })
                  .catch(() => undefined);
              }}
            />
            <ConfirmDialog
              open={open === 'start'}
              onOpenChange={(next) => setOpen(next ? 'start' : null)}
              title={t('route.startTitle')}
              body={t('route.startBody', { driver: r.driver.displayName, count: stops.length })}
              confirmLabel={t('route.start')}
              pendingLabel={t('actions.working')}
              pending={start.isPending}
              error={start.error}
              failedTitle={t('route.startFailed')}
              onConfirm={() => {
                start
                  .mutateAsync(startInput, { idempotencyKey: keyFor(startInput) })
                  .then(() => setOpen(null))
                  .catch(() => undefined);
              }}
            >
              <p>
                {t('route.cod')} <MoneyDisplay pesewas={r.codDueTotalPesewas} strong />
              </p>
            </ConfirmDialog>
          </article>
        );
      }}
    </QueryBoundary>
  );
}
