import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The budgets every later session inherits (docs/BUILD_PROMPT.md, F0):
 * a keyboard path through every interactive component, and the storefront
 * Lighthouse budget recorded. These tests fail when either drifts.
 */

const components = resolve(__dirname, '../components');
const repo = resolve(__dirname, '../../../..');

/** Components a person operates with a keyboard. Each needs a `KeyboardPath` story that proves it. */
const INTERACTIVE = [
  'table-toolbar',
  'photo-input',
  'button',
  'input',
  'textarea',
  'number-input',
  'money-input',
  'weight-input',
  'date-picker',
  'select',
  'combobox',
  'checkbox',
  'radio',
  'switch',
  'dialog',
  'sheet',
  'popover',
  'tooltip',
  'toast',
  'tabs',
  'pagination',
  'query-boundary',
  'card',
  'table',
  'stat-tile',
  'chart',
  'progress-list',
  'alert-row',
  'confirm-changes',
  'page-header',
] as const;

/** Everything else is display only and needs no key handling. */
const DISPLAY_ONLY = [
  'icon-chip',
  'sparkline',
  'affix-input',
  'animal-tag',
  'avatar',
  'badge',
  'empty-state',
  'error-state',
  'field',
  'field-group',
  'lot-badge',
  'money-display',
  'price-band-display',
  'quantity-display',
  'skeleton',
  'spinner',
  'status-badge',
  'ui-provider',
  'weight-display',
  'alert',
  'donut',
  'unavailable',
  'barcode',
] as const;

describe('keyboard path budget', () => {
  it('classifies every component folder as interactive or display only', () => {
    const folders = readdirSync(components, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const known = [...INTERACTIVE, ...DISPLAY_ONLY].sort();
    expect(folders).toEqual(known);
  });

  it.each(INTERACTIVE)('%s has a KeyboardPath story', (folder) => {
    const stories = readdirSync(resolve(components, folder)).filter((f) =>
      f.endsWith('.stories.tsx'),
    );
    expect(stories.length).toBeGreaterThan(0);
    const source = stories
      .map((f) => readFileSync(resolve(components, folder, f), 'utf8'))
      .join('\n');
    expect(source).toMatch(/export const KeyboardPath\b/);
    expect(source).toMatch(/userEvent\.(tab|keyboard)\(/);
  });

  it.each([...INTERACTIVE, ...DISPLAY_ONLY])('%s has unit tests and stories', (folder) => {
    const files = readdirSync(resolve(components, folder));
    expect(files.some((f) => f.endsWith('.test.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('.stories.tsx'))).toBe(true);
  });
});

describe('storefront Lighthouse budget (docs/PERFORMANCE_BUDGET.md)', () => {
  const budget = JSON.parse(
    readFileSync(resolve(repo, 'lighthouse/budget.json'), 'utf8'),
  ) as Array<{
    timings: Array<{ metric: string; budget: number }>;
    resourceSizes: Array<{ resourceType: string; budget: number }>;
  }>;
  const first = budget[0];

  it('holds largest contentful paint under 2.5 seconds', () => {
    const lcp = first?.timings.find((t) => t.metric === 'largest-contentful-paint');
    expect(lcp?.budget).toBe(2500);
  });

  it('holds the listing page under 300 KB of compressed transfer', () => {
    expect(first?.resourceSizes.find((r) => r.resourceType === 'total')?.budget).toBe(300);
  });

  it('keeps the sub-budgets inside the total', () => {
    const parts = (first?.resourceSizes ?? []).filter((r) => r.resourceType !== 'total');
    const sum = parts.reduce((n, r) => n + r.budget, 0);
    expect(sum).toBeLessThan(300);
  });

  it('is run on a 360 px viewport and fails CI on any accessibility finding', () => {
    expect(existsSync(resolve(repo, 'lighthouse/lighthouserc.json'))).toBe(true);
    const rc = JSON.parse(readFileSync(resolve(repo, 'lighthouse/lighthouserc.json'), 'utf8')) as {
      ci: {
        collect: { settings: { screenEmulation: { width: number } } };
        assert: { assertions: Record<string, [string, { minScore: number }]> };
      };
    };
    expect(rc.ci.collect.settings.screenEmulation.width).toBe(360);
    expect(rc.ci.assert.assertions['categories:accessibility']?.[1].minScore).toBe(1);
  });
});
