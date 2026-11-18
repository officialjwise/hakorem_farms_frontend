import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  FilterMenu,
  IconChip,
  MutationFailure,
  NOT_APPLICABLE,
  QueryBoundary,
  Skeleton,
  formatDateTime,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { RFQ_STATUSES, RfqStatusBadge } from './presentation';

type Rfq = components['schemas']['Rfq'];

/**
 * Requests for quote, newest first: from the shop's form, a "request to buy", a phone call, WhatsApp or the
 * counter. Each opens to be quoted.
 */
export function RfqsScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const pages = useCursorPages();
  const [status, setStatus] = useState(ANY);
  const list = useApiQuery('listRfqs', {
    query: {
      ...param('status', status),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('rfqs.loading'),
    emptyTitle: t('rfqs.empty'),
    emptyDescription: t('rfqs.emptyBody'),
    errorTitle: t('rfqs.error'),
    deniedTitle: t('rfqs.denied'),
  });
  const view = useTableView<Rfq>([
    {
      id: 'rfq',
      rowHeader: true,
      head: t('columns.request'),
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Inbox} tone="info" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/rfqs/${r.id}`} className="text-accent-text underline">
              {r.rfqNo ?? t('rfq.unnumbered')}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">{r.contactName}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (r) => r.status,
      cell: (r) => <RfqStatusBadge status={r.status} />,
    },
    {
      id: 'source',
      head: t('columns.source'),
      sortValue: (r) => r.source,
      cell: (r) => t(`rfqSource.${r.source}`, { defaultValue: r.source }),
    },
    {
      id: 'received',
      head: t('columns.received'),
      sortValue: (r) => r.createdAt,
      cell: (r) => formatDateTime(r.createdAt),
    },
  ]);
  return (
    <section aria-labelledby="rfqs-title" className="grid gap-4">
      <PageHeader title={t('rfqs.title')} titleId="rfqs-title" />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('rfqs.title')}
        exportName={t('rfqs.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('rfqs.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                pages.reset();
              },
            }}
          >
            <FilterSelect
              anyLabel={t('filters.any')}
              label={t('filters.status')}
              value={status}
              onChange={(value) => {
                setStatus(value);
                pages.reset();
              }}
              options={RFQ_STATUSES.map((s) => ({ value: s, label: t(`rfqStatus.${s}`) }))}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** One request for quote: what the buyer asked for in their own words, and the quotes made from it. */
export function RfqScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const keyFor = useIntentKey();
  const rfq = useApiQuery('getRfq', { path: { id } });
  const update = useApiMutation('updateRfq', { invalidates: ['listRfqs'] });
  const [done, setDone] = useState<string | null>(null);
  const labels = useStateLabels({
    loading: t('rfq.loading'),
    emptyTitle: t('rfq.notFound'),
    errorTitle: t('rfq.error'),
    deniedTitle: t('rfqs.denied'),
  });
  const failure = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  const back = (
    <Link to="/rfqs" className="text-accent-text underline">
      {t('back.rfqs')}
    </Link>
  );
  if (rfq.error?.status === 404) {
    return (
      <EmptyState
        title={t('rfq.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  const set = (status: 'IN_PROGRESS' | 'CLOSED' | 'SPAM') => {
    const input = { path: { id }, body: { status } };
    update
      .mutateAsync(input, { idempotencyKey: keyFor(input) })
      .then(() => setDone(status))
      .catch(() => undefined);
  };
  return (
    <QueryBoundary
      query={rfq}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-48" />}
    >
      {(r) => {
        const open = r.status === 'NEW' || r.status === 'IN_PROGRESS';
        return (
          <article aria-labelledby="rfq-title" className="grid gap-4">
            {back}
            <div className="flex flex-wrap items-center gap-3">
              <PageHeader title={r.rfqNo ?? t('rfq.unnumbered')} titleId="rfq-title" />
              <RfqStatusBadge status={r.status} />
            </div>
            {done === null ? null : (
              <Alert severity="good" title={t(`rfq.done.${done}`, { defaultValue: done })} />
            )}
            <MutationFailure error={update.error} labels={failure} />
            <Card>
              <CardBody className="grid gap-3">
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                  <dt className="text-fg-muted">{t('fields.contact')}</dt>
                  <dd>{`${r.contactName}, ${r.contactPhone}`}</dd>
                  <dt className="text-fg-muted">{t('columns.source')}</dt>
                  <dd>{t(`rfqSource.${r.source}`, { defaultValue: r.source })}</dd>
                  <dt className="text-fg-muted">{t('fields.neededBy')}</dt>
                  <dd>{r.neededBy ?? NOT_APPLICABLE}</dd>
                  <dt className="text-fg-muted">{t('fields.deliveryArea')}</dt>
                  <dd>{r.deliveryArea ?? NOT_APPLICABLE}</dd>
                  <dt className="text-fg-muted">{t('fields.assignedTo')}</dt>
                  <dd>{r.assignedTo?.displayName ?? t('rfq.unassigned')}</dd>
                </dl>
                <h2 className="font-semibold">{t('rfq.requirements')}</h2>
                <p className="whitespace-pre-line">{r.requirements}</p>
              </CardBody>
            </Card>
            {r.quoteIds.length === 0 ? null : (
              <ul className="grid gap-1">
                {r.quoteIds.map((quoteId, index) => (
                  <li key={quoteId}>
                    <Link to={`/quotes/${quoteId}`} className="text-accent-text underline">
                      {t('rfq.openQuote', { number: index + 1 })}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {open && auth.can('quo.quote.create') ? (
                <Button asChild>
                  <Link to={`/quotes/new?rfq=${r.id}`}>{t('rfq.quoteIt')}</Link>
                </Button>
              ) : null}
              {r.status === 'NEW' && auth.can('quo.rfq.update') ? (
                <Button variant="secondary" onClick={() => set('IN_PROGRESS')}>
                  {t('rfq.start')}
                </Button>
              ) : null}
              {open && auth.can('quo.rfq.update') ? (
                <>
                  <Button variant="secondary" onClick={() => set('CLOSED')}>
                    {t('rfq.close')}
                  </Button>
                  <Button variant="secondary" onClick={() => set('SPAM')}>
                    {t('rfq.spam')}
                  </Button>
                </>
              ) : null}
            </div>
          </article>
        );
      }}
    </QueryBoundary>
  );
}
