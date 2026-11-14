/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { UIProvider } from './UIProvider';

const toastLabels = { region: 'Notifications', announcement: 'Notification', close: 'Dismiss' };

export const valid = [
  <UIProvider key="1" theme="system" density="comfortable" toastLabels={toastLabels}>
    <p>Storefront</p>
  </UIProvider>,
];

export const invalid = [
  // Every app states its theme and density explicitly; nothing is forgotten by default.
  // @ts-expect-error density is required
  <UIProvider key="a" theme="light" toastLabels={toastLabels}>
    <p>App</p>
  </UIProvider>,

  // @ts-expect-error theme is required
  <UIProvider key="b" density="compact" toastLabels={toastLabels}>
    <p>App</p>
  </UIProvider>,

  // @ts-expect-error "pos" is not a density
  <UIProvider key="c" theme="light" density="pos" toastLabels={toastLabels}>
    <p>App</p>
  </UIProvider>,

  // The words Radix Toast would supply in English must come from the app.
  // @ts-expect-error toastLabels is required
  <UIProvider key="d" theme="light" density="comfortable">
    <p>App</p>
  </UIProvider>,
];
