/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { NumberInput } from './NumberInput';

export const valid = [
  <Field key="1" label="Heads received">
    <NumberInput value="20" onValueChange={() => undefined} />
  </Field>,
  <Field key="2" label="Variance">
    <NumberInput value="-1.5" onValueChange={() => undefined} decimals={2} allowNegative />
  </Field>,
];

export const invalid = [
  // The value is the typed string, never a JavaScript number.
  // @ts-expect-error value must be a string
  <NumberInput key="a" aria-label="Heads" value={20} onValueChange={() => undefined} />,

  // @ts-expect-error onValueChange is required
  <NumberInput key="b" aria-label="Heads" value="20" />,

  // Decimal places are capped at six.
  // @ts-expect-error decimals above 6 are refused
  <NumberInput key="c" aria-label="Heads" value="" onValueChange={() => undefined} decimals={9} />,

  // type="number" is never allowed.
  // @ts-expect-error type is not accepted
  <NumberInput key="d" aria-label="Heads" value="" onValueChange={() => undefined} type="number" />,
];
