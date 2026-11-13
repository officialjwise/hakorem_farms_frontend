/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { Textarea } from './Textarea';

export const valid = [
  <Field key="1" label="Notes">
    <Textarea />
  </Field>,
  <Textarea key="2" aria-label="Notes" rows={5} size="sm" />,
];

export const invalid = [
  // @ts-expect-error children are not accepted: the value is the value prop
  <Textarea key="a" aria-label="Notes">
    text
  </Textarea>,

  // @ts-expect-error size is the variant, not a native attribute
  <Textarea key="b" aria-label="Notes" size={20} />,
];
