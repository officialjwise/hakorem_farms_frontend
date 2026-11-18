import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Combobox, Field } from '@hakorem/ui';
import { useApiQuery } from '../data/api';

type Customer = components['schemas']['Customer'];

/**
 * A customer found by name, phone or public id as the person types (at least two characters), from
 * `listCustomers`: a bakery, a kitchen, a chop bar or a shop that buys crates in bulk.
 */
export function CustomerPicker({
  label,
  hint,
  value,
  onChange,
  error,
  required = false,
}: {
  label: string;
  hint?: string;
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  error?: string;
  required?: boolean;
}) {
  const { t } = useTranslation(['wholesale', 'common']);
  const [text, setText] = useState(value?.name ?? '');
  const search = text.trim();
  // A list people search: `working`.
  const found = useApiQuery(
    'listCustomers',
    { query: { q: search, status: 'ACTIVE', limit: 10 } },
    { staleClass: 'working', enabled: search.length >= 2 && search !== value?.name },
  );
  const rows = [...(value === null ? [] : [value]), ...(found.data?.data ?? [])].filter(
    (c, i, all) => all.findIndex((d) => d.id === c.id) === i,
  );
  return (
    <Field
      label={label}
      hint={hint}
      {...(required
        ? { required: true as const, requiredLabel: t('common:field.required') }
        : { required: false as const })}
      error={error}
    >
      <Combobox
        options={rows.map((c) => ({ value: c.id, label: `${c.name} (${c.publicId})` }))}
        value={value?.id ?? null}
        inputValue={text}
        onInputValueChange={(next) => {
          setText(next);
          if (next.trim() === '' && value !== null) onChange(null);
        }}
        onValueChange={(id) => {
          const picked = rows.find((c) => c.id === id) ?? null;
          onChange(picked);
          if (picked !== null) setText(picked.name);
        }}
        listLabel={t('picker.matches')}
        noResultsLabel={search.length < 2 ? t('picker.typeMore') : t('picker.noMatch')}
      />
    </Field>
  );
}
