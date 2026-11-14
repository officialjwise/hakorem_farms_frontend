/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';

const noop = () => undefined;
import { WeightInput } from './WeightInput';

export const valid = [
  <Field key="1" label="Weight (kg)">
    <WeightInput value="38.400" onValueChange={noop} />
  </Field>,
  <Field key="2" label="Weight (kg)">
    <WeightInput value={null} onValueChange={noop} />
  </Field>,
];

export const invalid = [
  // Weight is a decimal string, never a JavaScript number.
  // @ts-expect-error value must be a string or null
  <WeightInput key="a" aria-label="Weight" value={38.4} onValueChange={noop} />,

  // @ts-expect-error onValueChange is required
  <WeightInput key="b" aria-label="Weight" value={null} />,

  // @ts-expect-error the type is fixed: it is a text input, not type=number
  <WeightInput key="c" aria-label="Weight" value={null} onValueChange={noop} type="number" />,
];
