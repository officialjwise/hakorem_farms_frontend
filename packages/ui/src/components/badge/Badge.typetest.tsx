/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Badge } from './Badge';

export const valid = [
  <Badge key="1">Goats</Badge>,
  <Badge key="2" tone="accent">
    12
  </Badge>,
];

export const invalid = [
  // A badge with nothing in it.
  // @ts-expect-error children are required
  <Badge key="a" />,

  // Status colours are StatusBadge's job, with an icon and a label.
  // @ts-expect-error only neutral and accent exist
  <Badge key="b" tone="critical">
    Overdue
  </Badge>,
];
