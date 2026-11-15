/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { CircleCheck } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const valid = [
  <StatusBadge key="1" tone="good" icon={CircleCheck} label="In stock" />,
  <StatusBadge key="2" tone="critical" variant="strong" icon={CircleCheck} label="Overdue" />,
  <StatusBadge key="3" tone="plum" icon={CircleCheck} label="Quarantined" />,
];

export const invalid = [
  // Colour only: no words.
  // @ts-expect-error label is required
  <StatusBadge key="a" tone="good" icon={CircleCheck} />,

  // An empty label is colour only too.
  // @ts-expect-error label cannot be an empty string
  <StatusBadge key="b" tone="good" icon={CircleCheck} label="" />,

  // Content through children instead of the label.
  // @ts-expect-error children are not accepted
  <StatusBadge key="d" tone="good" icon={CircleCheck} label="In stock">
    In stock
  </StatusBadge>,

  // Categorical hues have no strong fill.
  // @ts-expect-error variant="strong" is only for good, warning, critical and info
  <StatusBadge key="e" tone="violet" variant="strong" icon={CircleCheck} label="Reserved" />,
];
