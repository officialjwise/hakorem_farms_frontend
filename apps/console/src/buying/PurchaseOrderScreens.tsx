import { ClipboardList } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DatePicker,
  EmptyState,
  Field,
  FilterMenu,
  IconChip,
  MoneyDisplay,
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
import { emptyLine, lineProblems, LinesEditor, type DraftLine } from '../stock/LinesEditor';
import { useLocations } from '../stock/locations';
import { toQuantity, useUnits } from '../stock/units';
import { PURCHASE_ORDER_STATUSES, PurchaseOrderStatusBadge } from './presentation';

type S = components['schemas'];
type Order = S['PurchaseOrder'];

/** Today in Accra, which is UTC all year (ADR 0027), as the contract's `date`. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Purchase orders (FR-PUR-005, the egg session): what was ordered from which supplier, in the unit it was
 * bought by (a crate of eggs), and where it stands. Totals and tax are the API's; the list only sorts them.
 */
export function PurchaseOrdersScreen() {
  const { t } = useTranslation(['buying', 'common']);
  const auth = useAuth();
  const pages = useCursorPages();
  const suppliers = useSupplierOptions();
  const [status, setStatus] = useState(ANY);
  const [supplierId, setSupplierId] = useState(ANY);
  const list = useApiQuery('listPurchaseOrders', {
    query: {
      ...param('status', status),
      ...param('supplierId', supplierId),
      ...(pages.cursor === undefined ? {} : { cursor: pages.cursor }),
    },
  });
  const labels = useStateLabels({
    loading: t('list.loading'),
    emptyTitle: t('list.empty'),
    emptyDescription: t('list.emptyBody'),
    errorTitle: t('list.error'),
    deniedTitle: t('list.denied'),
  });
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    pages.reset();
  };
  const view = useTableView<Order>([
    {
      id: 'order',
      rowHeader: true,
      head: t('columns.order'),
      sortValue: (o) => o.orderNo,
      cell: (o) => (
        <span className="flex items-center gap-3">
          <IconChip icon={ClipboardList} tone="accent" size="sm" />
          <span className="grid min-w-0">
            <Link to={`/purchase-orders/${o.id}`} className="text-accent-text underline">
              {o.orderNo ?? t('unnumbered', { supplier: o.supplier.name })}
            </Link>
            <span className="text-control-sm font-normal text-fg-muted">
              {o.deliverToLocation.name}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      head: t('columns.status'),
      sortValue: (o) => o.status,
      cell: (o) => <PurchaseOrderStatusBadge status={o.status} />,
    },
    {
      id: 'supplier',
      head: t('columns.supplier'),
      sortValue: (o) => o.supplier.name,
      cell: (o) => o.supplier.name,
    },
    {
      id: 'ordered',
      head: t('columns.ordered'),
      // Dates sort as text.
      sortValue: (o) => o.orderDate,
      cell: (o) => o.orderDate,
    },
    {
      id: 'expected',
      head: t('columns.expected'),
      sortValue: (o) => o.expectedOn ?? '',
      cell: (o) => o.expectedOn ?? NOT_APPLICABLE,
    },
    {
      id: 'total',
      head: t('columns.total'),
      numeric: true,
      // The API's integer pesewas, compared, never added.
      sortValue: (o) => o.grossPesewas,
      cell: (o) => <MoneyDisplay pesewas={o.grossPesewas} />,
    },
  ]);
  return (
    <section aria-labelledby="orders-title" className="grid gap-4">
      <PageHeader
        title={t('list.title')}
        titleId="orders-title"
        description={<BranchScopeNote />}
        actions={
          auth.can('pur.purchase_order.create') ? (
            <Button asChild>
              <Link to="/purchase-orders/new">{t('list.new')}</Link>
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
        tableLabel={t('list.title')}
        exportName={t('list.title')}
        pages={{ state: pages, info: (page) => page.page, label: t('list.pages') }}
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
              label={t('filters.status')}
              anyLabel={t('filters.anyStatus')}
              value={status}
              onChange={change(setStatus)}
              options={PURCHASE_ORDER_STATUSES.map((value) => ({
                value,
                label: t(`status.${value}`),
              }))}
            />
            <FilterSelect
              label={t('filters.supplier')}
              anyLabel={t('filters.anySupplier')}
              value={supplierId}
              onChange={change(setSupplierId)}
              options={suppliers}
            />
          </FilterMenu>
        }
      />
    </section>
  );
}

/**
 * Drafting an order: the supplier, where it is delivered, and the lines in the unit they are bought by. A
 * price left empty takes the last price paid to that supplier for the product in that unit (2.3.0); the
 * server prices, taxes and totals every line, and the draft's own screen shows them before it is submitted.
 */
export function PurchaseOrderNewScreen() {
  const { t } = useTranslation(['buying', 'stock', 'common']);
  const navigate = useNavigate();
  const suppliers = useSupplierOptions();
  const locations = useLocations();
  const [supplierId, setSupplierId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [expectedOn, setExpectedOn] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [problems, setProblems] = useState<Record<string, string[]>>({});
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const create = useApiMutation('createPurchaseOrder', { invalidates: ['listPurchaseOrders'] });
  const keyFor = useIntentKey();
  const dirty = !saved && (supplierId !== '' || lines.some((l) => l.product !== null));
  const guard = useLeaveGuard(dirty);
  const required = t('common:field.required');
  const states = useStateLabels({
    loading: t('stock:move.loading'),
    emptyTitle: t('stock:move.noLocations'),
    emptyDescription: t('stock:move.noLocationsBody'),
    errorTitle: t('stock:move.locationsError'),
    deniedTitle: t('stock:move.locationsDenied'),
  });
  const failure = useStateLabels({
    loading: t('new.saving'),
    emptyTitle: t('new.notSaved'),
    errorTitle: t('new.notSaved'),
    deniedTitle: t('new.denied'),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    const found = lineProblems(lines, 'order');
    setProblems(found);
    if (supplierId === '' || locationId === '' || orderDate === '') return;
    if (expectedOn !== '' && expectedOn < orderDate) return;
    if (Object.keys(found).length > 0) return;
    const body = {
      supplierId,
      deliverToLocationId: locationId,
      orderDate,
      ...(expectedOn === '' ? {} : { expectedOn }),
      lines: lines.map((line) => ({
        productId: line.product?.id ?? '',
        ...(line.uom === null ? {} : { uom: line.uom }),
        qtyOrdered: toQuantity(line.qty) ?? '',
        // Left out, the server takes the last price paid; it never guesses one here.
        ...(line.unitPricePesewas === null ? {} : { unitPricePesewas: line.unitPricePesewas }),
      })),
    };
    create
      .mutateAsync({ body }, { idempotencyKey: keyFor(body) })
      .then((made) => {
        setSaved(true);
        return navigate(`/purchase-orders/${made.id}`);
      })
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="order-new-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to="/purchase-orders" className="text-accent-text underline">
          {t('back')}
        </Link>
        <PageHeader title={t('new.title')} titleId="order-new-title" />
        <p className="text-fg-muted">{t('new.hint')}</p>
      </div>
      <QueryBoundary
        query={locations.query}
        labels={states}
        isEmpty={(all) => all.items.length === 0}
        loadingFallback={<Skeleton label={states.loading} shape="block" className="h-96" />}
      >
        {() => (
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
                    onValueChange={setSupplierId}
                    placeholder={t('fields.chooseSupplier')}
                    options={suppliers}
                  />
                </Field>
                <Field
                  label={t('fields.deliverTo')}
                  required
                  requiredLabel={required}
                  error={checked && locationId === '' ? required : undefined}
                >
                  <Select
                    value={locationId}
                    onValueChange={setLocationId}
                    placeholder={t('stock:takes.chooseLocation')}
                    options={locations.options}
                  />
                </Field>
                <Field
                  label={t('fields.orderDate')}
                  required
                  requiredLabel={required}
                  error={checked && orderDate === '' ? required : undefined}
                >
                  <DatePicker
                    value={orderDate}
                    onChange={(event) => setOrderDate(event.target.value)}
                  />
                </Field>
                <Field
                  label={t('fields.expectedOn')}
                  hint={t('fields.expectedOnHint')}
                  error={
                    checked && expectedOn !== '' && expectedOn < orderDate
                      ? t('fields.expectedBefore')
                      : undefined
                  }
                >
                  <DatePicker
                    value={expectedOn}
                    onChange={(event) => setExpectedOn(event.target.value)}
                  />
                </Field>
                <LinesEditor kind="order" lines={lines} onChange={setLines} problems={problems} />
                <div>
                  <Button type="submit" loading={create.isPending} loadingLabel={t('new.saving')}>
                    {t('new.save')}
                  </Button>
                </div>
              </form>
              <LeaveGuardDialog guard={guard} />
            </CardBody>
          </Card>
        )}
      </QueryBoundary>
    </article>
  );
}

/** What a draft becomes in one step, kept on screen in words. */
type Outcome = 'submitted' | 'awaiting' | 'sent' | 'cancelled' | 'closed';

/**
 * One purchase order: what was ordered in the unit it was bought by, what was received and is outstanding
 * in the base unit (eggs), the API's totals, and the step it is waiting for. Every write is confirmed first.
 */
export function PurchaseOrderScreen() {
  const { t } = useTranslation(['buying', 'common']);
  const { id = '' } = useParams();
  const auth = useAuth();
  const units = useUnits();
  const order = useApiQuery('getPurchaseOrder', { path: { id } });
  const labels = useStateLabels({
    loading: t('detail.loading'),
    emptyTitle: t('detail.notFound'),
    errorTitle: t('detail.error'),
    deniedTitle: t('list.denied'),
  });
  const back = (
    <Link to="/purchase-orders" className="text-accent-text underline">
      {t('back')}
    </Link>
  );
  if (order.error?.status === 404) {
    return (
      <EmptyState
        title={t('detail.notFound')}
        description={t('common:states.notFoundBody')}
        action={back}
      />
    );
  }
  const qty = (value: string, uom: string) => (
    <QuantityDisplay quantity={value} unit={units.name(uom)} places={units.places(uom)} />
  );
  return (
    <QueryBoundary
      query={order}
      labels={labels}
      isEmpty={() => false}
      loadingFallback={<Skeleton label={labels.loading} shape="block" className="h-64" />}
    >
      {(o) => (
        <article aria-labelledby="order-title" className="grid gap-4">
          {back}
          <div className="flex flex-wrap items-center gap-3">
            <PageHeader
              title={o.orderNo ?? t('unnumbered', { supplier: o.supplier.name })}
              titleId="order-title"
            />
            <PurchaseOrderStatusBadge status={o.status} />
          </div>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                {(
                  [
                    [
                      t('fields.supplier'),
                      <span key="s">
                        {o.supplier.name} <ReadableId value={o.supplier.publicId} />
                      </span>,
                    ],
                    [t('fields.deliverTo'), o.deliverToLocation.name],
                    [t('fields.orderDate'), o.orderDate],
                    [t('fields.expectedOn'), o.expectedOn ?? NOT_APPLICABLE],
                    [
                      t('detail.sentAt'),
                      <When key="w" instant={o.sentAt} empty={t('detail.notSent')} />,
                    ],
                    [t('detail.createdBy'), o.createdBy.displayName],
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
          <TableContainer aria-label={t('detail.lines')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.product')}</TableHead>
                  <TableHead numeric>{t('columns.qtyOrdered')}</TableHead>
                  <TableHead numeric>{t('columns.unitPrice')}</TableHead>
                  <TableHead numeric>{t('columns.lineNet')}</TableHead>
                  <TableHead numeric>{t('columns.received')}</TableHead>
                  <TableHead numeric>{t('columns.outstanding')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableRowHeader>
                      <span className="grid">
                        <span>{line.product.name}</span>
                        <code className="text-control-sm text-fg-muted">{line.product.sku}</code>
                      </span>
                    </TableRowHeader>
                    <TableCell numeric label={t('columns.qtyOrdered')}>
                      <span className="grid">
                        <span>{qty(line.qtyOrdered, line.uom)}</span>
                        {line.uom === line.baseUom ? null : (
                          <span className="text-control-sm text-fg-muted">
                            {qty(line.qtyOrderedBase, line.baseUom)}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell numeric label={t('columns.unitPrice')}>
                      {t('detail.per', { unit: units.name(line.uom) })}{' '}
                      <MoneyDisplay pesewas={line.unitPricePesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.lineNet')}>
                      <MoneyDisplay pesewas={line.lineNetPesewas} />
                    </TableCell>
                    <TableCell numeric label={t('columns.received')}>
                      {qty(line.qtyReceived, line.baseUom)}
                    </TableCell>
                    <TableCell numeric label={t('columns.outstanding')}>
                      {qty(line.qtyOutstanding, line.baseUom)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Card>
            <CardBody>
              <dl className="grid gap-x-4 gap-y-2 grid-cols-[minmax(0,1fr)_max-content]">
                <dt>{t('detail.net')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.netPesewas} />
                </dd>
                <dt>{t('detail.tax')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.taxPesewas} />
                </dd>
                <dt className="font-semibold">{t('detail.gross')}</dt>
                <dd className="text-end">
                  <MoneyDisplay pesewas={o.grossPesewas} strong />
                </dd>
              </dl>
            </CardBody>
          </Card>
          {o.status === 'PENDING_APPROVAL' ? (
            <Alert severity="warning" title={t('detail.pendingTitle')}>
              {t('detail.pendingBody')}
            </Alert>
          ) : null}
          <OrderActions order={o} can={auth.can} />
        </article>
      )}
    </QueryBoundary>
  );
}

function OrderActions({ order: o, can }: { order: Order; can: (permission: string) => boolean }) {
  const { t } = useTranslation(['buying', 'common']);
  const units = useUnits();
  const keyFor = useIntentKey();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [open, setOpen] = useState<'submit' | 'send' | 'cancel' | 'close' | null>(null);
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('WHATSAPP');
  const after = { invalidates: ['listPurchaseOrders', 'getPurchaseOrder'] } as const;
  const submit = useApiMutation('submitPurchaseOrder', after);
  const send = useApiMutation('sendPurchaseOrder', after);
  const cancel = useApiMutation('cancelPurchaseOrder', after);
  const close = useApiMutation('closePurchaseOrder', after);
  const failure = useStateLabels({
    loading: t('actions.sending'),
    emptyTitle: t('actions.failed'),
    errorTitle: t('actions.failed'),
    deniedTitle: t('actions.denied'),
  });
  if (outcome !== null) {
    return (
      <Alert
        severity={outcome === 'awaiting' ? 'warning' : 'good'}
        title={t(`outcome.${outcome}`)}
      />
    );
  }
  const received = o.lines.some((l) => l.qtyReceived !== '0.000');
  const receivable =
    o.status === 'APPROVED' || o.status === 'SENT' || o.status === 'PARTIALLY_RECEIVED';
  const summary = (
    <ul className="grid list-disc gap-1 ps-5">
      <li>{t('summary.supplier', { supplier: o.supplier.name })}</li>
      {o.lines.map((line) => (
        <li key={line.id}>
          {line.product.name},{' '}
          <QuantityDisplay
            quantity={line.qtyOrdered}
            unit={units.name(line.uom)}
            places={units.places(line.uom)}
          />
          , <MoneyDisplay pesewas={line.lineNetPesewas} />
        </li>
      ))}
      <li>
        {t('detail.gross')}: <MoneyDisplay pesewas={o.grossPesewas} strong />
      </li>
    </ul>
  );
  const run = (write: () => Promise<unknown>, done: Outcome) => () => {
    write()
      .then((answer) => {
        setOpen(null);
        setOutcome(isApprovalPending(answer) ? 'awaiting' : done);
      })
      .catch(() => undefined);
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {o.status === 'DRAFT' && can('pur.purchase_order.create') ? (
          <Button onClick={() => setOpen('submit')}>{t('actions.submit')}</Button>
        ) : null}
        {o.status === 'APPROVED' && can('pur.purchase_order.send') ? (
          <Button onClick={() => setOpen('send')}>{t('actions.send')}</Button>
        ) : null}
        {receivable && can('inv.goods_receipt.create') ? (
          <Button asChild variant={o.status === 'APPROVED' ? 'secondary' : 'primary'}>
            <Link to={`/goods-receipts/new?purchaseOrder=${o.id}`}>{t('actions.receive')}</Link>
          </Button>
        ) : null}
        {(o.status === 'DRAFT' || receivable) && !received && can('pur.purchase_order.close') ? (
          <Button variant="secondary" onClick={() => setOpen('cancel')}>
            {t('actions.cancel')}
          </Button>
        ) : null}
        {o.status === 'PARTIALLY_RECEIVED' && can('pur.purchase_order.close') ? (
          <Button variant="secondary" onClick={() => setOpen('close')}>
            {t('actions.close')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={open === 'submit'}
        onOpenChange={(next) => setOpen(next ? 'submit' : null)}
        title={t('actions.submitTitle')}
        body={t('actions.submitBody')}
        confirmLabel={t('actions.submit')}
        pendingLabel={t('actions.sending')}
        pending={submit.isPending}
        error={shownFailure(submit.error)}
        failedTitle={t('actions.notSubmitted')}
        onConfirm={run(
          () =>
            submit.mutateAsync(
              { path: { id: o.id } },
              { idempotencyKey: keyFor({ submit: o.id, version: o.version }) },
            ),
          'submitted',
        )}
      >
        {summary}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'send'}
        onOpenChange={(next) => setOpen(next ? 'send' : null)}
        title={t('actions.sendTitle')}
        body={t('actions.sendBody', { supplier: o.supplier.name })}
        confirmLabel={t('actions.send')}
        pendingLabel={t('actions.sending')}
        pending={send.isPending}
        error={shownFailure(send.error)}
        failedTitle={t('actions.notSent')}
        onConfirm={run(() => {
          const input = { path: { id: o.id }, body: { channels: [channel] } };
          return send.mutateAsync(input, { idempotencyKey: keyFor(input) });
        }, 'sent')}
      >
        <Field label={t('actions.channel')}>
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value === 'EMAIL' ? 'EMAIL' : 'WHATSAPP')}
            options={[
              { value: 'WHATSAPP', label: t('channel.WHATSAPP') },
              { value: 'EMAIL', label: t('channel.EMAIL') },
            ]}
          />
        </Field>
        {summary}
      </ConfirmDialog>
      {open === 'cancel' || open === 'close' ? (
        <ReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          title={t(open === 'cancel' ? 'actions.cancelTitle' : 'actions.closeTitle')}
          body={t(open === 'cancel' ? 'actions.cancelBody' : 'actions.closeBody')}
          submitLabel={t(open === 'cancel' ? 'actions.cancel' : 'actions.close')}
          destructive={open === 'cancel'}
          error={shownFailure(open === 'cancel' ? cancel.error : close.error)}
          failureLabels={failure}
          onConfirm={async (reason) => {
            const input = { path: { id: o.id }, body: { reason } };
            const write = open === 'cancel' ? cancel : close;
            await write.mutateAsync(input, { idempotencyKey: keyFor({ ...input, open }) });
            setOutcome(open === 'cancel' ? 'cancelled' : 'closed');
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}
