import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Button,
  DateRangeMenu,
  Field,
  FilterMenu,
  Input,
  Select,
  formatDateTime,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useApiQuery } from '../data/api';
import { KNOWN_MODULES } from '../iam/permissions';
import { dayEnd, dayStart, useDateRangeWords, type DateRange } from '../lib/dateRange';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { IntegrityPanel } from './IntegrityPanel';
import { AUDIT_ACTIONS, type AuditAction, type AuditEvent } from './presentation';

const ANY = 'ANY';

interface Filters {
  module: string;
  action: string;
  entityType: string;
}
const NONE: Filters = { module: ANY, action: ANY, entityType: '' };
const ANY_DATE: DateRange = { from: undefined, to: undefined };

/**
 * FR-AUD-001, 003, 005: the audit log, filtered by area, action, record type and dates, a page at a time,
 * with the tamper check above it. Owner and accountant only (`aud.audit.read`); reading is itself audited.
 */
export function AuditScreen() {
  const { t } = useTranslation(['audit', 'iam', 'common']);
  const pages = useCursorPages();
  const rangeWords = useDateRangeWords();
  const [draft, setDraft] = useState<Filters>(NONE);
  const [applied, setApplied] = useState<Filters>(NONE);
  // The range as picked, and the last valid one, which is what the API is asked for.
  const [range, setRange] = useState<DateRange>(ANY_DATE);
  const [appliedRange, setAppliedRange] = useState<DateRange>(ANY_DATE);
  const [rangeError, setRangeError] = useState<string | undefined>(undefined);

  const events = useApiQuery('listAuditEvents', {
    query: {
      ...(applied.module === ANY ? {} : { module: applied.module }),
      ...(applied.action === ANY ? {} : { action: applied.action }),
      ...(applied.entityType === '' ? {} : { entityType: applied.entityType }),
      ...(appliedRange.from === undefined ? {} : { from: dayStart(appliedRange.from) }),
      ...(appliedRange.to === undefined ? {} : { to: dayEnd(appliedRange.to) }),
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

  const changeRange = (next: DateRange) => {
    setRange(next);
    // ISO dates compare as text. A range that ends before it starts is not sent.
    if (next.from !== undefined && next.to !== undefined && next.to < next.from) {
      setRangeError(t('list.filters.invalidRange'));
      return;
    }
    setRangeError(undefined);
    setAppliedRange(next);
    pages.reset();
  };

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplied({ ...draft, entityType: draft.entityType.trim() });
    pages.reset();
  };

  const active =
    (applied.module === ANY ? 0 : 1) +
    (applied.action === ANY ? 0 : 1) +
    (applied.entityType === '' ? 0 : 1);

  const columns: TableColumn<AuditEvent>[] = [
    {
      id: 'when',
      rowHeader: true,
      head: t('list.columns.when'),
      // ISO instants sort as text.
      sortValue: (event) => event.occurredAt,
      cell: (event) => (
        <Link
          to={`/audit/${event.id}`}
          className="text-accent-text hover:underline"
          aria-label={t('list.open', { time: formatDateTime(event.occurredAt) })}
        >
          <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
        </Link>
      ),
    },
    {
      id: 'actor',
      head: t('list.columns.actor'),
      sortValue: (event) => event.actor?.displayName ?? t('list.system'),
      cell: (event) => event.actor?.displayName ?? t('list.system'),
    },
    {
      id: 'action',
      head: t('list.columns.action'),
      sortValue: (event) => t(`action.${event.action as AuditAction}`),
      cell: (event) => t(`action.${event.action as AuditAction}`),
    },
    {
      id: 'record',
      head: t('list.columns.record'),
      sortValue: (event) => event.entityType,
      cell: (event) => event.entityType,
    },
    {
      id: 'area',
      head: t('list.columns.area'),
      sortValue: (event) => event.module,
      cell: (event) => event.module,
    },
  ];
  const view = useTableView(columns);

  return (
    <section aria-labelledby="audit-title" className="grid gap-4">
      <PageHeader title={t('list.title')} titleId="audit-title" />
      <p className="text-fg-muted">
        {t('list.intro')} {t('common:time.zone')}
      </p>
      <IntegrityPanel />
      <TableCard
        view={view}
        query={events}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(event) => event.id}
        tableLabel={t('list.table')}
        exportName={t('list.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('list.pages') }}
        toolbar={
          <>
            <DateRangeMenu
              label={t('common:dates.label')}
              summary={rangeWords(range)}
              from={range.from}
              to={range.to}
              onChange={changeRange}
              fromLabel={t('common:dates.from')}
              toLabel={t('common:dates.to')}
              clearLabel={t('common:dates.clear')}
            />
            {rangeError === undefined ? null : (
              <p role="alert" className="text-control-sm font-semibold text-critical-fg">
                {rangeError}
              </p>
            )}
            <FilterMenu
              label={t('common:table.filter')}
              active={active}
              reset={{
                label: t('common:table.resetFilters'),
                onReset: () => {
                  setDraft(NONE);
                  setApplied(NONE);
                  pages.reset();
                },
              }}
            >
              <form aria-label={t('list.filters.label')} onSubmit={apply} className="grid gap-3">
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
                      ...AUDIT_ACTIONS.map((action) => ({
                        value: action,
                        label: t(`action.${action}`),
                      })),
                    ]}
                  />
                </Field>
                <Field label={t('list.filters.entityType')} hint={t('list.filters.entityTypeHint')}>
                  <Input
                    size="sm"
                    value={draft.entityType}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, entityType: event.target.value }))
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Button type="submit" variant="secondary" size="sm" className="justify-self-start">
                  {t('list.filters.apply')}
                </Button>
              </form>
            </FilterMenu>
          </>
        }
      />
    </section>
  );
}
