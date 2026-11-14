/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from './Field';

export const valid = [
  <Field key="1" label="Weight (kg)">
    <input />
  </Field>,
  <Field key="2" label="Weight (kg)" required requiredLabel="Required" hint="From the scale">
    <input />
  </Field>,
];

export const invalid = [
  // A field without a label.
  // @ts-expect-error label is required
  <Field key="a">
    <input />
  </Field>,

  // An empty label is no label.
  // @ts-expect-error label cannot be an empty string
  <Field key="b" label="">
    <input />
  </Field>,

  // Required needs visible words, not just the attribute or an asterisk.
  // @ts-expect-error requiredLabel is required when required is set
  <Field key="c" label="Weight (kg)" required>
    <input />
  </Field>,

  // Exactly one control.
  // @ts-expect-error children must be a single element
  <Field key="d" label="Weight (kg)">
    <input />
    <input />
  </Field>,

  // @ts-expect-error children must be an element, not text
  <Field key="e" label="Weight (kg)">
    38.400
  </Field>,
];
