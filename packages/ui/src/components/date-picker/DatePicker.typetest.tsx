/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { DatePicker } from './DatePicker';

export const valid = [
  <Field key="1" label="Delivery date">
    <DatePicker defaultValue="2026-12-04" min="2026-12-01" max="2026-12-31" />
  </Field>,
  <DatePicker key="2" aria-label="Expires on" value="2026-12-09" onChange={() => undefined} />,
];

export const invalid = [
  // @ts-expect-error the type is fixed to date
  <DatePicker key="a" aria-label="Date" type="text" />,

  // @ts-expect-error the value is a string, not a Date object
  <DatePicker key="b" aria-label="Date" value={new Date()} />,

  // @ts-expect-error children are not accepted
  <DatePicker key="c" aria-label="Date">
    x
  </DatePicker>,
];
