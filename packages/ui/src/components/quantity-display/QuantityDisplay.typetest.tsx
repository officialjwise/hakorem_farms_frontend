/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { QuantityDisplay } from './QuantityDisplay';

declare const maybe: string | null;

export const valid = [
  <QuantityDisplay key="1" quantity="3.000" unit="head" places={0} />,
  <QuantityDisplay key="2" quantity="38.400" unit="kg" places={3} />,
  <QuantityDisplay
    key="3"
    quantity={maybe}
    unit="crates"
    places={0}
    notApplicableLabel="No count"
  />,
];

export const invalid = [
  // @ts-expect-error unit is required
  <QuantityDisplay key="a" quantity="3.000" places={0} />,

  // @ts-expect-error unit cannot be an empty string
  <QuantityDisplay key="b" quantity="3.000" unit="" places={0} />,

  // @ts-expect-error notApplicableLabel is required when quantity can be null
  <QuantityDisplay key="c" quantity={maybe} unit="head" places={0} />,

  // Precision follows the unit, so the caller must say which: no default to fall back on.
  // @ts-expect-error places is required
  <QuantityDisplay key="d" quantity="3.000" unit="head" />,

  // Only 0 to 3 places exist on the wire.
  // @ts-expect-error places cannot be 4
  <QuantityDisplay key="e" quantity="3.000" unit="head" places={4} />,
];
