/**
 * The console's bundle budget (ADR 0030, docs/PERFORMANCE_BUDGET.md "Console"). Run after `vite build`:
 *
 *   pnpm budget:console
 *
 * It budgets each document's INITIAL LOAD: what the browser must fetch before the first screen renders.
 * From Vite's manifest (`.vite/manifest.json`) that is the entry chunk, every chunk it imports statically
 * (the `modulepreload` links), the catalogue namespaces the document loads at boot (`ENTRY_NAMESPACES`),
 * and their stylesheets. Each file is gzipped and the sizes added up.
 *
 * What a document loads on demand (a lazy route's chunk) is reported, not budgeted, so the number stays
 * honest as F9 fills the till: a screen added as a lazy route does not move the till's initial load, and a
 * screen added eagerly does.
 *
 * Two builds (ADR 0058): the console's (`dist/`, the till and the back office) and the investor portal's
 * own (`dist-investor/`, `pnpm build:investor`). Build both first.
 *
 * It fails when a document's initial load is over budget, when the till's initial load contains the back
 * office's entry chunk, when the console's build holds the portal's document, or when the portal's build
 * holds a document or an entry of the console's. Not counted: the service worker and the icons.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ENTRY_DOCUMENT, ENTRY_NAMESPACES, type ConsoleEntry } from '../src/app/entries.ts';
import { INVESTOR_DOCUMENT, INVESTOR_NAMESPACES } from '../src/investor/entry.ts';

type Document = ConsoleEntry | 'investor';

/** Kilobytes (1,000 bytes), gzipped, of the initial load. Owner-confirmed 2026-11-14 (A-F3-17). */
export const CONSOLE_BUDGET: Record<Document, { script: number; style: number }> = {
  pos: { script: 250, style: 15 },
  'back-office': { script: 300, style: 15 },
  // The investor portal opens on a phone (ADR 0058, A-F12-02): the till's budget.
  investor: { script: 250, style: 15 },
};

interface ManifestChunk {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}

/** One build's output folder and the chunk graph Vite wrote for it. */
class Build {
  readonly manifest: Record<string, ManifestChunk>;
  readonly namespaceKeys: string[];

  constructor(
    readonly dist: string,
    readonly command: string,
  ) {
    let text: string;
    try {
      text = readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8');
    } catch {
      throw new Error(`${dist} has no .vite/manifest.json. Run ${command} first.`);
    }
    this.manifest = JSON.parse(text) as Record<string, ManifestChunk>;
    // A catalogue namespace's chunk is keyed by its JSON file, `…/locales/<lang>/<namespace>.json`.
    this.namespaceKeys = Object.keys(this.manifest).filter((key) =>
      /\/locales\/[^/]+\/[^/]+\.json$/.test(key),
    );
  }

  chunk(key: string): ManifestChunk {
    const found = this.manifest[key];
    if (found === undefined)
      throw new Error(`${this.dist}'s manifest has no chunk ${key}. Run ${this.command} first.`);
    return found;
  }

  namespaceKey(namespace: string): string {
    const key = this.namespaceKeys.find((k) => k.endsWith(`/locales/en/${namespace}.json`));
    if (key === undefined)
      throw new Error(`The manifest has no catalogue chunk for "${namespace}".`);
    return key;
  }

  /** Every chunk reachable from `roots` through static imports, and through dynamic ones too if asked. */
  closure(roots: string[], dynamic = false): Set<string> {
    const seen = new Set<string>();
    const visit = (key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      const chunk = this.chunk(key);
      const next = [...(chunk.imports ?? []), ...(dynamic ? (chunk.dynamicImports ?? []) : [])];
      next.filter((k) => !this.namespaceKeys.includes(k)).forEach(visit);
    };
    roots.forEach(visit);
    return seen;
  }
}

const root = join(import.meta.dirname, '..');
const consoleBuild = new Build(join(root, 'dist'), 'pnpm build:console');
const investorBuild = new Build(join(root, 'dist-investor'), 'pnpm build:investor');

interface Load {
  build: Build;
  document: string;
  entryFile: string;
  initial: Set<string>;
  onDemand: Set<string>;
}

function load(build: Build, document: string, namespaces: string[]): Load {
  const initial = new Set([
    ...build.closure([document]),
    ...namespaces.map((namespace) => build.namespaceKey(namespace)),
  ]);
  // Lazy routes: everything reachable through dynamic imports that the initial load does not hold. The
  // catalogue is left out: a document asks for its namespaces at boot (counted above) and never the rest.
  const onDemand = new Set([...build.closure([document], true)].filter((key) => !initial.has(key)));
  return { build, document, entryFile: build.chunk(document).file, initial, onDemand };
}

const kB = (build: Build, files: Iterable<string>) =>
  [...new Set(files)].reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(build.dist, file))).length,
    0,
  ) / 1000;
const scripts = (load: Load, keys: Set<string>) =>
  [...keys].map((key) => load.build.chunk(key).file);
const styles = (load: Load, keys: Set<string>) =>
  [...keys].flatMap((key) => load.build.chunk(key).css ?? []);

const loads = {
  pos: load(consoleBuild, ENTRY_DOCUMENT.pos, ENTRY_NAMESPACES.pos),
  'back-office': load(consoleBuild, ENTRY_DOCUMENT['back-office'], ENTRY_NAMESPACES['back-office']),
  investor: load(investorBuild, INVESTOR_DOCUMENT, INVESTOR_NAMESPACES),
} satisfies Record<Document, Load>;

const failures: string[] = [];
for (const entry of Object.keys(CONSOLE_BUDGET) as Document[]) {
  const current = loads[entry];
  const budget = CONSOLE_BUDGET[entry];
  const script = kB(current.build, scripts(current, current.initial));
  const style = kB(current.build, styles(current, current.initial));
  const label = current.document.padEnd(13);
  const line = (kind: string, size: number, limit: number) =>
    `${label} initial ${kind.padEnd(6)} ${size.toFixed(1).padStart(6)} kB of ${limit} kB`;
  console.log(line('script', script, budget.script));
  console.log(line('style', style, budget.style));
  console.log(
    `${label} on demand      ${kB(current.build, scripts(current, current.onDemand))
      .toFixed(1)
      .padStart(6)} kB in ${current.onDemand.size} chunks, not budgeted`,
  );
  if (script > budget.script)
    failures.push(`${line('script', script, budget.script)}: over budget`);
  if (style > budget.style) failures.push(`${line('style', style, budget.style)}: over budget`);
}

// The point of separate documents: the till never downloads the back office's own code.
if (scripts(loads.pos, loads.pos.initial).includes(loads['back-office'].entryFile)) {
  failures.push(
    `${ENTRY_DOCUMENT.pos}'s initial load contains the back office's entry chunk ${loads['back-office'].entryFile}`,
  );
}
// The portal is its own build on its own host (ADR 0058): neither build carries the other's documents.
if (consoleBuild.manifest[INVESTOR_DOCUMENT] !== undefined) {
  failures.push(`The console's build holds ${INVESTOR_DOCUMENT}: the portal is its own build.`);
}
const consoleEntries = new Set([
  ...Object.values(ENTRY_DOCUMENT),
  ...Object.values(consoleBuild.manifest)
    .filter((chunk) => chunk.isEntry === true && chunk.src !== undefined)
    .map((chunk) => chunk.src as string),
]);
for (const [key, chunk] of Object.entries(investorBuild.manifest)) {
  if (chunk.isEntry === true && key !== INVESTOR_DOCUMENT) {
    failures.push(`The investor portal's build has a second entry, ${key}.`);
  }
  if (consoleEntries.has(key) || (chunk.src !== undefined && consoleEntries.has(chunk.src))) {
    failures.push(`The investor portal's build holds the console's ${key}.`);
  }
}

if (failures.length > 0) {
  console.error(
    `\nThe console is over its budget (docs/PERFORMANCE_BUDGET.md):\n${failures.join('\n')}`,
  );
  process.exit(1);
}
console.log('\nThe console is within its budget.');
