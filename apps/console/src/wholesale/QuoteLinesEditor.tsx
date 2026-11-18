import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  MoneyDisplay,
  MoneyInput,
  MutationFailure,
  Select,
} from '@hakorem/ui';
import { useApiMutation } from '../data/api';
import { useStateLabels } from '../lib/states';
import { newRecordId } from '../lib/clientId';
import { ProductPicker, type ProductRef } from '../stock/LinesEditor';
import { toQuantity, useLineUnits, useUnits } from '../stock/units';
import { quoteLineUnitOn, withQuoteLineUnit } from '../requested/quoteLineUnit';

type S = components['schemas'];

/** The API's price for one line, as `resolvePrices` answered it: never worked out on this screen. */
export interface LinePrice {
  outcome: S['PriceResolution']['outcome'];
  resolved: S['ResolvedPrice'] | null;
  quoteRequiredReason: S['PriceResolution']['quoteRequiredReason'];
}

/** One quote line being entered. */
export interface DraftQuoteLine {
  key: string;
  product: ProductRef | null;
  /** The unit it is sold in: a crate or a single egg (CR-046); empty for the product's sale unit. */
  uom: string;
  qty: string;
  description: string;
  /** The price agreed with the buyer: the API's own until the person types another. */
  unitPricePesewas: number | null;
  priceBasis: S['PriceBasis'] | '';
  /** The API's answer, for the words beside the price. */
  price: LinePrice | null;
}

export function blankQuoteLine(): DraftQuoteLine {
  return {
    key: newRecordId(),
    product: null,
    uom: '',
    qty: '',
    description: '',
    unitPricePesewas: null,
    priceBasis: '',
    price: null,
  };
}

/** A line read back from a draft version, so it can be edited and sent again whole. */
export function draftFromLine(line: S['QuoteLine']): DraftQuoteLine {
  return {
    key: line.id,
    product: line.product === null ? null : { ...line.product, baseUom: line.uom },
    uom: line.uom,
    qty: line.quantity,
    description: line.description,
    unitPricePesewas: line.unitPricePesewas,
    priceBasis: line.priceBasis,
    price: null,
  };
}

/** What is wrong with a line, in the order the person reads it; empty when it can be sent. */
export function lineProblems(
  line: DraftQuoteLine,
): ('product' | 'qty' | 'description' | 'price')[] {
  const problems: ('product' | 'qty' | 'description' | 'price')[] = [];
  if (line.product === null) problems.push('product');
  if (toQuantity(line.qty) === null || toQuantity(line.qty) === '0.000') problems.push('qty');
  if (line.description.trim() === '') problems.push('description');
  if (line.unitPricePesewas === null || line.priceBasis === '') problems.push('price');
  return problems;
}

/** The line as the contract takes it (`QuoteLineInput`), with its unit only where CR-046 is switched on. */
export function toLineInput(line: DraftQuoteLine): S['QuoteLineInput'] {
  const input: S['QuoteLineInput'] = {
    ...(line.product === null ? {} : { productId: line.product.id }),
    description: line.description.trim(),
    quantity: toQuantity(line.qty) ?? '',
    priceBasis: line.priceBasis === '' ? 'PER_UNIT' : line.priceBasis,
    unitPricePesewas: line.unitPricePesewas ?? 0,
  };
  return line.uom === '' ? input : withQuoteLineUnit(input, line.uom);
}

const BASES = ['PER_UNIT', 'PER_HEAD', 'PER_KG'] as const satisfies readonly S['PriceBasis'][];

/**
 * The lines of a quote: a product, the unit it is sold in (a crate or a single egg, CR-046), how many, and
 * the price. "Get the API's prices" asks `resolvePrices` for every line at once, for this buyer, and each
 * line takes the price the API gives for its own unit; a single egg's price is never worked out from a
 * crate's. The person may agree another price; the API's stays beside it, and a price below the margin
 * floor is the server's to stop (`QUOTE_BELOW_MARGIN`). Nothing is multiplied or added up here: the line
 * totals and the quote's totals come back from the server when it is saved.
 */
export function QuoteLinesEditor({
  lines,
  onChange,
  customerId,
  branchId,
  checked,
}: {
  lines: DraftQuoteLine[];
  onChange: (lines: DraftQuoteLine[]) => void;
  customerId: string | null;
  branchId: string | null;
  checked: boolean;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const resolve = useApiMutation('resolvePrices');
  const failure = useStateLabels({
    loading: t('lines.pricing'),
    emptyTitle: t('lines.notPriced'),
    errorTitle: t('lines.notPriced'),
    deniedTitle: t('lines.priceDenied'),
  });
  const set = (key: string, next: Partial<DraftQuoteLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...next } : line)));
  const ready = lines.filter(
    (line) => line.product !== null && toQuantity(line.qty) !== null && line.qty !== '',
  );
  const price = () => {
    if (branchId === null || ready.length === 0) return;
    const body: S['PriceResolveRequest'] = {
      channel: 'QUOTE',
      branchId,
      ...(customerId === null ? {} : { customerId }),
      lines: ready.map((line) => ({
        lineRef: line.key,
        productId: line.product?.id ?? '',
        quantity: toQuantity(line.qty) ?? '',
        ...(line.uom === '' || !quoteLineUnitOn() ? {} : { uom: line.uom }),
      })),
    };
    resolve
      .mutateAsync({ body })
      .then((answer) => {
        const byRef = new Map(answer.lines.map((row) => [row.lineRef, row]));
        onChange(
          lines.map((line) => {
            const row = byRef.get(line.key);
            if (row === undefined) return line;
            const resolved = row.resolved;
            return {
              ...line,
              price: {
                outcome: row.outcome,
                resolved,
                quoteRequiredReason: row.quoteRequiredReason,
              },
              ...(resolved === null
                ? {}
                : {
                    unitPricePesewas: resolved.listPricePesewas,
                    priceBasis: resolved.basis,
                    uom: line.uom === '' ? resolved.uom : line.uom,
                  }),
            };
          }),
        );
      })
      .catch(() => undefined);
  };
  return (
    <section aria-labelledby="quote-lines-title" className="grid gap-3">
      <h2 id="quote-lines-title" className="text-heading-sm font-semibold">
        {t('lines.title')}
      </h2>
      <p className="text-control-sm text-fg-muted">{t('lines.hint')}</p>
      {quoteLineUnitOn() ? null : (
        <Alert severity="info" title={t('lines.unitWaits')}>
          {t('lines.unitWaitsBody')}
        </Alert>
      )}
      {lines.map((line, index) => (
        <QuoteLineCard
          key={line.key}
          line={line}
          index={index}
          checked={checked}
          onChange={(next) => set(line.key, next)}
          onRemove={
            lines.length > 1
              ? () => onChange(lines.filter((other) => other.key !== line.key))
              : undefined
          }
        />
      ))}
      <MutationFailure error={resolve.error} labels={failure} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onChange([...lines, blankQuoteLine()])}>
          <Plus aria-hidden="true" />
          {t('lines.add')}
        </Button>
        <Button
          variant="secondary"
          onClick={price}
          loading={resolve.isPending}
          loadingLabel={t('lines.pricing')}
          disabled={ready.length === 0 || branchId === null}
        >
          {t('lines.price')}
        </Button>
      </div>
    </section>
  );
}

function QuoteLineCard({
  line,
  index,
  checked,
  onChange,
  onRemove,
}: {
  line: DraftQuoteLine;
  index: number;
  checked: boolean;
  onChange: (next: Partial<DraftQuoteLine>) => void;
  onRemove: (() => void) | undefined;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const units = useUnits();
  const choices = useLineUnits(line.product);
  const problems = checked ? lineProblems(line) : [];
  const required = t('common:field.required');
  const unitOptions = choices.units.map((unit) => ({
    value: unit.code,
    label:
      unit.factor === null
        ? units.name(unit.code)
        : t('lines.unitWithFactor', {
            unit: units.name(unit.code),
            factor: unit.factor,
            base: units.name(line.product?.baseUom ?? ''),
          }),
  }));
  const resolved = line.price?.resolved ?? null;
  return (
    <Card>
      <CardBody className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('lines.line', { number: index + 1 })}</h3>
          {onRemove === undefined ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={t('lines.remove', { number: index + 1 })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
        <ProductPicker
          label={t('lines.product')}
          value={line.product}
          error={problems.includes('product') ? required : undefined}
          onChange={(product) =>
            onChange({
              product,
              uom: quoteLineUnitOn() && product !== null ? product.baseUom : '',
              price: null,
              unitPricePesewas: null,
              priceBasis: '',
              description: line.description === '' ? (product?.name ?? '') : line.description,
            })
          }
        />
        {quoteLineUnitOn() && line.product !== null ? (
          <Field label={t('lines.unit')} hint={t('lines.unitHint')}>
            <Select
              value={line.uom === '' ? line.product.baseUom : line.uom}
              onValueChange={(uom) =>
                onChange({ uom, price: null, unitPricePesewas: null, priceBasis: '' })
              }
              options={unitOptions}
            />
          </Field>
        ) : null}
        <Field
          label={
            line.uom === ''
              ? t('lines.qty')
              : t('lines.qtyIn', { unit: units.name(line.uom).toLowerCase() })
          }
          required
          requiredLabel={required}
          error={problems.includes('qty') ? t('lines.qtyWrong') : undefined}
        >
          <Input
            inputMode="decimal"
            value={line.qty}
            onChange={(event) => onChange({ qty: event.target.value, price: null })}
          />
        </Field>
        <Field
          label={t('lines.description')}
          hint={t('lines.descriptionHint')}
          required
          requiredLabel={required}
          error={problems.includes('description') ? required : undefined}
        >
          <Input
            value={line.description}
            maxLength={200}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </Field>
        {line.price === null ? null : resolved === null ? (
          <Alert severity="warning" title={t('lines.noApiPrice')}>
            {t(`quoteRequired.${line.price.quoteRequiredReason ?? 'NO_RULE'}`, {
              defaultValue: line.price.quoteRequiredReason ?? '',
            })}
          </Alert>
        ) : (
          <p className="text-control-sm" data-testid="api-price">
            {t('lines.apiPrice', {
              unit: units.name(resolved.uom).toLowerCase(),
              list: resolved.priceList.name,
            })}{' '}
            <MoneyDisplay pesewas={resolved.listPricePesewas} strong />
          </p>
        )}
        {resolved === null && line.price !== null ? (
          <Field label={t('lines.basis')} required requiredLabel={required}>
            <Select
              value={line.priceBasis}
              onValueChange={(value) => onChange({ priceBasis: value as S['PriceBasis'] })}
              placeholder={t('lines.chooseBasis')}
              options={BASES.map((basis) => ({ value: basis, label: t(`basis.${basis}`) }))}
            />
          </Field>
        ) : null}
        <Field
          label={
            line.uom === ''
              ? t('lines.agreedPrice')
              : t('lines.agreedPriceIn', { unit: units.name(line.uom).toLowerCase() })
          }
          hint={t('lines.agreedPriceHint')}
          required
          requiredLabel={required}
          error={problems.includes('price') ? t('lines.priceMissing') : undefined}
        >
          <MoneyInput
            value={line.unitPricePesewas}
            onValueChange={(pesewas) => onChange({ unitPricePesewas: pesewas })}
          />
        </Field>
      </CardBody>
    </Card>
  );
}
