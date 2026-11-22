import { Banknote, CalendarClock, Coins, HandCoins, Percent, PiggyBank } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Button,
  DateRangeMenu,
  MoneyDisplay,
  MutationFailure,
  PageHeader,
  QueryBoundary,
  ReportTile,
  StatusBadge,
  formatDateTime,
  useTableView,
  type BadgeTone,
  type DateString,
} from '@hakorem/ui';
import { useApiMutation, useApiQuery } from '../data/api';
import { useDateRangeWords } from '../lib/dateRange';
import { lookup } from '../lib/lookup';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { accraToday } from '../reports/period';

type Schemas = components['schemas'];
type CapitalTransaction = Schemas['CapitalTransaction'];
type DistributionLine = Schemas['InvestorDistributionLine'];
type StatementLine = Schemas['InvestorStatementLine'];
type InvestorDocument = Schemas['InvestorDocument'];

/*
 * The investor portal's screens (ADR 0058). Each reads one investor operation, which the server scopes to
 * the signed-in investor: nothing here can name another investor, a branch or any operational record.
 * Every amount, share, unit and return is the API's; the screens format, they never compute.
 */

/** The four states' words, with the portal's own words for denied. */
function useInvestorLabels(words: {
  loading: string;
  errorTitle: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { t } = useTranslation('investor');
  return useStateLabels({
    emptyTitle: words.emptyTitle ?? words.errorTitle,
    deniedTitle: t('states.denied'),
    deniedDescription: t('states.deniedBody'),
    ...words,
  });
}

/** A percentage the API states, with a negative one said in words. Null is "not yet meaningful". */
function useRate() {
  const { t } = useTranslation('investor');
  return (value: string | null, negative: boolean) =>
    value === null
      ? t('summary.notYet')
      : negative
        ? t('summary.negative', { value: `${value}%` })
        : `${value}%`;
}

/** The investor's capital, share and distributions at a glance (`getMyInvestorSummary`). */
export function SummaryScreen() {
  const { t } = useTranslation('investor');
  const summary = useApiQuery('getMyInvestorSummary');
  const labels = useInvestorLabels({
    loading: t('summary.loading'),
    errorTitle: t('summary.error'),
  });
  const rate = useRate();
  return (
    <section aria-labelledby="investor-title" className="grid gap-4">
      <PageHeader
        title={t('summary.title')}
        titleId="investor-title"
        description={t('summary.description')}
      />
      <QueryBoundary query={summary} labels={labels} isEmpty={() => false}>
        {(s) => (
          <div className="grid gap-6">
            <p className="text-sm text-fg-muted">
              {s.investor.name} · {t('summary.investorNo', { number: s.investor.investorNo })}
            </p>
            <ul
              aria-label={t('summary.title')}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <li>
                <ReportTile
                  label={t('summary.share')}
                  value={`${s.sharePercent}%`}
                  detail={t('summary.units', { units: s.units })}
                  icon={Percent}
                  tone="accent"
                />
              </li>
              <li>
                <ReportTile
                  label={t('summary.contributed')}
                  value={<MoneyDisplay pesewas={s.contributedPesewas} />}
                  icon={PiggyBank}
                  tone="sand"
                />
              </li>
              <li>
                <ReportTile
                  label={t('summary.allocated')}
                  value={<MoneyDisplay pesewas={s.allocatedPesewas} />}
                  icon={Coins}
                  tone="info"
                />
              </li>
              <li>
                <ReportTile
                  label={t('summary.paid')}
                  value={<MoneyDisplay pesewas={s.paidPesewas} />}
                  icon={HandCoins}
                  tone="good"
                />
              </li>
              <li>
                <ReportTile
                  label={t('summary.outstanding')}
                  value={<MoneyDisplay pesewas={s.outstandingPesewas} />}
                  icon={Banknote}
                  tone="accent"
                />
              </li>
            </ul>
            <section aria-labelledby="investor-returns" className="grid gap-3">
              <h2 id="investor-returns" className="text-lg font-semibold">
                {t('summary.returns')}
              </h2>
              <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
                <div className="grid gap-0.5">
                  <dt className="text-fg-muted">{t('summary.roi')}</dt>
                  <dd className="font-semibold">
                    {rate(s.returns.roiPercent, s.returns.roiIsNegative)}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-fg-muted">{t('summary.irr')}</dt>
                  <dd className="font-semibold">
                    {rate(s.returns.irrPercent, s.returns.irrIsNegative)}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-fg-muted">{t('summary.payback')}</dt>
                  <dd className="font-semibold">
                    {s.returns.paybackMonths === null
                      ? t('summary.notYet')
                      : t('summary.paybackMonths', { count: s.returns.paybackMonths })}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-fg-muted">{t('summary.distributed')}</dt>
                  <dd className="font-semibold">
                    <MoneyDisplay pesewas={s.returns.distributedPesewas} />
                  </dd>
                </div>
              </dl>
            </section>
            <p className="text-control-sm text-fg-muted">
              {t('summary.asOf', { when: formatDateTime(s.asOf) })}
            </p>
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}

/** The investor's contributions and withdrawals (`listMyCapitalTransactions`), a page at a time. */
export function CapitalScreen() {
  const { t } = useTranslation('investor');
  const pages = useCursorPages();
  const list = useApiQuery('listMyCapitalTransactions', {
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useInvestorLabels({
    loading: t('capital.loading'),
    errorTitle: t('capital.error'),
    emptyTitle: t('capital.empty'),
    emptyDescription: t('capital.emptyBody'),
  });
  const view = useTableView<CapitalTransaction>([
    {
      id: 'valueDate',
      head: t('capital.valueDate'),
      rowHeader: true,
      sortValue: (row) => row.valueDate,
      cell: (row) => row.valueDate,
    },
    {
      id: 'kind',
      head: t('capital.kind'),
      sortValue: (row) => row.kind,
      cell: (row) => (
        <StatusBadge
          tone={row.kind === 'CONTRIBUTION' ? 'good' : 'warning'}
          label={t(`capital.${row.kind}`, { defaultValue: row.kind })}
        />
      ),
    },
    {
      id: 'amount',
      head: t('capital.amount'),
      numeric: true,
      sortValue: (row) => row.amountPesewas,
      cell: (row) => <MoneyDisplay pesewas={row.amountPesewas} />,
    },
    {
      id: 'units',
      head: t('capital.units'),
      numeric: true,
      cell: (row) => row.units,
    },
    {
      id: 'unitPrice',
      head: t('capital.unitPrice'),
      numeric: true,
      cell: (row) => <MoneyDisplay pesewas={row.unitPricePesewas} />,
    },
    {
      id: 'reference',
      head: t('capital.reference'),
      sortValue: (row) => row.transactionNo,
      cell: (row) => row.transactionNo,
    },
  ]);
  return (
    <section aria-labelledby="investor-title" className="grid gap-4">
      <PageHeader
        title={t('capital.title')}
        titleId="investor-title"
        description={t('capital.description')}
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('capital.table')}
        exportName={t('capital.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('capital.pages') }}
      />
    </section>
  );
}

/** The investor's share of each distribution (`listMyDistributions`). */
export function DistributionsScreen() {
  const { t } = useTranslation('investor');
  const pages = useCursorPages();
  const list = useApiQuery('listMyDistributions', {
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useInvestorLabels({
    loading: t('distributions.loading'),
    errorTitle: t('distributions.error'),
    emptyTitle: t('distributions.empty'),
    emptyDescription: t('distributions.emptyBody'),
  });
  const view = useTableView<DistributionLine>([
    {
      id: 'run',
      head: t('distributions.run'),
      rowHeader: true,
      sortValue: (row) => row.runNo,
      cell: (row) => (
        <span className="grid">
          <span>{row.runNo}</span>
          <span className="text-control-sm font-normal text-fg-muted">
            {t('distributions.periodRange', {
              from: row.periodStart,
              to: row.periodEnd,
            })}
          </span>
        </span>
      ),
    },
    {
      id: 'allocated',
      head: t('distributions.allocated'),
      numeric: true,
      cell: (row) => <MoneyDisplay pesewas={row.allocatedPesewas} />,
    },
    {
      id: 'withheld',
      head: t('distributions.withheld'),
      numeric: true,
      cell: (row) => <MoneyDisplay pesewas={row.withheldPesewas} />,
    },
    {
      id: 'net',
      head: t('distributions.net'),
      numeric: true,
      cell: (row) => <MoneyDisplay pesewas={row.netPayablePesewas} />,
    },
    {
      id: 'paid',
      head: t('distributions.paid'),
      numeric: true,
      cell: (row) => <MoneyDisplay pesewas={row.paidPesewas} />,
    },
    {
      id: 'status',
      head: t('distributions.status'),
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge tone="info" label={row.status} />,
    },
  ]);
  return (
    <section aria-labelledby="investor-title" className="grid gap-4">
      <PageHeader
        title={t('distributions.title')}
        titleId="investor-title"
        description={t('distributions.description')}
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.runId}
        tableLabel={t('distributions.table')}
        exportName={t('distributions.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('distributions.pages') }}
      />
    </section>
  );
}

/** The capital statement for a period (`getMyInvestorStatement`): opening, every movement, closing. */
export function StatementScreen() {
  const { t } = useTranslation('investor');
  const today = accraToday();
  const fallback = { from: `${today.slice(0, 4)}-01-01` as DateString, to: today };
  const [range, setRange] = useState(fallback);
  const words = useDateRangeWords();
  const statement = useApiQuery('getMyInvestorStatement', {
    query: { from: range.from, to: range.to },
  });
  const labels = useInvestorLabels({
    loading: t('statement.loading'),
    errorTitle: t('statement.error'),
    emptyTitle: t('statement.empty'),
    emptyDescription: t('statement.emptyBody'),
  });
  const view = useTableView<StatementLine>([
    {
      id: 'date',
      head: t('statement.date'),
      rowHeader: true,
      cell: (line) => line.date,
    },
    {
      id: 'what',
      head: t('statement.what'),
      cell: (line) => t(`statement.kind.${line.kind}`, { defaultValue: line.kind }),
    },
    {
      id: 'reference',
      head: t('statement.reference'),
      cell: (line) => line.reference,
    },
    {
      id: 'amount',
      head: t('statement.amount'),
      numeric: true,
      cell: (line) => (
        <span className="grid justify-items-end">
          <MoneyDisplay pesewas={line.amountPesewas} />
          <span className="text-control-sm text-fg-muted">
            {t(`statement.${line.direction}`, { defaultValue: line.direction })}
          </span>
        </span>
      ),
    },
    {
      id: 'units',
      head: t('statement.units'),
      numeric: true,
      cell: (line) => line.units ?? t('statement.noUnits'),
    },
  ]);
  const s = statement.data;
  return (
    <section aria-labelledby="investor-title" className="grid gap-4">
      <PageHeader
        title={t('statement.title')}
        titleId="investor-title"
        description={t('statement.description')}
      />
      {s === undefined ? null : (
        <ul aria-label={t('statement.title')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <ReportTile
              label={t('statement.opening')}
              value={<MoneyDisplay pesewas={s.openingCapitalPesewas} />}
              icon={CalendarClock}
              tone="sand"
            />
          </li>
          <li>
            <ReportTile
              label={t('statement.closing')}
              value={<MoneyDisplay pesewas={s.closingCapitalPesewas} />}
              icon={PiggyBank}
              tone="accent"
            />
          </li>
          <li>
            <ReportTile
              label={t('statement.allocatedInPeriod')}
              value={<MoneyDisplay pesewas={s.allocatedInPeriodPesewas} />}
              icon={Coins}
              tone="info"
            />
          </li>
          <li>
            <ReportTile
              label={t('statement.paidInPeriod')}
              value={<MoneyDisplay pesewas={s.paidInPeriodPesewas} />}
              icon={HandCoins}
              tone="good"
            />
          </li>
        </ul>
      )}
      {s === undefined || s.documentUrl === null ? null : (
        <p>
          <a
            href={s.documentUrl}
            className="text-accent-text underline"
            target="_blank"
            rel="noreferrer"
          >
            {t('statement.download')}
          </a>
        </p>
      )}
      <TableCard
        view={view}
        query={statement}
        labels={labels}
        rows={(data) => data.lines}
        rowKey={(line, index) => `${line.reference}-${index}`}
        tableLabel={t('statement.table')}
        exportName={`${t('statement.title')}, ${range.from} to ${range.to}`}
        toolbar={
          <DateRangeMenu
            label={t('statement.range')}
            summary={words(range)}
            from={range.from}
            to={range.to}
            onChange={(next) =>
              setRange({
                from: (next.from as DateString | undefined) ?? fallback.from,
                to: (next.to as DateString | undefined) ?? fallback.to,
              })
            }
            fromLabel={t('statement.from')}
            toLabel={t('statement.to')}
            clearLabel={t('statement.thisYear')}
          />
        }
      />
    </section>
  );
}

const DOCUMENT_TONE = {
  AGREEMENT: 'violet',
  IDENTIFICATION: 'slate',
  STATEMENT: 'info',
  DISTRIBUTION_SCHEDULE: 'good',
  OTHER: 'slate',
} as const satisfies Record<InvestorDocument['kind'], BadgeTone>;

/** The investor's documents (`listMyInvestorDocuments`), each opened by a short-lived link. */
export function DocumentsScreen() {
  const { t } = useTranslation('investor');
  const pages = useCursorPages();
  const list = useApiQuery('listMyInvestorDocuments', {
    query: pages.cursor === undefined ? {} : { cursor: pages.cursor },
  });
  const labels = useInvestorLabels({
    loading: t('documents.loading'),
    errorTitle: t('documents.error'),
    emptyTitle: t('documents.empty'),
    emptyDescription: t('documents.emptyBody'),
  });
  const view = useTableView<InvestorDocument>([
    {
      id: 'name',
      head: t('documents.name'),
      rowHeader: true,
      sortValue: (row) => row.name,
      cell: (row) => row.name,
    },
    {
      id: 'kind',
      head: t('documents.kind'),
      sortValue: (row) => row.kind,
      cell: (row) => (
        <StatusBadge
          tone={lookup(DOCUMENT_TONE, row.kind, 'slate')}
          label={t(`documents.kinds.${row.kind}`, { defaultValue: row.kind })}
        />
      ),
    },
    {
      id: 'added',
      head: t('documents.added'),
      sortValue: (row) => row.createdAt,
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      id: 'open',
      head: t('documents.open'),
      cell: (row) => <DocumentLink document={row} />,
    },
  ]);
  return (
    <section aria-labelledby="investor-title" className="grid gap-4">
      <PageHeader
        title={t('documents.title')}
        titleId="investor-title"
        description={t('documents.description')}
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('documents.table')}
        exportName={t('documents.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('documents.pages') }}
      />
    </section>
  );
}

/** "Get the file": asks for a signed link (`downloadMyInvestorDocument`), then offers it to open. */
function DocumentLink({ document }: { document: InvestorDocument }) {
  const { t } = useTranslation('investor');
  const download = useApiMutation('downloadMyInvestorDocument');
  const keyFor = useIntentKey();
  const labels = useInvestorLabels({
    loading: t('documents.opening'),
    errorTitle: t('documents.failed'),
  });
  if (download.data !== undefined) {
    return (
      <span className="grid justify-items-start gap-0.5">
        <a
          href={download.data.url}
          className="text-accent-text underline"
          target="_blank"
          rel="noreferrer"
        >
          {t('documents.ready', { name: document.name })}
        </a>
        <span className="text-control-sm text-fg-muted">{t('documents.readyNote')}</span>
      </span>
    );
  }
  return (
    <span className="grid justify-items-start gap-1">
      <Button
        variant="secondary"
        size="sm"
        loading={download.isPending}
        loadingLabel={t('documents.opening')}
        aria-label={t('documents.openFor', { name: document.name })}
        onClick={() => {
          const input = { path: { id: document.id } };
          void download
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .catch(() => undefined);
        }}
      >
        {t('documents.open')}
      </Button>
      <MutationFailure error={download.error} labels={labels} />
    </span>
  );
}
