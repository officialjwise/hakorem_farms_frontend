/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { Switch } from './Switch';

export const valid = [
  <Field key="1" label="Online visibility">
    <Switch defaultChecked />
  </Field>,
];

export const invalid = [
  // One control, one label: the label belongs to Field.
  // @ts-expect-error Switch has no label prop
  <Switch key="a" label="Online visibility" />,

  // No content: the thumb is built in.
  // @ts-expect-error children are not accepted
  <Switch key="b">On</Switch>,
];
