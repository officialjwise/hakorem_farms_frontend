/**
 * Writes the generated token files. `--check` writes nothing and exits non-zero
 * if any committed file is stale, which is how CI keeps them honest.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_FILES } from '../src/tokens/render';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const stale: string[] = [];

for (const [rel, render] of Object.entries(GENERATED_FILES)) {
  const path = resolve(root, rel);
  const next = render();
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === next) continue;
  if (check) {
    stale.push(rel);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next);
    console.log(`wrote ${rel}`);
  }
}

if (stale.length > 0) {
  console.error(
    `Generated token files are stale. Run \`pnpm tokens\` and commit:\n  ${stale.join('\n  ')}`,
  );
  process.exit(1);
}
if (check) console.log('Generated token files are up to date.');
