/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { ErrorState } from './ErrorState';

export const valid = [
  <ErrorState key="1" title="Failed" />,
  <ErrorState key="2" title="Failed" reference="3f2a9c1e" referenceLabel="Reference:" />,
];

export const invalid = [
  // @ts-expect-error title is required
  <ErrorState key="a" />,

  // @ts-expect-error title cannot be an empty string
  <ErrorState key="b" title="" />,

  // A reference without the words that explain it.
  // @ts-expect-error referenceLabel is required with reference
  <ErrorState key="c" title="Failed" reference="3f2a9c1e" />,
];
