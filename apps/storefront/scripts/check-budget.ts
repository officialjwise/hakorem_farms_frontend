/**
 * The storefront's script budget per route (docs/PERFORMANCE_BUDGET.md, "Storefront, per route"). Run after
 * `next build`:
 *
 *   pnpm budget:storefront
 *
 * It measures a route's whole first load of JavaScript (the owner, 2026-11-18, F10m): every file of the
 * route's page entry and of the root layout in `.next/app-build-manifest.json`, each counted once and
 * gzipped, in kilobytes of 1,000 bytes. That is the page `next build` reports (the 103 kB every page shares
 * included) and the layout's own client chunks beside it, which `next build` leaves out of its figure and
 * F10l's budget did too. The page's share is printed beside the whole.
 *
 * Budgets, each for the whole first load, enforced:
 * - the two quote pages, 170 kB (owner, 2026-11-18, F10i): they carry the data layer for the form's write
 *   and for accepting or declining a quote. The quote link page loaded 173,365 bytes counted whole and
 *   was held there; its confirmations loading when the customer starts to answer took it to 158,952;
 * - the listing pages, 120 kB (owner, 2026-11-18; A-F0-06). Counted whole they loaded 124,315 bytes on
 *   F10m's first build; the header's basket button and search box in plain classes, without `Button` and
 *   `Input`, took them to 112,145.
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
  /** The most it may weigh, in bytes, gzipped; CI fails above it. Null: not budgeted. */
  ceiling: number | null;
}

const QUOTE_PAGES = 170_000;
const LISTING_PAGES = 120_000;
const listing = { ceiling: LISTING_PAGES };

const ROUTES: RouteBudget[] = [
  { route: '/quote', entry: '/quote/page', ceiling: QUOTE_PAGES },
  { route: '/q/[token]', entry: '/q/[token]/page', ceiling: QUOTE_PAGES },
  { route: '/', entry: '/page', ...listing },
  { route: '/c/[slug]', entry: '/c/[slug]/page', ...listing },
  { route: '/search', entry: '/search/page', ...listing },
  { route: '/p/[slug]', entry: '/p/[slug]/page', ceiling: null },
  { route: '/checkout', entry: '/checkout/page', ceiling: null },
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
const total = (files: Iterable<string>) => [...files].reduce((sum, file) => sum + size(file), 0);
/** The page's files and the root layout's, each once: what the browser loads for the route. */
const firstLoad = (entry: string) =>
  new Set([
    ...scripts(entry),
    ...(manifest.pages['/layout'] ?? []).filter((f) => f.endsWith('.js')),
  ]);

const over: string[] = [];
for (const route of ROUTES) {
  const bytes = total(firstLoad(route.entry));
  const { ceiling } = route;
  const verdict =
    ceiling === null
      ? 'not budgeted'
      : bytes > ceiling
        ? `OVER ${kb(ceiling)} kB`
        : `of ${kb(ceiling)} kB`;
  console.log(
    `${route.route.padEnd(12)} first-load script ${kb(bytes).padStart(6)} kB ${verdict}` +
      `   (the page ${kb(total(scripts(route.entry)))} kB, as next build reports it; ${bytes} bytes)`,
  );
  if (ceiling !== null && bytes > ceiling)
    over.push(`${route.route}: ${bytes} bytes, over ${ceiling}`);
}

if (over.length > 0) {
  console.error(`\nThe storefront is over its budget: ${over.join('; ')}.`);
  process.exit(1);
}
console.log('\nThe storefront is within its budgets.');
