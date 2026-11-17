import { Field, Select } from '@hakorem/ui';
import { useApiAllPages } from '../data/api';
import { uniqueById } from '../lib/queries';

/** "Any" in every filter: the value that sends nothing to the API. */
export const ANY = 'ANY';

/** One labelled choice in a stock list's Filter pill: "any" first, then the API's own values. */
export function FilterSelect({
  label,
  anyLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  anyLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        onValueChange={onChange}
        options={[{ value: ANY, label: anyLabel }, ...options]}
      />
    </Field>
  );
}

/** A filter's value as a query parameter: nothing for "any". */
export function param<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  return value === ANY ? {} : ({ [key]: value } as Record<K, string>);
}

/** How many of these filters are set, for the pill. */
export function countSet(...values: string[]): number {
  return values.filter((value) => value !== ANY).length;
}

/** Suppliers for a choice list. A short register that changes rarely: `reference` (ADR 0028). */
export function useSupplierOptions() {
  const suppliers = useApiAllPages(
    'listSuppliers',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  return uniqueById(suppliers.data?.items ?? []).map((supplier) => ({
    value: supplier.id,
    // The public id beside the name, so two suppliers of one name are told apart (contract 2.0.0).
    label: `${supplier.name} (${supplier.publicId})`,
  }));
}

/** The adjustment and wastage reasons, the fixed lists an adjustment takes its reason from: `reference`. */
export function useReasonOptions() {
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
  return [...(adjust.data?.items ?? []), ...(waste.data?.items ?? [])]
    .filter((reason, i, all) => all.findIndex((r) => r.code === reason.code) === i)
    .map((reason) => ({ value: reason.code, label: reason.description }));
}
