import {
  BadgeCent,
  Banknote,
  CalendarClock,
  ChartColumn,
  Egg,
  EggOff,
  Hash,
  Landmark,
  Percent,
  ReceiptText,
  Scale,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  DatePicker,
  DateRangeMenu,
  QueryBoundary,
  IconChip,
  MoneyDisplay,
  ReportTile,
  formatDateTime,
  formatMoney,
  formatWeight,
  useTableView,
  type DateString,
  type FailureLike,
  type QueryLike,
  type ReportTileTone,
  type TableColumn,
} from '@hakorem/ui';
import { useBranchScope } from '../branch/branchScope';
import { useApiMutation, useApiQuery } from '../data/api';
import { useDateRangeWords } from '../lib/dateRange';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import {
  useListedCodes,
  useReportExport,
  useStatementExport,
  type ReportExporting,
} from './exporting';
import { accraToday, monthStart } from './period';

type ReportRun = components['schemas']['ReportRun'];
type Column = components['schemas']['ReportColumn'];

/**
 * The reports (F5b, F12). Most run on `runReport` by code; the ledger statements read their own operations
 * (`getProfitAndLoss`, `getBalanceSheet`, `getTrialBalance`) and export through `runReport` once its
 * listing carries their code (CR-061). The egg reports and the VAT return are codes the contract does not
 * list yet (CR-059, CR-060): each runs once `listReportDefinitions` lists its code, and says in words that
 * it waits for the backend until then. Every figure, total and summary is the API's.
 */
export const REPORTS = {
  sales: { group: 'trading', code: 'SALES_BY_CASHIER', icon: ChartColumn },
  purchases: { group: 'trading', code: 'PURCHASES', icon: ShoppingCart },
  'stock-valuation': { group: 'trading', code: 'STOCK_ON_HAND', icon: Warehouse },
  expiry: { group: 'trading', code: 'EXPIRING_LOTS', icon: CalendarClock },
  'profit-and-loss': {
    group: 'financial',
    code: null,
    exportCode: 'PROFIT_AND_LOSS',
    icon: BadgeCent,
  },
  'balance-sheet': { group: 'financial', code: null, exportCode: 'BALANCE_SHEET', icon: Landmark },
  'trial-balance': { group: 'financial', code: null, exportCode: 'TRIAL_BALANCE', icon: Scale },
  'egg-sales': { group: 'eggs', code: 'EGG_SALES_BY_SHOP', request: 'CR-059', icon: Egg },
  'egg-margin': { group: 'eggs', code: 'EGG_CRATE_MARGIN', request: 'CR-059', icon: Percent },
  'egg-breakage': { group: 'eggs', code: 'EGG_BREAKAGE', request: 'CR-059', icon: EggOff },
  'egg-valuation': {
    group: 'eggs',
    code: 'EGG_STOCK_VALUATION',
    request: 'CR-059',
    asOf: true,
    icon: Warehouse,
  },
  'vat-return': { group: 'tax', code: 'VAT_RETURN', request: 'CR-060', icon: ReceiptText },
} as const satisfies Record<string, ReportEntry>;
type ReportKey = keyof typeof REPORTS;

interface ReportEntry {
  group: 'trading' | 'financial' | 'eggs' | 'tax';
  /** The `runReport` code, or null for a ledger statement read through its own operation. */
  code: string | null;
  /** A statement's code on `runReport` for its file (CR-061). */
  exportCode?: string;
  /** The request a code waits for: the report runs once `listReportDefinitions` lists the code. */
  request?: 'CR-059' | 'CR-060';
  /** Read at the end of one day (`to`) rather than for a period. */
  asOf?: true;
  icon: LucideIcon;
}

const GROUPS = ['trading', 'financial', 'eggs', 'tax'] as const;

/** An entry read through its own shape, so the optional parts read as optional. */
const entry = (key: ReportKey): ReportEntry => REPORTS[key];

/** One cell of a report, formatted by the type the API gave its column. */
function cellText(column: Column, value: unknown): string {
  if (value === null || value === undefined) return '—';
  switch (column.type) {
    case 'PESEWAS':
      return typeof value === 'number' ? formatMoney(value) : String(value);
    case 'KG':
      return typeof value === 'string' ? formatWeight(value) : String(value);
    case 'PERCENT':
      return `${String(value)}%`;
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : String(value);
    default:
      return String(value);
  }
}

/** The reports in their groups, each a card that opens it; one that waits for the backend says so. */
export function ReportsScreen() {
  const { t } = useTranslation(['reports', 'common']);
  const { listing, codes } = useListedCodes();
  return (
    <section aria-labelledby="reports-title" className="grid gap-6">
      <PageHeader title={t('title')} titleId="reports-title" description={t('description')} />
      {GROUPS.map((group) => (
        <section key={group} aria-labelledby={`reports-${group}`} className="grid gap-3">
          <h2 id={`reports-${group}`} className="text-lg font-semibold">
            {t(`groups.${group}`)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(REPORTS) as ReportKey[])
              .filter((key) => entry(key).group === group)
              .map((key) => {
                const { icon: Icon, request, code } = entry(key);
                const waits =
                  request !== undefined &&
                  listing.status === 'success' &&
                  code !== null &&
                  !codes.has(code);
                return (
                  <li key={key}>
                    <Link
                      to={`/reports/${key}`}
                      className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm outline-focus outline-offset-2 hover:bg-surface-hover focus-visible:outline-2"
                    >
                      <IconChip icon={Icon} />
                      <span className="grid gap-0.5">
                        <span className="font-semibold">{t(`list.${key}.name`)}</span>
                        <span className="text-sm text-fg-muted">{t(`list.${key}.about`)}</span>
                        {waits ? (
                          <span className="text-control-sm text-fg-muted">
                            {t('waitsShort', { request })}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** A summary figure's icon and tint by the type of its column: money, weight, a share or a count. */
const TILE: Record<Column['type'], { icon: LucideIcon; tone: ReportTileTone }> = {
  PESEWAS: { icon: Banknote, tone: 'accent' },
  KG: { icon: Scale, tone: 'sand' },
  PERCENT: { icon: Percent, tone: 'info' },
  INTEGER: { icon: Hash, tone: 'good' },
  QUANTITY: { icon: Scale, tone: 'sand' },
  TEXT: { icon: Hash, tone: 'good' },
  DATE: { icon: CalendarClock, tone: 'info' },
  DATETIME: { icon: CalendarClock, tone: 'info' },
};
const TONES: readonly ReportTileTone[] = ['accent', 'sand', 'info', 'good'];

/** The report's period: the date pill, which always holds both ends (clearing returns to this month). */
function usePeriod() {
  const today = accraToday();
  const fallback = { from: monthStart(today), to: today };
  const [range, setRange] = useState(fallback);
  const words = useDateRangeWords();
  const { t } = useTranslation(['reports', 'common']);
  const menu = (
    <DateRangeMenu
      label={t('range')}
      summary={words(range)}
      from={range.from}
      to={range.to}
      onChange={(next) =>
        setRange({
          from: (next.from as DateString | undefined) ?? fallback.from,
          to: (next.to as DateString | undefined) ?? fallback.to,
        })
      }
      fromLabel={t('from')}
      toLabel={t('to')}
      clearLabel={t('thisMonth')}
    />
  );
  return { range, menu, words: `${range.from} to ${range.to}` };
}

/** A report read at the end of one day: a date, today in Accra until another is chosen. */
function useAsOf() {
  const { t } = useTranslation(['reports', 'common']);
  const [day, setDay] = useState<DateString>(accraToday());
  const menu = (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold">{t('asAt')}</span>
      <DatePicker
        value={day}
        max={accraToday()}
        onChange={(event) => {
          const next = event.target.value as DateString;
          setDay(next === '' ? accraToday() : next);
        }}
      />
    </label>
  );
  return { day, menu, words: t('asAtWords', { day }) };
}

/** A report from `runReport`: the period, the API's totals as report tiles, the table card, and export. */
export function ReportScreen() {
  const { t } = useTranslation(['reports', 'common']);
  const { report = '' } = useParams();
  const key = (report in REPORTS ? report : 'sales') as ReportKey;
  if (key === 'profit-and-loss') return <ProfitAndLoss />;
  if (key === 'balance-sheet') return <BalanceSheet />;
  if (key === 'trial-balance') return <TrialBalance />;
  const { code, request, asOf } = entry(key);
  const title = t(`list.${key}.name`);
  if (code === null) return null;
  if (request !== undefined) {
    return (
      <ListedReport
        reportKey={key}
        code={code}
        request={request}
        asOf={asOf === true}
        key={key}
        title={title}
      />
    );
  }
  return <RunReport reportKey={key} code={code} asOf={asOf === true} key={key} title={title} />;
}

/**
 * A report whose code the contract does not list yet (CR-059, CR-060): it runs, as any other, once
 * `listReportDefinitions` lists the code, and says in words that it waits for the backend until then.
 */
function ListedReport({
  reportKey,
  code,
  request,
  asOf,
  title,
}: {
  reportKey: ReportKey;
  code: string;
  request: string;
  asOf: boolean;
  title: string;
}) {
  const { t } = useTranslation(['reports', 'common']);
  const { listing } = useListedCodes();
  const labels = useStateLabels({
    loading: t('loading', { name: title }),
    emptyTitle: t('empty'),
    errorTitle: t('error', { name: title }),
    deniedTitle: t('denied'),
  });
  return (
    <QueryBoundary query={listing} labels={labels} isEmpty={() => false}>
      {(page) =>
        page.data.some((definition) => definition.code === code) ? (
          <RunReport reportKey={reportKey} code={code} asOf={asOf} title={title} />
        ) : (
          <section aria-labelledby="report-title" className="grid gap-4">
            <PageHeader
              title={title}
              titleId="report-title"
              description={t(`list.${reportKey}.about`)}
            />
            <Alert severity="info" title={t('waits', { request })} />
          </section>
        )
      }
    </QueryBoundary>
  );
}

type Row = Record<string, unknown>;

function RunReport({
  reportKey,
  code,
  title,
  asOf = false,
}: {
  reportKey: ReportKey;
  code: string;
  title: string;
  /** Read at the end of one day: the report takes `to` alone. */
  asOf?: boolean;
}) {
  const { t } = useTranslation(['reports', 'common']);
  const scope = useBranchScope();
  const range = usePeriod();
  const day = useAsOf();
  const period = asOf ? { menu: day.menu, words: day.words } : range;
  const run = useApiMutation('runReport');
  const keyFor = useIntentKey();
  const parameters = {
    ...(asOf ? { to: day.day } : { from: range.range.from, to: range.range.to }),
    ...(scope.branchId === null ? {} : { branchId: scope.branchId }),
  };
  const exporting = useReportExport(code, parameters);
  const asked = JSON.stringify(parameters);
  const go = () => {
    const body = {
      parameters: JSON.parse(asked) as Record<string, string>,
      format: 'SCREEN' as const,
    };
    void run
      .mutateAsync({ path: { code }, body }, { idempotencyKey: keyFor(body) })
      .catch(() => undefined);
  };
  // The latest `go`, so the effect below runs only when what is asked changes, not on every render
  // (the mutation's functions are new each render).
  const latest = useRef(go);
  useEffect(() => {
    latest.current = go;
  });
  useEffect(() => {
    latest.current();
  }, [asked, code]);
  const query: QueryLike<ReportRun, FailureLike> =
    run.status === 'error'
      ? { status: 'error', data: undefined, error: run.error, refetch: go }
      : run.data !== undefined && 'reportCode' in run.data
        ? { status: 'success', data: run.data, error: null, refetch: go }
        : { status: 'pending', data: undefined, error: null, refetch: go };
  const labels = useStateLabels({
    loading: t('loading', { name: title }),
    emptyTitle: t('empty'),
    emptyDescription: t('emptyBody'),
    errorTitle: t('error', { name: title }),
    deniedTitle: t('denied'),
  });
  const result = query.data?.result ?? null;
  const columns: TableColumn<Row>[] = (result?.columns ?? []).map((column, index) => ({
    id: column.key,
    head: column.label,
    rowHeader: index === 0,
    numeric: column.type !== 'TEXT' && column.type !== 'DATE',
    // The API's own values: integer pesewas, numbers and ISO strings compare as they are.
    sortValue: (row) => {
      const value = row[column.key];
      return typeof value === 'number' || typeof value === 'string' ? value : null;
    },
    cell: (row) => cellText(column, row[column.key]),
  }));
  const view = useTableView(columns);
  const totals = result?.totals ?? {};
  const summarised = (result?.columns ?? []).filter((column) => column.key in totals);
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader title={title} titleId="report-title" description={t(`list.${reportKey}.about`)} />
      {summarised.length === 0 ? null : (
        <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summarised.map((column, index) => (
            <li key={column.key}>
              <ReportTile
                label={column.label}
                value={cellText(column, totals[column.key])}
                detail={t('total')}
                icon={TILE[column.type].icon}
                tone={TONES[index % TONES.length]}
              />
            </li>
          ))}
        </ul>
      )}
      {exporting.status}
      <TableCard
        view={view}
        query={query}
        labels={labels}
        rows={(r) => (r.result?.rows ?? []) as Row[]}
        rowKey={(_, index) => String(index)}
        tableLabel={title}
        exportName={`${title}, ${period.words}`}
        exports={exporting.items}
        toolbar={period.menu}
        footer={(r) => (
          <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
            {t('asOf', {
              when: formatDateTime(r.dataAsOf ?? r.createdAt),
              count: r.rowCount ?? r.result?.rows.length ?? 0,
            })}
          </p>
        )}
      />
    </section>
  );
}

type Statement = components['schemas']['FinancialStatement'];
type Line = {
  key: string;
  label: string;
  section: string;
  amountPesewas: number;
  negative: boolean;
  total: boolean;
};

/** The statement's lines in its own order: each section's rows, then its total. */
function statementLines(s: Statement): Line[] {
  return s.sections.flatMap((section, index) => [
    ...section.rows.map((row, rowIndex) => ({
      key: `${section.key ?? index}-${rowIndex}`,
      label: row.label,
      section: section.label,
      amountPesewas: row.amountPesewas,
      negative: row.isNegative,
      total: false,
    })),
    {
      key: `${section.key ?? index}-total`,
      label: section.label,
      section: section.label,
      amountPesewas: section.totalPesewas,
      negative: section.totalIsNegative,
      total: true,
    },
  ]);
}

/**
 * A ledger statement (profit and loss, balance sheet): its sections' totals as tiles, its lines in the
 * statement's own order, the API's checks in words, and export. Every amount is the API's; a negative one
 * says so in words, never by a minus sign alone.
 */
function StatementView({
  reportKey,
  statement,
  toolbar,
  period,
  exporting,
}: {
  reportKey: 'profit-and-loss' | 'balance-sheet';
  statement: QueryLike<Statement, FailureLike>;
  toolbar: ReactNode;
  period: string;
  exporting: ReportExporting;
}) {
  const { t } = useTranslation(['reports', 'common']);
  const title = t(`list.${reportKey}.name`);
  const labels = useStateLabels({
    loading: t('loading', { name: title }),
    emptyTitle: t('empty'),
    errorTitle: t('error', { name: title }),
    deniedTitle: t('denied'),
  });
  // The statement's own order matters (a section's rows, then its total), so its lines do not sort.
  const view = useTableView<Line>([
    {
      id: 'line',
      head: t('pl.line'),
      rowHeader: true,
      cell: (line) =>
        line.total ? (
          <span className="font-bold">{t('pl.totalFor', { section: line.section })}</span>
        ) : (
          <span className="grid">
            <span>{line.label}</span>
            <span className="text-control-sm font-normal text-fg-muted">{line.section}</span>
          </span>
        ),
    },
    {
      id: 'amount',
      head: t('pl.amount'),
      numeric: true,
      cell: (line) => (
        <>
          <MoneyDisplay pesewas={line.amountPesewas} strong={line.total} />
          {line.negative ? ` ${t('negativeShort')}` : ''}
        </>
      ),
    },
  ]);
  const s = statement.data;
  const failed = (s?.checks ?? []).filter((check) => !check.passed);
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader title={title} titleId="report-title" description={t(`list.${reportKey}.about`)} />
      {s === undefined || s.sections.length === 0 ? null : (
        <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {s.sections.map((section, index) => (
            <li key={section.key ?? index}>
              <ReportTile
                label={section.label}
                value={<MoneyDisplay pesewas={section.totalPesewas} />}
                detail={
                  section.totalIsNegative
                    ? t(reportKey === 'profit-and-loss' ? 'negative' : 'negativeBalance')
                    : t(reportKey === 'profit-and-loss' ? 'total' : 'totalAt')
                }
                icon={Banknote}
                tone={TONES[index % TONES.length]}
              />
            </li>
          ))}
        </ul>
      )}
      {exporting.status}
      <TableCard
        view={view}
        query={statement}
        labels={labels}
        rows={statementLines}
        rowKey={(line) => line.key}
        tableLabel={title}
        exportName={`${title}, ${period}`}
        exports={exporting.items}
        toolbar={toolbar}
        footer={(statementData) => (
          <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
            {t('generated', { when: formatDateTime(statementData.generatedAt) })}
          </p>
        )}
      />
      {s === undefined || s.checks.length === 0 ? null : failed.length === 0 ? (
        <Alert severity="good" title={t('checksPassed', { count: s.checks.length })}>
          {s.checks.map((check) => check.name).join('; ')}
        </Alert>
      ) : (
        <Alert severity="critical" title={t('checksFailed', { count: failed.length })}>
          {failed.map((check) => check.name).join('; ')}
        </Alert>
      )}
    </section>
  );
}

/** Profit and loss for a period, from the ledger (`getProfitAndLoss`). */
function ProfitAndLoss() {
  const scope = useBranchScope();
  const period = usePeriod();
  // A statement an owner reads and acts on: `live`.
  const statement = useApiQuery('getProfitAndLoss', {
    query: { from: period.range.from, to: period.range.to, ...scope.query },
  });
  const exporting = useStatementExport('PROFIT_AND_LOSS', {
    from: period.range.from,
    to: period.range.to,
    ...scope.query,
  });
  return (
    <StatementView
      reportKey="profit-and-loss"
      statement={statement}
      toolbar={period.menu}
      period={period.words}
      exporting={exporting}
    />
  );
}

/** The balance sheet at the end of a day, from the ledger (`getBalanceSheet`). */
function BalanceSheet() {
  const scope = useBranchScope();
  const day = useAsOf();
  const statement = useApiQuery('getBalanceSheet', { query: { asOf: day.day, ...scope.query } });
  const exporting = useStatementExport('BALANCE_SHEET', { asOf: day.day, ...scope.query });
  return (
    <StatementView
      reportKey="balance-sheet"
      statement={statement}
      toolbar={day.menu}
      period={day.words}
      exporting={exporting}
    />
  );
}

type TrialBalancePage = components['schemas']['TrialBalance'];
type TrialBalanceRow = components['schemas']['TrialBalanceRow'];

/**
 * The trial balance for a period (`getTrialBalance`): each account's opening, period and closing debits and
 * credits, in account order, a page at a time, with the API's totals over the whole range and whether it
 * balances, in words. The totals are never summed from the page.
 */
function TrialBalance() {
  const { t } = useTranslation(['reports', 'common']);
  const scope = useBranchScope();
  const period = usePeriod();
  const pages = useCursorPages();
  const balance = useApiQuery('getTrialBalance', {
    query: {
      from: period.range.from,
      to: period.range.to,
      ...scope.query,
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const exporting = useStatementExport('TRIAL_BALANCE', {
    from: period.range.from,
    to: period.range.to,
    ...scope.query,
  });
  const title = t('list.trial-balance.name');
  const labels = useStateLabels({
    loading: t('loading', { name: title }),
    emptyTitle: t('empty'),
    emptyDescription: t('emptyBody'),
    errorTitle: t('error', { name: title }),
    deniedTitle: t('denied'),
  });
  const money = (pesewas: number) => <MoneyDisplay pesewas={pesewas} />;
  const view = useTableView<TrialBalanceRow>([
    {
      id: 'account',
      head: t('tb.account'),
      rowHeader: true,
      sortValue: (row) => row.account.code,
      cell: (row) => (
        <span className="grid">
          <span>
            {row.account.code} {row.account.name}
          </span>
          <span className="text-control-sm font-normal text-fg-muted">{row.type}</span>
        </span>
      ),
    },
    {
      id: 'openingDebit',
      head: t('tb.openingDebit'),
      numeric: true,
      cell: (row) => money(row.openingDebitPesewas),
    },
    {
      id: 'openingCredit',
      head: t('tb.openingCredit'),
      numeric: true,
      cell: (row) => money(row.openingCreditPesewas),
    },
    {
      id: 'periodDebit',
      head: t('tb.periodDebit'),
      numeric: true,
      cell: (row) => money(row.periodDebitPesewas),
    },
    {
      id: 'periodCredit',
      head: t('tb.periodCredit'),
      numeric: true,
      cell: (row) => money(row.periodCreditPesewas),
    },
    {
      id: 'closingDebit',
      head: t('tb.closingDebit'),
      numeric: true,
      cell: (row) => money(row.closingDebitPesewas),
    },
    {
      id: 'closingCredit',
      head: t('tb.closingCredit'),
      numeric: true,
      cell: (row) => money(row.closingCreditPesewas),
    },
  ]);
  const data = balance.data;
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader
        title={title}
        titleId="report-title"
        description={t('list.trial-balance.about')}
      />
      {data === undefined ? null : (
        <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li>
            <ReportTile
              label={t('tb.totalDebit')}
              value={money(data.totalDebitPesewas)}
              detail={t('total')}
              icon={Banknote}
              tone="accent"
            />
          </li>
          <li>
            <ReportTile
              label={t('tb.totalCredit')}
              value={money(data.totalCreditPesewas)}
              detail={t('total')}
              icon={Banknote}
              tone="sand"
            />
          </li>
        </ul>
      )}
      {data === undefined ? null : data.balanced ? (
        <Alert severity="good" title={t('tb.balanced')} />
      ) : (
        <Alert severity="critical" title={t('tb.notBalanced')}>
          {t('tb.notBalancedBody')}
        </Alert>
      )}
      {exporting.status}
      <TableCard
        view={view}
        query={balance}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.account.id}
        tableLabel={title}
        exportName={`${title}, ${period.words}`}
        exports={exporting.items}
        toolbar={period.menu}
        layout="scroll"
        pages={{ state: pages, info: (page: TrialBalancePage) => page.page, label: t('tb.pages') }}
        footer={(page) => (
          <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
            {t('generated', { when: formatDateTime(page.asOf) })}
          </p>
        )}
      />
    </section>
  );
}
