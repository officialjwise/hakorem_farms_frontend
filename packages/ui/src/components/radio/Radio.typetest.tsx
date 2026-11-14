/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { FieldGroup } from '../field-group/FieldGroup';
import { Radio, RadioGroup } from './Radio';

export const valid = [
  <RadioGroup key="1" asChild defaultValue="cash">
    <FieldGroup label="Payment method">
      <Radio value="cash" label="Cash" />
      <Radio value="momo" label="Mobile money" hint="MTN, Vodafone or AirtelTigo" />
    </FieldGroup>
  </RadioGroup>,
];

export const invalid = [
  // An option without its own label.
  // @ts-expect-error label is required
  <Radio key="a" value="cash" />,

  // An empty label is no label.
  // @ts-expect-error label cannot be an empty string
  <Radio key="b" value="cash" label="" />,

  // The label is the only content, so nothing can bypass it.
  // @ts-expect-error children are not accepted
  <Radio key="c" value="cash" label="Cash">
    Cash
  </Radio>,

  // An option needs a value.
  // @ts-expect-error value is required
  <Radio key="d" label="Cash" />,
];
