/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Lock } from 'lucide-react';
import { EmptyState } from './EmptyState';

export const valid = [
  <EmptyState key="1" title="No stock yet" />,
  <EmptyState key="2" title="No stock yet" icon={Lock} compact description="Receive stock." />,
];

export const invalid = [
  // @ts-expect-error title is required
  <EmptyState key="a" />,

  // @ts-expect-error title cannot be an empty string
  <EmptyState key="b" title="" />,
];
