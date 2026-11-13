/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { UIProvider } from './UIProvider';

export const valid = [
  <UIProvider key="1" theme="system" density="comfortable">
    <p>Storefront</p>
  </UIProvider>,
];

export const invalid = [
  // Every app states its theme and density explicitly; nothing is forgotten by default.
  // @ts-expect-error density is required
  <UIProvider key="a" theme="light">
    <p>App</p>
  </UIProvider>,

  // @ts-expect-error theme is required
  <UIProvider key="b" density="compact">
    <p>App</p>
  </UIProvider>,

  // @ts-expect-error "pos" is not a density
  <UIProvider key="c" theme="light" density="pos">
    <p>App</p>
  </UIProvider>,
];
