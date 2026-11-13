/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { AnimalTag } from './AnimalTag';

export const valid = [
  <AnimalTag key="1" tagNo="GT-0142" />,
  <AnimalTag key="2" tagNo="GT-0142" speciesLabel="Goat" />,
];

export const invalid = [
  // @ts-expect-error tagNo is required
  <AnimalTag key="a" />,

  // @ts-expect-error tagNo cannot be an empty string
  <AnimalTag key="b" tagNo="" />,

  // @ts-expect-error asChild is not accepted: the tag is display only
  <AnimalTag key="c" tagNo="GT-0142" asChild />,

  // @ts-expect-error children are not accepted
  <AnimalTag key="d" tagNo="GT-0142">
    GT-0142
  </AnimalTag>,
];
