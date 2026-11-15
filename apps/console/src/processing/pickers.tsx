import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Combobox, Field, formatWeight } from '@hakorem/ui';
import { useApiQuery } from '../data/api';

type S = components['schemas'];
export type ProductChoice = S['ProductRef'];
export type AnimalChoice = Pick<S['StockUnit'], 'id' | 'identifier' | 'product' | 'lastWeightKg'>;

/** A product found by name, SKU or barcode as the person types (at least two characters). */
export function ProductPicker({
  label,
  value,
  onChange,
  error,
  hint,
  required = true,
}: {
  label: string;
  value: ProductChoice | null;
  onChange: (product: ProductChoice | null) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const { t } = useTranslation(['processing', 'common']);
  const [text, setText] = useState(value?.name ?? '');
  const search = text.trim();
  // A list people search: `working`.
  const found = useApiQuery(
    'listProducts',
    { query: { q: search, status: 'ACTIVE', limit: 10 } },
    { staleClass: 'working', enabled: search.length >= 2 && search !== value?.name },
  );
  const rows = found.data?.data ?? [];
  const options = [...(value === null ? [] : [value]), ...rows]
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  return (
    <Field
      label={label}
      hint={hint}
      {...(required === true
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
          const row = rows.find((p) => p.id === id);
          const picked =
            row === undefined
              ? value?.id === id
                ? value
                : null
              : { id: row.id, sku: row.sku, name: row.name };
          onChange(picked);
          if (picked !== null) setText(picked.name);
        }}
        loading={found.isFetching}
        loadingLabel={t('pickers.searching')}
        listLabel={t('pickers.products')}
        noResultsLabel={search.length < 2 ? t('pickers.typeMore') : t('pickers.noProduct')}
      />
    </Field>
  );
}

/**
 * An animal standing at the processing location, found by part of its tag. The order's inputs are stock
 * unit ids (`ProcessingInputInput.stockUnitId`), and an animal's id is its stock unit's id, so this reads
 * `listStockUnits` for SERIAL units that are ACTIVE where the order will be processed. One under a hold in
 * force now is listed but cannot be chosen, and says why; the API refuses it anyway (`STOCK_UNIT_ON_HOLD`).
 */
export function AnimalPicker({
  label,
  locationId,
  exclude,
  onPick,
  error,
}: {
  label: string;
  locationId: string;
  /** Animals already on the order. */
  exclude: readonly string[];
  onPick: (animal: AnimalChoice) => void;
  error?: string;
}) {
  const { t } = useTranslation(['processing', 'common']);
  const [text, setText] = useState('');
  const search = text.trim();
  // Animals at a location are acted on: `live`.
  const found = useApiQuery(
    'listStockUnits',
    {
      query: {
        tracking: 'SERIAL',
        status: 'ACTIVE',
        locationId,
        limit: 25,
        ...(search === '' ? {} : { q: search }),
      },
    },
    { enabled: locationId !== '' },
  );
  const rows = (found.data?.data ?? []).filter(
    (unit, i, all) => !exclude.includes(unit.id) && all.findIndex((u) => u.id === unit.id) === i,
  );
  const options = rows.map((unit) => {
    const held = unit.activeHolds.length > 0;
    const weight =
      unit.lastWeightKg === null
        ? ''
        : `, ${t('pickers.lastWeight', { weight: formatWeight(unit.lastWeightKg) })}`;
    return {
      value: unit.id,
      label: `${unit.identifier}, ${unit.product.name}${weight}${held ? `, ${t('pickers.onHold')}` : ''}`,
      disabled: held,
    };
  });
  return (
    <Field label={label} hint={t('pickers.animalHint')} error={error}>
      <Combobox
        options={options}
        value={null}
        inputValue={text}
        onInputValueChange={setText}
        disabled={locationId === ''}
        onValueChange={(id) => {
          const unit = rows.find((u) => u.id === id);
          if (unit === undefined) return;
          onPick({
            id: unit.id,
            identifier: unit.identifier,
            product: unit.product,
            lastWeightKg: unit.lastWeightKg,
          });
          setText('');
        }}
        loading={found.isFetching}
        loadingLabel={t('pickers.searching')}
        listLabel={t('pickers.animals')}
        noResultsLabel={
          found.isError
            ? t('pickers.animalsError')
            : locationId === ''
              ? t('pickers.chooseLocationFirst')
              : t('pickers.noAnimal')
        }
      />
    </Field>
  );
}
