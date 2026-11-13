/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { Combobox } from './Combobox';

const options = [{ value: 'gt-0142', label: 'GT-0142' }];

export const valid = [
  <Field key="1" label="Animal">
    <Combobox options={options} listLabel="Animals" noResultsLabel="No animal found" />
  </Field>,
  <Combobox
    key="2"
    aria-label="Animal"
    options={options}
    listLabel="Animals"
    noResultsLabel="No animal found"
    loading={false}
    loadingLabel="Searching animals"
  />,
];

export const invalid = [
  // The list needs a name.
  // @ts-expect-error listLabel is required
  <Combobox key="a" aria-label="Animal" options={options} noResultsLabel="No animal found" />,

  // An empty list name announces nothing.
  <Combobox
    key="b"
    aria-label="Animal"
    options={options}
    // @ts-expect-error listLabel cannot be an empty string
    listLabel=""
    noResultsLabel="No animal found"
  />,

  // Loading needs the words announced while it runs.
  // @ts-expect-error loadingLabel is required when loading is passed
  <Combobox
    key="c"
    aria-label="Animal"
    options={options}
    listLabel="Animals"
    noResultsLabel="No animal found"
    loading
  />,

  // The combobox role and its aria wiring belong to the component.
  <Combobox
    key="d"
    aria-label="Animal"
    options={options}
    listLabel="Animals"
    noResultsLabel="No animal found"
    // @ts-expect-error role is set by the component
    role="textbox"
  />,
];
