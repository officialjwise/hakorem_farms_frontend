/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Plus } from 'lucide-react';
import { Button } from './Button';

export const valid = [
  <Button key="1">Save</Button>,
  <Button key="2" loading={false} loadingLabel="Saving">
    Save
  </Button>,
  <Button key="3" iconOnly aria-label="Add item">
    <Plus />
  </Button>,
  <Button key="4" asChild>
    <a href="/stock">Stock</a>
  </Button>,
];

export const invalid = [
  // An icon-only button without an accessible name.
  // @ts-expect-error aria-label is required when iconOnly
  <Button key="a" iconOnly>
    <Plus />
  </Button>,

  // Loading without the text a screen reader announces.
  // @ts-expect-error loadingLabel is required when loading is passed
  <Button key="b" loading>
    Save
  </Button>,

  // asChild cannot show a loading state.
  // @ts-expect-error loading is not available with asChild
  <Button key="c" asChild loading loadingLabel="Saving">
    <a href="/stock">Stock</a>
  </Button>,

  // A button with no content at all.
  // @ts-expect-error children are required
  <Button key="d" />,
];
