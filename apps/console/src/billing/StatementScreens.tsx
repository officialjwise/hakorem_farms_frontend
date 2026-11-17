import { ScrollText } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  Combobox,
  DatePicker,
  EmptyState,
  Field,
  IconChip,
  MoneyDisplay,
  MutationFailure,
  QueryBoundary,
  Skeleton,
  StatusBadge,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  useTableView,
  type TableColumn,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiMutation, useApiQuery } from '../data/api';
import { useIntentKey } from '../lib/queries';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import type { Statement } from './presentation';

type CustomerRef = components['schemas']['CustomerRef'];

function StatementStatus({ statement }: { statement: Pick<Statement, 'status'> }) {
  const { t } = useTranslation('billing');
  return statement.status === 'DRAFT' ? (
    <StatusBadge tone="info" label={t('status.DRAFT')} />
  ) : (
    <StatusBadge tone="good" label={t('status.ISSUED')} />
  );
}

function useStatementName(): (statement: Pick<Statement, 'statementNo'>) => string {
  const { t } = useTranslation('billing');
  return (statement) => statement.statementNo ?? t('statements.draftName');
}

/**
 * FR-WHL: customer statements, newest first: what each customer was invoiced, paid and credited over a
 * period, and the balance carried forward, all as the API states them. Planned in the contract (B08
 * continued 2d), so this screen reads the mock until it lands.
 */
export function StatementsScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const statementName = useStatementName();
  const statements = useApiQuery(
    'listStatements',
    { query: pages.cursor === undefined ? {} : { cursor: pages.cursor } },
    { staleClass: 'working' },
  );
  const labels = useStateLabels({
    loading: t('statements.loading'),
    emptyTitle: t('statements.empty'),
    emptyDescription: t('statements.emptyBody'),
    errorTitle: t('statements.error'),
    deniedTitle: t('statements.denied'),
  });
  const columns: TableColumn<Statement>[] = [
    {
      id: 'statement',
      rowHeader: true,
      head: t('statements.columns.statement'),
      sortValue: (s) => s.statementNo ?? '',
      cell: (s) => (
        <span className="flex items-center gap-3">
          <IconChip icon={ScrollText} tone="accent" size="sm" />
          <Link to={`/statements/${s.id}`} className="text-accent-text underline">
            {statementName(s)}
          </Link>
        </span>
      ),
    },
    {
      id: 'customer',
      head: t('statements.columns.customer'),
      sortValue: (s) => s.customer.name,
      cell: (s) => `${s.customer.name} (${s.customer.publicId})`,
    },
    {
      id: 'period',
      head: t('statements.columns.period'),
      sortValue: (s) => s.periodEnd,
      cell: (s) => t('statements.period', { start: s.periodStart, end: s.periodEnd }),
    },
    {
      id: 'closing',
      head: t('statements.columns.closing'),
      numeric: true,
      sortValue: (s) => s.closingPesewas,
      cell: (s) => <MoneyDisplay pesewas={s.closingPesewas} strong />,
    },
    {
      id: 'status',
      head: t('statements.columns.status'),
      sortValue: (s) => s.status,
      cell: (s) => <StatementStatus statement={s} />,
    },
  ];
  const view = useTableView(columns);
  return (
    <section aria-labelledby="statements-title" className="grid gap-4">
      <PageHeader
        title={t('statements.title')}
        titleId="statements-title"
        description={t('statements.description')}
        actions={
          auth.can('whl.statement.create') ? (
            <Button asChild>
              <Link to="/statements/new">{t('statements.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={statements}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(s) => s.id}
        tableLabel={t('statements.table')}
        exportName={t('statements.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('statements.pages') }}
      />
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function BackToStatements() {
  const { t } = useTranslation('billing');
  return (
    <Link to="/statements" className="text-accent-text underline">
      {t('statements.back')}
    </Link>
  );
}

/** One statement: its summary and every movement with the running balance, as the API gives them. */
export function StatementScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const { id = '' } = useParams();
  const statement = useApiQuery('getStatement', { path: { id } });
  const labels = useStateLabels({
    loading: t('statements.one.loading'),
    emptyTitle: t('statements.notFound'),
    errorTitle: t('statements.one.error'),
    deniedTitle: t('statements.one.denied'),
  });
  if (statement.error?.status === 404) {
    return (
      <EmptyState
        title={t('statements.notFound')}
        description={t('common:states.notFoundBody')}
        action={<BackToStatements />}
      />
    );
  }
  return (
    <QueryBoundary
      query={statement}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(current) => <StatementView statement={current} />}
    </QueryBoundary>
  );
}

export function StatementView({ statement }: { statement: Statement }) {
  const { t } = useTranslation('billing');
  const name = useStatementName()(statement);
  const c = (key: string) => t(`statements.one.columns.${key}` as 'statements.one.columns.date');
  return (
    <article aria-labelledby="statement-title" className="grid gap-4">
      <div className="grid gap-2">
        <BackToStatements />
        <div className="flex flex-wrap items-center gap-3">
          <PageHeader title={t('statements.one.title', { name })} titleId="statement-title" />
          <StatementStatus statement={statement} />
        </div>
        <p className="text-fg-muted">
          {statement.customer.name} ({statement.customer.publicId}) ·{' '}
          {t('statements.period', { start: statement.periodStart, end: statement.periodEnd })}
        </p>
        {statement.status === 'DRAFT' ? (
          <p className="text-fg-muted">{t('statements.one.draftNote')}</p>
        ) : null}
      </div>
      <Card>
        <CardBody className="grid gap-2">
          <h2 className="text-lg font-semibold">{t('statements.one.totals')}</h2>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <Fact term={t('statements.one.opening')}>
              <MoneyDisplay pesewas={statement.openingPesewas} />
            </Fact>
            <Fact term={t('statements.one.invoiced')}>
              <MoneyDisplay pesewas={statement.invoicedPesewas} />
            </Fact>
            <Fact term={t('statements.one.paid')}>
              <MoneyDisplay pesewas={statement.paidPesewas} />
            </Fact>
            <Fact term={t('statements.one.credited')}>
              <MoneyDisplay pesewas={statement.creditedPesewas} />
            </Fact>
            <Fact term={t('statements.one.closing')}>
              <MoneyDisplay pesewas={statement.closingPesewas} strong />
            </Fact>
          </dl>
        </CardBody>
      </Card>
      <section aria-labelledby="movements-title" className="grid gap-3">
        <h2 id="movements-title" className="text-xl font-semibold">
          {t('statements.one.lines')}
        </h2>
        {statement.lines.length === 0 ? (
          <p className="text-fg-muted">{t('statements.one.noLines')}</p>
        ) : (
          <TableContainer aria-label={t('statements.one.linesTable')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c('date')}</TableHead>
                  <TableHead>{c('kind')}</TableHead>
                  <TableHead>{c('reference')}</TableHead>
                  <TableHead numeric>{c('debit')}</TableHead>
                  <TableHead numeric>{c('credit')}</TableHead>
                  <TableHead numeric>{c('balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.lines.map((line, index) => (
                  <TableRow key={`${line.date}-${line.reference}-${index}`}>
                    <TableRowHeader>{line.date}</TableRowHeader>
                    <TableCell label={c('kind')}>
                      {t(`statements.one.kind.${line.kind}`, { defaultValue: line.kind })}
                    </TableCell>
                    <TableCell label={c('reference')}>{line.reference}</TableCell>
                    <TableCell numeric label={c('debit')}>
                      <MoneyDisplay pesewas={line.debitPesewas} />
                    </TableCell>
                    <TableCell numeric label={c('credit')}>
                      <MoneyDisplay pesewas={line.creditPesewas} />
                    </TableCell>
                    <TableCell numeric label={c('balance')}>
                      <MoneyDisplay pesewas={line.balancePesewas} strong />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>
    </article>
  );
}

/** A customer found by part of the name or by phone number, as the person types. */
function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: CustomerRef | null;
  onChange: (customer: CustomerRef | null) => void;
  error?: string;
}) {
  const { t } = useTranslation(['billing', 'common']);
  const [text, setText] = useState(value?.name ?? '');
  const search = text.trim();
  const found = useApiQuery(
    'listCustomers',
    { query: { q: search, status: 'ACTIVE', limit: 10 } },
    { staleClass: 'working', enabled: search.length >= 2 && search !== value?.name },
  );
  const rows = found.data?.data ?? [];
  const options = [...(value === null ? [] : [value]), ...rows]
    .filter((c, i, all) => all.findIndex((o) => o.id === c.id) === i)
    .map((c) => ({ value: c.id, label: `${c.name} (${c.publicId})` }));
  return (
    <Field
      label={t('statements.create.customer')}
      hint={t('statements.create.customerSearch')}
      required
      requiredLabel={t('common:field.required')}
      error={error}
    >
      <Combobox
        options={options}
        value={value?.id ?? null}
        inputValue={text}
        onInputValueChange={setText}
        onValueChange={(id) => {
          const row = rows.find((c) => c.id === id);
          const picked =
            row === undefined
              ? value?.id === id
                ? value
                : null
              : { id: row.id, publicId: row.publicId, name: row.name };
          onChange(picked);
          if (picked !== null) setText(picked.name);
        }}
        loading={found.isFetching}
        loadingLabel={t('statements.create.searching')}
        listLabel={t('statements.create.customers')}
        noResultsLabel={
          search.length < 2 ? t('statements.create.typeMore') : t('statements.create.noCustomer')
        }
      />
    </Field>
  );
}

/**
 * Draws up a statement (`createStatement`): a draft preview, or issued and archived at once. It writes no
 * money, so it has no confirmation; the answer opens on its own page.
 */
export function StatementNewScreen() {
  const { t } = useTranslation(['billing', 'common']);
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issue, setIssue] = useState(false);
  const [checked, setChecked] = useState(false);
  const create = useApiMutation('createStatement', { invalidates: ['listStatements'] });
  const keyFor = useIntentKey();
  const failure = useStateLabels({
    loading: t('statements.create.pending'),
    emptyTitle: t('statements.create.failed'),
    errorTitle: t('statements.create.failed'),
    deniedTitle: t('statements.create.failed'),
  });
  const datesMissing = periodStart === '' || periodEnd === '';
  // ISO calendar dates compare as text.
  const datesOrder = !datesMissing && periodEnd < periodStart;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (customer === null || datesMissing || datesOrder) return;
    const body = { customerId: customer.id, periodStart, periodEnd, issue };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((statement) => navigate(`/statements/${statement.id}`))
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="statement-new-title" className="grid gap-4">
      <BackToStatements />
      <PageHeader title={t('statements.create.title')} titleId="statement-new-title" />
      <p className="text-fg-muted">{t('statements.create.intro')}</p>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CustomerPicker
                value={customer}
                onChange={setCustomer}
                error={
                  checked && customer === null ? t('statements.create.customerMissing') : undefined
                }
              />
            </div>
            <Field
              label={t('statements.create.start')}
              required
              requiredLabel={t('common:field.required')}
              error={
                checked && periodStart === '' ? t('statements.create.datesMissing') : undefined
              }
            >
              <DatePicker
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </Field>
            <Field
              label={t('statements.create.end')}
              required
              requiredLabel={t('common:field.required')}
              error={
                checked && periodEnd === ''
                  ? t('statements.create.datesMissing')
                  : checked && datesOrder
                    ? t('statements.create.datesOrder')
                    : undefined
              }
            >
              <DatePicker
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </Field>
            <Field label={t('statements.create.issue')} hint={t('statements.create.issueHint')}>
              <Switch checked={issue} onCheckedChange={setIssue} />
            </Field>
          </CardBody>
        </Card>
        {create.error === null ? null : <MutationFailure error={create.error} labels={failure} />}
        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending
              ? t('statements.create.pending')
              : issue
                ? t('statements.create.submitIssue')
                : t('statements.create.submitDraft')}
          </Button>
        </div>
      </form>
    </article>
  );
}
