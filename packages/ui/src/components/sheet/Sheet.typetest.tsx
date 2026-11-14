/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Sheet } from './Sheet';

export const valid = [
  <Sheet key="1" side="end" title="Filter stock" closeLabel="Close" />,
  <Sheet key="2" side="bottom" title="Tender" closeLabel="Close" defaultOpen />,
];

export const invalid = [
  // The edge is required: no default is guessed.
  // @ts-expect-error side is required
  <Sheet key="a" title="Filter stock" closeLabel="Close" />,

  // Logical edges only, so right-to-left works.
  // @ts-expect-error "left" is not a side
  <Sheet key="b" side="left" title="Filter stock" closeLabel="Close" />,

  // @ts-expect-error title cannot be an empty string
  <Sheet key="c" side="end" title="" closeLabel="Close" />,

  // @ts-expect-error closeLabel is required
  <Sheet key="d" side="end" title="Filter stock" />,
];
