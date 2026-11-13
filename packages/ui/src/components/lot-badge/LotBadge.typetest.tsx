/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Clock } from 'lucide-react';
import { LotBadge } from './LotBadge';

export const valid = [
  <LotBadge key="1" batchNo="LOT-1" />,
  <LotBadge key="2" batchNo="LOT-1" expiry={{ label: 'Expired', tone: 'critical', icon: Clock }} />,
];

export const invalid = [
  // @ts-expect-error batchNo is required
  <LotBadge key="a" />,

  // @ts-expect-error batchNo cannot be an empty string
  <LotBadge key="b" batchNo="" />,

  // An expiry state with no icon is colour plus words only.
  // @ts-expect-error icon is required in expiry
  <LotBadge key="c" batchNo="LOT-1" expiry={{ label: 'Expired', tone: 'critical' }} />,

  // An expiry state with no words is colour alone.
  // @ts-expect-error label is required in expiry
  <LotBadge key="d" batchNo="LOT-1" expiry={{ tone: 'critical', icon: Clock }} />,
];
