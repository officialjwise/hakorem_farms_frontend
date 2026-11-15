import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
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
  PageHeader,
} from '@hakorem/ui';
import { useApiAllPages, useApiMutation } from '../data/api';
import { LeaveGuardDialog, useLeaveGuard } from '../lib/LeaveGuard';
import { useIntentKey } from '../lib/queries';
import { useStateLabels } from '../lib/states';
import { emptyLine, lineProblems, LinesEditor, type DraftLine, type LineKind } from './LinesEditor';
import { useLocations } from './locations';
import { toQuantity } from './units';

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
}: {
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
    const found = lineProblems(lines, kind);
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
                <LinesEditor kind={kind} lines={lines} onChange={setLines} problems={problems} />
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
  lines.map((line) => ({ productId: line.product?.id ?? '', qty: toQuantity(line.qty) ?? '' }));

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

export function ReceiptNewScreen() {
  const { t } = useTranslation(['stock', 'common']);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [kind, setKind] = useState<ReceiptKind>('HARVEST');
  const [locationId, setLocationId] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [checked, setChecked] = useState(false);
  const create = useApiMutation('createGoodsReceipt');
  const keyFor = useIntentKey();
  return (
    <MoveForm
      kind="receipt"
      titleKey="receipts"
      backTo="/goods-receipts"
      lines={lines}
      setLines={setLines}
      error={create.error}
      pending={create.isPending}
      headerOk={() => {
        setChecked(true);
        return locationId !== '';
      }}
      onSave={async () => {
        const body = {
          kind,
          locationId,
          // The moment it is saved: when the stock arrived is the person's to correct on paper (A-F5-04).
          receivedAt: new Date().toISOString(),
          ...(deliveryNote.trim() === '' ? {} : { deliveryNoteRef: deliveryNote.trim() }),
          lines: lines.map((line) => ({
            productId: line.product?.id ?? '',
            qtyReceived: toQuantity(line.qty) ?? '',
            valuePesewas: line.valuePesewas ?? 0,
          })),
        };
        const made = await create.mutateAsync({ body }, { idempotencyKey: keyFor(body) });
        return `/goods-receipts/${made.id}`;
      }}
      header={
        <>
          <Field label={t('receipts.kind')} hint={t('receipts.kindHint')}>
            <Select
              value={kind}
              onValueChange={(value) =>
                setKind(
                  value === 'PURCHASE' ? 'PURCHASE' : value === 'OPENING' ? 'OPENING' : 'HARVEST',
                )
              }
              options={(['HARVEST', 'PURCHASE', 'OPENING'] as const).map((k) => ({
                value: k,
                label: t(`receiptKind.${k}`),
              }))}
            />
          </Field>
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
