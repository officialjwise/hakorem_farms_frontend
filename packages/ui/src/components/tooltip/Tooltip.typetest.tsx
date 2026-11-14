/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Tooltip } from './Tooltip';

export const valid = [
  <Tooltip key="1" content="Shortcut: F2">
    <button type="button">Tare</button>
  </Tooltip>,
];

export const invalid = [
  // @ts-expect-error content is required
  <Tooltip key="a">
    <button type="button">Tare</button>
  </Tooltip>,

  // @ts-expect-error content cannot be an empty string
  <Tooltip key="b" content="">
    <button type="button">Tare</button>
  </Tooltip>,

  // The trigger must be one element, not text.
  // @ts-expect-error children must be an element
  <Tooltip key="c" content="Shortcut: F2">
    Tare
  </Tooltip>,
];
