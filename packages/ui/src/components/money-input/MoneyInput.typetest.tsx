/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';

const noop = () => undefined;
import { MoneyInput } from './MoneyInput';

export const valid = [
  <Field key="1" label="Price (GH₵)">
    <MoneyInput value={123450} onValueChange={noop} />
  </Field>,
  <Field key="2" label="Price (GH₵)">
    <MoneyInput value={null} onValueChange={noop} />
  </Field>,
];

export const invalid = [
  // Money is integer pesewas, never a string or a formatted amount.
  // @ts-expect-error value must be a number or null
  <MoneyInput key="a" aria-label="Price" value="12.34" onValueChange={noop} />,

  // @ts-expect-error onValueChange is required
  <MoneyInput key="b" aria-label="Price" value={null} />,

  // @ts-expect-error the type is fixed: it is a text input, not type=number
  <MoneyInput key="c" aria-label="Price" value={null} onValueChange={noop} type="number" />,
];
