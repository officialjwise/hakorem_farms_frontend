/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { WeightDisplay } from './WeightDisplay';

declare const maybe: string | null;

export const valid = [
  <WeightDisplay key="1" kilograms="38.400" />,
  <WeightDisplay key="2" kilograms={maybe} notApplicableLabel="Not weighed" />,
  <WeightDisplay key="3" kilograms="1.000" context="document" strong />,
];

export const invalid = [
  // @ts-expect-error notApplicableLabel is required when kilograms can be null
  <WeightDisplay key="a" kilograms={maybe} />,

  // @ts-expect-error 'export' is not a display context
  <WeightDisplay key="b" kilograms="1.000" context="export" />,

  // A JSON number is never a weight.
  // @ts-expect-error kilograms is a string
  <WeightDisplay key="c" kilograms={38.4} />,
];
