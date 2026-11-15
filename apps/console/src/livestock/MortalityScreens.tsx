import { HeartCrack, Send } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  AnimalTag,
  Button,
  DateRangeMenu,
  EmptyState,
  FilterMenu,
  IconChip,
  MoneyDisplay,
  NOT_APPLICABLE,
  QueryBoundary,
  Skeleton,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { isApprovalPending, type ApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useLocations } from '../stock/locations';
import { MortalityDialog } from './forms';
import { MortalityStatusBadge } from './presentation';
import { rangeQuery } from './range';

type MortalityRecord = components['schemas']['MortalityRecord'];
const STATUSES = ['REPORTED', 'PENDING_APPROVAL', 'POSTED', 'REJECTED'] as const;
const KINDS = ['DEATH', 'CULL'] as const;

function Who({ record }: { record: MortalityRecord }) {
  const auth = useAuth();
  const tag = <AnimalTag tagNo={record.animal?.tagNo ?? record.stockUnit.identifier} />;
  return record.animal !== null && auth.can('liv.animal.read') ? (
    <Link to={`/animals/${record.animal.id}`} className="text-accent-text underline">
      {tag}
    </Link>
  ) : (
    tag
  );
}

/**
 * FR-LIV deaths and culls: each report, its reason, the cost written off (from the cost pool, by the API)
 * and where it stands. A report writes nothing off until its reporter submits it; at or above the threshold
 * a second person approves first.
 */
export function MortalityScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const navigate = useNavigate();
  const pages = useCursorPages();
  const locations = useLocations();
  const rangeWords = useDateRangeWords();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [status, setStatus] = useState(ANY);
  const [kind, setKind] = useState(ANY);
  const [locationId, setLocationId] = useState(ANY);
  const [reporting, setReporting] = useState(false);
  const records = useApiQuery('listMortalityRecords', {
    query: {
      ...rangeQuery(range, 'instant'),
      ...param('status', status),
      ...(kind === ANY ? {} : { kind: KINDS.find((k) => k === kind) }),
      ...param('locationId', locationId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('mortalityList.loading'),
    emptyTitle: t('mortalityList.empty'),
    emptyDescription: t('mortalityList.emptyBody'),
    errorTitle: t('mortalityList.error'),
    deniedTitle: t('mortalityList.denied'),
  });
  const columns: TableColumn<MortalityRecord>[] = [
    {
      id: 'record',
      rowHeader: true,
      head: t('mortalityList.columns.record'),
      sortValue: (record) => record.foundAt,
      cell: (record) => (
        <span className="flex items-center gap-3">
          <IconChip
            icon={HeartCrack}
            tone={record.kind === 'DEATH' ? 'critical' : 'warning'}
            size="sm"
          />
          <span className="grid">
            <Link to={`/mortality/${record.id}`} className="text-accent-text underline">
              {t(`mortalityKind.${record.kind}`)}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              <When instant={record.foundAt} />
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'animal',
      head: t('mortalityList.columns.animal'),
      sortValue: (record) => record.animal?.tagNo ?? record.stockUnit.identifier,
      cell: (record) => (
        <span className="grid">
          <Who record={record} />
          {record.head > 1 ? (
            <span className="text-control-sm text-fg-muted">
              {t('mortalityList.head', { count: record.head })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'reason',
      head: t('mortalityList.columns.reason'),
      sortValue: (record) => record.reasonCode,
      cell: (record) => record.reasonCode,
    },
    {
      id: 'status',
      head: t('mortalityList.columns.status'),
      sortValue: (record) => record.status,
      cell: (record) => <MortalityStatusBadge status={record.status} />,
    },
    {
      id: 'value',
      head: t('mortalityList.columns.value'),
      numeric: true,
      sortValue: (record) => record.valuePesewas,
      cell: (record) => <MoneyDisplay pesewas={record.valuePesewas} />,
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="mortality-title" className="grid gap-4">
      <PageHeader
        title={t('mortalityList.title')}
        titleId="mortality-title"
        description={t('mortalityList.description')}
        actions={
          auth.can('liv.mortality.report') ? (
            <Button onClick={() => setReporting(true)}>
              <HeartCrack aria-hidden="true" />
              {t('mortalityList.report')}
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={records}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(record) => record.id}
        tableLabel={t('mortalityList.table')}
        exportName={t('mortalityList.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('mortalityList.pages') }}
        toolbar={
          <>
            <DateRangeMenu
              label={t('filters.dates')}
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
              active={countSet(status, kind, locationId)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setStatus(ANY);
                  setKind(ANY);
                  setLocationId(ANY);
                  pages.reset();
                },
              }}
            >
              <FilterSelect
                label={t('filters.status')}
                anyLabel={t('filters.anyStatus')}
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  pages.reset();
                }}
                options={STATUSES.map((value) => ({ value, label: t(`mortalityStatus.${value}`) }))}
              />
              <FilterSelect
                label={t('filters.kind')}
                anyLabel={t('filters.anyKind')}
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  pages.reset();
                }}
                options={KINDS.map((value) => ({ value, label: t(`mortalityKind.${value}`) }))}
              />
              <FilterSelect
                label={t('filters.location')}
                anyLabel={t('filters.anyLocation')}
                value={locationId}
                onChange={(value) => {
                  setLocationId(value);
                  pages.reset();
                }}
                options={locations.options}
              />
            </FilterMenu>
          </>
        }
      />
      {reporting ? (
        <MortalityDialog
          animal={null}
          onClose={() => setReporting(false)}
          onDone={(record) => navigate(`/mortality/${record.id}`)}
        />
      ) : null}
    </section>
  );
}

/**
 * One death or cull, and its submit: the write-off at the value the API gives, confirmed first. At or above
 * the threshold the answer is 202: nothing is written off and the animal stays on hand until a different
 * person approves. Without the photograph the API requires there, it refuses in its own words (A-F6-03).
 */
export function MortalityRecordScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const { id = '' } = useParams();
  const record = useApiQuery('getMortalityRecord', { path: { id } });
  const labels = useStateLabels({
    loading: t('mortalityRecord.loading'),
    emptyTitle: t('mortalityRecord.notFound'),
    errorTitle: t('mortalityRecord.error'),
    deniedTitle: t('mortalityRecord.denied'),
  });
  const back = (
    <Link to="/mortality" className="w-fit text-accent-text underline">
      {t('mortalityRecord.back')}
    </Link>
  );
  if (record.error?.status === 404) {
    return (
      <EmptyState
        title={t('mortalityRecord.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={record}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
    >
      {(current) => <RecordDetail record={current} back={back} />}
    </QueryBoundary>
  );
}

function RecordDetail({ record, back }: { record: MortalityRecord; back: ReactNode }) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<ApprovalPending | null>(null);
  const [posted, setPosted] = useState(false);
  const submit = useApiMutation('submitMortalityRecord');
  const keyFor = useIntentKey();
  const rows: [string, ReactNode][] = [
    [t('mortalityRecord.animal'), <Who key="who" record={record} />],
    [t('mortalityRecord.head'), String(record.head)],
    [t('mortalityRecord.reason'), record.reasonCode],
    [t('mortalityRecord.found'), <When key="found" instant={record.foundAt} />],
    [t('mortalityRecord.location'), record.location?.name ?? NOT_APPLICABLE],
    [t('mortalityRecord.reportedBy'), record.reportedBy.displayName],
    [t('mortalityRecord.value'), <MoneyDisplay key="value" pesewas={record.valuePesewas} />],
    [
      t('mortalityRecord.photo'),
      record.photoFileId === null ? t('mortalityRecord.noPhoto') : t('mortalityRecord.hasPhoto'),
    ],
    [t('mortality.disposal'), record.disposalNote ?? NOT_APPLICABLE],
  ];
  return (
    <article aria-labelledby="record-title" className="grid gap-4">
      <div className="grid gap-2">
        {back}
        <PageHeader
          title={t('mortalityRecord.title', {
            kind: t(`mortalityKind.${record.kind}`),
            tag: record.animal?.tagNo ?? record.stockUnit.identifier,
          })}
          titleId="record-title"
          description={<MortalityStatusBadge status={record.status} />}
          actions={
            record.status === 'REPORTED' &&
            auth.can('liv.mortality.report') &&
            !posted &&
            pending === null ? (
              <Button onClick={() => setConfirming(true)}>
                <Send aria-hidden="true" />
                {t('mortalityRecord.submit')}
              </Button>
            ) : undefined
          }
        />
      </div>
      {pending === null ? null : (
        <Alert severity="info" title={t('mortalityRecord.pendingTitle')}>
          {t('mortalityRecord.pendingBody', { summary: pending.summary })}
        </Alert>
      )}
      {posted ? <Alert severity="good" title={t('mortalityRecord.posted')} /> : null}
      {record.status === 'PENDING_APPROVAL' && pending === null ? (
        <Alert severity="info" title={t('mortalityRecord.awaiting')} />
      ) : null}
      {record.status === 'REPORTED' ? (
        <p className="text-sm text-fg-muted">{t('mortalityRecord.onlyReporter')}</p>
      ) : null}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('mortalityRecord.confirmTitle', {
          tag: record.animal?.tagNo ?? record.stockUnit.identifier,
        })}
        body={t('mortalityRecord.confirmBody')}
        changes={[
          {
            label: t('mortalityRecord.writeOff'),
            after: <MoneyDisplay pesewas={record.valuePesewas} />,
          },
        ]}
        consequence={t('mortalityRecord.consequence')}
        confirmLabel={t('mortalityRecord.submit')}
        pendingLabel={t('mortalityRecord.submitting')}
        pending={submit.isPending}
        error={submit.error}
        failedTitle={t('mortalityRecord.notSubmitted')}
        destructive
        icon={HeartCrack}
        confirmIcon={Send}
        onConfirm={() =>
          void submit
            .mutateAsync({ path: { id: record.id } }, { idempotencyKey: keyFor({ id: record.id }) })
            .then((answer) => {
              setConfirming(false);
              if (isApprovalPending(answer)) setPending(answer);
              else setPosted(true);
            })
            .catch(() => undefined)
        }
      />
    </article>
  );
}
