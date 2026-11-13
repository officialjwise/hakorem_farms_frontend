/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Pagination } from './Pagination';

const base = {
  hasPrevious: false,
  hasNext: true,
  onPrevious: () => undefined,
  onNext: () => undefined,
  previousLabel: 'Previous',
  nextLabel: 'Next',
};

export const valid = [
  <Pagination key="1" label="Stock pages" {...base} />,
  <Pagination key="2" label="Stock pages" {...base} loading loadingLabel="Loading next page" />,
];

export const invalid = [
  // An unnamed landmark.
  // @ts-expect-error label is required
  <Pagination key="a" {...base} />,

  // @ts-expect-error label cannot be an empty string
  <Pagination key="b" label="" {...base} />,

  // Loading without the text a screen reader announces.
  // @ts-expect-error loadingLabel is required when loading is passed
  <Pagination key="c" label="Stock pages" {...base} loading />,
];
