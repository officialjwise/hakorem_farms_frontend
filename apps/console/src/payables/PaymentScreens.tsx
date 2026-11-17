import { Banknote } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  DatePicker,
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
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  useTableView,
} from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { shownFailure } from '../auth/StepUp';
import { BranchScopeNote } from '../branch/BranchScopeNote';
import { useApiMutation, useApiQuery } from '../data/api';
import { When } from '../iam/presentation';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param, useSupplierOptions } from '../stock/filters';
import { toInstant, today } from './instant';
import { PAYMENT_METHODS, PAYMENT_STATUSES, PaymentStatusBadge } from './presentation';

type S = components['schemas'];
type Payment = S['SupplierPayment'];
type Method = Payment['method'];

/** Supplier payments (FR-PUR-012), newest first, with where each stands. */
export function SupplierPaymentsScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const suppliers = useSupplierOptions();
  const [status, setStatus] = useState(ANY);
  const [supplierId, setSupplierId] = useState(ANY);
  const list = useApiQuery('listSupplierPayments', {
    query: {
      ...param('status', status),
      ...param('supplierId', supplierId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('payments.loading'),
    emptyTitle: t('payments.empty'),
    emptyDescription: t('payments.emptyBody'),
    errorTitle: t('payments.error'),
    deniedTitle: t('payments.denied'),
  });
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    pages.reset();
  };
  const view = useTableView<Payment>([
    {
      id: 'payment',
      rowHeader: true,
      head: t('columns.payment'),
      sortValue: (p) => p.paymentNo ?? '',
      cell: (p) => (
        <span className="flex items-center gap-3">
          <IconChip icon={Banknote} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/supplier-payments/${p.id}`} className="text-accent-text underline">
              {p.paymentNo ?? t('payment.unnumbered', { supplier: p.supplier.name })}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">{p.supplier.name}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (p) => p.status,
      cell: (p) => <PaymentStatusBadge status={p.status} />,
    },
    {
      id: 'method',
      head: t('columns.method'),
      sortValue: (p) => p.method,
      cell: (p) => t(`method.${p.method}`),
    },
    {
      id: 'scheduled',
      head: t('columns.scheduled'),
      sortValue: (p) => p.scheduledFor ?? '',
      cell: (p) => p.scheduledFor ?? NOT_APPLICABLE,
    },
    {
      id: 'amount',
      head: t('columns.amount'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (p) => p.amountPesewas,
      cell: (p) => <MoneyDisplay pesewas={p.amountPesewas} />,
    },
  ]);
  return (
    <section aria-labelledby="payments-title" className="grid gap-4">
      <PageHeader
        title={t('payments.title')}
        titleId="payments-title"
        description={<BranchScopeNote />}
        actions={
          auth.can('pur.supplier_payment.create') ? (
            <Button asChild>
              <Link to="/supplier-payments/new">{t('payments.new')}</Link>
            </Button>
          ) : undefined
        }
      />
      <TableCard
        view={view}
        query={list}
        labels={labels}
        rows={(page) => page.data}
        rowKey={(row) => row.id}
        tableLabel={t('payments.title')}
        exportName={t('payments.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('payments.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status, supplierId)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                setSupplierId(ANY);
                pages.reset();
              },
            }}
          >
            <FilterSelect
              label={t('filters.supplier')}
              anyLabel={t('filters.anySupplier')}
              value={supplierId}
              onChange={change(setSupplierId)}
              options={suppliers}
            />
            <FilterSelect
              label={t('filters.status')}
              anyLabel={t('filters.anyStatus')}
              value={status}
              onChange={change(setStatus)}
              options={PAYMENT_STATUSES.map((value) => ({
                value,
                label: t(`paymentStatus.${value}`),
              }))}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** What the person is paying on one approved invoice. */
interface Allocation {
  pay: boolean;
  amountPesewas: number | null;
}

/**
 * Preparing a payment to a supplier: which approved invoices it pays and how much on each, by what method
 * and when. The amount on each invoice starts at what the API says is still owed; the payment's total is
 * the server's sum of its allocations, shown on the payment's own page. It is a draft until it is sent for
 * approval, and a different person approves it.
 */
export function SupplierPaymentNewScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const suppliers = useSupplierOptions();
  const preselected = search.get('invoice');
  const [supplierId, setSupplierId] = useState(search.get('supplier') ?? '');
  const [method, setMethod] = useState<Method | ''>('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [chosen, setChosen] = useState<Record<string, Allocation>>({});
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const invoices = useApiQuery(
    'listSupplierInvoices',
    {
      query: { supplierId, kind: 'INVOICE', status: 'APPROVED', outstandingOnly: true, limit: 100 },
    },
    { enabled: supplierId !== '' },
  );
  const create = useApiMutation('createSupplierPayment', {
    invalidates: ['listSupplierPayments', 'listSupplierInvoices'],
  });
  const keyFor = useIntentKey();
  const guard = useLeaveGuard(!saved && Object.values(chosen).some((a) => a.pay));
  const required = t('common:field.required');
  const failure = useStateLabels({
    loading: t('prepare.saving'),
    emptyTitle: t('prepare.notSaved'),
    errorTitle: t('prepare.notSaved'),
    deniedTitle: t('prepare.denied'),
  });
  const states = useStateLabels({
    loading: t('prepare.invoicesLoading'),
    emptyTitle: t('prepare.noInvoices'),
    emptyDescription: t('prepare.noInvoicesBody'),
    errorTitle: t('prepare.invoicesError'),
    deniedTitle: t('prepare.invoicesDenied'),
  });
  const rows = invoices.data?.data ?? [];
  const allocationOf = (invoice: S['SupplierInvoice']): Allocation =>
    chosen[invoice.id] ?? {
      pay: invoice.id === preselected,
      amountPesewas: invoice.outstandingPesewas,
    };
  const paying = rows.filter((invoice) => allocationOf(invoice).pay);
  // Comparing two of the API's integers, not working anything out: the server judges it again.
  const amountWrong = (invoice: S['SupplierInvoice']) => {
    const amount = allocationOf(invoice).amountPesewas;
    return amount === null || amount <= 0 || amount > invoice.outstandingPesewas;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (supplierId === '' || method === '' || paying.length === 0) return;
    if (paying.some(amountWrong)) return;
    const body: S['SupplierPaymentCreate'] = {
      supplierId,
      method,
      ...(scheduledFor === '' ? {} : { scheduledFor }),
      allocations: paying.map((invoice) => ({
        supplierInvoiceId: invoice.id,
        amountPesewas: allocationOf(invoice).amountPesewas ?? 0,
      })),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => {
        setSaved(true);
        return navigate(`/supplier-payments/${made.id}`);
      })
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="payment-new-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/supplier-payments" className="text-accent-text underline">
          {t('back.payments')}
        </Link>
        <PageHeader title={t('prepare.title')} titleId="payment-new-title" />
        <p className="text-fg-muted">{t('prepare.hint')}</p>
      </div>
      <Card>
        <CardBody>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <MutationFailure error={create.error} labels={failure} />
            <Field
              label={t('fields.supplier')}
              required
              requiredLabel={required}
              error={checked && supplierId === '' ? required : undefined}
            >
              <Select
                value={supplierId}
                onValueChange={(value) => {
                  setSupplierId(value);
                  setChosen({});
                }}
                placeholder={t('fields.chooseSupplier')}
                options={suppliers}
              />
            </Field>
            <Field
              label={t('fields.method')}
              hint={t('fields.methodHint')}
              required
              requiredLabel={required}
              error={checked && method === '' ? required : undefined}
            >
              <Select
                value={method}
                onValueChange={(value) => setMethod(PAYMENT_METHODS.find((m) => m === value) ?? '')}
                placeholder={t('fields.chooseMethod')}
                options={PAYMENT_METHODS.map((value) => ({ value, label: t(`method.${value}`) }))}
              />
            </Field>
            <Field label={t('fields.scheduledFor')} hint={t('fields.scheduledForHint')}>
              <DatePicker
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </Field>
            {supplierId === '' ? null : (
              <QueryBoundary
                query={invoices}
                labels={states}
                isEmpty={(page) => page.data.length === 0}
                loadingFallback={<Skeleton label={states.loading} shape="block" className="h-40" />}
              >
                {() => (
                  <fieldset className="grid gap-3">
                    <legend className="text-lg font-semibold">{t('prepare.invoicesTitle')}</legend>
                    {checked && paying.length === 0 ? (
                      <Alert severity="critical" title={t('prepare.noneChosen')} />
                    ) : null}
                    {rows.map((invoice) => {
                      const allocation = allocationOf(invoice);
                      const set = (next: Partial<Allocation>) =>
                        setChosen((now) => ({ ...now, [invoice.id]: { ...allocation, ...next } }));
                      return (
                        <Card key={invoice.id}>
                          <CardBody className="grid gap-2">
                            <Field
                              label={t('prepare.pay', { number: invoice.supplierInvoiceNo })}
                              hint={t('prepare.payHint', { due: invoice.dueDate })}
                            >
                              <Checkbox
                                checked={allocation.pay}
                                onCheckedChange={(on) => set({ pay: on === true })}
                              />
                            </Field>
                            <p>
                              {t('prepare.owed')}{' '}
                              <MoneyDisplay pesewas={invoice.outstandingPesewas} strong />
                            </p>
                            {allocation.pay ? (
                              <Field
                                label={t('prepare.amount', { number: invoice.supplierInvoiceNo })}
                                required
                                requiredLabel={required}
                                error={
                                  checked && amountWrong(invoice)
                                    ? t('prepare.amountWrong')
                                    : undefined
                                }
                              >
                                <MoneyInput
                                  value={allocation.amountPesewas}
                                  onValueChange={(pesewas) => set({ amountPesewas: pesewas })}
                                />
                              </Field>
                            ) : null}
                          </CardBody>
                        </Card>
                      );
                    })}
                  </fieldset>
                )}
              </QueryBoundary>
            )}
            <div>
              <Button type="submit" loading={create.isPending} loadingLabel={t('prepare.saving')}>
                {t('prepare.save')}
              </Button>
            </div>
          </form>
          <LeaveGuardDialog guard={guard} />
        </CardBody>
      </Card>
    </article>
  );
}

/**
 * One supplier payment: what it pays on which invoices, who it pays and how, and the step it waits for.
 * The maker sends it for approval; a different person approves it in the approvals inbox, where the server
 * refuses the maker; then it is recorded as paid with the bank or mobile money reference.
 */
export function SupplierPaymentScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const { id = '' } = useParams();
  const payment = useApiQuery('getSupplierPayment', { path: { id } });
  const labels = useStateLabels({
    loading: t('payment.loading'),
    emptyTitle: t('payment.notFound'),
    errorTitle: t('payment.error'),
    deniedTitle: t('payments.denied'),
  });
  const back = (
    <Link to="/supplier-payments" className="text-accent-text underline">
      {t('back.payments')}
    </Link>
  );
  if (payment.error?.status === 404) {
    return (
      <EmptyState
        title={t('payment.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={payment}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(p) => (
        <article aria-labelledby="payment-title" className="grid gap-4">
          {back}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              title={p.paymentNo ?? t('payment.unnumbered', { supplier: p.supplier.name })}
              titleId="payment-title"
            />
            <PaymentStatusBadge status={p.status} />
          </div>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [
                      t('fields.supplier'),
                      <span key="s">
                        <Link
                          to={`/suppliers/${p.supplier.id}`}
                          className="text-accent-text underline"
                        >
                          {p.supplier.name}
                        </Link>{' '}
                        <ReadableId value={p.supplier.publicId} />
                      </span>,
                    ],
                    [t('fields.method'), t(`method.${p.method}`)],
                    [t('payment.payee'), p.payeeDetailsMasked ?? NOT_APPLICABLE],
                    [t('payment.fromAccount'), p.bankAccount?.name ?? NOT_APPLICABLE],
                    [t('fields.scheduledFor'), p.scheduledFor ?? NOT_APPLICABLE],
                    [
                      t('payment.paidAt'),
                      <When key="w" instant={p.paidAt} empty={t('payment.notPaid')} />,
                    ],
                    [t('payment.reference'), p.externalReference ?? NOT_APPLICABLE],
                    [t('payment.preparedBy'), p.createdBy.displayName],
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
          <TableContainer aria-label={t('payment.allocations')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.invoice')}</TableHead>
                  <TableHead numeric>{t('columns.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.allocations.map((a) => (
                  <TableRow key={a.supplierInvoiceId}>
                    <TableRowHeader>
                      <Link
                        to={`/supplier-invoices/${a.supplierInvoiceId}`}
                        className="text-accent-text underline"
                      >
                        {t('kindName.INVOICE', { number: a.supplierInvoiceNo })}
                      </Link>
                    </TableRowHeader>
                    <TableCell numeric label={t('columns.amount')}>
                      <MoneyDisplay pesewas={a.amountPesewas} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 grid-cols-[minmax(0,1fr)_max-content]">
                <dt className="font-semibold">{t('payment.amount')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={p.amountPesewas} strong />
                </dd>
              </dl>
            </CardBody>
          </Card>
          <PaymentActions payment={p} />
          {p.status === 'PAID' ? <Remittance paymentId={p.id} /> : null}
        </article>
      )}
    </QueryBoundary>
  );
}

type PaymentOutcome = 'submitted' | 'approved' | 'paid' | 'cancelled';

function PaymentActions({ payment: p }: { payment: Payment }) {
  const { t } = useTranslation(['payables', 'common']);
  const auth = useAuth();
  const keyFor = useIntentKey();
  const [open, setOpen] = useState<'submit' | 'paid' | 'cancel' | null>(null);
  const [outcome, setOutcome] = useState<{
    kind: PaymentOutcome;
    approvalId: string | null;
  } | null>(null);
  const [paidDay, setPaidDay] = useState(today());
  const [paidTime, setPaidTime] = useState('');
  const [reference, setReference] = useState('');
  const [checked, setChecked] = useState(false);
  const after = {
    invalidates: ['listSupplierPayments', 'getSupplierPayment', 'listSupplierInvoices'],
  } as const;
  const submit = useApiMutation('submitSupplierPayment', after);
  const markPaid = useApiMutation('markSupplierPaymentPaid', after);
  const cancel = useApiMutation('cancelSupplierPayment', after);
  const failure = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  const paidFailure = useStateLabels({
    loading: t('paymentActions.recording'),
    emptyTitle: t('paymentActions.notRecorded'),
    errorTitle: t('paymentActions.notRecorded'),
    deniedTitle: t('actions.denied'),
  });
  const required = t('common:field.required');
  const summary = (
    <ul className="grid list-disc gap-1 ps-5">
      <li>{t('summary.supplier', { supplier: p.supplier.name })}</li>
      <li>{t('summary.method', { method: t(`method.${p.method}`) })}</li>
      {p.allocations.map((a) => (
        <li key={a.supplierInvoiceId}>
          {t('kindName.INVOICE', { number: a.supplierInvoiceNo })}:{' '}
          <MoneyDisplay pesewas={a.amountPesewas} />
        </li>
      ))}
      <li>
        {t('payment.amount')}: <MoneyDisplay pesewas={p.amountPesewas} strong />
      </li>
    </ul>
  );
  const instant = toInstant(paidDay, paidTime);
  const mine = p.createdBy.id === auth.session?.principal.id;
  return (
    <div className="grid gap-3">
      {outcome === null ? null : (
        <Alert
          severity={outcome.approvalId === null ? 'good' : 'warning'}
          title={t(`paymentOutcome.${outcome.kind}`)}
        >
          {outcome.approvalId === null ? null : (
            <div className="grid gap-1">
              <p>{t('paymentOutcome.otherApprover')}</p>
              <Link to={`/approvals/${outcome.approvalId}`} className="text-accent-text underline">
                {t('outcome.openApproval')}
              </Link>
            </div>
          )}
        </Alert>
      )}
      {p.status === 'PENDING_APPROVAL' && outcome === null ? (
        <Alert severity="warning" title={t('paymentActions.waitingTitle')}>
          <div className="grid gap-1">
            <p>{mine ? t('paymentActions.waitingYours') : t('paymentActions.waitingBody')}</p>
            {p.approvalRequestId === null ? null : (
              <Link to={`/approvals/${p.approvalRequestId}`} className="text-accent-text underline">
                {t('outcome.openApproval')}
              </Link>
            )}
          </div>
        </Alert>
      ) : null}
      {p.status === 'REJECTED' ? (
        <Alert severity="critical" title={t('paymentActions.rejected')} />
      ) : null}
      {open === null ? (
        <>
          <MutationFailure error={shownFailure(submit.error)} labels={failure} />
          <MutationFailure error={shownFailure(markPaid.error)} labels={paidFailure} />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {p.status === 'DRAFT' && auth.can('pur.supplier_payment.create') ? (
          <Button
            onClick={() => {
              submit.reset();
              setOpen('submit');
            }}
          >
            {t('paymentActions.submit')}
          </Button>
        ) : null}
        {p.status === 'APPROVED' && auth.can('pur.supplier_payment.pay') ? (
          <Button
            onClick={() => {
              markPaid.reset();
              setChecked(false);
              setOpen('paid');
            }}
          >
            {t('paymentActions.markPaid')}
          </Button>
        ) : null}
        {(p.status === 'DRAFT' || p.status === 'APPROVED') &&
        auth.can('pur.supplier_payment.create') ? (
          <Button variant="secondary" onClick={() => setOpen('cancel')}>
            {t('paymentActions.cancel')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={open === 'submit'}
        onOpenChange={(next) => setOpen(next ? 'submit' : null)}
        title={t('paymentActions.submitTitle')}
        body={t('paymentActions.submitBody')}
        confirmLabel={t('paymentActions.submit')}
        pendingLabel={t('actions.working')}
        pending={submit.isPending}
        error={shownFailure(submit.error)}
        failedTitle={t('actions.failed')}
        onConfirm={() => {
          submit
            .mutateAsync(
              { path: { id: p.id } },
              { idempotencyKey: keyFor({ submit: p.id, version: p.version }) },
            )
            .then((answer) => {
              setOpen(null);
              setOutcome(
                isApprovalPending(answer)
                  ? { kind: 'submitted', approvalId: answer.approvalRequestId }
                  : { kind: 'approved', approvalId: null },
              );
            })
            .catch(() => undefined);
        }}
      >
        {summary}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'paid'}
        onOpenChange={(next) => setOpen(next ? 'paid' : null)}
        title={t('paymentActions.markPaidTitle')}
        body={t('paymentActions.markPaidBody')}
        confirmLabel={t('paymentActions.markPaid')}
        pendingLabel={t('paymentActions.recording')}
        pending={markPaid.isPending}
        error={shownFailure(markPaid.error)}
        failedTitle={t('paymentActions.notRecorded')}
        onConfirm={() => {
          setChecked(true);
          if (instant === null || reference.trim() === '') return;
          const input = {
            path: { id: p.id },
            body: { paidAt: instant, externalReference: reference.trim() },
          };
          markPaid
            .mutateAsync(input, { idempotencyKey: keyFor(input) })
            .then(() => {
              setOpen(null);
              setOutcome({ kind: 'paid', approvalId: null });
            })
            .catch(() => undefined);
        }}
      >
        <Field
          label={t('paymentActions.paidOn')}
          required
          requiredLabel={required}
          error={checked && paidDay === '' ? required : undefined}
        >
          <DatePicker value={paidDay} onChange={(event) => setPaidDay(event.target.value)} />
        </Field>
        <Field
          label={t('paymentActions.paidAt')}
          hint={t('paymentActions.paidAtHint')}
          required
          requiredLabel={required}
          error={checked && instant === null ? t('paymentActions.paidAtWrong') : undefined}
        >
          <Input
            inputMode="numeric"
            value={paidTime}
            onChange={(event) => setPaidTime(event.target.value)}
            maxLength={5}
          />
        </Field>
        <Field
          label={t('paymentActions.reference')}
          hint={t(`paymentActions.referenceHint.${p.method}`)}
          required
          requiredLabel={required}
          error={checked && reference.trim() === '' ? required : undefined}
        >
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
          />
        </Field>
        {summary}
      </ConfirmDialog>
      {open === 'cancel' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('paymentActions.cancelTitle')}
          body={t('paymentActions.cancelBody')}
          submitLabel={t('paymentActions.cancel')}
          destructive
          error={shownFailure(cancel.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: p.id }, body: { reason } };
            await cancel.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'cancelled', approvalId: null });
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** A paid payment's remittance advice, fixed by the server when it was marked paid (FR-PUR-013). */
function Remittance({ paymentId }: { paymentId: string }) {
  const { t } = useTranslation(['payables', 'common']);
  // Fixed once and never changed: `immutable`.
  const remittance = useApiQuery(
    'getSupplierPaymentRemittance',
    { path: { id: paymentId } },
    { staleClass: 'immutable' },
  );
  const labels = useStateLabels({
    loading: t('remittance.loading'),
    emptyTitle: t('remittance.none'),
    errorTitle: t('remittance.error'),
    deniedTitle: t('remittance.denied'),
  });
  return (
    <section aria-labelledby="remittance-title" className="grid gap-3">
      <h2 id="remittance-title" className="text-lg font-semibold">
        {t('remittance.title')}
      </h2>
      <QueryBoundary
        query={remittance}
        labels={labels}
        isEmpty={() => false}
        loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-32" />}
      >
        {(r) => (
          <TableContainer aria-label={t('remittance.lines')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.invoice')}</TableHead>
                  <TableHead numeric>{t('columns.gross')}</TableHead>
                  <TableHead numeric>{t('columns.credited')}</TableHead>
                  <TableHead numeric>{t('columns.thisPayment')}</TableHead>
                  <TableHead numeric>{t('columns.outstandingAfter')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.lines.map((line) => (
                  <TableRow key={line.supplierInvoiceId}>
                    <TableRowHeader>
                      {t('kindName.INVOICE', { number: line.supplierInvoiceNo })}
                    </TableRowHeader>
                    <TableCell numeric label={t('columns.gross')}>
                      <MoneyDisplay pesewas={line.grossPesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.credited')}>
                      <MoneyDisplay pesewas={line.creditedPesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.thisPayment')}>
                      <MoneyDisplay pesewas={line.amountPesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.outstandingAfter')}>
                      <MoneyDisplay pesewas={line.outstandingAfterPesewas} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </section>
  );
}
