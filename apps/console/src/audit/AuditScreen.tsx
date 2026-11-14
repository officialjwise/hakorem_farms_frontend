import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  DatePicker,
  Field,
  Input,
  Pagination,
  QueryBoundary,
  Select,
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
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { KNOWN_MODULES } from '../iam/permissions';
import { useStateLabels } from '../lib/states';
import { useCursorPages } from '../lib/useCursorPages';
import { IntegrityPanel } from './IntegrityPanel';
import { AUDIT_ACTIONS, dayEnd, dayStart, type AuditAction } from './presentation';

const ANY = 'ANY';
const COLUMNS = 5;

interface Filters {
  module: string;
  action: string;
  entityType: string;
  from: string;
  to: string;
}
const NONE: Filters = { module: ANY, action: ANY, entityType: '', from: '', to: '' };

/**
 * FR-AUD-001, 003, 005: the audit log, filtered by area, action, record type and dates, a page at a time,
 * with the tamper check above it. Owner and accountant only (`aud.audit.read`); reading is itself audited.
 */
export function AuditScreen() {
  const { t } = useTranslation(['audit', 'iam', 'common']);
  const pages = useCursorPages();
  const [draft, setDraft] = useState<Filters>(NONE);
  const [applied, setApplied] = useState<Filters>(NONE);
  const [rangeError, setRangeError] = useState<string | undefined>(undefined);

  const events = useApiQuery('listAuditEvents', {
    query: {
      ...(applied.module === ANY ? {} : { module: applied.module }),
      ...(applied.action === ANY ? {} : { action: applied.action }),
      ...(applied.entityType === '' ? {} : { entityType: applied.entityType }),
      ...(applied.from === '' ? {} : { from: dayStart(applied.from) }),
      ...(applied.to === '' ? {} : { to: dayEnd(applied.to) }),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('list.loading'),
    emptyTitle: t('list.empty'),
    emptyDescription: t('list.emptyBody'),
    errorTitle: t('list.error'),
    deniedTitle: t('list.denied'),
    deniedDescription: t('list.deniedBody'),
  });

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ISO dates compare as text.
    if (draft.from !== '' && draft.to !== '' && draft.to < draft.from) {
      setRangeError(t('list.filters.invalidRange'));
      return;
    }
    setRangeError(undefined);
    setApplied({ ...draft, entityType: draft.entityType.trim() });
    pages.reset();
  };

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('list.columns.when')}</TableHead>
        <TableHead>{t('list.columns.actor')}</TableHead>
        <TableHead>{t('list.columns.action')}</TableHead>
        <TableHead>{t('list.columns.record')}</TableHead>
        <TableHead>{t('list.columns.area')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby="audit-title" className="grid gap-4">
      <h1 id="audit-title" className="text-2xl font-semibold">
        {t('list.title')}
      </h1>
      <p className="text-fg-muted">
        {t('list.intro')} {t('common:time.zone')}
      </p>
      <IntegrityPanel />
      <form
        role="search"
        aria-label={t('list.filters.label')}
        onSubmit={apply}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Field label={t('list.filters.module')}>
          <Select
            value={draft.module}
            onValueChange={(module) => setDraft((d) => ({ ...d, module }))}
            options={[
              { value: ANY, label: t('list.filters.anyModule') },
              ...KNOWN_MODULES.map((module) => ({
                value: module,
                label: t(`iam:role.module.${module}`),
              })),
            ]}
          />
        </Field>
        <Field label={t('list.filters.action')}>
          <Select
            value={draft.action}
            onValueChange={(action) => setDraft((d) => ({ ...d, action }))}
            options={[
              { value: ANY, label: t('list.filters.anyAction') },
              ...AUDIT_ACTIONS.map((action) => ({ value: action, label: t(`action.${action}`) })),
            ]}
          />
        </Field>
        <Field label={t('list.filters.entityType')} hint={t('list.filters.entityTypeHint')}>
          <Input
            value={draft.entityType}
            onChange={(event) => setDraft((d) => ({ ...d, entityType: event.target.value }))}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label={t('list.filters.from')}>
          <DatePicker
            value={draft.from}
            onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
          />
        </Field>
        <Field label={t('list.filters.to')} {...(rangeError ? { error: rangeError } : {})}>
          <DatePicker
            value={draft.to}
            onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" variant="secondary">
            {t('common:actions.search')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(NONE);
              setApplied(NONE);
              setRangeError(undefined);
              pages.reset();
            }}
          >
            {t('common:actions.clear')}
          </Button>
        </div>
      </form>

      <QueryBoundary
        query={events}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={
          <TableContainer aria-label={t('list.table')}>
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={COLUMNS} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(page) => (
          <div className="grid gap-3">
            <TableContainer aria-label={t('list.table')}>
              <Table>
                {header}
                <TableBody>
                  {page.data.map((event) => (
                    <TableRow key={event.id}>
                      <TableRowHeader>
                        <Link
                          to={`/audit/${event.id}`}
                          className="text-accent-text underline"
                          aria-label={t('list.open', { time: formatDateTime(event.occurredAt) })}
                        >
                          <time dateTime={event.occurredAt}>
                            {formatDateTime(event.occurredAt)}
                          </time>
                        </Link>
                      </TableRowHeader>
                      <TableCell label={t('list.columns.actor')}>
                        {event.actor?.displayName ?? t('list.system')}
                      </TableCell>
                      <TableCell label={t('list.columns.action')}>
                        {t(`action.${event.action as AuditAction}`)}
                      </TableCell>
                      <TableCell label={t('list.columns.record')}>{event.entityType}</TableCell>
                      <TableCell label={t('list.columns.area')}>{event.module}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pages.hasPrevious || page.page.hasMore ? (
              <Pagination
                label={t('list.pages')}
                hasPrevious={pages.hasPrevious}
                hasNext={page.page.hasMore && page.page.nextCursor !== null}
                onPrevious={pages.previous}
                onNext={() => {
                  if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                }}
                previousLabel={t('common:pagination.previous')}
                nextLabel={t('common:pagination.next')}
                summary={t('common:pagination.page', { page: pages.page })}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </section>
  );
}
