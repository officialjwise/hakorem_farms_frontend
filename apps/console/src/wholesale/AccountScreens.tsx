import { Building } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FilterMenu,
  IconChip,
  Input,
  MoneyDisplay,
  MoneyInput,
  MutationFailure,
  NOT_APPLICABLE,
  QueryBoundary,
  Textarea,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  formatDateTime,
  formatMoney,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param } from '../stock/filters';
import { AgeingBuckets } from './AgeingScreen';
import { CustomerPicker } from './CustomerPicker';
import { ACCOUNT_STATUSES, AccountStatusBadge } from './presentation';

type S = components['schemas'];
type Account = S['BusinessAccount'];

/** A whole number of days, as typed: 0 to 365. */
const DAYS = /^(0|[1-9]\d{0,2})$/;
const toDays = (typed: string): number | null =>
  DAYS.test(typed.trim()) && Number(typed.trim()) <= 365 ? Number(typed.trim()) : null;

/**
 * Wholesale accounts: each buyer on credit, their limit and terms, what they owe and what is overdue, all
 * as the API answers them. Over the limit and on hold are said in words, never only in colour.
 */
export function BusinessAccountsScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const [status, setStatus] = useState(ANY);
  const [overLimit, setOverLimit] = useState(ANY);
  const list = useApiQuery('listBusinessAccounts', {
    query: {
      ...param('status', status),
      ...(overLimit === 'YES' ? { overLimit: true } : {}),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('accounts.loading'),
    emptyTitle: t('accounts.empty'),
    emptyDescription: t('accounts.emptyBody'),
    errorTitle: t('accounts.error'),
    deniedTitle: t('accounts.denied'),
  });
  const view = useTableView<Account>([
    {
      id: 'customer',
      rowHeader: true,
      head: t('columns.customer'),
      sortValue: (a) => a.customer.name,
      cell: (a) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Building} tone="accent" size="sm" />
          <Link to={`/business-accounts/${a.customer.id}`} className="text-accent-text underline">
            {a.customer.name}
          </Link>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (a) => a.status,
      cell: (a) => <AccountStatusBadge status={a.status} />,
    },
    {
      id: 'limit',
      head: t('columns.limit'),
      numeric: true,
      sortValue: (a) => a.creditLimitPesewas,
      cell: (a) => <MoneyDisplay pesewas={a.creditLimitPesewas} />,
    },
    {
      id: 'owes',
      head: t('columns.owes'),
      numeric: true,
      sortValue: (a) => a.exposurePesewas,
      cell: (a) => <MoneyDisplay pesewas={a.exposurePesewas} />,
    },
    {
      id: 'overdue',
      head: t('columns.overdue'),
      numeric: true,
      sortValue: (a) => a.overduePesewas,
      cell: (a) => <MoneyDisplay pesewas={a.overduePesewas} />,
    },
    {
      id: 'available',
      head: t('columns.available'),
      numeric: true,
      sortValue: (a) => a.availableCreditPesewas,
      cell: (a) => <MoneyDisplay pesewas={a.availableCreditPesewas} />,
    },
    {
      id: 'terms',
      head: t('columns.terms'),
      sortValue: (a) => a.paymentTermsDays,
      cell: (a) => t('credit.days', { count: a.paymentTermsDays }),
    },
  ]);
  return (
    <section aria-labelledby="accounts-title" className="grid gap-4">
      <PageHeader
        title={t('accounts.title')}
        titleId="accounts-title"
        actions={
          auth.can('whl.account.manage') ? (
            <Button asChild>
              <Link to="/business-accounts/new">{t('accounts.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.customer.id}
        tableLabel={t('accounts.title')}
        exportName={t('accounts.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('accounts.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status, overLimit)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                setOverLimit(ANY);
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
              options={ACCOUNT_STATUSES.map((s) => ({ value: s, label: t(`accountStatus.${s}`) }))}
            />
            <FilterSelect
              anyLabel={t('filters.any')}
              label={t('filters.overLimit')}
              value={overLimit}
              onChange={(value) => {
                setOverLimit(value);
                pages.reset();
              }}
              options={[{ value: 'YES', label: t('filters.overLimitOnly') }]}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** Credit terms as typed, for opening an account or changing one. */
interface TermsDraft {
  creditLimitPesewas: number | null;
  paymentTermsDays: string;
  overdueHoldDays: string;
  /** Why the limit is asked for, shown to the approver (2.14.0). */
  reason: string;
}

function TermsFields({
  draft,
  onChange,
  checked,
}: {
  draft: TermsDraft;
  onChange: (next: Partial<TermsDraft>) => void;
  checked: boolean;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const required = t('common:field.required');
  return (
    <>
      <Field
        label={t('fields.creditLimit')}
        hint={t('fields.creditLimitHint')}
        required
        requiredLabel={required}
        error={checked && draft.creditLimitPesewas === null ? required : undefined}
      >
        <MoneyInput
          value={draft.creditLimitPesewas}
          onValueChange={(pesewas) => onChange({ creditLimitPesewas: pesewas })}
        />
      </Field>
      <Field
        label={t('fields.paymentTermsDays')}
        hint={t('fields.paymentTermsDaysHint')}
        required
        requiredLabel={required}
        error={
          checked && toDays(draft.paymentTermsDays) === null ? t('fields.daysWrong') : undefined
        }
      >
        <Input
          inputMode="numeric"
          value={draft.paymentTermsDays}
          onChange={(event) => onChange({ paymentTermsDays: event.target.value })}
        />
      </Field>
      <Field
        label={t('fields.overdueHoldDays')}
        hint={t('fields.overdueHoldDaysHint')}
        error={
          checked && draft.overdueHoldDays !== '' && toDays(draft.overdueHoldDays) === null
            ? t('fields.daysWrong')
            : undefined
        }
      >
        <Input
          inputMode="numeric"
          value={draft.overdueHoldDays}
          onChange={(event) => onChange({ overdueHoldDays: event.target.value })}
        />
      </Field>
      <Field label={t('fields.limitReason')} hint={t('fields.limitReasonHint')}>
        <Textarea
          rows={2}
          value={draft.reason}
          onChange={(event) => onChange({ reason: event.target.value })}
        />
      </Field>
    </>
  );
}

function termsWrong(draft: TermsDraft): boolean {
  return (
    draft.creditLimitPesewas === null ||
    toDays(draft.paymentTermsDays) === null ||
    (draft.overdueHoldDays !== '' && toDays(draft.overdueHoldDays) === null)
  );
}

/** Open credit terms for a customer (`createBusinessAccount`). */
export function BusinessAccountNewScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const navigate = useNavigate();
  const keyFor = useIntentKey();
  const [customer, setCustomer] = useState<S['Customer'] | null>(null);
  const [draft, setDraft] = useState<TermsDraft>({
    creditLimitPesewas: null,
    paymentTermsDays: '30',
    overdueHoldDays: '',
    reason: '',
  });
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const create = useApiMutation('createBusinessAccount', {
    invalidates: ['listBusinessAccounts'],
  });
  const guard = useLeaveGuard(!saved && (customer !== null || draft.creditLimitPesewas !== null));
  const failure = useStateLabels({
    loading: t('account.saving'),
    emptyTitle: t('account.notSaved'),
    errorTitle: t('account.notSaved'),
    deniedTitle: t('accounts.denied'),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (customer === null || termsWrong(draft)) return;
    const body: S['BusinessAccountCreate'] = {
      customerId: customer.id,
      creditLimitPesewas: draft.creditLimitPesewas ?? 0,
      paymentTermsDays: toDays(draft.paymentTermsDays) ?? 0,
      ...(draft.overdueHoldDays === ''
        ? {}
        : { overdueHoldDays: toDays(draft.overdueHoldDays) ?? 0 }),
      ...(draft.reason.trim() === '' ? {} : { reason: draft.reason.trim() }),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then(() => {
        // Opened at once; a limit asked for waits for its approver (202), and the account says so.
        setSaved(true);
        return navigate(`/business-accounts/${customer.id}`);
      })
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="account-new-title" className="grid gap-4">
      <Link to="/business-accounts" className="text-accent-text underline">
        {t('back.accounts')}
      </Link>
      <PageHeader title={t('account.newTitle')} titleId="account-new-title" />
      <Card>
        <CardBody>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <MutationFailure error={create.error} labels={failure} />
            <CustomerPicker
              label={t('fields.customer')}
              required
              value={customer}
              onChange={setCustomer}
              error={checked && customer === null ? t('common:field.required') : undefined}
            />
            <TermsFields
              draft={draft}
              onChange={(next) => setDraft((now) => ({ ...now, ...next }))}
              checked={checked}
            />
            <div>
              <Button type="submit" loading={create.isPending} loadingLabel={t('account.saving')}>
                {t('account.open')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <LeaveGuardDialog guard={guard} />
    </article>
  );
}

/**
 * One buyer's account: their limit, terms and price list, what they owe and how late (the ageing row the
 * API gives for them), whether they are on hold, and every credit override with who approved it.
 */
export function BusinessAccountScreen() {
  const { t } = useTranslation(['wholesale', 'common']);
  const { customerId = '' } = useParams();
  const account = useApiQuery('getBusinessAccount', { path: { customerId } });
  const labels = useStateLabels({
    loading: t('account.loading'),
    emptyTitle: t('account.notFound'),
    errorTitle: t('account.error'),
    deniedTitle: t('accounts.denied'),
  });
  const back = (
    <Link to="/business-accounts" className="text-accent-text underline">
      {t('back.accounts')}
    </Link>
  );
  if (account.error?.status === 404) {
    return (
      <EmptyState
        title={t('account.notFound')}
        description={t('account.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={account}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(a) => (
        <article aria-labelledby="account-title" className="grid gap-4">
          {back}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader title={a.customer.name} titleId="account-title" />
            <AccountStatusBadge status={a.status} />
          </div>
          {a.status === 'ON_HOLD' ? (
            <Alert
              severity="critical"
              title={t('account.onHold', {
                when: a.heldAt === null ? '' : formatDateTime(a.heldAt),
              })}
            >
              {a.holdReason ?? null}
            </Alert>
          ) : null}
          {a.pendingCreditLimitPesewas === null ? null : (
            <Alert
              severity="warning"
              title={t('account.limitPending', {
                limit: formatMoney(a.pendingCreditLimitPesewas),
              })}
            />
          )}
          {a.pendingRelease ? (
            <Alert severity="warning" title={t('account.releasePending')} />
          ) : null}
          {a.availableCreditPesewas === 0 && a.status === 'ACTIVE' ? (
            <Alert severity="warning" title={t('account.noCreditLeft')} />
          ) : null}
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [t('fields.customer'), <ReadableId key="p" value={a.customer.publicId} />],
                    [t('fields.paymentTermsDays'), t('credit.days', { count: a.paymentTermsDays })],
                    [t('fields.overdueHoldDays'), t('credit.days', { count: a.overdueHoldDays })],
                    [t('fields.priceList'), a.priceList?.name ?? t('account.noPriceList')],
                    [t('fields.accountManager'), a.accountManager?.displayName ?? NOT_APPLICABLE],
                  ] satisfies [string, ReactNode][]
                ).map(([term, value]) => (
                  <div key={term} className="contents">
                    <dt className="text-fg-muted">{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t('account.owes')}</h2>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 gap-y-2">
                <dt>{t('fields.creditLimit')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={a.creditLimitPesewas} />
                </dd>
                <dt className="font-semibold">{t('account.exposure')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={a.exposurePesewas} strong />
                </dd>
                <dt>{t('account.overdue')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={a.overduePesewas} />
                </dd>
                <dt>{t('account.available')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={a.availableCreditPesewas} />
                </dd>
              </dl>
              <p className="mt-2 text-control-sm text-fg-muted">{t('account.exposureHint')}</p>
            </CardBody>
          </Card>
          <CustomerAgeing customerId={a.customer.id} />
          <AccountActions account={a} />
          <Overrides customerId={a.customer.id} />
        </article>
      )}
    </QueryBoundary>
  );
}

/** How late the buyer is: their own ageing row, bucket by bucket, from the API. */
function CustomerAgeing({ customerId }: { customerId: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const ageing = useApiQuery('getAgeingReport', { query: { customerId } });
  const labels = useStateLabels({
    loading: t('ageing.loading'),
    emptyTitle: t('account.nothingOwed'),
    errorTitle: t('ageing.error'),
    deniedTitle: t('ageing.denied'),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('account.howLate')}</h2>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <QueryBoundary
          query={ageing}
          labels={labels}
          isEmpty={(report) => report.data.length === 0}
          loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
        >
          {(report) => (
            <div className="grid gap-2">
              {report.data.map((row) => (
                <AgeingBuckets key={row.customer.id} row={row} />
              ))}
              <p className="text-control-sm text-fg-muted">
                {t('ageing.asOf', { day: report.asOf })}
              </p>
            </div>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}

type Outcome = 'saved' | 'held' | 'released' | { approvalId: string; waiting: 'limit' | 'release' };

/** Change the terms, put the account on hold, or release it; each with its own permission. */
function AccountActions({ account: a }: { account: Account }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const [open, setOpen] = useState<'edit' | 'hold' | 'release' | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const after = { invalidates: ['getBusinessAccount', 'listBusinessAccounts'] } as const;
  const update = useApiMutation('updateBusinessAccount', after);
  const hold = useApiMutation('holdBusinessAccount', after);
  const release = useApiMutation('releaseBusinessAccount', after);
  const [draft, setDraft] = useState<TermsDraft>({
    creditLimitPesewas: a.creditLimitPesewas,
    paymentTermsDays: String(a.paymentTermsDays),
    overdueHoldDays: String(a.overdueHoldDays),
    reason: '',
  });
  const [checked, setChecked] = useState(false);
  const failure = useStateLabels({
    loading: t('account.saving'),
    emptyTitle: t('account.notSaved'),
    errorTitle: t('account.notSaved'),
    deniedTitle: t('actions.denied'),
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (termsWrong(draft)) return;
    const input = {
      path: { customerId: a.customer.id },
      body: {
        version: a.version,
        // Every limit change waits for an approver (2.14.0), so an unchanged limit is not sent.
        ...(draft.creditLimitPesewas === a.creditLimitPesewas
          ? {}
          : { creditLimitPesewas: draft.creditLimitPesewas ?? 0 }),
        paymentTermsDays: toDays(draft.paymentTermsDays) ?? 0,
        ...(draft.overdueHoldDays === ''
          ? {}
          : { overdueHoldDays: toDays(draft.overdueHoldDays) ?? 0 }),
        ...(draft.reason.trim() === '' ? {} : { reason: draft.reason.trim() }),
      },
    };
    update
      .mutateAsync(input, { idempotencyKey: keyFor(input) })
      .then((answer) => {
        setOpen(null);
        setOutcome(
          isApprovalPending(answer)
            ? { approvalId: answer.approvalRequestId, waiting: 'limit' }
            : 'saved',
        );
      })
      .catch(() => undefined);
  };
  return (
    <div className="grid gap-3">
      {outcome === null ? null : typeof outcome === 'string' ? (
        <Alert severity="good" title={t(`account.outcome.${outcome}`, { name: a.customer.name })} />
      ) : (
        <Alert
          severity="warning"
          title={t(
            outcome.waiting === 'limit'
              ? 'account.outcome.limitWaiting'
              : 'account.outcome.releaseWaiting',
          )}
        >
          <Link to={`/approvals/${outcome.approvalId}`} className="text-accent-text underline">
            {t('outcome.openApproval')}
          </Link>
        </Alert>
      )}
      {open === 'edit' ? (
        <Card>
          <CardBody>
            <form className="grid gap-4" onSubmit={save} noValidate aria-label={t('account.edit')}>
              <MutationFailure error={shownFailure(update.error)} labels={failure} />
              <TermsFields
                draft={draft}
                onChange={(next) => setDraft((now) => ({ ...now, ...next }))}
                checked={checked}
              />
              <p className="text-control-sm text-fg-muted">{t('account.limitApproval')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={update.isPending} loadingLabel={t('account.saving')}>
                  {t('account.save')}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(null)}>
                  {t('edit.discard')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {auth.can('whl.account.manage') && a.status !== 'CLOSED' ? (
            <Button variant="secondary" onClick={() => setOpen('edit')}>
              {t('account.edit')}
            </Button>
          ) : null}
          {auth.can('whl.account.hold') && a.status === 'ACTIVE' ? (
            <Button variant="danger" onClick={() => setOpen('hold')}>
              {t('account.hold')}
            </Button>
          ) : null}
          {/* An Owner or Manager releases a hold, never the Accountant who may put one on (2.14.0, CR-048). */}
          {auth.can('whl.account.release') && a.status === 'ON_HOLD' && !a.pendingRelease ? (
            <Button variant="secondary" onClick={() => setOpen('release')}>
              {t('account.release')}
            </Button>
          ) : null}
          {auth.can('quo.quote.create') ? (
            <Button asChild variant="secondary">
              <Link to="/quotes/new">{t('account.quote')}</Link>
            </Button>
          ) : null}
        </div>
      )}
      {open === 'hold' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('account.holdTitle', { name: a.customer.name })}
          body={t('account.holdBody')}
          submitLabel={t('account.hold')}
          destructive
          error={shownFailure(hold.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { customerId: a.customer.id }, body: { reason } };
            await hold.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome('held');
            setOpen(null);
          }}
        />
      ) : null}
      {open === 'release' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('account.releaseTitle', { name: a.customer.name })}
          body={t('account.releaseBody')}
          submitLabel={t('account.release')}
          error={shownFailure(release.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { customerId: a.customer.id }, body: { reason } };
            const answer: unknown = await release.mutateAsync(input, {
              idempotencyKey: keyFor(input),
            });
            // A release waits for an Owner or Manager other than the one who asked (2.14.0, CR-048).
            setOutcome(
              isApprovalPending(answer)
                ? { approvalId: answer.approvalRequestId, waiting: 'release' }
                : 'released',
            );
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** Every approved credit override for the buyer: which order, by how much, and who approved it. */
function Overrides({ customerId }: { customerId: string }) {
  const { t } = useTranslation(['wholesale', 'common']);
  const overrides = useApiQuery('listCreditOverrides', { query: { customerId } });
  const labels = useStateLabels({
    loading: t('overrides.loading'),
    emptyTitle: t('overrides.empty'),
    errorTitle: t('overrides.error'),
    deniedTitle: t('overrides.denied'),
  });
  return (
    <section aria-labelledby="overrides-title" className="grid gap-2">
      <h2 id="overrides-title" className="text-heading-sm font-semibold">
        {t('overrides.title')}
      </h2>
      <QueryBoundary
        query={overrides}
        labels={labels}
        isEmpty={(page) => page.data.length === 0}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-24" />}
      >
        {(page) => (
          <TableContainer aria-label={t('overrides.table')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.order')}</TableHead>
                  <TableHead numeric>{t('columns.limit')}</TableHead>
                  <TableHead numeric>{t('columns.exposure')}</TableHead>
                  <TableHead>{t('columns.approvedBy')}</TableHead>
                  <TableHead>{t('columns.reason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((o) => {
                  return (
                    <TableRow key={o.id}>
                      <TableRowHeader>
                        <Link to={`/orders/${o.order.id}`} className="text-accent-text underline">
                          {o.order.number ?? t('quote.unnumberedOrder')}
                        </Link>
                      </TableRowHeader>
                      <TableCell numeric label={t('columns.limit')}>
                        <MoneyDisplay pesewas={o.limitPesewas} />
                      </TableCell>
                      <TableCell numeric label={t('columns.exposure')}>
                        <MoneyDisplay pesewas={o.exposurePesewas} />
                      </TableCell>
                      <TableCell label={t('columns.approvedBy')}>
                        {t('overrides.approvedBy', {
                          who: o.approvedBy.displayName,
                          when: formatDateTime(o.recordedAt),
                        })}
                        <span className="block text-control-sm text-fg-muted">
                          {t('overrides.askedBy', { who: o.requestedBy.displayName })}
                        </span>
                      </TableCell>
                      <TableCell label={t('columns.reason')}>{o.reason}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </section>
  );
}
