/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { QuantityDisplay } from './QuantityDisplay';

declare const maybe: string | null;

export const valid = [
  <QuantityDisplay key="1" quantity="3.000" unit="head" />,
  <QuantityDisplay key="2" quantity={maybe} unit="crates" notApplicableLabel="No count" />,
];

export const invalid = [
  // @ts-expect-error unit is required
  <QuantityDisplay key="a" quantity="3.000" />,

  // @ts-expect-error unit cannot be an empty string
  <QuantityDisplay key="b" quantity="3.000" unit="" />,

  // @ts-expect-error notApplicableLabel is required when quantity can be null
  <QuantityDisplay key="c" quantity={maybe} unit="head" />,
];
