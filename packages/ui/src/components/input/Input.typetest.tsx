/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { Input } from './Input';

export const valid = [
  <Field key="1" label="Tag number">
    <Input />
  </Field>,
  <Field key="2" label="Buyer phone">
    <Input type="tel" size="sm" inputMode="tel" />
  </Field>,
  // Outside a Field it must carry its own name.
  <Input key="3" aria-label="Search stock" type="search" />,
];

export const invalid = [
  // A checkbox is not a text-like input: it has its own component.
  // @ts-expect-error type is limited to text-like inputs
  <Input key="a" type="checkbox" aria-label="Tick" />,

  // The control is self-closing: content goes through Field.
  // @ts-expect-error children are not accepted
  <Input key="b" aria-label="Tag">
    text
  </Input>,

  // The native size attribute would clash with the size variant.
  // @ts-expect-error size is the variant, not a width in characters
  <Input key="c" aria-label="Tag" size={20} />,
];
