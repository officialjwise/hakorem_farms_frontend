import {
  BadgeCent,
  CalendarClock,
  ChartColumn,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  DatePicker,
  Field,
  MoneyDisplay,
  MutationFailure,
  Popover,
  QueryBoundary,
  StatTile,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  formatDateTime,
  formatMoney,
  formatWeight,
  type DateString,
  type FailureLike,
  type QueryLike,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useBranchScope } from '../branch/branchScope';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';

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

/** Today in Accra, as a calendar date: the default end of a range. */
function accraToday(): DateString {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }).format(
    new Date(),
  ) as DateString;
}
function monthStart(day: DateString): DateString {
  return `${day.slice(0, 8)}01` as DateString;
}

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
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-subtle">
                  <Icon aria-hidden="true" className="size-icon-md stroke-accent" />
                </span>
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

/** From, to and run: the toolbar every report shares, at the top of its card. */
function RangeToolbar({
  from,
  to,
  onRun,
  running,
}: {
  from: DateString;
  to: DateString;
  onRun: (from: DateString, to: DateString) => void;
  running: boolean;
}) {
  const { t } = useTranslation('reports');
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onRun(start, end);
  };
  return (
    <form
      onSubmit={submit}
      aria-label={t('range')}
      className="flex flex-wrap items-end gap-3 border-b border-border p-4"
    >
      <div className="w-full sm:w-44">
        <Field label={t('from')}>
          <DatePicker
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value as DateString)}
          />
        </Field>
      </div>
      <div className="w-full sm:w-44">
        <Field label={t('to')}>
          <DatePicker
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value as DateString)}
          />
        </Field>
      </div>
      <Button type="submit" loading={running} loadingLabel={t('running')}>
        <Play aria-hidden="true" />
        {t('run')}
      </Button>
    </form>
  );
}

/** Export as a spreadsheet or PDF: the API builds the file (rpt.report.export), this hands over its link. */
function ExportMenu({ code, parameters }: { code: string; parameters: Record<string, string> }) {
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
  if (!auth.can('rpt.report.export')) return null;
  const go = (format: 'XLSX' | 'PDF') => {
    const body = { parameters, format };
    void run
      .mutateAsync({ path: { code }, body }, { idempotencyKey: keyFor(body) })
      .catch(() => undefined);
  };
  const file = run.data && 'file' in run.data ? run.data.file : null;
  return (
    <Popover
      label={t('export')}
      align="end"
      trigger={
        <Button variant="secondary">
          <Download aria-hidden="true" />
          {t('export')}
        </Button>
      }
    >
      <div className="grid w-64 gap-2">
        <Button
          variant="ghost"
          onClick={() => go('XLSX')}
          loading={run.isPending}
          loadingLabel={t('exporting')}
        >
          <FileSpreadsheet aria-hidden="true" />
          {t('xlsx')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => go('PDF')}
          loading={run.isPending}
          loadingLabel={t('exporting')}
        >
          <FileText aria-hidden="true" />
          {t('pdf')}
        </Button>
        {file === null || file === undefined ? null : (
          <a
            href={file.url}
            className="text-sm text-accent-text underline"
            target="_blank"
            rel="noreferrer"
          >
            {t('download')}
          </a>
        )}
        {run.isSuccess && (file === null || file === undefined) ? (
          <p role="status" className="text-sm text-fg-muted">
            {t('queued')}
          </p>
        ) : null}
        <MutationFailure error={run.error} labels={labels} />
      </div>
    </Popover>
  );
}

/** A report from `runReport`: range, the API's totals as a summary row, the table, and export. */
export function ReportScreen() {
  const { t } = useTranslation(['reports', 'common']);
  const { report = '' } = useParams();
  const key = (report in REPORTS ? report : 'sales') as ReportKey;
  if (key === 'profit-and-loss') return <ProfitAndLoss />;
  return (
    <RunReport reportKey={key} code={REPORTS[key].code} key={key} title={t(`list.${key}.name`)} />
  );
}

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
  const today = accraToday();
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  const run = useApiMutation('runReport');
  const keyFor = useIntentKey();
  const parameters = {
    from: range.from,
    to: range.to,
    ...(scope.branchId === null ? {} : { branchId: scope.branchId }),
  };
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
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader
        title={title}
        titleId="report-title"
        description={t(`list.${reportKey}.about`)}
        actions={<ExportMenu code={code} parameters={parameters} />}
      />
      <QueryBoundary
        query={query}
        labels={labels}
        isEmpty={(r) => r.result === null || r.result.rows.length === 0}
        loadingFallback={
          <TableContainer aria-label={title}>
            <Table>
              <TableBody>
                <TableLoadingRows columns={4} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(r) => (
          <ReportResult
            run={r}
            title={title}
            toolbar={
              <RangeToolbar
                from={range.from}
                to={range.to}
                running={run.isPending}
                onRun={(from, to) => setRange({ from, to })}
              />
            }
          />
        )}
      </QueryBoundary>
    </section>
  );
}

function ReportResult({
  run,
  title,
  toolbar,
}: {
  run: ReportRun;
  title: string;
  toolbar: ReactNode;
}) {
  const { t } = useTranslation('reports');
  const result = run.result;
  if (result === null) return null;
  const totals = result.totals ?? {};
  const summarised = result.columns.filter((column) => column.key in totals);
  const [first, ...rest] = result.columns;
  return (
    <div className="grid gap-4">
      {summarised.length === 0 ? null : (
        <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summarised.map((column) => (
            <li key={column.key}>
              <StatTile
                label={column.label}
                value={cellText(column, totals[column.key])}
                detail={t('total')}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {toolbar}
        <TableContainer aria-label={title} className="rounded-none border-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow>
                {result.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    numeric={column.type !== 'TEXT' && column.type !== 'DATE'}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, index) => (
                <TableRow key={index}>
                  {first === undefined ? null : (
                    <TableRowHeader>{cellText(first, row[first.key])}</TableRowHeader>
                  )}
                  {rest.map((column) => (
                    <TableCell
                      key={column.key}
                      label={column.label}
                      numeric={column.type !== 'TEXT' && column.type !== 'DATE'}
                    >
                      {cellText(column, row[column.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
          {t('asOf', {
            when: formatDateTime(run.dataAsOf ?? run.createdAt),
            count: run.rowCount ?? result.rows.length,
          })}
        </p>
      </div>
    </div>
  );
}

/** Profit and loss for a range, from the ledger (`getProfitAndLoss`): sections, their rows and totals. */
function ProfitAndLoss() {
  const { t } = useTranslation(['reports', 'common']);
  const scope = useBranchScope();
  const today = accraToday();
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  // A statement an owner reads and acts on: `live`.
  const statement = useApiQuery('getProfitAndLoss', {
    query: { from: range.from, to: range.to, ...scope.query },
  });
  const title = t('list.profit-and-loss.name');
  const labels = useStateLabels({
    loading: t('loading', { name: title }),
    emptyTitle: t('empty'),
    errorTitle: t('error', { name: title }),
    deniedTitle: t('denied'),
  });
  return (
    <section aria-labelledby="report-title" className="grid gap-4">
      <PageHeader
        title={title}
        titleId="report-title"
        description={t('list.profit-and-loss.about')}
      />
      <QueryBoundary query={statement} labels={labels} isEmpty={(s) => s.sections.length === 0}>
        {(s) => (
          <div className="grid gap-4">
            <ul aria-label={t('summary')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {s.sections.map((section) => (
                <li key={section.key}>
                  <StatTile
                    label={section.label}
                    value={<MoneyDisplay pesewas={section.totalPesewas} />}
                    detail={section.totalIsNegative ? t('negative') : t('total')}
                  />
                </li>
              ))}
            </ul>
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <RangeToolbar
                from={range.from}
                to={range.to}
                running={statement.isFetching}
                onRun={(from, to) => setRange({ from, to })}
              />
              <TableContainer aria-label={title} className="rounded-none border-0 shadow-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pl.line')}</TableHead>
                      <TableHead numeric>{t('pl.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.sections.flatMap((section) => [
                      ...section.rows.map((row) => (
                        <TableRow key={`${section.key}-${row.label}`}>
                          <TableRowHeader>
                            <span className="grid">
                              <span>{row.label}</span>
                              <span className="text-control-sm text-fg-muted">{section.label}</span>
                            </span>
                          </TableRowHeader>
                          <TableCell numeric label={t('pl.amount')}>
                            <MoneyDisplay pesewas={row.amountPesewas} />
                            {row.isNegative ? ` ${t('negativeShort')}` : ''}
                          </TableCell>
                        </TableRow>
                      )),
                      <TableRow key={`${section.key}-total`}>
                        <TableRowHeader>
                          <span className="font-bold">
                            {t('pl.totalFor', { section: section.label })}
                          </span>
                        </TableRowHeader>
                        <TableCell numeric label={t('pl.amount')}>
                          <MoneyDisplay pesewas={section.totalPesewas} strong />
                        </TableCell>
                      </TableRow>,
                    ])}
                  </TableBody>
                </Table>
              </TableContainer>
              <p className="border-t border-border px-4 py-3 text-control-sm text-fg-muted">
                {t('generated', { when: formatDateTime(s.generatedAt) })}
              </p>
            </div>
            {s.checks.length === 0 ? null : (
              <Alert severity="info" title={t('checks', { count: s.checks.length })} />
            )}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}
