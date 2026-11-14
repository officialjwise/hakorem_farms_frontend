// @vitest-environment node
/**
 * No float arithmetic touches a displayed amount (docs/BUILD_PROMPT.md F2, ADR 0007).
 *
 * Two layers. This file is the static one: no source file in the apps or the data layer may do the things
 * that turn pesewas into a float or format a number with the runtime's locale. The behavioural one is in
 * `api.integration.test.tsx` (every `...Pesewas` from the mock is a safe integer, every `...Kg` a
 * three-place string, and the figures on screen equal the figures sent) and in packages/ui's format tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const SOURCES = [
  'apps/console/src',
  'apps/storefront/src',
  'packages/data/src',
  'packages/api-client/src',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = SOURCES.flatMap((dir) => walk(join(root, dir))).filter(
  (path) => !/\.(test|typetest|integration\.test)\.tsx?$/.test(path),
);

/** Modules that handle time and never an amount: the auth stub rounds a retry delay up to whole seconds. Deleted with the stub in F3. */
const TIME_ONLY = ['apps/console/src/auth/'];

/** What turns an integer amount into a float, or formats with the runtime's locale. */
const FORBIDDEN: [string, RegExp][] = [
  ['parseFloat', /\bparseFloat\s*\(/],
  ['Number.parseFloat', /Number\.parseFloat/],
  ['toFixed', /\.toFixed\s*\(/],
  ['toLocaleString', /\.toLocaleString\s*\(/],
  ['Intl.NumberFormat', /Intl\.NumberFormat/],
  ['division by 100', /\/\s*100\b/],
  ['multiplication by 100', /\*\s*100\b/],
  ['Math.round', /Math\.(round|floor|ceil|trunc)\s*\(/],
  ['unary plus on a value', /[=(,:]\s*\+[a-zA-Z_]/],
];

describe('no float arithmetic touches an amount', () => {
  it('scans the sources it is meant to', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((path) => path.endsWith('hooks.ts'))).toBe(true);
  });

  it.each(FORBIDDEN)('no source file uses %s', (_name, pattern) => {
    const offenders = files
      .filter((path) => !TIME_ONLY.some((dir) => path.includes(dir)))
      .filter((path) => pattern.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });

  it('the rule fires: a file with float money maths is caught', () => {
    const bad = 'const shown = (row.valueAtCostPesewas / 100).toFixed(2);';
    expect(FORBIDDEN.filter(([, pattern]) => pattern.test(bad)).map(([name]) => name)).toEqual([
      'toFixed',
      'division by 100',
    ]);
  });
});
