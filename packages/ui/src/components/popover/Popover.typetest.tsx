/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Popover } from './Popover';

export const valid = [
  <Popover key="1" trigger={<button type="button">Weights</button>} label="Recent weights">
    <p>38.400 kg</p>
  </Popover>,
];

export const invalid = [
  // @ts-expect-error label is required
  <Popover key="a" trigger={<button type="button">Weights</button>}>
    <p>38.400 kg</p>
  </Popover>,

  // @ts-expect-error label cannot be an empty string
  <Popover key="b" trigger={<button type="button">Weights</button>} label="">
    <p>38.400 kg</p>
  </Popover>,

  // @ts-expect-error trigger is required
  <Popover key="c" label="Recent weights">
    <p>38.400 kg</p>
  </Popover>,
];
