import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  MutationFailure,
  QueryBoundary,
  Select,
  Skeleton,
  Textarea,
  type FailureLike,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useApiAllPages, useApiMutation, useApiQuery } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import {
  emptyLine,
  lineProblems,
  LinesEditor,
  receiptLineInput,
  type DraftLine,
  type LineKind,
} from './LinesEditor';
import { useLocations } from './locations';
import { toQuantity } from './units';
import { useSupplierOptions } from './filters';

type S = components['schemas'];
type ReasonCode = S['ReasonCode'];

/**
 * The three ways stock is entered by hand (FR-INV): an adjustment with a reason, a transfer between
 * locations, and a goods receipt. Each saves a DRAFT, which moves no stock; the draft's own screen shows
 * the exact lines and asks before it posts.
 */
function MoveForm({
  kind,
  titleKey,
  backTo,
  lines,
  setLines,
  header,
  headerOk,
  error,
  pending,
  onSave,
  rejectionReasons = [],
  intro,
}: {
  /** Receipts: the reasons a rejected quantity names. */
  rejectionReasons?: readonly ReasonCode[];
  /** Words under the title, before the form: what a receipt against an order fills in. */
  intro?: ReactNode;
  kind: LineKind;
  titleKey: 'adjustments' | 'transfers' | 'receipts';
  backTo: string;
  lines: DraftLine[];
  setLines: (lines: DraftLine[]) => void;
  header: ReactNode;
  headerOk: () => boolean;
  error: FailureLike | null;
  pending: boolean;
  onSave: () => Promise<string>;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const dirty = !saved && lines.some((line) => line.product !== null || line.qty !== '');
  const guard = useLeaveGuard(dirty);
  const locations = useLocations();
  const states = useStateLabels({
    loading: t('move.loading'),
    emptyTitle: t('move.noLocations'),
    emptyDescription: t('move.noLocationsBody'),
    errorTitle: t('move.locationsError'),
    deniedTitle: t('move.locationsDenied'),
  });
  const failure = useStateLabels({
    loading: t('move.saving'),
    emptyTitle: t('move.notSaved'),
    errorTitle: t('move.notSaved'),
    deniedTitle: t('move.denied'),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = lineProblems(lines, kind, rejectionReasons);
    setProblems(found);
    if (!headerOk() || Object.keys(found).length > 0) return;
    onSave()
      .then((path) => {
        setSaved(true);
        return navigate(path);
      })
      .catch(() => undefined);
  };
  return (
    <article aria-labelledby="move-title" className="grid gap-4">
      <div className="grid gap-2">
        <Link to={backTo} className="text-accent-text underline">
          {t(`${titleKey}.back`)}
        </Link>
        <PageHeader title={t(`${titleKey}.newTitle`)} titleId="move-title" />
        <p className="text-fg-muted">{t('move.draftHint')}</p>
        {intro}
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
                <MutationFailure error={error} labels={failure} />
                {header}
                <LinesEditor
                  kind={kind}
                  lines={lines}
                  onChange={setLines}
                  problems={problems}
                  rejectionReasons={rejectionReasons}
                />
                <div>
                  <Button type="submit" loading={pending} loadingLabel={t('move.saving')}>
                    {t('move.save')}
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

function LocationField({
  label,
  value,
  onChange,
  missing,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  missing: boolean;
  exclude?: string;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const locations = useLocations();
  return (
    <Field
      label={label}
      required
      requiredLabel={t('common:field.required')}
      error={missing ? t('common:field.required') : undefined}
    >
      <Select
        value={value}
        onValueChange={onChange}
        placeholder={t('takes.chooseLocation')}
        options={locations.options.filter((option) => option.value !== exclude)}
      />
    </Field>
  );
}

const quantities = (lines: DraftLine[]) =>
  lines.map((line) => ({
    productId: line.product?.id ?? '',
    // A transfer counted in crates names the crate (2.2.0); the server converts to eggs.
    ...(line.uom === null ? {} : { uom: line.uom }),
    qty: toQuantity(line.qty) ?? '',
  }));

export function AdjustmentNewScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [locationId, setLocationId] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  // The fixed reason lists for adjustments and wastage (StockAdjustmentCreate.reasonCode): `reference`.
  const adjust = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'STOCK_ADJUSTMENT', limit: 100 } },
    { staleClass: 'reference' },
  );
  const waste = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'WASTAGE', limit: 100 } },
    { staleClass: 'reference' },
  );
  const reasons = [...(adjust.data?.items ?? []), ...(waste.data?.items ?? [])].filter(
    (r, i, all) =>
      all.findIndex((s) => s.code === r.code) === i &&
      (r.domain === 'STOCK_ADJUSTMENT' || r.domain === 'WASTAGE'),
  );
  const reason = reasons.find((r) => r.code === reasonCode);
  const create = useApiMutation('createStockAdjustment');
  const keyFor = useIntentKey();
  const required = t('common:field.required');
  return (
    <MoveForm
      kind="adjustment"
      titleKey="adjustments"
      backTo="/stock-adjustments"
      lines={lines}
      setLines={setLines}
      error={create.error}
      pending={create.isPending}
      headerOk={() => {
        setChecked(true);
        return (
          locationId !== '' &&
          reasonCode !== '' &&
          (reason?.requiresNote !== true || note.trim() !== '')
        );
      }}
      onSave={async () => {
        const body = {
          locationId,
          reasonCode,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
          lines: lines.map((line) => ({
            productId: line.product?.id ?? '',
            qty: toQuantity(line.qty) ?? '',
            direction: line.direction,
          })),
        };
        const made = await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
        return `/stock-adjustments/${made.id}`;
      }}
      header={
        <>
          <LocationField
            label={t('adjustments.location')}
            value={locationId}
            onChange={setLocationId}
            missing={checked && locationId === ''}
          />
          {adjust.isError || waste.isError ? (
            <p role="alert">{t('adjustments.reasonsError')}</p>
          ) : null}
          <Field
            label={t('adjustments.reason')}
            required
            requiredLabel={required}
            error={checked && reasonCode === '' ? required : undefined}
          >
            <Select
              value={reasonCode}
              onValueChange={setReasonCode}
              placeholder={t('adjustments.chooseReason')}
              options={reasons.map((r) => ({ value: r.code, label: r.description }))}
            />
          </Field>
          {reason?.requiresNote === true ? (
            <Field
              label={t('adjustments.note')}
              hint={t('adjustments.noteRequired')}
              required
              requiredLabel={required}
              error={checked && note.trim() === '' ? required : undefined}
            >
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={500}
              />
            </Field>
          ) : (
            <Field label={t('adjustments.note')} hint={t('adjustments.noteHint')}>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={500}
              />
            </Field>
          )}
        </>
      }
    />
  );
}

export function TransferNewScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [checked, setChecked] = useState(false);
  const create = useApiMutation('createStockTransfer');
  const keyFor = useIntentKey();
  return (
    <MoveForm
      kind="transfer"
      titleKey="transfers"
      backTo="/stock-transfers"
      lines={lines}
      setLines={setLines}
      error={create.error}
      pending={create.isPending}
      headerOk={() => {
        setChecked(true);
        return from !== '' && to !== '';
      }}
      onSave={async () => {
        const body = { fromLocationId: from, toLocationId: to, lines: quantities(lines) };
        const made = await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
        return `/stock-transfers/${made.id}`;
      }}
      header={
        <>
          <LocationField
            label={t('transfers.from')}
            value={from}
            onChange={setFrom}
            missing={checked && from === ''}
          />
          <LocationField
            label={t('transfers.to')}
            value={to}
            onChange={setTo}
            missing={checked && to === ''}
            exclude={from}
          />
        </>
      }
    />
  );
}

type ReceiptKind = 'PURCHASE' | 'HARVEST' | 'OPENING';

/** Orders a delivery can still come in against: approved or sent, and not yet fully received. */
const RECEIVABLE: readonly S['PurchaseOrder']['status'][] = [
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
];

/** One draft line per order line, its product and unit fixed by the order; the person counts what came. */
function linesFromOrder(order: S['PurchaseOrder']): DraftLine[] {
  return order.lines.map((line) =>
    emptyLine({
      product: { ...line.product, baseUom: line.baseUom },
      uom: line.uom === line.baseUom ? null : line.uom,
      purchaseOrderLineId: line.id,
    }),
  );
}

export function ReceiptNewScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const [search] = useSearchParams();
  const fromOrder = search.get('purchaseOrder');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [kind, setKind] = useState<ReceiptKind>(fromOrder === null ? 'HARVEST' : 'PURCHASE');
  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [checked, setChecked] = useState(false);
  const suppliers = useSupplierOptions();
  // The order this delivery comes in against, when opened from it: its supplier, place and lines.
  const linked = useApiQuery(
    'getPurchaseOrder',
    { path: { id: fromOrder ?? '' } },
    { enabled: fromOrder !== null },
  );
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  if (linked.data !== undefined && filledFrom !== linked.data.id) {
    setFilledFrom(linked.data.id);
    setKind('PURCHASE');
    setSupplierId(linked.data.supplier.id);
    setOrderId(linked.data.id);
    setLocationId(linked.data.deliverToLocation.id);
    setLines(linesFromOrder(linked.data));
  }
  // A supplier's open orders: a working list (ADR 0028).
  const orders = useApiAllPages(
    'listPurchaseOrders',
    { query: { supplierId, limit: 100 } },
    { staleClass: 'working', enabled: kind === 'PURCHASE' && supplierId !== '' },
  );
  const open = (orders.data?.items ?? []).filter(
    (o) => o.supplier.id === supplierId && RECEIVABLE.includes(o.status),
  );
  // The fixed reasons for goods turned away at the door (2.3.0): `reference`.
  const reasons = useApiAllPages(
    'listReasonCodes',
    { query: { domain: 'GOODS_RECEIPT_REJECTION', limit: 100 } },
    { staleClass: 'reference' },
  );
  const rejectionReasons = (reasons.data?.items ?? []).filter(
    (r) => r.domain === 'GOODS_RECEIPT_REJECTION',
  );
  const create = useApiMutation('createGoodsReceipt');
  const keyFor = useIntentKey();
  const required = t('common:field.required');
  const chooseOrder = (id: string) => {
    setOrderId(id);
    const order = open.find((o) => o.id === id);
    if (order === undefined) {
      setLines([emptyLine()]);
      return;
    }
    setLocationId(order.deliverToLocation.id);
    setLines(linesFromOrder(order));
  };
  return (
    <MoveForm
      kind="receipt"
      titleKey="receipts"
      backTo="/goods-receipts"
      lines={lines}
      setLines={setLines}
      rejectionReasons={rejectionReasons}
      error={create.error}
      pending={create.isPending}
      intro={reasons.isError ? <p role="alert">{t('receipts.reasonsError')}</p> : null}
      headerOk={() => {
        setChecked(true);
        return locationId !== '' && (kind !== 'PURCHASE' || supplierId !== '');
      }}
      onSave={async () => {
        const body = {
          kind,
          locationId,
          ...(kind === 'PURCHASE' ? { supplierId } : {}),
          ...(kind === 'PURCHASE' && orderId !== '' ? { purchaseOrderId: orderId } : {}),
          // The moment it is saved: when the stock arrived is the person's to correct on paper (A-F5-04).
          receivedAt: new Date().toISOString(),
          ...(deliveryNote.trim() === '' ? {} : { deliveryNoteRef: deliveryNote.trim() }),
          lines: lines.map(receiptLineInput),
        };
        const made = await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
        return `/goods-receipts/${made.id}`;
      }}
      header={
        <>
          <Field label={t('receipts.kind')} hint={t('receipts.kindHint')}>
            <Select
              value={kind}
              onValueChange={(value) => {
                const next: ReceiptKind =
                  value === 'PURCHASE' ? 'PURCHASE' : value === 'OPENING' ? 'OPENING' : 'HARVEST';
                setKind(next);
                if (next !== 'PURCHASE' && orderId !== '') {
                  setOrderId('');
                  setLines([emptyLine()]);
                }
              }}
              options={(['HARVEST', 'PURCHASE', 'OPENING'] as const).map((k) => ({
                value: k,
                label: t(`receiptKind.${k}`),
              }))}
            />
          </Field>
          {kind === 'PURCHASE' ? (
            <>
              <Field
                label={t('receipts.supplier')}
                required
                requiredLabel={required}
                error={checked && supplierId === '' ? required : undefined}
              >
                <Select
                  value={supplierId}
                  onValueChange={(value) => {
                    setSupplierId(value);
                    if (orderId !== '') {
                      setOrderId('');
                      setLines([emptyLine()]);
                    }
                  }}
                  placeholder={t('receipts.chooseSupplier')}
                  options={suppliers}
                />
              </Field>
              {supplierId === '' ? null : (
                <Field label={t('receipts.order')} hint={t('receipts.orderHint')}>
                  <Select
                    value={orderId === '' ? NO_ORDER : orderId}
                    onValueChange={(value) => chooseOrder(value === NO_ORDER ? '' : value)}
                    options={[
                      { value: NO_ORDER, label: t('receipts.noOrder') },
                      ...open.map((o) => ({
                        value: o.id,
                        label: t('receipts.orderOption', {
                          order: o.orderNo ?? t('receipts.orderUnnumbered'),
                          date: o.orderDate,
                        }),
                      })),
                    ]}
                  />
                </Field>
              )}
            </>
          ) : null}
          <LocationField
            label={t('receipts.location')}
            value={locationId}
            onChange={setLocationId}
            missing={checked && locationId === ''}
          />
          <Field label={t('receipts.deliveryNote')}>
            <Input
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </>
      }
    />
  );
}

const NO_ORDER = 'NONE';
