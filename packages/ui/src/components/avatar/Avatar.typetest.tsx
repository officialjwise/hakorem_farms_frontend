/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Avatar } from './Avatar';

export const valid = [
  <Avatar key="1" name="Ama Mensah" />,
  <Avatar key="2" name="Kofi" size="lg" />,
];

export const invalid = [
  // No name: no accessible name.
  // @ts-expect-error name is required
  <Avatar key="a" />,

  // @ts-expect-error name cannot be an empty string
  <Avatar key="b" name="" />,
];
