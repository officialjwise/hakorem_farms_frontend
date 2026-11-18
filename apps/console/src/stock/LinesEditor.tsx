import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Button,
  Combobox,
  Field,
  MoneyDisplay,
  MoneyInput,
  NumberInput,
  QuantityDisplay,
  Select,
  Textarea,
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { toQuantity, useLineUnits, useUnits } from './units';

type ReasonCode = components['schemas']['ReasonCode'];

export type ProductRef = Pick<components['schemas']['Product'], 'id' | 'name' | 'sku' | 'baseUom'>;
/** `order` is a purchase order's lines (the egg session): bought in a unit, at a price or the last paid. */
export type LineKind = 'adjustment' | 'transfer' | 'receipt' | 'order';

/** One line being entered: the product, the quantity as typed, and what the kind of document adds. */
export interface DraftLine {
  key: string;
  product: ProductRef | null;
  qty: string;
  direction: 'GAIN' | 'LOSS';
  /** Receipts: the cost of the accepted quantity, from the supplier's paper, in pesewas. */
  valuePesewas: number | null;
  /**
   * Receipts and transfers (contract 2.2.0): the unit the quantities are counted in, a crate or an egg.
   * Null is the product's base unit, and nothing is sent. The server converts, never the screen.
   */
  uom: string | null;
  /** Receipts: what was turned away at the door, as typed, in the same unit. Empty is none. */
  rejected: string;
  /** Receipts (2.3.0): why it was turned away, a `GOODS_RECEIPT_REJECTION` reason. */
  rejectionReasonCode: string;
  rejectionNote: string;
  /** Receipts against a purchase order: the order line this line receives, which fixes its product and unit. */
  purchaseOrderLineId: string | null;
  /** Orders: the price per `uom` agreed with the supplier, or null for the last price paid (2.3.0). */
  unitPricePesewas: number | null;
}

let next = 0;
export function emptyLine(change: Partial<Omit<DraftLine, 'key'>> = {}): DraftLine {
  next += 1;
  return {
    key: `line-${next}`,
    product: null,
    qty: '',
    direction: 'LOSS',
    valuePesewas: null,
    uom: null,
    rejected: '',
    rejectionReasonCode: '',
    rejectionNote: '',
    purchaseOrderLineId: null,
    unitPricePesewas: null,
    ...change,
  };
}

/** Whether a line turns anything away: a rejected quantity above zero. */
export function rejectsSome(line: DraftLine): boolean {
  const rejected = toQuantity(line.rejected);
  return rejected !== null && rejected !== '0.000';
}

/**
 * Which lines are not ready to send, and why, by line key. A rejection needs its reason, and a note when
 * the reason asks for one (2.3.0); the server refuses the same, so this only saves a round trip.
 */
export function lineProblems(
  lines: DraftLine[],
  kind: LineKind,
  reasons: readonly Pick<ReasonCode, 'code' | 'requiresNote'>[] = [],
): Record<string, string[]> {
  const problems: Record<string, string[]> = {};
  for (const line of lines) {
    const found: string[] = [];
    if (line.product === null) found.push('product');
    if (toQuantity(line.qty) === null) found.push('qty');
    // CR-040 (2.9.0): a line against an order line may leave its value to the server, from the order.
    if (kind === 'receipt' && line.valuePesewas === null && line.purchaseOrderLineId === null) {
      found.push('value');
    }
    if (kind === 'receipt' && line.rejected.trim() !== '' && toQuantity(line.rejected) === null) {
      found.push('rejected');
    }
    if (kind === 'receipt' && rejectsSome(line)) {
      const reason = reasons.find((r) => r.code === line.rejectionReasonCode);
      if (reason === undefined) found.push('reason');
      else if (reason.requiresNote && line.rejectionNote.trim() === '') found.push('note');
    }
    if (found.length > 0) problems[line.key] = found;
  }
  return problems;
}

/**
 * A line as `GoodsReceiptLineInput` takes it: the unit only when it is not the base unit, the rejection
 * with its reason only when something was turned away, and the value unless a line against an order line
 * leaves it to the server (CR-040, 2.9.0), which values it at the order's price and says so in its answer.
 */
export function receiptLineInput(line: DraftLine) {
  const rejected = rejectsSome(line) ? toQuantity(line.rejected) : null;
  const note = line.rejectionNote.trim();
  return {
    productId: line.product?.id ?? '',
    ...(line.purchaseOrderLineId === null ? {} : { purchaseOrderLineId: line.purchaseOrderLineId }),
    ...(line.uom === null ? {} : { uom: line.uom }),
    qtyReceived: toQuantity(line.qty) ?? '',
    ...(rejected === null
      ? {}
      : {
          qtyRejected: rejected,
          rejectionReasonCode: line.rejectionReasonCode,
          ...(note === '' ? {} : { rejectionNote: note }),
        }),
    ...(line.valuePesewas === null && line.purchaseOrderLineId !== null
      ? {}
      : { valuePesewas: line.valuePesewas ?? 0 }),
  };
}

/** The unit a line is counted in: the one chosen, or the product's base unit. */
export const lineUom = (line: DraftLine): string => line.uom ?? line.product?.baseUom ?? '';

/**
 * The choice of unit for a line whose product converts (a crate or a single egg). A product with one unit
 * shows no choice. The conversion is the API's (`listUomConversions`), shown so the person knows what a
 * crate holds, and never applied here.
 */
function UnitField({
  line,
  number,
  locked,
  onChange,
}: {
  line: DraftLine;
  number: number;
  locked: boolean;
  onChange: (uom: string | null) => void;
}) {
  const { t } = useTranslation('stock');
  const names = useUnits();
  const { units } = useLineUnits(line.product);
  if (line.product === null || units.length < 2 || locked) return null;
  const base = line.product.baseUom;
  return (
    <Field label={t('lines.unit', { number })} hint={t('lines.unitHint')}>
      <Select
        value={line.uom ?? base}
        onValueChange={(code) => onChange(code === base ? null : code)}
        options={units.map((unit) => ({
          value: unit.code,
          label:
            unit.factor === null
              ? names.name(unit.code)
              : t('lines.unitOf', {
                  unit: names.name(unit.code),
                  factor: unit.factor.replace(/\.?0+$/, ''),
                  base: names.after(base, unit.factor),
                }),
        }))}
      />
    </Field>
  );
}

/** A product found by name or SKU as the person types (at least two characters). */
export function ProductPicker({
  value,
  onChange,
  label,
  error,
  required = true,
}: {
  value: ProductRef | null;
  onChange: (product: ProductRef | null) => void;
  label: string;
  error?: string;
  /** A line's product always is; a medicine on a health event is not (F6). */
  required?: boolean;
}) {
  const { t } = useTranslation(['stock', 'common']);
  const [text, setText] = useState(value?.name ?? '');
  const search = text.trim();
  // A list people search: `working`.
  const found = useApiQuery(
    'listProducts',
    { query: { q: search, status: 'ACTIVE', limit: 10 } },
    { staleClass: 'working', enabled: search.length >= 2 && search !== value?.name },
  );
  const options = [...(value === null ? [] : [value]), ...(found.data?.data ?? [])]
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  return (
    <Field
      label={label}
      {...(required
        ? { required: true as const, requiredLabel: t('common:field.required') }
        : { required: false as const })}
      error={error}
    >
      <Combobox
        options={options}
        value={value?.id ?? null}
        inputValue={text}
        onInputValueChange={setText}
        onValueChange={(id) => {
          const picked =
            found.data?.data.find((p) => p.id === id) ?? (value?.id === id ? value : null);
          onChange(picked ?? null);
          if (picked !== null && picked !== undefined) setText(picked.name);
        }}
        listLabel={t('lines.matches')}
        noResultsLabel={search.length < 2 ? t('lines.typeMore') : t('lines.noMatch')}
      />
    </Field>
  );
}

/** The lines of an adjustment, transfer or receipt, entered one by one. */
export function LinesEditor({
  kind,
  lines,
  onChange,
  problems,
  rejectionReasons = [],
}: {
  kind: LineKind;
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  problems: Record<string, string[]>;
  /** Receipts: the `GOODS_RECEIPT_REJECTION` reasons a rejected quantity names. */
  rejectionReasons?: readonly ReasonCode[];
}) {
  const { t } = useTranslation(['stock', 'common']);
  const units = useUnits();
  const update = (key: string, change: Partial<DraftLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));
  const required = t('common:field.required');

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-lg font-semibold">{t('lines.title')}</legend>
      <ol className="grid gap-3">
        {lines.map((line, index) => {
          const number = index + 1;
          const wrong = problems[line.key] ?? [];
          const places = line.product === null ? 3 : units.places(lineUom(line));
          const unit = line.product === null ? '' : units.many(lineUom(line));
          const perUnit = line.product === null ? '' : units.one(lineUom(line));
          const fromOrder = line.purchaseOrderLineId !== null;
          const reason = rejectionReasons.find((r) => r.code === line.rejectionReasonCode);
          return (
            <li key={line.key} className="grid gap-2 rounded-md border border-border p-3">
              <p className="font-semibold">{t('lines.line', { number })}</p>
              {fromOrder && line.product !== null ? (
                <p>{t('lines.fromOrder', { product: line.product.name, unit })}</p>
              ) : (
                <ProductPicker
                  label={t('lines.product', { number })}
                  value={line.product}
                  onChange={(product) => update(line.key, { product, uom: null })}
                  {...(wrong.includes('product') ? { error: required } : {})}
                />
              )}
              {kind === 'adjustment' ? null : (
                <UnitField
                  line={line}
                  number={number}
                  locked={fromOrder}
                  onChange={(uom) => update(line.key, { uom })}
                />
              )}
              {kind === 'adjustment' ? (
                <Field label={t('lines.direction', { number })}>
                  <Select
                    value={line.direction}
                    onValueChange={(value) =>
                      update(line.key, { direction: value === 'GAIN' ? 'GAIN' : 'LOSS' })
                    }
                    options={[
                      { value: 'LOSS', label: t('direction.LOSS') },
                      { value: 'GAIN', label: t('direction.GAIN') },
                    ]}
                  />
                </Field>
              ) : null}
              <Field
                label={
                  kind === 'order'
                    ? unit === ''
                      ? t('lines.ordered', { number })
                      : t('lines.orderedIn', { number, unit })
                    : kind === 'receipt'
                      ? unit === ''
                        ? t('lines.accepted', { number })
                        : t('lines.acceptedIn', { number, unit })
                      : unit === ''
                        ? t('lines.qty', { number })
                        : t('lines.qtyIn', { number, unit })
                }
                required
                requiredLabel={required}
                error={wrong.includes('qty') ? t('lines.qtyInvalid', { count: places }) : undefined}
              >
                <NumberInput
                  decimals={places}
                  value={line.qty}
                  onValueChange={(qty) => update(line.key, { qty })}
                />
              </Field>
              {kind === 'order' ? (
                <Field
                  label={
                    unit === ''
                      ? t('lines.price', { number })
                      : t('lines.priceIn', { number, unit: perUnit })
                  }
                  hint={t('lines.priceHint')}
                >
                  <MoneyInput
                    value={line.unitPricePesewas}
                    onValueChange={(unitPricePesewas) => update(line.key, { unitPricePesewas })}
                  />
                </Field>
              ) : null}
              {kind === 'receipt' ? (
                <Field
                  label={
                    unit === ''
                      ? t('lines.rejected', { number })
                      : t('lines.rejectedIn', { number, unit })
                  }
                  hint={t('lines.rejectedHint')}
                  error={
                    wrong.includes('rejected')
                      ? t('lines.qtyInvalid', { count: places })
                      : undefined
                  }
                >
                  <NumberInput
                    decimals={places}
                    value={line.rejected}
                    onValueChange={(rejected) => update(line.key, { rejected })}
                  />
                </Field>
              ) : null}
              {kind === 'receipt' && rejectsSome(line) ? (
                <>
                  <Field
                    label={t('lines.rejectionReason', { number })}
                    required
                    requiredLabel={required}
                    error={wrong.includes('reason') ? required : undefined}
                  >
                    <Select
                      value={line.rejectionReasonCode}
                      onValueChange={(rejectionReasonCode) =>
                        update(line.key, { rejectionReasonCode })
                      }
                      placeholder={t('lines.chooseRejectionReason')}
                      options={rejectionReasons.map((r) => ({
                        value: r.code,
                        label: r.description,
                      }))}
                    />
                  </Field>
                  <Field
                    label={t('lines.rejectionNote', { number })}
                    {...(reason?.requiresNote === true
                      ? {
                          required: true as const,
                          requiredLabel: required,
                          hint: t('lines.rejectionNoteRequired'),
                        }
                      : { hint: t('lines.rejectionNoteHint') })}
                    error={wrong.includes('note') ? required : undefined}
                  >
                    <Textarea
                      value={line.rejectionNote}
                      onChange={(event) => update(line.key, { rejectionNote: event.target.value })}
                      rows={2}
                      maxLength={500}
                    />
                  </Field>
                </>
              ) : null}
              {kind === 'receipt' ? (
                <Field
                  label={t('lines.value', { number })}
                  hint={fromOrder ? t('lines.valueFromOrderHint') : t('lines.valueHint')}
                  required={!fromOrder}
                  requiredLabel={required}
                  error={wrong.includes('value') ? required : undefined}
                >
                  <MoneyInput
                    value={line.valuePesewas}
                    onValueChange={(valuePesewas) => update(line.key, { valuePesewas })}
                  />
                </Field>
              ) : null}
              {lines.length > 1 ? (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                  >
                    {t('lines.remove', { number })}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <Button type="button" variant="secondary" onClick={() => onChange([...lines, emptyLine()])}>
          {t('lines.add')}
        </Button>
      </div>
    </fieldset>
  );
}

/** The lines as they will be sent, for the confirmation: exact quantities, and values for a receipt. */
export function LinesSummary({ kind, lines }: { kind: LineKind; lines: DraftLine[] }) {
  const { t } = useTranslation('stock');
  const units = useUnits();
  return (
    <ul className="grid list-disc gap-1 ps-5">
      {lines.map((line) => {
        if (line.product === null) return null;
        const quantity = toQuantity(line.qty);
        const uom = lineUom(line);
        const rejected = kind === 'receipt' && rejectsSome(line) ? toQuantity(line.rejected) : null;
        return (
          <li key={line.key}>
            {kind === 'adjustment' ? `${t(`direction.${line.direction}`)}: ` : ''}
            {line.product.name},{' '}
            {quantity === null ? (
              line.qty
            ) : (
              <QuantityDisplay
                quantity={quantity}
                unit={units.after(uom, quantity)}
                places={units.places(uom)}
              />
            )}
            {rejected === null ? null : (
              <>
                {', '}
                {t('lines.rejectedSummary')}{' '}
                <QuantityDisplay
                  quantity={rejected}
                  unit={units.after(uom, rejected)}
                  places={units.places(uom)}
                />
              </>
            )}
            {kind === 'receipt' && line.valuePesewas !== null ? (
              <>
                {', '}
                {t('lines.atCost')} <MoneyDisplay pesewas={line.valuePesewas} />
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
