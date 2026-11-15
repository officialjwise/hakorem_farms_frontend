import { Syringe } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
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
  formatQuantity,
  QueryBoundary,
  Skeleton,
  StatusBadge,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { useDateRangeWords, type DateRange } from '../lib/dateRange';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { useLocations } from '../stock/locations';
import { HealthEventDialog } from './forms';
import { rangeQuery } from './range';

type HealthEvent = components['schemas']['HealthEvent'];
const KINDS = ['VACCINATION', 'TREATMENT', 'CHECK', 'DEWORMING'] as const;

/** Who an event was for: one animal by its tag, or every animal in a pen. */
function Subject({ event }: { event: HealthEvent }) {
  const { t } = useTranslation('livestock');
  const auth = useAuth();
  if (event.stockUnit !== null) {
    const tag = <AnimalTag tagNo={event.stockUnit.identifier} />;
    return auth.can('liv.animal.read') && event.stockUnit.tracking === 'SERIAL' ? (
      <Link to={`/animals/${event.stockUnit.id}`} className="text-accent-text underline">
        {tag}
      </Link>
    ) : (
      tag
    );
  }
  return <>{t('health.wholePen', { pen: event.location?.name ?? '' })}</>;
}

/**
 * FR-LIV health: vaccinations, treatments, checks and dewormings, by kind, pen and date, each with what was
 * used, what it cost and when its withdrawal ends. Recording one opens the same form as an animal's page.
 */
export function HealthEventsScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const locations = useLocations();
  const rangeWords = useDateRangeWords();
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [kind, setKind] = useState(ANY);
  const [locationId, setLocationId] = useState(ANY);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const events = useApiQuery('listHealthEvents', {
    query: {
      ...rangeQuery(range, 'instant'),
      ...param('kind', kind),
      ...param('locationId', locationId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('healthList.loading'),
    emptyTitle: t('healthList.empty'),
    emptyDescription: t('healthList.emptyBody'),
    errorTitle: t('healthList.error'),
    deniedTitle: t('healthList.denied'),
  });
  const columns: TableColumn<HealthEvent>[] = [
    {
      id: 'event',
      rowHeader: true,
      head: t('healthList.columns.event'),
      sortValue: (event) => event.kind,
      cell: (event) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Syringe} tone="warning" size="sm" />
          <Link to={`/health-events/${event.id}`} className="text-accent-text underline">
            {t(`healthKind.${event.kind}`)}
          </Link>
        </span>
      ),
    },
    {
      id: 'subject',
      head: t('healthList.columns.subject'),
      sortValue: (event) => event.stockUnit?.identifier ?? event.location?.name ?? '',
      cell: (event) => <Subject event={event} />,
    },
    {
      id: 'medicine',
      head: t('healthList.columns.medicine'),
      sortValue: (event) => event.product?.name ?? '',
      cell: (event) =>
        event.product === null ? (
          NOT_APPLICABLE
        ) : (
          <span className="grid">
            <span>{event.product.name}</span>
            {event.qtyUsed === null ? null : (
              <span className="text-control-sm text-fg-muted">
                {t('healthList.used', { qty: formatQuantity(event.qtyUsed, { places: 3 }) })}
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'withdrawal',
      head: t('healthList.columns.withdrawal'),
      sortValue: (event) => event.withdrawalEndsAt ?? '',
      cell: (event) =>
        event.withdrawalEndsAt === null ? (
          t('healthList.noWithdrawal')
        ) : (
          <When instant={event.withdrawalEndsAt} />
        ),
    },
    {
      id: 'cost',
      head: t('healthList.columns.cost'),
      numeric: true,
      sortValue: (event) => event.costPesewas,
      cell: (event) => <MoneyDisplay pesewas={event.costPesewas} />,
    },
    {
      id: 'when',
      head: t('healthList.columns.when'),
      sortValue: (event) => event.occurredAt,
      cell: (event) => (
        <>
          <When instant={event.occurredAt} /> · {event.actor.displayName}
        </>
      ),
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="health-title" className="grid gap-4">
      <PageHeader
        title={t('healthList.title')}
        titleId="health-title"
        description={t('healthList.description')}
        actions={
          auth.can('liv.health.record') ? (
            <Button onClick={() => setRecording(true)}>
              <Syringe aria-hidden="true" />
              {t('healthList.record')}
            </Button>
          ) : undefined
        }
      />
      {notice === null ? null : <Alert severity="good" title={notice} />}
      <TableCard
        view={view}
        query={events}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(event) => event.id}
        tableLabel={t('healthList.table')}
        exportName={t('healthList.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('healthList.pages') }}
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
              active={countSet(kind, locationId)}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setKind(ANY);
                  setLocationId(ANY);
                  pages.reset();
                },
              }}
            >
              <FilterSelect
                label={t('filters.kind')}
                anyLabel={t('filters.anyKind')}
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  pages.reset();
                }}
                options={KINDS.map((value) => ({ value, label: t(`healthKind.${value}`) }))}
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
      {recording ? (
        <HealthEventDialog
          animal={null}
          onClose={() => setRecording(false)}
          onDone={(message) => {
            setRecording(false);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}

/** One health event, in full. */
export function HealthEventScreen() {
  const { t } = useTranslation(['livestock', 'common']);
  const { id = '' } = useParams();
  const event = useApiQuery('getHealthEvent', { path: { id } });
  const labels = useStateLabels({
    loading: t('healthEvent.loading'),
    emptyTitle: t('healthEvent.notFound'),
    errorTitle: t('healthEvent.error'),
    deniedTitle: t('healthEvent.denied'),
  });
  const back = (
    <Link to="/health-events" className="w-fit text-accent-text underline">
      {t('healthEvent.back')}
    </Link>
  );
  if (event.error?.status === 404) {
    return (
      <EmptyState
        title={t('healthEvent.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={event}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
    >
      {(current) => {
        const rows: [string, ReactNode][] = [
          [t('healthEvent.subject'), <Subject key="subject" event={current} />],
          [t('healthEvent.medicine'), current.product?.name ?? t('animal.none')],
          [t('health.dose'), current.dose ?? NOT_APPLICABLE],
          [
            t('health.qty'),
            current.qtyUsed === null
              ? NOT_APPLICABLE
              : formatQuantity(current.qtyUsed, { places: 3 }),
          ],
          [
            t('healthEvent.withdrawalDays'),
            t('health.withdrawalDays', { count: current.withdrawalDays }),
          ],
          [
            t('healthEvent.withdrawalEnds'),
            current.withdrawalEndsAt === null ? (
              t('healthList.noWithdrawal')
            ) : (
              <When key="ends" instant={current.withdrawalEndsAt} />
            ),
          ],
          [t('health.cost'), <MoneyDisplay key="cost" pesewas={current.costPesewas} />],
          [t('health.by'), current.administeredBy ?? NOT_APPLICABLE],
          [t('healthEvent.occurred'), <When key="occurred" instant={current.occurredAt} />],
          [
            t('healthEvent.recorded'),
            <span key="recorded">
              <When instant={current.recordedAt} /> · {current.actor.displayName}
            </span>,
          ],
          [t('health.notes'), current.notes ?? NOT_APPLICABLE],
        ];
        return (
          <article aria-labelledby="event-title" className="grid gap-4">
            <div className="grid gap-2">
              {back}
              <PageHeader
                title={t(`healthKind.${current.kind}`)}
                titleId="event-title"
                description={
                  current.holdsPlaced > 0 ? (
                    <StatusBadge
                      tone="warning"
                      label={t('healthEvent.holds', { count: current.holdsPlaced })}
                    />
                  ) : undefined
                }
              />
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm shadow-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        );
      }}
    </QueryBoundary>
  );
}
