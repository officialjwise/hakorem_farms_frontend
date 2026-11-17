/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { ErrorState } from './ErrorState';

const COPY = { copy: 'Copy the full reference', copied: 'Copied', failed: 'Could not copy' };

export const valid = [
  <ErrorState key="1" title="Failed" />,
  <ErrorState key="2" title="Failed" reference="3f2a9c1e" referenceLabel="Reference:" />,
  <ErrorState
    key="3"
    title="Failed"
    reference="019a7b1d-f4de-751c-aa55-5aa0965fd37e"
    referenceLabel="Reference:"
    referenceCopy={COPY}
  />,
];

export const invalid = [
  // @ts-expect-error title is required
  <ErrorState key="a" />,

  // @ts-expect-error title cannot be an empty string
  <ErrorState key="b" title="" />,

  // A reference without the words that explain it.
  // @ts-expect-error referenceLabel is required with reference
  <ErrorState key="c" title="Failed" reference="3f2a9c1e" />,

  // A copy button with nothing to copy.
  // @ts-expect-error referenceCopy needs a reference
  <ErrorState key="d" title="Failed" referenceCopy={COPY} />,
];
