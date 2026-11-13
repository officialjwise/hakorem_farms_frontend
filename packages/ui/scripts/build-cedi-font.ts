/**
 * Builds the glyph-only cedi face (ADR 0007): Noto Sans (OFL), variable weight,
 * subset to U+20B5 alone, so GH₵ renders on devices whose system fonts lack it.
 * The browser downloads it only when the glyph appears (unicode-range).
 *
 * `--check` writes nothing and exits non-zero if the committed files are stale.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const CEDI = '₵';
const require = createRequire(import.meta.url);
const sourceDir = dirname(require.resolve('@fontsource-variable/noto-sans/package.json'));
const source = resolve(sourceDir, 'files/noto-sans-latin-ext-wght-normal.woff2');
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles/fonts');
const check = process.argv.includes('--check');

const font = await subsetFont(readFileSync(source), CEDI, { targetFormat: 'woff2' });
const outputs: Record<string, Buffer> = {
  'hakorem-cedi.woff2': font,
  'OFL-noto-sans.txt': readFileSync(resolve(sourceDir, 'LICENSE')),
};

const stale: string[] = [];
mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const path = resolve(outDir, name);
  const same = existsSync(path) && readFileSync(path).equals(content);
  if (same) continue;
  if (check) stale.push(name);
  else {
    writeFileSync(path, content);
    console.log(`wrote src/styles/fonts/${name} (${content.length} bytes)`);
  }
}
if (stale.length > 0) {
  console.error(`Cedi font files are stale. Run \`pnpm fonts\` and commit: ${stale.join(', ')}`);
  process.exit(1);
}
if (check) console.log('Cedi font files are up to date.');
