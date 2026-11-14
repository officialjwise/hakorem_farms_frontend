/**
 * The console's bundle budget (ADR 0030, docs/PERFORMANCE_BUDGET.md "Console"). Run after `vite build`:
 *
 *   pnpm budget:console
 *
 * It budgets each document's INITIAL LOAD: what the browser must fetch before the first screen renders.
 * From Vite's manifest (dist/.vite/manifest.json) that is the entry chunk, every chunk it imports statically
 * (the `modulepreload` links), the catalogue namespaces the document loads at boot (`ENTRY_NAMESPACES`),
 * and their stylesheets. Each file is gzipped and the sizes added up.
 *
 * What a document loads on demand (a lazy route's chunk) is reported, not budgeted, so the number stays
 * honest as F9 fills the till: a screen added as a lazy route does not move the till's initial load, and a
 * screen added eagerly does.
 *
 * It fails when a document's initial load is over budget, or when the till's initial load contains the back
 * office's entry chunk. Not counted: the service worker and the icons.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ENTRY_DOCUMENT, ENTRY_NAMESPACES, type ConsoleEntry } from '../src/app/entries.ts';

/** Kilobytes (1,000 bytes), gzipped, of the initial load. Owner-confirmed 2026-11-14 (A-F3-17). */
export const CONSOLE_BUDGET: Record<ConsoleEntry, { script: number; style: number }> = {
  pos: { script: 250, style: 15 },
  'back-office': { script: 300, style: 15 },
};

interface ManifestChunk {
  file: string;
  name?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}

const dist = join(import.meta.dirname, '..', 'dist');
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;

const chunk = (key: string): ManifestChunk => {
  const found = manifest[key];
  if (found === undefined)
    throw new Error(`The manifest has no chunk ${key}. Build the console first.`);
  return found;
};

/** A catalogue namespace's chunk is keyed by its JSON file, `…/locales/<lang>/<namespace>.json`. */
const namespaceKeys = Object.keys(manifest).filter((key) =>
  /\/locales\/[^/]+\/[^/]+\.json$/.test(key),
);
const namespaceKey = (namespace: string) => {
  const key = namespaceKeys.find((k) => k.endsWith(`/locales/en/${namespace}.json`));
  if (key === undefined) throw new Error(`The manifest has no catalogue chunk for "${namespace}".`);
  return key;
};

/** Every chunk reachable from `roots` through static imports, and through dynamic ones too if asked. */
function closure(roots: string[], dynamic = false): Set<string> {
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const next = [
      ...(chunk(key).imports ?? []),
      ...(dynamic ? (chunk(key).dynamicImports ?? []) : []),
    ];
    next.filter((k) => !namespaceKeys.includes(k)).forEach(visit);
  };
  roots.forEach(visit);
  return seen;
}

interface Load {
  entryFile: string;
  initial: Set<string>;
  onDemand: Set<string>;
}

function load(entry: ConsoleEntry): Load {
  const entryKey = ENTRY_DOCUMENT[entry];
  const initial = new Set([...closure([entryKey]), ...ENTRY_NAMESPACES[entry].map(namespaceKey)]);
  // Lazy routes: everything reachable through dynamic imports that the initial load does not hold. The
  // catalogue is left out: a document asks for its namespaces at boot (counted above) and never the rest.
  const onDemand = new Set([...closure([entryKey], true)].filter((key) => !initial.has(key)));
  return { entryFile: chunk(entryKey).file, initial, onDemand };
}

const kB = (files: Iterable<string>) =>
  [...new Set(files)].reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length,
    0,
  ) / 1000;
const scripts = (keys: Set<string>) => [...keys].map((key) => chunk(key).file);
const styles = (keys: Set<string>) => [...keys].flatMap((key) => chunk(key).css ?? []);

const loads = { pos: load('pos'), 'back-office': load('back-office') } satisfies Record<
  ConsoleEntry,
  Load
>;

const failures: string[] = [];
for (const entry of Object.keys(CONSOLE_BUDGET) as ConsoleEntry[]) {
  const { initial, onDemand } = loads[entry];
  const budget = CONSOLE_BUDGET[entry];
  const script = kB(scripts(initial));
  const style = kB(styles(initial));
  const label = ENTRY_DOCUMENT[entry].padEnd(11);
  const line = (kind: string, size: number, limit: number) =>
    `${label} initial ${kind.padEnd(6)} ${size.toFixed(1).padStart(6)} kB of ${limit} kB`;
  console.log(line('script', script, budget.script));
  console.log(line('style', style, budget.style));
  console.log(
    `${label} on demand      ${kB(scripts(onDemand)).toFixed(1).padStart(6)} kB in ${onDemand.size} chunks, not budgeted`,
  );
  if (script > budget.script)
    failures.push(`${line('script', script, budget.script)}: over budget`);
  if (style > budget.style) failures.push(`${line('style', style, budget.style)}: over budget`);
}

// The point of two documents: the till never downloads the back office's own code.
if (scripts(loads.pos.initial).includes(loads['back-office'].entryFile)) {
  failures.push(
    `the till's initial load contains the back office's entry chunk ${loads['back-office'].entryFile}`,
  );
}

if (failures.length > 0) {
  console.error(
    `\nThe console is over its budget (docs/PERFORMANCE_BUDGET.md):\n${failures.join('\n')}`,
  );
  process.exit(1);
}
console.log('\nThe console is within its budget.');
