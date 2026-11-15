import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarClock,
  CircleAlert,
  FileText,
  HandCoins,
  PackageMinus,
  PawPrint,
  Printer,
  ScanBarcode,
  ShoppingCart,
  Truck,
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
  PageHeader,
  ProgressList,
  QueryBoundary,
  StatTile,
  StatusBadge,
  Unavailable,
  cn,
  formatQuantity,
  type BadgeTone,
  type StatTrend,
} from '@hakorem/ui';
import { protectedRoutes } from '../app/routes';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { lookup } from '../lib/lookup';
import { useStateLabels } from '../lib/states';
import { useUnits } from '../stock/units';
import { isAvailable, type FigureKey, type OwnerDashboard } from './figures';

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
        'grid content-start gap-3 rounded-lg border border-border bg-surface p-4',
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
  const units = useUnits();
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
  const unavailable = t('unavailable');
  const unavailableBody = t('unavailableBody');
  const off = (key: FigureKey) => (isAvailable(key) ? undefined : unavailable);

  const tile = (
    key: FigureKey,
    props: {
      label: string;
      icon: LucideIcon;
      value?: ReactNode;
      detail?: ReactNode;
      trend?: StatTrend;
      to?: string;
    },
  ) => {
    const { to, ...rest } = props;
    const common = { ...rest, unavailable: off(key) };
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <StatTile key={i} label={t('loadingTile')} loadingLabel={t('loading')} />
            ))}
          </div>
        }
      >
        {(d) => (
          <div className="grid gap-4">
            {/* The stat row: how today is going. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {tile('salesToday', {
                label: t('tiles.salesToday'),
                icon: Banknote,
                value: <MoneyDisplay pesewas={d.salesTodayPesewas} />,
                trend: salesTrend(d),
              })}
              {tile('purchasesToday', {
                label: t('tiles.purchasesToday'),
                icon: ShoppingCart,
                to: auth.can('inv.goods_receipt.read') ? '/goods-receipts' : undefined,
              })}
              {tile('stockValue', {
                label: t('tiles.stockValue'),
                icon: Boxes,
                value: <MoneyDisplay pesewas={d.stockValueAtCostPesewas} />,
                detail: t('tiles.atCost'),
                to: auth.can('inv.stock.read') ? '/stock' : undefined,
              })}
              {tile('receivables', {
                label: t('tiles.receivables'),
                icon: HandCoins,
                value: <MoneyDisplay pesewas={d.receivablesOutstandingPesewas} />,
                detail: t('tiles.overdue', { amount: formatMoney(d.receivablesOverduePesewas) }),
              })}
              {tile('lowStock', {
                label: t('tiles.lowStock'),
                icon: PackageMinus,
                to: auth.can('inv.stock.read') ? '/lots' : undefined,
              })}
              {tile('animalsOnHand', { label: t('tiles.animals'), icon: PawPrint })}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {/* Sales and purchases over the period, with the two comparison cards. */}
              <Panel id="dash-series" title={t('series.title')} className="xl:col-span-2">
                <Unavailable title={unavailable} description={t('series.unavailable')} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {tile('salesMonthToDate', {
                    label: t('series.salesMonthToDate'),
                    icon: Banknote,
                    value: <MoneyDisplay pesewas={d.salesMonthToDatePesewas} />,
                  })}
                  {tile('purchasesPeriod', {
                    label: t('series.purchasesMonthToDate'),
                    icon: Truck,
                    to: auth.can('inv.goods_receipt.read') ? '/goods-receipts' : undefined,
                  })}
                </div>
              </Panel>

              {/* Stock health on the deep teal panel: a dark-theme island (ADR 0001, amendment). */}
              <section
                data-theme="dark"
                aria-labelledby="dash-health"
                className="grid content-start gap-3 rounded-lg bg-panel p-4 text-fg"
              >
                <h2 id="dash-health" className="text-lg font-semibold">
                  {t('health.title')}
                </h2>
                <p className="text-sm text-fg-muted">{t('health.summary')}</p>
                {isAvailable('stockHealth') ? null : (
                  <p className="flex items-center gap-2 rounded-md border border-dashed border-border-strong p-3 text-sm">
                    <span className="font-semibold">{unavailable}</span>
                    <span className="text-fg-muted">{t('health.unavailable')}</span>
                  </p>
                )}
                {auth.can('inv.stock.read') ? (
                  <Link to="/stock" className="text-sm text-accent-text underline">
                    {t('health.open')}
                  </Link>
                ) : null}
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                            icon={look.icon}
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

              <Panel id="dash-movers" title={t('movers.title')}>
                {d.topMovers.length === 0 ? (
                  <p className="text-sm text-fg-muted">{t('movers.none')}</p>
                ) : (
                  <ProgressList
                    label={t('movers.title')}
                    items={d.topMovers.map((mover) => ({
                      id: mover.product.id,
                      label: mover.product.name,
                      value: mover.revenuePesewas,
                      formatted: t('movers.figure', {
                        amount: formatMoney(mover.revenuePesewas),
                        qty: formatQuantity(mover.qty, { places: units.places(mover.uom) }),
                        unit: units.name(mover.uom),
                      }),
                      href: auth.can('mdm.product.read')
                        ? `/products/${mover.product.id}`
                        : undefined,
                    }))}
                    renderLink={(href, children, className) => (
                      <Link to={href} className={className}>
                        {children}
                      </Link>
                    )}
                  />
                )}
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

              <Panel id="dash-categories" title={t('categories.title')}>
                <Unavailable title={unavailable} description={unavailableBody} />
              </Panel>

              <Panel id="dash-invoices" title={t('invoices.title')}>
                <div className="grid gap-2">
                  {(['total', 'paid', 'overdue'] as const).map((key) => (
                    <StatTile
                      key={key}
                      label={t(`invoices.${key}`)}
                      icon={FileText}
                      unavailable={off('invoices')}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ['stockAlerts', PackageMinus],
                  ['expiringLots', CalendarClock],
                  ['expiredLots', AlertTriangle],
                  ['nearExpiry', CalendarClock],
                ] as const
              ).map(([key]) => (
                <Panel key={key} id={`dash-${key}`} title={t(`lists.${key}`)}>
                  <Unavailable title={unavailable} description={unavailableBody} />
                  {key !== 'nearExpiry' && auth.can('inv.stock.read') ? (
                    <Link to="/lots" className="text-sm text-accent-text underline">
                      {t('lists.openLots')}
                    </Link>
                  ) : null}
                </Panel>
              ))}
            </div>

            <Panel id="dash-payments" title={t('payments.title')}>
              <div className="grid gap-3 md:grid-cols-2">
                <Unavailable title={unavailable} description={t('payments.splitUnavailable')} />
                <Unavailable title={unavailable} description={t('payments.recentUnavailable')} />
              </div>
            </Panel>
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}
