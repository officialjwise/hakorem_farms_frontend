import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarRange,
  CircleAlert,
  CircleSlash,
  HandCoins,
  Printer,
  ScanBarcode,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, matchRoutes } from 'react-router';
import {
  AlertRow,
  Button,
  Donut,
  formatMoney,
  MoneyDisplay,
  ProgressList,
  QueryBoundary,
  IconChip,
  StatGroup,
  StatTile,
  StatusBadge,
  cn,
  formatQuantity,
  type BadgeTone,
  type IconChipTone,
  type StatTrend,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { protectedRoutes } from '../app/routes';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { lookup } from '../lib/lookup';
import { useStateLabels } from '../lib/states';
import { useUnits } from '../stock/units';
import { isAvailable, UNAVAILABLE, type FigureKey, type OwnerDashboard } from './figures';

/** A card with a heading, as the dashboard's panels are. */
function Panel({
  title,
  id,
  action,
  children,
  className,
}: {
  title: string;
  id: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'grid content-start gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const SEVERITY: Record<'INFO' | 'REVIEW' | 'URGENT', { tone: BadgeTone; icon: LucideIcon }> = {
  INFO: { tone: 'info', icon: CircleAlert },
  REVIEW: { tone: 'warning', icon: AlertTriangle },
  URGENT: { tone: 'critical', icon: CircleAlert },
};

/** The console's own routes, so an alert's link becomes a link only when it leads somewhere here. */
function isConsoleRoute(link: string): boolean {
  return (matchRoutes(protectedRoutes, link) ?? []).some((match) => match.route.path !== undefined);
}

/**
 * The owner dashboard (FR-RPT, F5b). One read, `getOwnerDashboard`, scoped to the branch chosen in the
 * header. Every figure comes from the API; a figure the contract does not carry yet is shown as
 * unavailable in words, never as zero (`figures.ts`, CR-013). Each tile links to the screen behind it.
 */
export function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common']);
  const auth = useAuth();
  const scope = useBranchScope();
  const allowed = auth.can('rpt.dashboard.owner');
  // Money and stock an owner acts on: `live`, the default.
  const dashboard = useApiQuery('getOwnerDashboard', { query: scope.query }, { enabled: allowed });
  const labels = useStateLabels({
    loading: t('loading'),
    emptyTitle: t('empty'),
    emptyDescription: t('emptyBody'),
    errorTitle: t('error'),
    deniedTitle: t('denied'),
  });
  const branchName =
    scope.branchId === null
      ? t('allBranches')
      : (scope.branches.find((branch) => branch.id === scope.branchId)?.name ?? '');

  const tile = (
    key: FigureKey,
    props: {
      label: string;
      icon: LucideIcon;
      tone?: IconChipTone;
      value?: ReactNode;
      detail?: ReactNode;
      trend?: StatTrend;
      to?: string;
    },
  ) => {
    // A figure with no data source is in the strip below the row, not an empty cell in it.
    if (!isAvailable(key)) return null;
    const { to, tone, ...rest } = props;
    const common = { ...rest, iconTone: tone, variant: 'cell' as const };
    return to === undefined ? (
      <StatTile {...common} />
    ) : (
      <StatTile {...common} asChild>
        <Link to={to} />
      </StatTile>
    );
  };

  const salesTrend = (d: OwnerDashboard): StatTrend => {
    // A comparison of two integers from the API, never a computed change (CR-013 asks for the change).
    const direction =
      d.salesTodayPesewas > d.salesYesterdayPesewas
        ? 'up'
        : d.salesTodayPesewas < d.salesYesterdayPesewas
          ? 'down'
          : 'flat';
    return {
      direction,
      tone: direction === 'up' ? 'good' : direction === 'down' ? 'critical' : 'neutral',
      label: t('yesterday', { amount: formatMoney(d.salesYesterdayPesewas) }),
    };
  };

  const header = (asOf: string | null) => (
    <PageHeader
      title={t('title')}
      titleId="dashboard-title"
      description={t('description', { branch: branchName })}
      generatedAt={
        asOf === null ? undefined : (
          <span>
            {t('generated')} <When instant={asOf} /> · {t('common:time.zone')}
          </span>
        )
      }
      refresh={
        allowed
          ? {
              label: t('refresh'),
              refreshingLabel: t('refreshing'),
              refreshing: dashboard.isFetching,
              onRefresh: () => void dashboard.refetch(),
            }
          : undefined
      }
      actions={
        <>
          {auth.can('pos.sale.create') ? (
            <Button asChild size="sm">
              <Link to="/pos">
                <ScanBarcode aria-hidden="true" />
                {t('openPos')}
              </Link>
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            {t('print')}
          </Button>
        </>
      }
    />
  );

  return (
    <section aria-labelledby="dashboard-title" className="grid gap-4">
      {header(dashboard.data?.asOf ?? null)}
      <QueryBoundary
        query={dashboard}
        labels={labels}
        denied={!allowed}
        isEmpty={(d) =>
          d.salesTodayPesewas === 0 &&
          d.stockValueAtCostPesewas === 0 &&
          d.topMovers.length === 0 &&
          d.alerts.length === 0
        }
        emptyAction={
          auth.can('inv.goods_receipt.create') ? (
            <Button asChild>
              <Link to="/goods-receipts/new">{t('receiveStock')}</Link>
            </Button>
          ) : undefined
        }
        loadingFallback={
          <StatGroup label={t('glance')}>
            {[0, 1, 2, 3, 4].map((i) => (
              <StatTile
                key={i}
                variant="cell"
                label={t('loadingTile')}
                loadingLabel={t('loading')}
              />
            ))}
          </StatGroup>
        }
      >
        {(d) => (
          <div className="grid gap-4">
            {/* The stat row: how today is going, one card divided into columns (the reference's). */}
            <StatGroup label={t('glance')}>
              {tile('salesToday', {
                label: t('tiles.salesToday'),
                icon: Banknote,
                value: <MoneyDisplay pesewas={d.salesTodayPesewas} />,
                trend: salesTrend(d),
              })}
              {tile('salesMonthToDate', {
                label: t('series.salesMonthToDate'),
                icon: CalendarRange,
                tone: 'sand',
                value: <MoneyDisplay pesewas={d.salesMonthToDatePesewas} />,
              })}
              {tile('stockValue', {
                label: t('tiles.stockValue'),
                icon: Boxes,
                tone: 'info',
                value: <MoneyDisplay pesewas={d.stockValueAtCostPesewas} />,
                detail: t('tiles.atCost'),
                to: auth.can('inv.stock.read') ? '/stock' : undefined,
              })}
              {tile('receivables', {
                label: t('tiles.receivables'),
                icon: HandCoins,
                tone: 'warning',
                value: <MoneyDisplay pesewas={d.receivablesOutstandingPesewas} />,
                detail: t('tiles.overdue', { amount: formatMoney(d.receivablesOverduePesewas) }),
              })}
              {tile('cash', {
                label: t('tiles.cash'),
                icon: Wallet,
                tone: 'good',
                value: <MoneyDisplay pesewas={d.cash.totalPesewas} />,
                detail: t('tiles.cashDetail'),
              })}
            </StatGroup>

            {/* Every figure with no data source yet, in one strip, saying what it arrives with. */}
            <PendingFigures />

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel id="dash-movers" title={t('movers.title')}>
                <TopMovers movers={d.topMovers} />
              </Panel>

              <Panel id="dash-channels" title={t('channels.title')}>
                <Donut
                  title={t('channels.title')}
                  hideTitle
                  segments={d.salesByChannel.map((row) => ({
                    label: t(`channels.${row.channel}`, { defaultValue: row.channel }),
                    value: row.amountPesewas,
                    formatted: t('channels.figure', {
                      amount: formatMoney(row.amountPesewas),
                      count: row.count,
                    }),
                  }))}
                  centre={
                    <span className="grid">
                      <span className="text-xs font-semibold">
                        <MoneyDisplay pesewas={d.salesTodayPesewas} />
                      </span>
                      <span className="text-xs text-fg-muted">{t('channels.today')}</span>
                    </span>
                  }
                />
              </Panel>

              <Panel id="dash-attention" title={t('attention.title')}>
                {d.alerts.length === 0 ? (
                  <p className="text-sm text-fg-muted">{t('attention.none')}</p>
                ) : (
                  <ul className="grid gap-1">
                    {d.alerts.map((alert, index) => {
                      const look = lookup(SEVERITY, alert.severity, SEVERITY.INFO);
                      const row = {
                        icon: look.icon,
                        tone: look.tone,
                        title: alert.summary,
                        status: (
                          <StatusBadge
                            tone={look.tone}
                            label={t(`attention.severity.${alert.severity}`, {
                              defaultValue: alert.severity,
                            })}
                          />
                        ),
                      };
                      return (
                        <li key={`${alert.kind}-${index}`}>
                          {alert.link !== null && isConsoleRoute(alert.link) ? (
                            <AlertRow {...row} asChild>
                              <Link to={alert.link} />
                            </AlertRow>
                          ) : (
                            <AlertRow {...row} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-control-sm text-fg-muted">
                  {t('attention.exceptions', { count: d.exceptionsToday })}
                </p>
              </Panel>

              <Panel id="dash-cash" title={t('cash.title')}>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                  {(
                    [
                      ['tills', d.cash.tillsPesewas],
                      ['safe', d.cash.safePesewas],
                      ['drivers', d.cash.driversPesewas],
                      ['mobileMoney', d.cash.mobileMoneyPesewas],
                      ['bank', d.cash.bankPesewas],
                    ] as const
                  ).map(([key, pesewas]) => (
                    <div key={key} className="contents">
                      <dt className="text-fg-muted">{t(`cash.${key}`)}</dt>
                      <dd className="text-end tabular-nums">
                        <MoneyDisplay pesewas={pesewas} />
                      </dd>
                    </div>
                  ))}
                  <div className="contents font-semibold">
                    <dt className="border-t border-border pt-1.5">{t('cash.total')}</dt>
                    <dd className="border-t border-border pt-1.5 text-end tabular-nums">
                      <MoneyDisplay pesewas={d.cash.totalPesewas} strong />
                    </dd>
                  </div>
                </dl>
              </Panel>
            </div>
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}

/** Each figure with no data source yet, by the words it is known by on this screen. */
const PENDING_LABEL = {
  purchasesToday: 'tiles.purchasesToday',
  lowStock: 'tiles.lowStock',
  animalsOnHand: 'tiles.animals',
  series: 'pending.series',
  purchasesPeriod: 'series.purchasesMonthToDate',
  stockHealth: 'health.title',
  stockByCategory: 'categories.title',
  stockAlerts: 'lists.stockAlerts',
  expiringLots: 'lists.expiringLots',
  expiredLots: 'lists.expiredLots',
  nearExpiry: 'lists.nearExpiry',
  invoices: 'invoices.title',
  recentPayments: 'payments.title',
  paymentSplit: 'pending.paymentSplit',
} as const satisfies Partial<Record<FigureKey, string>>;

/**
 * The figures the server does not send yet (`figures.ts`), in one compact strip instead of a dozen empty
 * boxes: what each is, and what it arrives with. A figure leaves the strip the moment its field is wired.
 * Never a number: nothing here is a figure.
 */
function PendingFigures() {
  const { t } = useTranslation('dashboard');
  if (UNAVAILABLE.length === 0) return null;
  return (
    <section
      aria-labelledby="dash-pending"
      data-slot="pending-figures"
      className="flex flex-wrap items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-4"
    >
      <IconChip icon={CircleSlash} tone="slate" size="sm" />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-0.5">
          <h2 id="dash-pending" className="text-sm font-semibold">
            {t('pending.title')}
          </h2>
          <p className="text-control-sm text-fg-muted">{t('pending.body')}</p>
        </div>
        <ul aria-label={t('pending.list')} className="flex flex-wrap gap-1.5">
          {UNAVAILABLE.map((key) => (
            <li
              key={key}
              data-slot="pending-figure"
              className="rounded-full bg-slate-subtle px-2.5 py-0.5 text-control-sm text-slate-fg"
            >
              {key in PENDING_LABEL ? t(PENDING_LABEL[key as keyof typeof PENDING_LABEL]) : key}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Today's best sellers. Its own component so the unit names it needs (a reference read) are asked for only
 * when there is a dashboard to show, never for a role that cannot see it.
 */
function TopMovers({ movers }: { movers: OwnerDashboard['topMovers'] }) {
  const { t } = useTranslation('dashboard');
  const auth = useAuth();
  const units = useUnits();
  if (movers.length === 0) return <p className="text-sm text-fg-muted">{t('movers.none')}</p>;
  return (
    <ProgressList
      label={t('movers.title')}
      items={movers.map((mover) => ({
        id: mover.product.id,
        label: mover.product.name,
        value: mover.revenuePesewas,
        formatted: t('movers.figure', {
          amount: formatMoney(mover.revenuePesewas),
          qty: formatQuantity(mover.qty, { places: units.places(mover.uom) }),
          unit: units.name(mover.uom),
        }),
        href: auth.can('mdm.product.read') ? `/products/${mover.product.id}` : undefined,
      }))}
      renderLink={(href, children, className) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    />
  );
}
