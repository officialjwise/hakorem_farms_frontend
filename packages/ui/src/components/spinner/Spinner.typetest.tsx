/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Spinner } from './Spinner';

export const valid = [
  <Spinner key="1" label="Loading stock" />,
  <Spinner key="2" decorative size="sm" />,
];

export const invalid = [
  // Neither announced nor marked decorative: silent to a screen reader.
  // @ts-expect-error label or decorative is required
  <Spinner key="a" />,

  // An empty label announces nothing.
  // @ts-expect-error label cannot be an empty string
  <Spinner key="b" label="" />,

  // Announced and decorative at once is a contradiction.
  // @ts-expect-error label and decorative are exclusive
  <Spinner key="c" label="Loading" decorative />,
];
