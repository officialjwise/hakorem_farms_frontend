import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Card,
  CardBody,
  DatePicker,
  Field,
  MoneyDisplay,
  StatusBadge,
  useTableView,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { useApiQuery } from '../data/api';

type S = components['schemas'];
type Row = S['AgeingRow'];

/** The five buckets the API answers, in order: current, then by how many days past due. */
const BUCKETS = [
  'currentPesewas',
  'days1To30Pesewas',
  'days31To60Pesewas',
  'days61To90Pesewas',
  'daysOver90Pesewas',
] as const satisfies readonly (keyof S['AgeingTotals'])[];

/** One buyer's ageing, bucket by bucket, as a list a phone reads from top to bottom. */
export function AgeingBuckets({ row }: { row: S['AgeingTotals'] }) {
  const { t } = useTranslation('wholesale');
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-1">
      {BUCKETS.map((bucket) => (
        <div key={bucket} className="contents">
          <dt>{t(`ageing.bucket.${bucket}`)}</dt>
          <dd className="text-end">
            <MoneyDisplay pesewas={row[bucket]} />
          </dd>
        </div>
      ))}
      <dt className="font-semibold">{t('ageing.total')}</dt>
      <dd className="text-end">
        <MoneyDisplay pesewas={row.totalPesewas} strong />
      </dd>
    </dl>
  );
}

/**
 * Receivables ageing: who owes what, current and 1 to 30, 31 to 60, 61 to 90 and over 90 days past due,
 * with the totals, all as the API works them out on the day chosen. The screen sorts; it never adds.
 */
export function AgeingScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const pages = useCursorPages();
  const [asOf, setAsOf] = useState('');
  const report = useApiQuery('getAgeingReport', {
    query: {
      ...(asOf === '' ? {} : { asOf }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('ageing.loading'),
    emptyTitle: t('ageing.empty'),
    emptyDescription: t('ageing.emptyBody'),
    errorTitle: t('ageing.error'),
    deniedTitle: t('ageing.denied'),
  });
  const view = useTableView<Row>([
    {
      id: 'customer',
      rowHeader: true,
      head: t('columns.customer'),
      sortValue: (r) => r.customer.name,
      cell: (r) => (
        <span className="grid gap-1">
          <Link to={`/business-accounts/${r.customer.id}`} className="text-accent-text underline">
            {r.customer.name}
          </Link>
          {r.onHold ? <StatusBadge tone="critical" label={t('accountStatus.ON_HOLD')} /> : null}
        </span>
      ),
    },
    ...BUCKETS.map((bucket) => ({
      id: bucket,
      head: t(`ageing.bucket.${bucket}`),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (r: Row) => r[bucket],
      cell: (r: Row) => <MoneyDisplay pesewas={r[bucket]} />,
    })),
    {
      id: 'total',
      head: t('ageing.total'),
      numeric: true,
      sortValue: (r) => r.totalPesewas,
      cell: (r) => <MoneyDisplay pesewas={r.totalPesewas} strong />,
    },
    {
      id: 'limit',
      head: t('columns.limit'),
      numeric: true,
      sortValue: (r) => r.creditLimitPesewas ?? -1,
      cell: (r) =>
        r.creditLimitPesewas === null ? (
          t('ageing.noLimit')
        ) : (
          <MoneyDisplay pesewas={r.creditLimitPesewas} />
        ),
    },
  ]);
  return (
    <section aria-labelledby="ageing-title" className="grid gap-4">
      <PageHeader
        title={t('ageing.title')}
        titleId="ageing-title"
        description={
          report.data === undefined ? undefined : t('ageing.asOf', { day: report.data.asOf })
        }
      />
      <Card>
        <CardBody>
          <Field label={t('ageing.asOfField')} hint={t('ageing.asOfHint')}>
            <DatePicker
              value={asOf}
              onChange={(event) => {
                setAsOf(event.target.value);
                pages.reset();
              }}
            />
          </Field>
        </CardBody>
      </Card>
      {report.data === undefined ? null : (
        <Card>
          <CardBody className="grid gap-2">
            <h2 className="font-semibold">{t('ageing.totals')}</h2>
            <AgeingBuckets row={report.data.totals} />
          </CardBody>
        </Card>
      )}
      <TableCard
        view={view}
        query={report}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.customer.id}
        tableLabel={t('ageing.title')}
        exportName={t('ageing.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('ageing.pages') }}
      />
    </section>
  );
}
