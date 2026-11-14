/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { FieldGroup } from './FieldGroup';

export const valid = [
  <FieldGroup key="1" label="Payment method">
    <div />
  </FieldGroup>,
  <FieldGroup
    key="2"
    label="Payment method"
    required
    requiredLabel="Required"
    hint="Choose one"
    error="Choose a payment method."
    disabled
  >
    <div />
  </FieldGroup>,
];

export const invalid = [
  // A group without a label.
  // @ts-expect-error label is required
  <FieldGroup key="a">
    <div />
  </FieldGroup>,

  // An empty label is no label.
  // @ts-expect-error label cannot be an empty string
  <FieldGroup key="b" label="">
    <div />
  </FieldGroup>,

  // Required needs visible words, not just the attribute or an asterisk.
  // @ts-expect-error requiredLabel is required when required is set
  <FieldGroup key="c" label="Payment method" required>
    <div />
  </FieldGroup>,

  // Options go in as children.
  // @ts-expect-error children are required
  <FieldGroup key="e" label="Payment method" />,
];
