/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Card } from './Card';

export const valid = [
  <Card key="1">Body</Card>,
  <Card key="2" selected>
    Body
  </Card>,
  <Card key="3" asChild interactive>
    <a href="/stock">Stock</a>
  </Card>,
];

export const invalid = [
  // Looks clickable but has no link or button to focus.
  // @ts-expect-error interactive requires asChild
  <Card key="a" interactive>
    Body
  </Card>,

  // @ts-expect-error interactive requires asChild to be true
  <Card key="b" interactive asChild={false}>
    Body
  </Card>,
];
