import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarRange,
  CircleAlert,
  CircleSlash,
  HandCoins,
  PackageMinus,
  PawPrint,
  Printer,
  Truck,
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
import { isAvailable, unavailable, type FigureKey, type OwnerDashboard } from './figures';

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
 * The owner dashboard (FR-RPT, F5b, wired to contract 1.24.0 in F6). One read, `getOwnerDashboard`, scoped
 * to the branch chosen in the header. Every figure comes from the API; a figure the response does not carry
 * (`pendingFigures`, or not in the contract at all) is named in words, never shown as zero (`figures.ts`).
 * Each tile links to the screen behind it, and a figure with a series behind it draws it as a sparkline.
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
          // Nothing has happened: no stock, no animals, no purchases, and no sales or alerts where the
          // server sends them (a figure it does not send yet says nothing either way).
          d.stockValueAtCostPesewas === 0 &&
          d.animalsOnHand.total === 0 &&
          d.purchases.receiptCount === 0 &&
          (d.salesTodayPesewas === null || d.salesTodayPesewas === 0) &&
          (d.topMovers === null || d.topMovers.length === 0) &&
          (d.alerts === null || d.alerts.length === 0)
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
        {(d) => <Figures d={d} />}
      </QueryBoundary>
    </section>
  );
}

/** What the response carries, figure by figure: the value when available, otherwise null (`figures.ts`). */
function liveFigures(d: OwnerDashboard) {
  const pick = <T,>(key: FigureKey, value: T | null): T | null =>
    isAvailable(key, d) ? value : null;
  return {
    salesToday: pick('salesToday', d.salesTodayPesewas),
    salesSeries: pick('salesSeries', d.salesSeries),
    salesMonthToDate: pick('salesMonthToDate', d.salesMonthToDatePesewas),
    purchasesToday: pick('purchasesToday', d.purchasesTodayPesewas),
    purchasesSeries: pick('purchasesSeries', d.purchases),
    stockValue: pick('stockValue', d.stockValueAtCostPesewas),
    lowStock: pick('lowStock', d.lowStockCount),
    animalsOnHand: pick('animalsOnHand', d.animalsOnHand),
    receivables: pick('receivables', d.receivablesOutstandingPesewas),
    cash: pick('cash', d.cash),
    salesByChannel: pick('salesByChannel', d.salesByChannel),
    topMovers: pick('topMovers', d.topMovers),
    alerts: pick('alerts', d.alerts),
    exceptionsToday: pick('exceptionsToday', d.exceptionsToday),
  };
}

/** The dashboard's figures once the read has answered: the stat row, the pending strip and the panels. */
function Figures({ d }: { d: OwnerDashboard }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const auth = useAuth();
  const live = liveFigures(d);

  const tile = (props: {
    label: string;
    icon: LucideIcon;
    tone?: IconChipTone;
    value?: ReactNode;
    detail?: ReactNode;
    trend?: StatTrend;
    to?: string;
    series?: { values: readonly number[]; label: string };
  }) => {
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

  /**
   * Today against yesterday: a comparison of two integers from the API, never a computed change (CR-013
   * asks for the change). `rising` says which way is good: more sales is good, more spending is neutral.
   */
  const dayTrend = (today: number, yesterday: number, rising: 'good' | 'neutral'): StatTrend => {
    const direction = today > yesterday ? 'up' : today < yesterday ? 'down' : 'flat';
    return {
      direction,
      tone:
        direction === 'flat'
          ? 'neutral'
          : rising === 'neutral'
            ? 'neutral'
            : direction === 'up'
              ? 'good'
              : 'critical',
      label: t('yesterday', { amount: formatMoney(yesterday) }),
    };
  };

  /** The API's points behind a figure, oldest first, as a sparkline, with the dates it covers in words. */
  const seriesOf = <P,>(
    series: { from: string; to: string; points: readonly P[] } | null,
    value: (point: P) => number,
    label: 'tiles.salesSeries' | 'tiles.purchasesSeries',
  ) =>
    series === null
      ? undefined
      : { values: series.points.map(value), label: t(label, { from: series.from, to: series.to }) };

  return (
    <div className="grid gap-4">
      {/* The stat rows, each one card divided into columns (the reference's): how today's trading and
          money stand, then stock and animals. Four to a row, so a figure in cedis is never cut. A row
          the server sends nothing for yet is not drawn: its figures are in the pending strip. */}
      <TileRow label={t('glance')}>
        {live.salesToday === null
          ? null
          : tile({
              label: t('tiles.salesToday'),
              icon: Banknote,
              value: <MoneyDisplay pesewas={live.salesToday} />,
              trend:
                d.salesYesterdayPesewas === null
                  ? undefined
                  : dayTrend(live.salesToday, d.salesYesterdayPesewas, 'good'),
              series: seriesOf(
                live.salesSeries,
                (point) => point.salesPesewas,
                'tiles.salesSeries',
              ),
            })}
        {live.salesMonthToDate === null
          ? null
          : tile({
              label: t('series.salesMonthToDate'),
              icon: CalendarRange,
              tone: 'sand',
              value: <MoneyDisplay pesewas={live.salesMonthToDate} />,
            })}
        {live.receivables === null
          ? null
          : tile({
              label: t('tiles.receivables'),
              icon: HandCoins,
              tone: 'warning',
              value: <MoneyDisplay pesewas={live.receivables} />,
              detail:
                d.receivablesOverduePesewas === null
                  ? undefined
                  : t('tiles.overdue', { amount: formatMoney(d.receivablesOverduePesewas) }),
            })}
        {live.cash === null
          ? null
          : tile({
              label: t('tiles.cash'),
              icon: Wallet,
              tone: 'good',
              value: <MoneyDisplay pesewas={live.cash.totalPesewas} />,
              detail: t('tiles.cashDetail'),
            })}
      </TileRow>
      <TileRow label={t('stockRow')}>
        {live.purchasesToday === null
          ? null
          : tile({
              label: t('tiles.purchasesToday'),
              icon: Truck,
              tone: 'slate',
              value: <MoneyDisplay pesewas={live.purchasesToday} />,
              detail:
                live.purchasesSeries === null
                  ? t('tiles.atCost')
                  : t('tiles.purchasesPeriod', {
                      amount: formatMoney(live.purchasesSeries.totalPesewas),
                      count: live.purchasesSeries.receiptCount,
                    }),
              trend: dayTrend(live.purchasesToday, d.purchasesYesterdayPesewas, 'neutral'),
              series: seriesOf(
                live.purchasesSeries,
                (point) => point.valueAtCostPesewas,
                'tiles.purchasesSeries',
              ),
              to: auth.can('inv.goods_receipt.read') ? '/goods-receipts' : undefined,
            })}
        {live.stockValue === null
          ? null
          : tile({
              label: t('tiles.stockValue'),
              icon: Boxes,
              tone: 'info',
              value: <MoneyDisplay pesewas={live.stockValue} />,
              detail: t('tiles.atCost'),
              to: auth.can('inv.stock.read') ? '/stock' : undefined,
            })}
        {live.lowStock === null
          ? null
          : tile({
              label: t('tiles.lowStock'),
              icon: PackageMinus,
              tone: live.lowStock === 0 ? 'good' : 'warning',
              value: t('tiles.lowStockValue', { count: live.lowStock }),
              detail: t('tiles.lowStockDetail'),
              to: auth.can('inv.stock.read') ? '/stock' : undefined,
            })}
        {live.animalsOnHand === null
          ? null
          : tile({
              label: t('tiles.animals'),
              icon: PawPrint,
              tone: 'sand',
              value: t('tiles.animalsValue', { count: live.animalsOnHand.total }),
              detail:
                live.animalsOnHand.bySpecies.length === 0
                  ? undefined
                  : live.animalsOnHand.bySpecies
                      .map((row) =>
                        t('tiles.speciesCount', {
                          species: row.species?.name ?? t('tiles.speciesUnknown'),
                          count: row.count,
                        }),
                      )
                      .join(' · '),
              to: auth.can('liv.animal.read') ? '/animals' : undefined,
            })}
      </TileRow>

      {/* Every figure the response does not carry, in one strip, never as a zero. */}
      <PendingFigures pending={unavailable(d)} />

      <div className="grid gap-4 lg:grid-cols-2">
        {live.topMovers === null ? null : (
          <Panel id="dash-movers" title={t('movers.title')}>
            <TopMovers movers={live.topMovers} />
          </Panel>
        )}

        {live.salesByChannel === null ? null : (
          <Panel id="dash-channels" title={t('channels.title')}>
            <Donut
              title={t('channels.title')}
              hideTitle
              segments={live.salesByChannel.map((row) => ({
                label: t(`channels.${row.channel}`, { defaultValue: row.channel }),
                value: row.amountPesewas,
                formatted: t('channels.figure', {
                  amount: formatMoney(row.amountPesewas),
                  count: row.count,
                }),
              }))}
              centre={
                live.salesToday === null ? undefined : (
                  <span className="grid">
                    <span className="text-xs font-semibold">
                      <MoneyDisplay pesewas={live.salesToday} />
                    </span>
                    <span className="text-xs text-fg-muted">{t('channels.today')}</span>
                  </span>
                )
              }
            />
          </Panel>
        )}

        {live.alerts === null ? null : (
          <Panel id="dash-attention" title={t('attention.title')}>
            {live.alerts.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('attention.none')}</p>
            ) : (
              <ul className="grid gap-1">
                {live.alerts.map((alert, index) => {
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
            {live.exceptionsToday === null ? null : (
              <p className="text-control-sm">
                <Link to="/exceptions" className="text-accent-text underline">
                  {t('attention.exceptions', { count: live.exceptionsToday })}
                </Link>
              </p>
            )}
          </Panel>
        )}

        {live.cash === null ? null : (
          <Panel id="dash-cash" title={t('cash.title')}>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              {(
                [
                  ['tills', live.cash.tillsPesewas],
                  ['safe', live.cash.safePesewas],
                  ['drivers', live.cash.driversPesewas],
                  ['mobileMoney', live.cash.mobileMoneyPesewas],
                  ['bank', live.cash.bankPesewas],
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
                  <MoneyDisplay pesewas={live.cash.totalPesewas} strong />
                </dd>
              </div>
            </dl>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** A StatGroup that is drawn only when at least one of its tiles is (`null` children are figures not sent). */
function TileRow({ label, children }: { label: string; children: ReactNode[] }) {
  if (children.every((child) => child === null)) return null;
  return <StatGroup label={label}>{children}</StatGroup>;
}

/** Each figure, by the words it is known by on this screen, for the pending strip. */
const FIGURE_LABEL = {
  salesToday: 'tiles.salesToday',
  salesSeries: 'pending.salesSeries',
  salesMonthToDate: 'series.salesMonthToDate',
  purchasesToday: 'tiles.purchasesToday',
  purchasesSeries: 'pending.purchasesSeries',
  stockValue: 'tiles.stockValue',
  lowStock: 'tiles.lowStock',
  animalsOnHand: 'tiles.animals',
  receivables: 'tiles.receivables',
  cash: 'tiles.cash',
  salesByChannel: 'channels.title',
  topMovers: 'movers.title',
  alerts: 'attention.title',
  exceptionsToday: 'pending.exceptionsToday',
  stockHealth: 'health.title',
  stockByCategory: 'categories.title',
  stockAlerts: 'lists.stockAlerts',
  expiringLots: 'lists.expiringLots',
  expiredLots: 'lists.expiredLots',
  nearExpiry: 'lists.nearExpiry',
  invoices: 'invoices.title',
  recentPayments: 'payments.title',
  paymentSplit: 'pending.paymentSplit',
} as const satisfies Record<FigureKey, string>;

/**
 * The figures this response does not carry (`figures.ts`): those the server lists in `pendingFigures` and
 * those the contract has no field for. One compact strip instead of a dozen empty boxes, saying what each
 * is. A figure leaves the strip the moment the server sends it. Never a number: nothing here is a figure.
 */
function PendingFigures({ pending }: { pending: readonly FigureKey[] }) {
  const { t } = useTranslation('dashboard');
  if (pending.length === 0) return null;
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
          {pending.map((key) => (
            <li
              key={key}
              data-slot="pending-figure"
              className="rounded-full bg-slate-subtle px-2.5 py-0.5 text-control-sm text-slate-fg"
            >
              {t(FIGURE_LABEL[key])}
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
function TopMovers({ movers }: { movers: NonNullable<OwnerDashboard['topMovers']> }) {
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
          unit: units.after(mover.uom, mover.qty),
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
