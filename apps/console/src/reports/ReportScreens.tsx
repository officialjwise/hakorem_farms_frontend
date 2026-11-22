import {
  BadgeCent,
  Banknote,
  CalendarClock,
  ChartColumn,
  Hash,
  Percent,
  Scale,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  DateRangeMenu,
  IconChip,
  MoneyDisplay,
  MutationFailure,
  ReportTile,
  formatDateTime,
  formatMoney,
  formatWeight,
  useTableView,
  type DateString,
  type ExportMenuItem,
  type FailureLike,
  type QueryLike,
  type ReportTileTone,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiMutation, useApiQuery } from '../data/api';
import { useDateRangeWords } from '../lib/dateRange';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { accraToday, monthStart } from './period';

type ReportRun = components['schemas']['ReportRun'];
type Column = components['schemas']['ReportColumn'];

/**
 * The reports the owner asked for (F5b). Four run on `runReport` by code: two codes are in the contract's
 * examples (STOCK_ON_HAND, EXPIRING_LOTS), SALES_BY_CASHIER stands for sales, and PURCHASES is asked for in
 * CR-018. Profit and loss is `getProfitAndLoss`. Every figure, total and summary is the API's.
 */
export const REPORTS = {
  sales: { code: 'SALES_BY_CASHIER', icon: ChartColumn },
  purchases: { code: 'PURCHASES', icon: ShoppingCart },
  'stock-valuation': { code: 'STOCK_ON_HAND', icon: Warehouse },
  expiry: { code: 'EXPIRING_LOTS', icon: CalendarClock },
  'profit-and-loss': { code: null, icon: BadgeCent },
} as const satisfies Record<string, { code: string | null; icon: LucideIcon }>;
type ReportKey = keyof typeof REPORTS;

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

/** The reports, each a card that opens it. */
export function ReportsScreen() {
  const { t } = useTranslation(['reports', 'common']);
  return (
    <section aria-labelledby="reports-title" className="grid gap-4">
      <PageHeader title={t('title')} titleId="reports-title" description={t('description')} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(REPORTS) as ReportKey[]).map((key) => {
          const Icon = REPORTS[key].icon;
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
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
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
  return { range, menu };
}

/**
 * Export as a spreadsheet or PDF: the API builds the file (rpt.report.export). The formats go in the table
 * card's Export menu; what came of the last export (the link, "being prepared", or the failure) stays on
 * the page in words.
 */
function useReportExport(code: string, parameters: Record<string, string>) {
  const { t } = useTranslation(['reports', 'common']);
  const auth = useAuth();
  const run = useApiMutation('runReport');
  const keyFor = useIntentKey();
  const labels = useStateLabels({
    loading: t('exporting'),
    emptyTitle: t('notExported'),
    errorTitle: t('notExported'),
    deniedTitle: t('notExported'),
  });
  if (!auth.can('rpt.report.export')) return { items: [], status: null };
  const go = (format: 'XLSX' | 'PDF') => {
    const body = { parameters, format };
    void run
      .mutateAsync({ path: { code }, body }, { idempotencyKey: keyFor(body) })
      .catch(() => undefined);
  };
  const items: ExportMenuItem[] = [
    { id: 'xlsx', label: t('xlsx'), onSelect: () => go('XLSX'), disabled: run.isPending },
    { id: 'pdf', label: t('pdf'), onSelect: () => go('PDF'), disabled: run.isPending },
  ];
  const file = run.data && 'file' in run.data ? run.data.file : null;
  const status = run.isPending ? (
    <p role="status" className="text-sm text-fg-muted">
      {t('exporting')}
    </p>
  ) : run.isError ? (
    <MutationFailure error={run.error} labels={labels} />
  ) : run.isSuccess ? (
    file === null || file === undefined ? (
      <p role="status" className="text-sm text-fg-muted">
        {t('queued')}
      </p>
    ) : (
      <p role="status" className="text-sm">
        <a href={file.url} className="text-accent-text underline" target="_blank" rel="noreferrer">
          {t('download')}
        </a>
      </p>
    )
  ) : null;
  return { items, status };
}

/** A report from `runReport`: the period, the API's totals as report tiles, the table card, and export. */
export function ReportScreen() {
  const { t } = useTranslation(['reports', 'common']);
  const { report = '' } = useParams();
  const key = (report in REPORTS ? report : 'sales') as ReportKey;
  if (key === 'profit-and-loss') return <ProfitAndLoss />;
  return (
    <RunReport reportKey={key} code={REPORTS[key].code} key={key} title={t(`list.${key}.name`)} />
  );
}

type Row = Record<string, unknown>;

function RunReport({
  reportKey,
  code,
  title,
}: {
  reportKey: ReportKey;
  code: string;
  title: string;
}) {
  const { t } = useTranslation(['reports', 'common']);
  const scope = useBranchScope();
  const period = usePeriod();
  const run = useApiMutation('runReport');
  const keyFor = useIntentKey();
  const parameters = {
    from: period.range.from,
    to: period.range.to,
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
        exportName={`${title}, ${period.range.from} to ${period.range.to}`}
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

/** Profit and loss for a period, from the ledger (`getProfitAndLoss`): sections, their rows and totals. */
function ProfitAndLoss() {
  const { t } = useTranslation(['reports', 'common']);
  const scope = useBranchScope();
  const period = usePeriod();
  // A statement an owner reads and acts on: `live`.
  const statement = useApiQuery('getProfitAndLoss', {
    query: { from: period.range.from, to: period.range.to, ...scope.query },
  });
  const title = t('list.profit-and-loss.name');
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
  const lines = (s: Statement): Line[] =>
    s.sections.flatMap((section) => [
      ...section.rows.map((row) => ({
        key: `${section.key}-${row.label}`,
        label: row.label,
        section: section.label,
        amountPesewas: row.amountPesewas,
        negative: row.isNegative,
        total: false,
      })),
      {
        key: `${section.key}-total`,
        label: section.label,
        section: section.label,
        amountPesewas: section.totalPesewas,
        negative: false,
        total: true,
      },
    ]);
  const s = statement.data;
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader
        title={title}
        titleId="report-title"
        description={t('list.profit-and-loss.about')}
      />
      {s === undefined || s.sections.length === 0 ? null : (
        <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {s.sections.map((section, index) => (
            <li key={section.key}>
              <ReportTile
                label={section.label}
                value={<MoneyDisplay pesewas={section.totalPesewas} />}
                detail={section.totalIsNegative ? t('negative') : t('total')}
                icon={Banknote}
                tone={TONES[index % TONES.length]}
              />
            </li>
          ))}
        </ul>
      )}
      <TableCard
        view={view}
        query={statement}
        labels={labels}
        rows={lines}
        rowKey={(line) => line.key}
        tableLabel={title}
        exportName={`${title}, ${period.range.from} to ${period.range.to}`}
        toolbar={period.menu}
        footer={(statementData) => (
          <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
            {t('generated', { when: formatDateTime(statementData.generatedAt) })}
          </p>
        )}
      />
      {s === undefined || s.checks.length === 0 ? null : (
        <Alert severity="info" title={t('checks', { count: s.checks.length })} />
      )}
    </section>
  );
}
