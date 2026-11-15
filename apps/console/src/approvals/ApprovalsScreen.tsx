import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  FilterMenu,
  MoneyDisplay,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, countSet, FilterSelect } from '../stock/filters';
import {
  APPROVAL_KINDS,
  APPROVAL_STATUSES,
  ApprovalStatusBadge,
  useKindName,
  type ApprovalKind,
  type ApprovalRequest,
  type ApprovalStatus,
} from './presentation';

type View = 'mine' | 'asked' | 'all';
const VIEWS: readonly View[] = ['mine', 'asked', 'all'];

/**
 * The approvals inbox (FR-IAM, separation of duties): one place where an approver sees everything waiting
 * on them, whatever module asked: a death or cull write-off, a stock or transfer write-off, a purchase
 * order, a supplier payment, a reversal, a price list going live. "Waiting on me" is the server's
 * `decidableByMe`: pending, unlapsed requests of others whose approving permission the caller holds at
 * their branch, so the maker's own requests are never in it. Each row opens the request with its evidence.
 */
export function ApprovalsScreen() {
  const { t } = useTranslation(['approvals', 'common']);
  const kindName = useKindName();
  const pages = useCursorPages();
  const [view, setView] = useState<View>('mine');
  const [kind, setKind] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const requests = useApiQuery('listApprovals', {
    query: {
      ...(view === 'mine' ? { decidableByMe: true } : {}),
      ...(view === 'asked' ? { requestedByMe: true } : {}),
      ...(kind === ANY ? {} : { kind: kind as ApprovalKind }),
      ...(view !== 'mine' && status !== ANY ? { status: status as ApprovalStatus } : {}),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const empty = {
    mine: [t('list.empty'), t('list.emptyBody')],
    asked: [t('list.emptyAsked'), t('list.emptyAskedBody')],
    all: [t('list.emptyAll'), t('list.emptyAllBody')],
  }[view];
  const labels = useStateLabels({
    loading: t('list.loading'),
    emptyTitle: empty[0] ?? '',
    emptyDescription: empty[1] ?? '',
    errorTitle: t('list.error'),
    deniedTitle: t('list.denied'),
  });
  const columns: TableColumn<ApprovalRequest>[] = [
    {
      id: 'request',
      rowHeader: true,
      head: t('list.columns.request'),
      sortValue: (row) => kindName(row.kind),
      cell: (row) => (
        <span className="grid gap-0.5">
          <Link to={`/approvals/${row.id}`} className="font-semibold text-accent-text underline">
            {kindName(row.kind)}
          </Link>
          <span className="text-control-sm text-fg-muted">{row.summary}</span>
        </span>
      ),
    },
    {
      id: 'amount',
      head: t('list.columns.amount'),
      numeric: true,
      sortValue: (row) => String(row.amountPesewas ?? -1).padStart(16, '0'),
      cell: (row) =>
        row.amountPesewas === null ? (
          <span className="text-fg-muted">{t('list.noAmount')}</span>
        ) : (
          <MoneyDisplay pesewas={row.amountPesewas} />
        ),
    },
    {
      id: 'askedBy',
      head: t('list.columns.askedBy'),
      sortValue: (row) => row.requestedBy.displayName,
      cell: (row) => row.requestedBy.displayName,
    },
    {
      id: 'waiting',
      head: t('list.columns.waiting'),
      sortValue: (row) => row.requestedAt,
      cell: (row) => <When instant={row.requestedAt} />,
    },
    {
      id: 'status',
      head: t('list.columns.status'),
      sortValue: (row) => row.status,
      cell: (row) => <ApprovalStatusBadge status={row.status} />,
    },
  ];
  const tableView = useTableView(columns);
  return (
    <section aria-labelledby="approvals-title" className="grid gap-4">
      <PageHeader
        title={t('list.title')}
        titleId="approvals-title"
        description={t('list.description')}
      />
      <Tabs
        value={view}
        onValueChange={(next) => {
          setView(VIEWS.find((v) => v === next) ?? 'mine');
          pages.reset();
        }}
      >
        <TabsList aria-label={t('list.title')}>
          {VIEWS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {t(`list.tabs.${v}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One panel per tab, as the tabs pattern needs; Radix renders only the selected one. */}
        {VIEWS.map((v) => (
          <TabsContent key={v} value={v}>
            <TableCard
              view={tableView}
              query={requests}
              labels={labels}
              rows={(page) => page.data}
              rowKey={(row) => row.id}
              tableLabel={t('list.table')}
              exportName={t('list.title')}
              pages={{ state: pages, info: (page) => page.page, label: t('list.pages') }}
              toolbar={
                <FilterMenu
                  label={t('common:table.filter')}
                  active={countSet(kind, view === 'mine' ? ANY : status)}
                  reset={{
                    label: t('common:table.resetFilters'),
                    onReset: () => {
                      setKind(ANY);
                      setStatus(ANY);
                      pages.reset();
                    },
                  }}
                >
                  <FilterSelect
                    label={t('list.kind')}
                    anyLabel={t('list.anyKind')}
                    value={kind}
                    onChange={(value) => {
                      setKind(value);
                      pages.reset();
                    }}
                    options={APPROVAL_KINDS.map((value) => ({ value, label: kindName(value) }))}
                  />
                  {view === 'mine' ? null : (
                    <FilterSelect
                      label={t('list.status')}
                      anyLabel={t('list.anyStatus')}
                      value={status}
                      onChange={(value) => {
                        setStatus(value);
                        pages.reset();
                      }}
                      options={APPROVAL_STATUSES.map((value) => ({
                        value,
                        label: t(`status.${value}`),
                      }))}
                    />
                  )}
                </FilterMenu>
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
