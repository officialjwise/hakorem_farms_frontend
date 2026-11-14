/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { MoneyDisplay } from './MoneyDisplay';

declare const maybe: number | null;

export const valid = [
  <MoneyDisplay key="1" pesewas={123450} />,
  <MoneyDisplay key="2" pesewas={maybe} notApplicableLabel="No threshold" />,
  <MoneyDisplay key="3" pesewas={5n} context="document" negative strong />,
];

export const invalid = [
  // A possibly-null amount must say what the dash means.
  // @ts-expect-error notApplicableLabel is required when pesewas can be null
  <MoneyDisplay key="a" pesewas={maybe} />,

  // Null without words.
  // @ts-expect-error notApplicableLabel is required for null
  <MoneyDisplay key="b" pesewas={null} />,

  // Exports are files, not displays.
  // @ts-expect-error 'export' is not a display context
  <MoneyDisplay key="c" pesewas={1} context="export" />,
];
