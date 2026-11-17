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
} from '@hakorem/ui';
import { useApiQuery } from '../data/api';
import { toQuantity, useUnits } from './units';

export type ProductRef = Pick<components['schemas']['Product'], 'id' | 'name' | 'sku' | 'baseUom'>;
export type LineKind = 'adjustment' | 'transfer' | 'receipt';

/** One line being entered: the product, the quantity as typed, and what the kind of document adds. */
export interface DraftLine {
  key: string;
  product: ProductRef | null;
  qty: string;
  direction: 'GAIN' | 'LOSS';
  /** Receipts: the cost of the accepted quantity, from the supplier's paper, in pesewas. */
  valuePesewas: number | null;
}

let next = 0;
export function emptyLine(): DraftLine {
  next += 1;
  return { key: `line-${next}`, product: null, qty: '', direction: 'LOSS', valuePesewas: null };
}

/** Which lines are not ready to send, and why, by line key. */
export function lineProblems(lines: DraftLine[], kind: LineKind): Record<string, string[]> {
  const problems: Record<string, string[]> = {};
  for (const line of lines) {
    const found: string[] = [];
    if (line.product === null) found.push('product');
    if (toQuantity(line.qty) === null) found.push('qty');
    if (kind === 'receipt' && line.valuePesewas === null) found.push('value');
    if (found.length > 0) problems[line.key] = found;
  }
  return problems;
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
}: {
  kind: LineKind;
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  problems: Record<string, string[]>;
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
          const places = line.product === null ? 3 : units.places(line.product.baseUom);
          const unit = line.product === null ? '' : units.name(line.product.baseUom);
          return (
            <li key={line.key} className="grid gap-2 rounded-md border border-border p-3">
              <p className="font-semibold">{t('lines.line', { number })}</p>
              <ProductPicker
                label={t('lines.product', { number })}
                value={line.product}
                onChange={(product) => update(line.key, { product })}
                {...(wrong.includes('product') ? { error: required } : {})}
              />
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
                  unit === '' ? t('lines.qty', { number }) : t('lines.qtyIn', { number, unit })
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
              {kind === 'receipt' ? (
                <Field
                  label={t('lines.value', { number })}
                  hint={t('lines.valueHint')}
                  required
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
        return (
          <li key={line.key}>
            {kind === 'adjustment' ? `${t(`direction.${line.direction}`)}: ` : ''}
            {line.product.name},{' '}
            {quantity === null ? (
              line.qty
            ) : (
              <QuantityDisplay
                quantity={quantity}
                unit={units.name(line.product.baseUom)}
                places={units.places(line.product.baseUom)}
              />
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
