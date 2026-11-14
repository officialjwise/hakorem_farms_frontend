/**
 * The console's bundle budget (ADR 0030, docs/PERFORMANCE_BUDGET.md "Console"). Run after `vite build`:
 *
 *   pnpm budget:console
 *
 * For each document it reads what the built HTML makes the browser fetch before anything renders (the entry
 * script, every `modulepreload`, every stylesheet), gzips each file and adds them up. It fails when a
 * document is over its budget, or when the till's document loads the back office's entry chunk.
 *
 * Not counted: the catalogue namespaces each document loads at boot (about 1 to 3 kB gzipped each), the
 * service worker and the icons.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ENTRY_DOCUMENT, type ConsoleEntry } from '../src/app/entries.ts';

/** Kilobytes (1,000 bytes), gzipped. Changing a number is an owner decision, recorded in PERFORMANCE_BUDGET. */
export const CONSOLE_BUDGET: Record<ConsoleEntry, { script: number; style: number }> = {
  pos: { script: 250, style: 15 },
  'back-office': { script: 300, style: 15 },
};

const dist = join(import.meta.dirname, '..', 'dist');

interface DocumentLoad {
  entryScript: string;
  scripts: string[];
  styles: string[];
}

function documentLoad(entry: ConsoleEntry): DocumentLoad {
  const html = readFileSync(join(dist, ENTRY_DOCUMENT[entry]), 'utf8');
  const attribute = (pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1] ?? '');
  const entryScripts = attribute(/<script type="module"[^>]*\ssrc="([^"]+)"/g);
  const preloads = attribute(/<link rel="modulepreload"[^>]*\shref="([^"]+)"/g);
  const styles = attribute(/<link rel="stylesheet"[^>]*\shref="([^"]+)"/g);
  if (entryScripts.length !== 1) {
    throw new Error(`${ENTRY_DOCUMENT[entry]} has ${entryScripts.length} entry scripts, not one.`);
  }
  const entryScript = entryScripts[0] ?? '';
  return { entryScript, scripts: [entryScript, ...preloads], styles };
}

const gzipped = (files: string[]) =>
  files.reduce((sum, file) => sum + gzipSync(readFileSync(join(dist, file))).length, 0) / 1000;

const loads = {
  pos: documentLoad('pos'),
  'back-office': documentLoad('back-office'),
} satisfies Record<ConsoleEntry, DocumentLoad>;

const failures: string[] = [];
for (const entry of Object.keys(CONSOLE_BUDGET) as ConsoleEntry[]) {
  const load = loads[entry];
  const budget = CONSOLE_BUDGET[entry];
  const script = gzipped(load.scripts);
  const style = gzipped(load.styles);
  const line = (kind: string, size: number, limit: number) =>
    `${ENTRY_DOCUMENT[entry].padEnd(11)} ${kind.padEnd(7)} ${size.toFixed(1).padStart(6)} kB of ${limit} kB`;
  console.log(line('script', script, budget.script));
  console.log(line('style', style, budget.style));
  if (script > budget.script)
    failures.push(`${line('script', script, budget.script)}: over budget`);
  if (style > budget.style) failures.push(`${line('style', style, budget.style)}: over budget`);
}

// The point of two documents: the till never downloads the back office's own code.
if (loads.pos.scripts.includes(loads['back-office'].entryScript)) {
  failures.push(`pos.html loads the back office's entry chunk ${loads['back-office'].entryScript}`);
}

if (failures.length > 0) {
  console.error(
    `\nThe console is over its budget (docs/PERFORMANCE_BUDGET.md):\n${failures.join('\n')}`,
  );
  process.exit(1);
}
console.log('\nThe console is within its budget.');
