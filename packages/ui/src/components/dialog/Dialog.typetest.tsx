/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Dialog } from './Dialog';

export const valid = [
  <Dialog key="1" title="Void sale?" closeLabel="Close">
    <p>Body</p>
  </Dialog>,
  <Dialog key="2" open onOpenChange={() => undefined} title="Void sale?" closeLabel="Close" />,
];

export const invalid = [
  // A dialog without a name.
  // @ts-expect-error title is required
  <Dialog key="a" closeLabel="Close" />,

  // An empty title is no name.
  // @ts-expect-error title cannot be an empty string
  <Dialog key="b" title="" closeLabel="Close" />,

  // The close button needs an accessible name.
  // @ts-expect-error closeLabel is required
  <Dialog key="c" title="Void sale?" />,

  // @ts-expect-error closeLabel cannot be an empty string
  <Dialog key="d" title="Void sale?" closeLabel="" />,
];
