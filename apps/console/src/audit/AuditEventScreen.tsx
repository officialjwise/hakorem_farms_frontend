import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  QueryBoundary,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { changeRows, show, type AuditAction, type AuditEvent } from './presentation';
import { RequestReference } from '../lib/RequestReference';

/**
 * FR-AUD-001 and 006: one event, with what changed laid out as before and after, field by field. At 360 px
 * the table stacks (ADR 0003), so each field reads as a small block: field, before, after.
 */
export function AuditEventScreen() {
  const { t } = useTranslation(['audit', 'common']);
  const { id = '' } = useParams();
  // An event cannot change once written: `immutable` (DATA_CONVENTIONS).
  const event = useApiQuery('getAuditEvent', { path: { id } }, { staleClass: 'immutable' });
  const labels = useStateLabels({
    loading: t('event.loading'),
    emptyTitle: t('event.notFound'),
    errorTitle: t('event.error'),
    deniedTitle: t('event.denied'),
    deniedDescription: t('list.deniedBody'),
  });
  const back = (
    <Link to="/audit" className="text-accent-text underline">
      {t('event.back')}
    </Link>
  );
  if (event.error?.status === 404) {
    return (
      <EmptyState
        title={t('event.notFound')}
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
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(record) => <EventDetail record={record} back={back} />}
    </QueryBoundary>
  );
}

function EventDetail({ record, back }: { record: AuditEvent; back: ReactNode }) {
  const { t } = useTranslation(['audit', 'common']);
  const action = t(`action.${record.action as AuditAction}`);
  const rows = changeRows(record.before, record.after);
  const metadata = Object.entries(record.metadata ?? {});
  const absent = <span className="text-fg-muted">{t('event.absent')}</span>;

  return (
    <article aria-labelledby="event-title" className="grid gap-4">
      <PageHeader
        title={t('event.title', { action, record: record.entityType })}
        titleId="event-title"
        actions={back}
      />
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('event.facts')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt className="text-fg-muted">{t('event.occurredAt')}</dt>
            <dd>
              <When instant={record.occurredAt} />
            </dd>
            <dt className="text-fg-muted">{t('event.exact')}</dt>
            <dd className="font-mono break-all">{record.occurredAt}</dd>
            <dt className="text-fg-muted">{t('event.recordedAt')}</dt>
            <dd>
              <When instant={record.recordedAt} />
            </dd>
            <dt className="text-fg-muted">{t('event.actor')}</dt>
            <dd>{record.actor?.displayName ?? t('list.system')}</dd>
            <dt className="text-fg-muted">{t('event.address')}</dt>
            <dd>{record.ipAddress ?? t('event.none')}</dd>
            <dt className="text-fg-muted">{t('event.area')}</dt>
            <dd>{record.module}</dd>
            <dt className="text-fg-muted">{t('event.record')}</dt>
            <dd>{record.entityType}</dd>
            <dt className="text-fg-muted">{t('event.correlation')}</dt>
            <dd>
              <RequestReference value={record.correlationId} />
            </dd>
            <dt className="text-fg-muted">{t('event.sealed')}</dt>
            <dd>
              {record.sealed && record.chainSeq !== null
                ? t('event.sealedAt', { seq: record.chainSeq })
                : t('event.unsealed')}
            </dd>
          </dl>
          <p className="mt-2 text-control-sm text-fg-muted">{t('common:time.zone')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2 id="changes-title">{t('event.changes')}</h2>
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2">
          {rows.length === 0 ? (
            <p>{t('event.noChanges')}</p>
          ) : (
            <TableContainer aria-labelledby="changes-title">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('event.field')}</TableHead>
                    <TableHead>{t('event.before')}</TableHead>
                    <TableHead>{t('event.after')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.field} selected={row.changed}>
                      <TableRowHeader>
                        <code className="break-all">{row.field}</code>
                      </TableRowHeader>
                      <TableCell label={t('event.before')}>
                        <span className="break-all">{row.before ?? absent}</span>
                      </TableCell>
                      <TableCell label={t('event.after')}>
                        <span className="break-all">{row.after ?? absent}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <p className="text-control-sm text-fg-muted">{t('event.erasedNote')}</p>
        </CardBody>
      </Card>

      {metadata.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t('event.metadata')}</h2>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {metadata.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-fg-muted">
                    <code>{key}</code>
                  </dt>
                  <dd className="break-all">{show(value) ?? t('event.absent')}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      ) : null}
    </article>
  );
}
