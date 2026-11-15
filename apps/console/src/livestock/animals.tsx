import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@hakorem/api-client';
import { Combobox, Field } from '@hakorem/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApiAllPages, useApiQuery } from '../data/api';
import { uniqueById } from '../lib/queries';

export type Animal = components['schemas']['Animal'];
/** What a form keeps of the animal it is about: enough to send its id and to say which one it is. */
export type PickedAnimal = Pick<Animal, 'id' | 'tagNo'> & { species: { name: string } };

/** "G-0142, Goat": how an animal is named in a choice list and a confirmation. */
export function animalName(animal: PickedAnimal): string {
  return `${animal.tagNo}, ${animal.species.name}`;
}

/**
 * Choose a live animal by its tag, searched on the server (`listAnimals`, `q`). Recording roles that cannot
 * read the register (the Farm hand, A-158) are told so in words instead of an empty list; CR-021 asks for a
 * lookup by tag they may use.
 */
export function AnimalPicker({
  value,
  onChange,
  label,
  error,
  required = true,
  filter,
}: {
  value: PickedAnimal | null;
  onChange: (animal: PickedAnimal | null) => void;
  label: string;
  error?: string;
  required?: boolean;
  /** Narrows the choice, for example to females for a dam. */
  filter?: (animal: Animal) => boolean;
}) {
  const { t } = useTranslation(['livestock', 'common']);
  const auth = useAuth();
  const [text, setText] = useState(value === null ? '' : value.tagNo);
  const search = text.trim();
  const canLook = auth.can('liv.animal.read');
  const requiredProps = required
    ? { required: true as const, requiredLabel: t('common:field.required') }
    : { required: false as const };
  // A list people search: `working`.
  const found = useApiQuery(
    'listAnimals',
    { query: { q: search, status: 'ALIVE', limit: 10 } },
    {
      staleClass: 'working',
      enabled: canLook && search.length >= 1 && search !== value?.tagNo,
    },
  );
  if (!canLook) {
    return (
      <Field label={label} {...requiredProps}>
        <p role="note" className="text-sm text-fg-muted">
          {t('picker.cannotLook')}
        </p>
      </Field>
    );
  }
  const matches = (found.data?.data ?? []).filter((animal) => filter?.(animal) ?? true);
  const options = uniqueById([...(value === null ? [] : [value]), ...matches]).map((animal) => ({
    value: animal.id,
    label: animalName(animal),
  }));
  return (
    <Field label={label} {...requiredProps} error={error} hint={t('picker.hint')}>
      <Combobox
        options={options}
        value={value?.id ?? null}
        inputValue={text}
        onInputValueChange={setText}
        onValueChange={(id) => {
          const picked =
            matches.find((animal) => animal.id === id) ?? (value?.id === id ? value : null);
          onChange(picked ?? null);
          if (picked !== null && picked !== undefined) setText(picked.tagNo);
        }}
        listLabel={t('picker.matches')}
        noResultsLabel={
          search.length < 1
            ? t('picker.typeTag')
            : found.isError
              ? t('picker.error')
              : t('picker.noMatch')
        }
      />
    </Field>
  );
}

/** The species, for a filter. Seeded and short: `reference`. */
export function useSpeciesOptions() {
  const species = useApiAllPages(
    'listSpeciesList',
    { query: { limit: 100 } },
    { staleClass: 'reference' },
  );
  return uniqueById(species.data?.items ?? []).map((row) => ({ value: row.id, label: row.name }));
}

/** The reason codes a death or a cull is reported with (`MORTALITY` and `CULL`). */
export function useMortalityReasons(kind: 'DEATH' | 'CULL') {
  const reasons = useApiAllPages(
    'listReasonCodes',
    { query: { domain: kind === 'DEATH' ? 'MORTALITY' : 'CULL', limit: 100 } },
    { staleClass: 'reference' },
  );
  return {
    query: reasons,
    options: (reasons.data?.items ?? [])
      .filter(
        (reason, index, all) => all.findIndex((other) => other.code === reason.code) === index,
      )
      .map((reason) => ({ value: reason.code, label: reason.description })),
  };
}
