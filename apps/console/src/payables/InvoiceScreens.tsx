import { FileText } from 'lucide-react';
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
  QuantityDisplay,
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
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { isApprovalPending } from '../lib/approval';
import { ConfirmDialog } from '../lib/ConfirmDialog';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { uniqueById, useIntentKey } from '../lib/queries';
import { ReadableId } from '../lib/ReadableId';
import { ReasonDialog } from '../lib/ReasonDialog';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import { useCursorPages } from '../lib/useCursorPages';
import { ANY, FilterSelect, countSet, param, useSupplierOptions } from '../stock/filters';
import { toQuantity, useUnits } from '../stock/units';
import { today } from './instant';
import {
  INVOICE_STATUSES,
  InvoiceStatusBadge,
  MatchStatusBadge,
  useInvoiceName,
  varianceAllowed,
} from './presentation';

type S = components['schemas'];
type Invoice = S['SupplierInvoice'];
type InvoiceLine = S['SupplierInvoiceLine'];

/** An order a supplier's invoice may be entered against: one that has been, or may be, received. */
const INVOICEABLE: ReadonlySet<S['PurchaseOrder']['status']> = new Set([
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
]);

/**
 * Supplier invoices and credit notes (FR-PUR-008), newest first: whose they are, how they matched, when they
 * are due and what is still owed. Every amount is the API's; the list only sorts them.
 */
export function SupplierInvoicesScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const suppliers = useSupplierOptions();
  const invoiceName = useInvoiceName();
  const [status, setStatus] = useState(ANY);
  const [kind, setKind] = useState(ANY);
  const [supplierId, setSupplierId] = useState(ANY);
  const [owing, setOwing] = useState(ANY);
  const list = useApiQuery('listSupplierInvoices', {
    query: {
      ...param('status', status),
      ...(kind === 'INVOICE' || kind === 'CREDIT_NOTE' ? { kind } : {}),
      ...param('supplierId', supplierId),
      ...(owing === 'OUTSTANDING' ? { outstandingOnly: true } : {}),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('invoices.loading'),
    emptyTitle: t('invoices.empty'),
    emptyDescription: t('invoices.emptyBody'),
    errorTitle: t('invoices.error'),
    deniedTitle: t('invoices.denied'),
  });
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    pages.reset();
  };
  const view = useTableView<Invoice>([
    {
      id: 'invoice',
      rowHeader: true,
      head: t('columns.invoice'),
      sortValue: (i) => i.supplierInvoiceNo,
      cell: (i) => (
        <span className="flex items-center gap-3">
          <IconChip icon={FileText} tone={i.kind === 'INVOICE' ? 'accent' : 'info'} size="sm" />
          <span className="grid min-w-0">
            <Link to={`/supplier-invoices/${i.id}`} className="text-accent-text underline">
              {invoiceName(i)}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">{i.supplier.name}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (i) => i.status,
      cell: (i) => <InvoiceStatusBadge status={i.status} />,
    },
    {
      id: 'match',
      head: t('columns.match'),
      sortValue: (i) => i.matchStatus,
      cell: (i) => <MatchStatusBadge status={i.matchStatus} />,
    },
    {
      id: 'due',
      head: t('columns.due'),
      // Dates sort as text.
      sortValue: (i) => i.dueDate,
      cell: (i) => i.dueDate,
    },
    {
      id: 'gross',
      head: t('columns.gross'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (i) => i.grossPesewas,
      cell: (i) => <MoneyDisplay pesewas={i.grossPesewas} />,
    },
    {
      id: 'outstanding',
      head: t('columns.outstanding'),
      numeric: true,
      sortValue: (i) => i.outstandingPesewas,
      cell: (i) => <MoneyDisplay pesewas={i.outstandingPesewas} />,
    },
  ]);
  return (
    <section aria-labelledby="invoices-title" className="grid gap-4">
      <PageHeader
        title={t('invoices.title')}
        titleId="invoices-title"
        description={<BranchScopeNote />}
        actions={
          auth.can('pur.supplier_invoice.create') ? (
            <Button asChild>
              <Link to="/supplier-invoices/new">{t('invoices.new')}</Link>
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
        tableLabel={t('invoices.title')}
        exportName={t('invoices.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('invoices.pages') }}
        toolbar={
          <FilterMenu
            label={t('common:table.filter')}
            active={countSet(status, kind, supplierId, owing)}
            reset={{
              label: t('common:table.resetFilters'),
              onReset: () => {
                setStatus(ANY);
                setKind(ANY);
                setSupplierId(ANY);
                setOwing(ANY);
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
              options={INVOICE_STATUSES.map((value) => ({
                value,
                label: t(`invoiceStatus.${value}`),
              }))}
            />
            <FilterSelect
              label={t('filters.kind')}
              anyLabel={t('filters.anyKind')}
              value={kind}
              onChange={change(setKind)}
              options={[
                { value: 'INVOICE', label: t('kind.INVOICE') },
                { value: 'CREDIT_NOTE', label: t('kind.CREDIT_NOTE') },
              ]}
            />
            <FilterSelect
              label={t('filters.owing')}
              anyLabel={t('filters.anyOwing')}
              value={owing}
              onChange={change(setOwing)}
              options={[{ value: 'OUTSTANDING', label: t('filters.outstandingOnly') }]}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/** One line of the supplier's paper, typed against a received order line. */
interface DraftInvoiceLine {
  include: boolean;
  qty: string;
  unitPricePesewas: number | null;
  taxCategoryId: string;
}

const blankLine = (): DraftInvoiceLine => ({
  include: true,
  qty: '',
  unitPricePesewas: null,
  taxCategoryId: '',
});

/**
 * Entering a supplier's invoice against its purchase order and the receipt the goods came in on. Each line
 * is a received order line: the person types what the supplier's paper says (the quantity in the unit the
 * order was bought by, the price per that unit, the tax category). The server prices, taxes and totals it,
 * and the three-way match on the invoice's own page compares it with the order and the receipt.
 */
export function SupplierInvoiceNewScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const units = useUnits();
  const suppliers = useSupplierOptions();
  const [supplierId, setSupplierId] = useState(search.get('supplier') ?? '');
  const [orderId, setOrderId] = useState(search.get('purchaseOrder') ?? '');
  const [receiptId, setReceiptId] = useState(search.get('goodsReceipt') ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [statedGross, setStatedGross] = useState<number | null>(null);
  const [lines, setLines] = useState<Record<string, DraftInvoiceLine>>({});
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const orders = useApiQuery(
    'listPurchaseOrders',
    { query: { supplierId, limit: 100 } },
    { enabled: supplierId !== '' },
  );
  const order = useApiQuery(
    'getPurchaseOrder',
    { path: { id: orderId } },
    { enabled: orderId !== '' },
  );
  const receipts = useApiQuery(
    'listGoodsReceipts',
    { query: { purchaseOrderId: orderId, status: 'POSTED', limit: 100 } },
    { enabled: orderId !== '' },
  );
  const receipt = useApiQuery(
    'getGoodsReceipt',
    { path: { id: receiptId } },
    { enabled: receiptId !== '' },
  );
  const categories = useApiAllPages(
    'listTaxCategories',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  const create = useApiMutation('createSupplierInvoice', {
    invalidates: ['listSupplierInvoices', 'getPurchaseOrder'],
  });
  const keyFor = useIntentKey();
  const guard = useLeaveGuard(!saved && (invoiceNo !== '' || Object.keys(lines).length > 0));
  const required = t('common:field.required');
  const failure = useStateLabels({
    loading: t('enter.saving'),
    emptyTitle: t('enter.notSaved'),
    errorTitle: t('enter.notSaved'),
    deniedTitle: t('enter.denied'),
  });
  const receiptStates = useStateLabels({
    loading: t('enter.receiptLoading'),
    emptyTitle: t('enter.receiptNone'),
    errorTitle: t('enter.receiptError'),
    deniedTitle: t('enter.receiptDenied'),
  });
  const orderOptions = (orders.data?.data ?? [])
    .filter((o) => INVOICEABLE.has(o.status))
    .map((o) => ({ value: o.id, label: o.orderNo ?? t('enter.unnumbered') }));
  const receiptOptions = (receipts.data?.data ?? []).map((r) => ({
    value: r.id,
    label: r.receiptNo ?? t('enter.unnumbered'),
  }));
  const categoryOptions = uniqueById(categories.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const orderLines = new Map((order.data?.lines ?? []).map((line) => [line.id, line]));
  const receiptLines = (receipt.data?.lines ?? []).filter(
    (line) => line.purchaseOrderLineId !== null && orderLines.has(line.purchaseOrderLineId),
  );
  const draftOf = (id: string) => lines[id] ?? blankLine();
  const change = (id: string, next: Partial<DraftInvoiceLine>) =>
    setLines((now) => ({ ...now, [id]: { ...draftOf(id), ...now[id], ...next } }));
  const lineWrong = (id: string) => {
    const line = draftOf(id);
    return (
      line.include &&
      (toQuantity(line.qty) === null || line.unitPricePesewas === null || line.taxCategoryId === '')
    );
  };
  const included = receiptLines.filter((line) => draftOf(line.id).include);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (supplierId === '' || orderId === '' || receiptId === '') return;
    if (invoiceNo.trim() === '' || invoiceDate === '') return;
    if (dueDate !== '' && dueDate < invoiceDate) return;
    if (included.length === 0 || receiptLines.some((line) => lineWrong(line.id))) return;
    const body: S['SupplierInvoiceCreate'] = {
      kind: 'INVOICE',
      supplierId,
      supplierInvoiceNo: invoiceNo.trim(),
      invoiceDate,
      ...(dueDate === '' ? {} : { dueDate }),
      purchaseOrderId: orderId,
      ...(statedGross === null ? {} : { statedGrossPesewas: statedGross }),
      lines: included.map((line) => {
        const typed = draftOf(line.id);
        return {
          productId: line.product.id,
          description: line.product.name,
          purchaseOrderLineId: line.purchaseOrderLineId ?? '',
          goodsReceiptLineId: line.id,
          qty: toQuantity(typed.qty) ?? '',
          unitPricePesewas: typed.unitPricePesewas ?? 0,
          taxCategoryId: typed.taxCategoryId,
        };
      }),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => {
        setSaved(true);
        return navigate(`/supplier-invoices/${made.id}`);
      })
      .catch(() => undefined);
  };
  const qty = (value: string, uom: string) => (
    <QuantityDisplay quantity={value} unit={units.name(uom)} places={units.places(uom)} />
  );
  return (
    <article aria-labelledby="invoice-new-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/supplier-invoices" className="text-accent-text underline">
          {t('back.invoices')}
        </Link>
        <PageHeader title={t('enter.title')} titleId="invoice-new-title" />
        <p className="text-fg-muted">{t('enter.hint')}</p>
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
                  setOrderId('');
                  setReceiptId('');
                  setLines({});
                }}
                placeholder={t('fields.chooseSupplier')}
                options={suppliers}
              />
            </Field>
            <Field
              label={t('fields.order')}
              hint={t('fields.orderHint')}
              required
              requiredLabel={required}
              error={checked && orderId === '' ? required : undefined}
            >
              <Select
                value={orderId}
                onValueChange={(value) => {
                  setOrderId(value);
                  setReceiptId('');
                  setLines({});
                }}
                placeholder={t('fields.chooseOrder')}
                options={
                  orderId !== '' && !orderOptions.some((o) => o.value === orderId)
                    ? [
                        ...orderOptions,
                        { value: orderId, label: order.data?.orderNo ?? t('enter.unnumbered') },
                      ]
                    : orderOptions
                }
                disabled={supplierId === ''}
              />
            </Field>
            <Field
              label={t('fields.receipt')}
              hint={t('fields.receiptHint')}
              required
              requiredLabel={required}
              error={checked && receiptId === '' ? required : undefined}
            >
              <Select
                value={receiptId}
                onValueChange={(value) => {
                  setReceiptId(value);
                  setLines({});
                }}
                placeholder={t('fields.chooseReceipt')}
                options={receiptOptions}
                disabled={orderId === ''}
              />
            </Field>
            <Field
              label={t('fields.invoiceNo')}
              hint={t('fields.invoiceNoHint')}
              required
              requiredLabel={required}
              error={checked && invoiceNo.trim() === '' ? required : undefined}
            >
              <Input
                value={invoiceNo}
                onChange={(event) => setInvoiceNo(event.target.value)}
                maxLength={60}
              />
            </Field>
            <Field
              label={t('fields.invoiceDate')}
              required
              requiredLabel={required}
              error={checked && invoiceDate === '' ? required : undefined}
            >
              <DatePicker
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </Field>
            <Field
              label={t('fields.dueDate')}
              hint={t('fields.dueDateHint')}
              error={
                checked && dueDate !== '' && dueDate < invoiceDate
                  ? t('fields.dueBefore')
                  : undefined
              }
            >
              <DatePicker value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label={t('fields.statedGross')} hint={t('fields.statedGrossHint')}>
              <MoneyInput value={statedGross} onValueChange={setStatedGross} />
            </Field>
            {receiptId === '' ? null : (
              <QueryBoundary
                query={receipt}
                labels={receiptStates}
                isEmpty={() => receiptLines.length === 0}
                loadingFallback={
                  <Skeleton label={receiptStates.loading} shape="block" className="h-48" />
                }
              >
                {() => (
                  <fieldset className="grid gap-4">
                    <legend className="text-lg font-semibold">{t('enter.linesTitle')}</legend>
                    <p className="text-fg-muted">{t('enter.linesHint')}</p>
                    {checked && included.length === 0 ? (
                      <Alert severity="critical" title={t('enter.noLines')} />
                    ) : null}
                    {receiptLines.map((line, index) => {
                      const ordered = orderLines.get(line.purchaseOrderLineId ?? '');
                      if (ordered === undefined) return null;
                      const typed = draftOf(line.id);
                      const n = index + 1;
                      const unit = units.name(ordered.uom);
                      return (
                        <Card key={line.id}>
                          <CardBody className="grid gap-3">
                            <h3 className="font-semibold">
                              {t('enter.lineTitle', { n, product: line.product.name })}
                            </h3>
                            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
                              <dt className="text-fg-muted">{t('enter.ordered')}</dt>
                              <dd>
                                {qty(ordered.qtyOrdered, ordered.uom)}, {t('enter.per', { unit })}{' '}
                                <MoneyDisplay pesewas={ordered.unitPricePesewas} />
                              </dd>
                              <dt className="text-fg-muted">{t('enter.received')}</dt>
                              <dd>
                                {qty(line.qtyReceived, line.uom)}
                                {line.uom === line.baseUom ? null : (
                                  <> ({qty(line.qtyReceivedBase, line.baseUom)})</>
                                )}
                              </dd>
                              {line.qtyRejected === '0.000' ? null : (
                                <>
                                  <dt className="text-fg-muted">{t('enter.rejected')}</dt>
                                  <dd>
                                    {qty(line.qtyRejected, line.uom)}
                                    {line.uom === line.baseUom ? null : (
                                      <> ({qty(line.qtyRejectedBase, line.baseUom)})</>
                                    )}
                                  </dd>
                                </>
                              )}
                            </dl>
                            <Field label={t('enter.include', { n })}>
                              <Checkbox
                                checked={typed.include}
                                onCheckedChange={(on) => change(line.id, { include: on === true })}
                              />
                            </Field>
                            {typed.include ? (
                              <>
                                <Field
                                  label={t('enter.qty', { unit, n })}
                                  required
                                  requiredLabel={required}
                                  error={
                                    checked && toQuantity(typed.qty) === null
                                      ? t('enter.qtyWrong')
                                      : undefined
                                  }
                                >
                                  <Input
                                    inputMode="decimal"
                                    value={typed.qty}
                                    onChange={(event) =>
                                      change(line.id, { qty: event.target.value })
                                    }
                                  />
                                </Field>
                                <Field
                                  label={t('enter.price', { unit, n })}
                                  required
                                  requiredLabel={required}
                                  error={
                                    checked && typed.unitPricePesewas === null
                                      ? required
                                      : undefined
                                  }
                                >
                                  <MoneyInput
                                    value={typed.unitPricePesewas}
                                    onValueChange={(pesewas) =>
                                      change(line.id, { unitPricePesewas: pesewas })
                                    }
                                  />
                                </Field>
                                <Field
                                  label={t('enter.taxCategory', { n })}
                                  required
                                  requiredLabel={required}
                                  error={
                                    checked && typed.taxCategoryId === '' ? required : undefined
                                  }
                                >
                                  <Select
                                    value={typed.taxCategoryId}
                                    onValueChange={(value) =>
                                      change(line.id, { taxCategoryId: value })
                                    }
                                    placeholder={t('enter.chooseTaxCategory')}
                                    options={categoryOptions}
                                  />
                                </Field>
                              </>
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
              <Button type="submit" loading={create.isPending} loadingLabel={t('enter.saving')}>
                {t('enter.save')}
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
 * One line's disagreement, in words, from the API's match: which rules it broke, how far its quantity is
 * from what was received, and how far its price is from the order's. Nothing here is worked out.
 */
function LineDisagreement({ line }: { line: InvoiceLine }) {
  const { t } = useTranslation('payables');
  const units = useUnits();
  const unit = line.uom === null ? '' : units.name(line.uom);
  const places = line.uom === null ? 3 : units.places(line.uom);
  const variance = line.qtyVariance;
  const over = variance !== null && !variance.startsWith('-') && variance !== '0.000';
  const under = variance !== null && variance.startsWith('-');
  return (
    <ul className="grid list-disc gap-1 ps-5">
      {line.matchReasons.map((reason) => (
        <li key={reason}>{t(`reasons.${reason}`, { defaultValue: reason })}</li>
      ))}
      {over || under ? (
        <li>
          <QuantityDisplay
            quantity={under ? variance.slice(1) : variance}
            unit={unit}
            places={places}
          />{' '}
          {t(over ? 'match.qtyOver' : 'match.qtyUnder')}
        </li>
      ) : null}
      {line.priceVariancePesewas === null || line.priceVariancePesewas === 0 ? null : (
        <li>
          <MoneyDisplay pesewas={line.priceVariancePesewas} />{' '}
          {t(line.priceVarianceDirection === 'UNDER' ? 'match.priceUnder' : 'match.priceOver')}
        </li>
      )}
    </ul>
  );
}

/** The three-way match result, from the API: what matched, and which lines disagree and by how much. */
function MatchResult({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation('payables');
  if (invoice.kind === 'CREDIT_NOTE') return null;
  const failing = invoice.lines.filter((line) => line.matchStatus === 'MISMATCH');
  switch (invoice.matchStatus) {
    case 'UNMATCHED':
      return (
        <Alert severity="info" title={t('match.unmatched')}>
          {t('match.unmatchedBody', { order: invoice.purchaseOrder?.number ?? '' })}
        </Alert>
      );
    case 'MATCHED':
      return <Alert severity="good" title={t('match.matched')} />;
    case 'NOT_REQUIRED':
      return <Alert severity="info" title={t('match.notRequired')} />;
    case 'VARIANCE_APPROVED':
      return (
        <Alert severity="warning" title={t('match.varianceApproved')}>
          {invoice.varianceReason ?? ''}
        </Alert>
      );
    case 'MISMATCH':
      return (
        <Alert severity="critical" title={t('match.mismatch', { count: failing.length })}>
          <div className="grid gap-3">
            <p>{t('match.mismatchBody')}</p>
            {failing.map((line) => (
              <section key={line.id} aria-label={t('match.lineLabel', { n: line.lineNo })}>
                <h3 className="font-semibold">
                  {t('match.lineTitle', { n: line.lineNo, product: line.description })}
                </h3>
                <LineDisagreement line={line} />
              </section>
            ))}
          </div>
        </Alert>
      );
  }
}

/**
 * One supplier invoice or credit note: the lines the supplier charged, the three-way match against its order
 * and receipt, the API's totals with what is paid, credited and still owed, and the step it waits for.
 */
export function SupplierInvoiceScreen() {
  const { t } = useTranslation(['payables', 'common']);
  const { id = '' } = useParams();
  const units = useUnits();
  const invoiceName = useInvoiceName();
  const invoice = useApiQuery('getSupplierInvoice', { path: { id } });
  const labels = useStateLabels({
    loading: t('invoice.loading'),
    emptyTitle: t('invoice.notFound'),
    errorTitle: t('invoice.error'),
    deniedTitle: t('invoices.denied'),
  });
  const back = (
    <Link to="/supplier-invoices" className="text-accent-text underline">
      {t('back.invoices')}
    </Link>
  );
  if (invoice.error?.status === 404) {
    return (
      <EmptyState
        title={t('invoice.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  return (
    <QueryBoundary
      query={invoice}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(i) => (
        <article aria-labelledby="invoice-title" className="grid gap-4">
          {back}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader title={invoiceName(i)} titleId="invoice-title" />
            <InvoiceStatusBadge status={i.status} />
            {/* The match beside the state, unless the state already says it (matched, does not match). */}
            {i.kind === 'INVOICE' && i.status !== 'MATCHED' && i.status !== 'MISMATCH' ? (
              <MatchStatusBadge status={i.matchStatus} />
            ) : null}
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
                          to={`/suppliers/${i.supplier.id}`}
                          className="text-accent-text underline"
                        >
                          {i.supplier.name}
                        </Link>{' '}
                        <ReadableId value={i.supplier.publicId} />
                      </span>,
                    ],
                    [
                      t('fields.order'),
                      i.purchaseOrder === null ? (
                        NOT_APPLICABLE
                      ) : (
                        <Link
                          key="o"
                          to={`/purchase-orders/${i.purchaseOrder.id}`}
                          className="text-accent-text underline"
                        >
                          {i.purchaseOrder.number ?? t('enter.unnumbered')}
                        </Link>
                      ),
                    ],
                    [t('fields.invoiceDate'), i.invoiceDate],
                    [t('fields.dueDate'), i.dueDate],
                    ...(i.originalInvoiceId === null
                      ? []
                      : ([
                          [
                            t('invoice.reduces'),
                            <Link
                              key="r"
                              to={`/supplier-invoices/${i.originalInvoiceId}`}
                              className="text-accent-text underline"
                            >
                              {t('invoice.originalInvoice')}
                            </Link>,
                          ],
                        ] satisfies [string, ReactNode][])),
                    ...(i.supplierClaimId === null
                      ? []
                      : ([
                          [
                            t('invoice.fromClaim'),
                            <Link
                              key="c"
                              to={`/supplier-claims/${i.supplierClaimId}`}
                              className="text-accent-text underline"
                            >
                              {t('invoice.openClaim')}
                            </Link>,
                          ],
                        ] satisfies [string, ReactNode][])),
                    [t('invoice.enteredBy'), i.createdBy.displayName],
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
          <MatchResult invoice={i} />
          <TableContainer aria-label={t('invoice.lines')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.product')}</TableHead>
                  <TableHead numeric>{t('columns.qty')}</TableHead>
                  <TableHead numeric>{t('columns.unitPrice')}</TableHead>
                  <TableHead numeric>{t('columns.lineNet')}</TableHead>
                  {i.kind === 'INVOICE' ? <TableHead>{t('columns.match')}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {i.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableRowHeader>{line.description}</TableRowHeader>
                    <TableCell numeric label={t('columns.qty')}>
                      <QuantityDisplay
                        quantity={line.qty}
                        unit={line.uom === null ? '' : units.name(line.uom)}
                        places={line.uom === null ? 3 : units.places(line.uom)}
                      />
                    </TableCell>
                    <TableCell numeric label={t('columns.unitPrice')}>
                      {line.supplierClaimLineId !== null ? (
                        t('invoice.claimValue')
                      ) : (
                        <>
                          {line.uom === null
                            ? null
                            : `${t('enter.per', { unit: units.name(line.uom) })} `}
                          <MoneyDisplay pesewas={line.unitPricePesewas} />
                        </>
                      )}
                    </TableCell>
                    <TableCell numeric label={t('columns.lineNet')}>
                      <MoneyDisplay pesewas={line.lineNetPesewas} />
                    </TableCell>
                    {i.kind === 'INVOICE' ? (
                      <TableCell label={t('columns.match')}>
                        <MatchStatusBadge status={line.matchStatus} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 grid-cols-[minmax(0,1fr)_max-content]">
                <dt>{t('totals.net')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={i.netPesewas} />
                </dd>
                <dt>{t('totals.tax')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={i.taxPesewas} />
                </dd>
                <dt className="font-semibold">{t('totals.gross')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={i.grossPesewas} strong />
                </dd>
                {i.kind === 'INVOICE' ? (
                  <>
                    <dt>{t('totals.credited')}</dt>
                    <dd className="text-end">
                      <MoneyDisplay pesewas={i.creditedPesewas} />
                    </dd>
                    <dt>{t('totals.paid')}</dt>
                    <dd className="text-end">
                      <MoneyDisplay pesewas={i.paidPesewas} />
                    </dd>
                    <dt className="font-semibold">{t('totals.outstanding')}</dt>
                    <dd className="text-end">
                      <MoneyDisplay pesewas={i.outstandingPesewas} strong />
                    </dd>
                  </>
                ) : null}
              </dl>
            </CardBody>
          </Card>
          <InvoiceActions invoice={i} />
        </article>
      )}
    </QueryBoundary>
  );
}

type Outcome = 'approved' | 'variance' | 'submitted' | 'cancelled';

function InvoiceActions({ invoice: i }: { invoice: Invoice }) {
  const { t } = useTranslation(['payables', 'common']);
  const auth = useAuth();
  const invoiceName = useInvoiceName();
  const keyFor = useIntentKey();
  const [open, setOpen] = useState<'approve' | 'variance' | 'submit' | 'cancel' | null>(null);
  const [outcome, setOutcome] = useState<{ kind: Outcome; approvalId: string | null } | null>(null);
  const after = { invalidates: ['listSupplierInvoices', 'getSupplierInvoice'] } as const;
  const match = useApiMutation('matchSupplierInvoice', after);
  const approve = useApiMutation('approveSupplierInvoice', after);
  const variance = useApiMutation('requestSupplierInvoiceVariance', after);
  const submit = useApiMutation('submitSupplierCreditNote', after);
  const cancel = useApiMutation('cancelSupplierInvoice', after);
  const failure = useStateLabels({
    loading: t('actions.working'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  const approveFailure = useStateLabels({
    loading: t('actions.approving'),
    emptyTitle: t('actions.notApproved'),
    errorTitle: t('actions.notApproved'),
    deniedTitle: t('actions.denied'),
  });
  const waiting = i.approvalRequestId !== null && (i.status === 'DRAFT' || i.status === 'MISMATCH');
  const summary = (
    <ul className="grid list-disc gap-1 ps-5">
      <li>{t('summary.supplier', { supplier: i.supplier.name })}</li>
      <li>
        {t('totals.gross')}: <MoneyDisplay pesewas={i.grossPesewas} strong />
      </li>
      {i.kind === 'INVOICE' ? (
        <li>
          {t('totals.outstanding')}: <MoneyDisplay pesewas={i.outstandingPesewas} />
        </li>
      ) : null}
    </ul>
  );
  const pending = (answer: unknown) =>
    isApprovalPending(answer) ? answer.approvalRequestId : null;
  const done =
    outcome === null ? null : (
      <Alert
        severity={outcome.approvalId === null ? 'good' : 'warning'}
        title={t(`outcome.${outcome.kind}`, { name: invoiceName(i) })}
      >
        {outcome.approvalId === null ? null : (
          <Link to={`/approvals/${outcome.approvalId}`} className="text-accent-text underline">
            {t('outcome.openApproval')}
          </Link>
        )}
      </Alert>
    );
  const canMatch =
    i.kind === 'INVOICE' &&
    (i.status === 'DRAFT' || i.status === 'MISMATCH') &&
    !waiting &&
    auth.can('pur.supplier_invoice.match');
  const canApprove =
    i.kind === 'INVOICE' && i.status === 'MATCHED' && auth.can('pur.supplier_invoice.approve');
  const canVariance =
    i.kind === 'INVOICE' &&
    i.status === 'MISMATCH' &&
    !waiting &&
    varianceAllowed(i) &&
    auth.can('pur.supplier_invoice.approve');
  const canSubmit =
    i.kind === 'CREDIT_NOTE' &&
    i.status === 'DRAFT' &&
    !waiting &&
    auth.can('pur.supplier_invoice.create');
  const canPay =
    i.kind === 'INVOICE' &&
    i.status === 'APPROVED' &&
    i.outstandingPesewas > 0 &&
    auth.can('pur.supplier_payment.create');
  const canCancel =
    !waiting &&
    i.paidPesewas === 0 &&
    (i.kind === 'CREDIT_NOTE'
      ? i.status === 'DRAFT'
      : i.status !== 'PAID' && i.status !== 'CANCELLED') &&
    auth.can('pur.supplier_invoice.create');
  return (
    <div className="grid gap-3">
      {done}
      {waiting && outcome === null ? (
        <Alert severity="warning" title={t('actions.waitingTitle')}>
          <Link
            to={`/approvals/${i.approvalRequestId ?? ''}`}
            className="text-accent-text underline"
          >
            {t('outcome.openApproval')}
          </Link>
        </Alert>
      ) : null}
      {/* A failed write stays on the page until the next attempt, not only in its dialog. */}
      {open === null ? (
        <>
          <MutationFailure error={match.error} labels={failure} />
          <MutationFailure error={shownFailure(approve.error)} labels={approveFailure} />
          <MutationFailure error={shownFailure(variance.error)} labels={failure} />
          <MutationFailure error={shownFailure(submit.error)} labels={failure} />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canMatch ? (
          <Button
            loading={match.isPending}
            loadingLabel={t('actions.matching')}
            onClick={() => {
              setOutcome(null);
              match
                .mutateAsync(
                  { path: { id: i.id } },
                  { idempotencyKey: keyFor({ match: i.id, version: i.version }) },
                )
                .catch(() => undefined);
            }}
          >
            {t('actions.match')}
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            onClick={() => {
              approve.reset();
              setOpen('approve');
            }}
          >
            {t('actions.approve')}
          </Button>
        ) : null}
        {canVariance ? (
          <Button
            variant="secondary"
            onClick={() => {
              variance.reset();
              setOpen('variance');
            }}
          >
            {t('actions.variance')}
          </Button>
        ) : null}
        {canSubmit ? (
          <Button
            onClick={() => {
              submit.reset();
              setOpen('submit');
            }}
          >
            {t('actions.submitCredit')}
          </Button>
        ) : null}
        {canPay ? (
          <Button asChild>
            <Link to={`/supplier-payments/new?supplier=${i.supplier.id}&invoice=${i.id}`}>
              {t('actions.pay')}
            </Link>
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="secondary" onClick={() => setOpen('cancel')}>
            {t('actions.cancel')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={open === 'approve'}
        onOpenChange={(next) => setOpen(next ? 'approve' : null)}
        title={t('actions.approveTitle', { name: invoiceName(i) })}
        body={t('actions.approveBody')}
        confirmLabel={t('actions.approve')}
        pendingLabel={t('actions.approving')}
        pending={approve.isPending}
        error={shownFailure(approve.error)}
        failedTitle={t('actions.notApproved')}
        onConfirm={() => {
          approve
            .mutateAsync(
              { path: { id: i.id } },
              { idempotencyKey: keyFor({ approve: i.id, version: i.version }) },
            )
            .then(() => {
              setOpen(null);
              setOutcome({ kind: 'approved', approvalId: null });
            })
            .catch(() => undefined);
        }}
      >
        {summary}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'submit'}
        onOpenChange={(next) => setOpen(next ? 'submit' : null)}
        title={t('actions.submitCreditTitle', { name: invoiceName(i) })}
        body={t('actions.submitCreditBody')}
        confirmLabel={t('actions.submitCredit')}
        pendingLabel={t('actions.working')}
        pending={submit.isPending}
        error={shownFailure(submit.error)}
        failedTitle={t('actions.failed')}
        onConfirm={() => {
          submit
            .mutateAsync(
              { path: { id: i.id } },
              { idempotencyKey: keyFor({ submit: i.id, version: i.version }) },
            )
            .then((answer) => {
              setOpen(null);
              setOutcome({ kind: 'submitted', approvalId: pending(answer) });
            })
            .catch(() => undefined);
        }}
      >
        {summary}
      </ConfirmDialog>
      {open === 'variance' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('actions.varianceTitle')}
          body={t('actions.varianceBody')}
          submitLabel={t('actions.variance')}
          error={shownFailure(variance.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: i.id }, body: { reason } };
            const answer = await variance.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'variance', approvalId: pending(answer) });
            setOpen(null);
          }}
        />
      ) : null}
      {open === 'cancel' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t('actions.cancelTitle', { name: invoiceName(i) })}
          body={t('actions.cancelBody')}
          submitLabel={t('actions.cancel')}
          destructive
          error={shownFailure(cancel.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: i.id }, body: { reason } };
            await cancel.mutateAsync(input, { idempotencyKey: keyFor(input) });
            setOutcome({ kind: 'cancelled', approvalId: null });
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}
