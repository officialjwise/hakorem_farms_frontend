/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { FieldGroup } from '../field-group/FieldGroup';
import { Checkbox } from './Checkbox';

export const valid = [
  // One checkbox in a Field: Field names it.
  <Field key="1" label="Send receipt by SMS">
    <Checkbox />
  </Field>,
  // Several in a FieldGroup: each keeps its own label.
  <FieldGroup key="2" label="Cuts">
    <Checkbox label="Wings" />
    <Checkbox label="Drumsticks" hint="15 kg pack" defaultChecked />
    <Checkbox label="Backs" checked="indeterminate" />
  </FieldGroup>,
];

export const invalid = [
  // An empty label is no label.
  // @ts-expect-error label cannot be an empty string
  <Checkbox key="a" label="" />,

  // The label is the only content.
  // @ts-expect-error children are not accepted
  <Checkbox key="b" label="Wings">
    Wings
  </Checkbox>,
];
