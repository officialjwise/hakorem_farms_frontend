import type { Decorator, Preview } from '@storybook/react-vite';
import { UIProvider } from '../src/components/ui-provider/UIProvider';
import { toastLabels } from '../src/test/toastLabels';
import '../src/styles/index.css';

type Theme = 'light' | 'dark';
type Density = 'comfortable' | 'compact';

/**
 * Renders the story once per theme and density chosen in the toolbar, or in all
 * four combinations when a story sets `parameters.matrix`. The matrix stories
 * are what the axe test run sees, so both themes are contrast-checked on every run.
 * `parameters.matrixLayout: 'stack'` stacks the four frames for wide stories.
 */
const withThemeAndDensity: Decorator = (Story, { globals, parameters }) => {
  const matrix = parameters.matrix === true;
  const themes: Theme[] =
    matrix || globals.theme === 'both' ? ['light', 'dark'] : [globals.theme as Theme];
  const densities: Density[] =
    matrix || globals.density === 'both'
      ? ['comfortable', 'compact']
      : [globals.density as Density];
  const single = themes.length === 1 && densities.length === 1;
  const stacked = parameters.matrixLayout === 'stack';

  return (
    <div className={single || stacked ? '' : 'grid gap-0 lg:grid-cols-2'}>
      {themes.flatMap((theme) =>
        densities.map((density) => (
          // Each frame is its own app root, as in the apps: one UIProvider per root (ADR 0006).
          <div key={`${theme}-${density}`} className="min-w-0">
            <UIProvider theme={theme} density={density} toastLabels={toastLabels}>
              <section aria-label={`${theme} theme, ${density} density`} className="p-6">
                {single ? null : (
                  <p className="mb-4 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                    {theme} · {density}
                  </p>
                )}
                <Story />
              </section>
            </UIProvider>
          </div>
        )),
      )}
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'both', title: 'Light and dark' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density mode',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable (storefront)' },
          { value: 'compact', title: 'Compact (back office, POS)' },
          { value: 'both', title: 'Both' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', density: 'comfortable' },
  decorators: [withThemeAndDensity],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { expanded: true },
    a11y: {
      // A violation fails the story test, not just a panel warning.
      test: 'error',
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      },
    },
  },
};

export default preview;
