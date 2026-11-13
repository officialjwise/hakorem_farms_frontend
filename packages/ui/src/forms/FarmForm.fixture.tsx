/**
 * Shared by the form tests and stories only (not exported from the package): a
 * realistic farm form on one real Zod schema. The schema is built from messages
 * the caller passes, as an app does from its translation layer, because the UI
 * package holds no copy.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Checkbox } from '../components/checkbox/Checkbox';
import { Combobox } from '../components/combobox/Combobox';
import { Input } from '../components/input/Input';
import { MoneyInput } from '../components/money-input/MoneyInput';
import { Radio, RadioGroup } from '../components/radio/Radio';
import { Select } from '../components/select/Select';
import { WeightInput } from '../components/weight-input/WeightInput';
import { FormField } from './FormField';
import { FormFieldGroup, toggleInList } from './FormFieldGroup';

export interface FarmMessages {
  tagNo: string;
  species: string;
  animal: string;
  weightKg: string;
  pricePesewas: string;
  purpose: string;
  vaccines: string;
}

export const farmMessages: FarmMessages = {
  tagNo: 'Enter the tag number.',
  species: 'Choose a species.',
  animal: 'Choose the dam.',
  weightKg: 'Enter the weight in kilograms, to three places.',
  pricePesewas: 'Enter a price of zero or more.',
  purpose: 'Choose a purpose.',
  vaccines: 'Choose at least one vaccination.',
};

/** The contract's Kilograms pattern. */
const KILOGRAMS = /^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/;

export function createFarmSchema(m: FarmMessages) {
  return z.object({
    tagNo: z.string().trim().min(1, m.tagNo),
    species: z.string().min(1, m.species),
    damId: z
      .string()
      .nullable()
      .refine((v) => v !== null, { error: m.animal }),
    weightKg: z.string().regex(KILOGRAMS, m.weightKg),
    pricePesewas: z
      .number()
      .int()
      .min(0, m.pricePesewas)
      .nullable()
      .refine((v) => v !== null, { error: m.pricePesewas }),
    purpose: z.string().min(1, m.purpose),
    vaccines: z.array(z.string()).min(1, m.vaccines),
  });
}

export type FarmValues = z.input<ReturnType<typeof createFarmSchema>>;

export const emptyFarmValues: FarmValues = {
  tagNo: '',
  species: 'goat',
  damId: null,
  weightKg: '',
  pricePesewas: null,
  purpose: '',
  vaccines: [],
};

export function useFarmForm(messages: FarmMessages = farmMessages, defaults = emptyFarmValues) {
  return useForm<FarmValues>({
    resolver: zodResolver(createFarmSchema(messages)),
    defaultValues: defaults,
  });
}

const speciesOptions = [
  { value: 'goat', label: 'Goat' },
  { value: 'sheep', label: 'Sheep' },
];
const damOptions = [
  { value: 'gt-0141', label: 'GT-0141' },
  { value: 'gt-0207', label: 'GT-0207' },
];
const vaccineOptions = [
  { value: 'ppr', label: 'PPR' },
  { value: 'anthrax', label: 'Anthrax' },
];

/** Every field of the farm form, each through FormField or FormFieldGroup. Put it inside a Form. */
export function FarmFields({ control }: { control: ReturnType<typeof useFarmForm>['control'] }) {
  return (
    <>
      <FormField
        control={control}
        name="tagNo"
        label="Tag number"
        required
        requiredLabel="Required"
      >
        {(field) => <Input {...field} />}
      </FormField>
      <FormField control={control} name="species" label="Species">
        {({ value, onChange, name, ref }) => (
          <Select
            ref={ref}
            name={name}
            options={speciesOptions}
            placeholder="Choose a species"
            value={value}
            onValueChange={onChange}
          />
        )}
      </FormField>
      <FormField control={control} name="damId" label="Dam">
        {({ value, onChange, onBlur, ref }) => (
          <Combobox
            ref={ref}
            options={damOptions}
            listLabel="Dams"
            noResultsLabel="No animal found"
            value={value}
            onValueChange={onChange}
            onBlur={onBlur}
          />
        )}
      </FormField>
      <FormField control={control} name="weightKg" label="Weight (kg)" hint="From the scale.">
        {({ value, onChange, onBlur, ref, name }) => (
          <WeightInput
            ref={ref}
            name={name}
            value={value === '' ? null : value}
            onValueChange={(kg) => onChange(kg ?? '')}
            onBlur={onBlur}
          />
        )}
      </FormField>
      <FormField control={control} name="pricePesewas" label="Asking price (GH₵)">
        {({ value, onChange, onBlur, ref, name }) => (
          <MoneyInput
            ref={ref}
            name={name}
            value={value}
            onValueChange={onChange}
            onBlur={onBlur}
          />
        )}
      </FormField>
      <FormFieldGroup
        control={control}
        name="purpose"
        label="Purpose"
        wrap={(group, field) => (
          <RadioGroup asChild value={field.value} onValueChange={field.onChange}>
            {group}
          </RadioGroup>
        )}
      >
        {() => (
          <>
            <Radio value="GROWING" label="Growing" />
            <Radio value="BREEDING" label="Breeding" />
          </>
        )}
      </FormFieldGroup>
      <FormFieldGroup control={control} name="vaccines" label="Vaccinations given">
        {(field) => (
          <>
            {vaccineOptions.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={field.value.includes(option.value)}
                onCheckedChange={(on) =>
                  field.onChange(toggleInList(field.value, option.value, on === true))
                }
              />
            ))}
          </>
        )}
      </FormFieldGroup>
    </>
  );
}
