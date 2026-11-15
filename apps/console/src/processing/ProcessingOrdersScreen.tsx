import { Beef } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  DateRangeMenu,
  FilterMenu,
  IconChip,
  useTableView,
  WeightDisplay,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, countSet, FilterSelect, param } from '../stock/filters';
import {
  CompletionMoney,
  OrderStatusBadge,
  ORDER_STATUSES,
  PercentText,
  SetAtCompletion,
  useOrderName,
  YieldFlag,
  type Order,
} from './presentation';

const FLAGGED = 'true';
const NOT_FLAGGED = 'false';

/**
 * FR-PRC processing orders: each order of animals taken to the processing room, where it stands, its yield
 * against the standard and its total cost, all as the API gives them. Every filter is the API's own
 * (`status`, `from` and `to` as calendar dates of creation, `yieldVarianceFlag`). `listProcessingOrders`
 * takes no `branchId` (CR-015), so the branch note says the list is not narrowed.
 */
export function ProcessingOrdersScreen() {
  const { t } = useTranslation(['processing', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const rangeWords = useDateRangeWords();
  const orderName = useOrderName();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [status, setStatus] = useState(ANY);
  const [flag, setFlag] = useState(ANY);
  const orders = useApiQuery('listProcessingOrders', {
    query: {
      ...(range.from === undefined ? {} : { from: range.from }),
      ...(range.to === undefined ? {} : { to: range.to }),
      ...param('status', status),
      ...(flag === ANY ? {} : { yieldVarianceFlag: flag === FLAGGED }),
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
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    pages.reset();
  };
  const columns: TableColumn<Order>[] = [
    {
      id: 'order',
      rowHeader: true,
      head: t('orders.columns.order'),
      // ISO instants sort as text.
      sortValue: (order) => order.createdAt,
      cell: (order) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Beef} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/processing-orders/${order.id}`} className="text-accent-text underline">
              {orderName(order)}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {t('orders.route', {
                from: order.location.name,
                to: order.outputLocation.name,
              })}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('orders.columns.status'),
      sortValue: (order) => order.status,
      cell: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      id: 'inputs',
      head: t('orders.columns.inputs'),
      sortValue: (order) => order.inputs.map((input) => input.stockUnit.identifier).join(', '),
      cell: (order) => (
        <span className="grid">
          <span>{order.inputs.map((input) => input.stockUnit.identifier).join(', ')}</span>
          {order.inputWeightKg === null ? null : (
            <span className="text-control-sm text-fg-muted">
              <WeightDisplay kilograms={order.inputWeightKg} />
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'yield',
      head: t('orders.columns.yield'),
      cell: (order) => (
        <span className="grid gap-1">
          <span>
            {order.actualYieldPercent === null ? (
              <SetAtCompletion />
            ) : (
              <PercentText value={order.actualYieldPercent} />
            )}
            {order.expectedYieldPercent === null ? null : (
              <span className="text-control-sm text-fg-muted">
                {' '}
                {t('orders.expected', { value: order.expectedYieldPercent })}
              </span>
            )}
          </span>
          <YieldFlag order={order} />
        </span>
      ),
    },
    {
      id: 'cost',
      head: t('orders.columns.cost'),
      numeric: true,
      cell: (order) => (
        <CompletionMoney pesewas={order.totalCostPesewas} settled={order.status === 'COMPLETED'} />
      ),
    },
    {
      id: 'created',
      head: t('orders.columns.created'),
      sortValue: (order) => order.createdAt,
      cell: (order) => (
        <>
          {order.createdBy.displayName} · <When instant={order.createdAt} />
        </>
      ),
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="orders-title" className="grid gap-4">
      <PageHeader
        title={t('orders.title')}
        titleId="orders-title"
        description={<BranchScopeNote />}
        actions={
          auth.can('prc.order.create') ? (
            <Button asChild>
              <Link to="/processing-orders/new">{t('orders.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={orders}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(order) => order.id}
        tableLabel={t('orders.table')}
        exportName={t('orders.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('orders.pages') }}
        toolbar={
          <>
            <DateRangeMenu
              label={t('orders.dates')}
              summary={rangeWords(range)}
              from={range.from}
              to={range.to}
              onChange={(next) => {
                setRange(next);
                pages.reset();
              }}
              fromLabel={t('common:dates.from')}
              toLabel={t('common:dates.to')}
              clearLabel={t('common:dates.clear')}
            />
            <FilterMenu
              label={t('common:table.filter')}
              active={countSet(status, flag)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus(ANY);
                  setFlag(ANY);
                  pages.reset();
                },
              }}
            >
              <FilterSelect
                label={t('orders.filters.status')}
                anyLabel={t('orders.filters.anyStatus')}
                value={status}
                onChange={change(setStatus)}
                options={ORDER_STATUSES.map((value) => ({
                  value,
                  label: t(`orderStatus.${value}`),
                }))}
              />
              <FilterSelect
                label={t('orders.filters.yield')}
                anyLabel={t('orders.filters.anyYield')}
                value={flag}
                onChange={change(setFlag)}
                options={[
                  { value: FLAGGED, label: t('orders.filters.flagged') },
                  { value: NOT_FLAGGED, label: t('orders.filters.notFlagged') },
                ]}
              />
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
