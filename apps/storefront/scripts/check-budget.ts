/**
 * The storefront's script budget per route (docs/PERFORMANCE_BUDGET.md, "Storefront, per route"). Run after
 * `next build`:
 *
 *   pnpm budget:storefront
 *
 * It measures what `next build` reports as a route's first-load JavaScript: the files of the route's page
 * entry in `.next/app-build-manifest.json`, the 103 kB every page shares included, each gzipped, in kilobytes
 * of 1,000 bytes. The root layout's own client chunks are reported beside it, not budgeted, as `next build`
 * leaves them out of its figure too.
 *
 * Budgets:
 * - the two quote pages, 170 kB, enforced (owner, 2026-11-18, F10j): they carry the data layer for the
 *   form's write and for accepting or declining a quote;
 * - the listing pages, 120 kB, the target A-F0-06 set and the owner kept (2026-11-18). Reported against
 *   the target, not enforced here: they measured 121.7 kB before F10j, and Lighthouse enforces the page
 *   budgets against staging in F13. The owner decides whether CI should fail on them now.
 *
 * Every other route is reported, not budgeted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

interface RouteBudget {
  route: string;
  /** The page entry in the app build manifest. */
  entry: string;
  kilobytes: number | null;
  enforced: boolean;
}

const QUOTE_PAGES = 170;
const LISTING_PAGES = 120;

const ROUTES: RouteBudget[] = [
  { route: '/quote', entry: '/quote/page', kilobytes: QUOTE_PAGES, enforced: true },
  { route: '/q/[token]', entry: '/q/[token]/page', kilobytes: QUOTE_PAGES, enforced: true },
  { route: '/', entry: '/page', kilobytes: LISTING_PAGES, enforced: false },
  { route: '/c/[slug]', entry: '/c/[slug]/page', kilobytes: LISTING_PAGES, enforced: false },
  { route: '/search', entry: '/search/page', kilobytes: LISTING_PAGES, enforced: false },
  { route: '/p/[slug]', entry: '/p/[slug]/page', kilobytes: null, enforced: false },
  { route: '/checkout', entry: '/checkout/page', kilobytes: null, enforced: false },
];

const next = join(import.meta.dirname, '..', '.next');
let manifest: { pages: Record<string, string[]> };
try {
  manifest = JSON.parse(readFileSync(join(next, 'app-build-manifest.json'), 'utf8')) as {
    pages: Record<string, string[]>;
  };
} catch {
  throw new Error(
    'No .next/app-build-manifest.json: build the storefront first (pnpm build:storefront).',
  );
}

const gzipped = new Map<string, number>();
function size(file: string): number {
  const known = gzipped.get(file);
  if (known !== undefined) return known;
  const bytes = gzipSync(readFileSync(join(next, file))).length;
  gzipped.set(file, bytes);
  return bytes;
}

function scripts(entry: string): string[] {
  const files = manifest.pages[entry];
  if (files === undefined) throw new Error(`The build has no route entry ${entry}.`);
  return files.filter((file) => file.endsWith('.js'));
}

const kb = (bytes: number) => (bytes / 1000).toFixed(1);
const layoutOnly = (entry: string) => {
  const page = new Set(scripts(entry));
  return (manifest.pages['/layout'] ?? [])
    .filter((file) => file.endsWith('.js') && !page.has(file))
    .reduce((total, file) => total + size(file), 0);
};

const over: string[] = [];
for (const route of ROUTES) {
  const bytes = scripts(route.entry).reduce((total, file) => total + size(file), 0);
  const budget = route.kilobytes;
  const verdict =
    budget === null
      ? 'not budgeted'
      : bytes <= budget * 1000
        ? `of ${budget} kB`
        : `OVER ${budget} kB${route.enforced ? '' : ' (target, not enforced)'}`;
  console.log(
    `${route.route.padEnd(12)} first-load script ${kb(bytes).padStart(6)} kB ${verdict}` +
      `   (+${kb(layoutOnly(route.entry))} kB the root layout's own chunks)`,
  );
  if (budget !== null && route.enforced && bytes > budget * 1000) {
    over.push(`${route.route}: ${kb(bytes)} kB of ${budget} kB`);
  }
}

if (over.length > 0) {
  console.error(`\nThe storefront is over its budget: ${over.join('; ')}.`);
  process.exit(1);
}
console.log('\nThe storefront is within its enforced budgets.');
