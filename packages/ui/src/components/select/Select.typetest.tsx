/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { Select } from './Select';

const options = [{ value: 'goat', label: 'Goat' }];

export const valid = [
  <Field key="1" label="Species">
    <Select options={options} placeholder="Choose a species" />
  </Field>,
  <Select key="2" aria-label="Species" options={options} size="sm" />,
];

export const invalid = [
  // Options are required.
  // @ts-expect-error options is required
  <Select key="a" aria-label="Species" />,

  // Children are not accepted: options are data.
  // @ts-expect-error children are not accepted
  <Select key="b" aria-label="Species" options={options}>
    <option>Goat</option>
  </Select>,

  // An option needs a label.
  // @ts-expect-error label is required on an option
  <Select key="c" aria-label="Species" options={[{ value: 'goat' }]} />,
];
