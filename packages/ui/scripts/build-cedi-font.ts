/**
 * Builds the two self-hosted faces (ADR 0001, ADR 0007), both from OFL packages and both subset here, so
 * the repository holds exactly the bytes a browser downloads:
 *
 * - **The cedi face.** Noto Sans, variable weight, subset to U+20B5 alone, so GH₵ renders on devices whose
 *   system fonts lack it. Downloaded only when the glyph appears (unicode-range).
 * - **The UI face.** Plus Jakarta Sans, variable, the weight axis cut to 400 to 700 (the four weights the
 *   UI uses) and the Latin characters below. It lacks U+20B5, so the cedi face, listed first in the stack,
 *   still draws that one glyph.
 *
 * `--check` writes nothing and exits non-zero if the committed files are stale.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const CEDI = '₵';

/** Inclusive code point ranges, as text. */
function ranges(...spans: [number, number][]): string {
  return spans
    .flatMap(([from, to]) =>
      Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)),
    )
    .join('');
}

/**
 * Basic Latin, Latin-1 (accents in Ghanaian and European names, ×, ·, °), dashes, quotes, the bullet,
 * the ellipsis, the euro, arrows and the minus sign. Twi letters (ɛ, ɔ) are not in the face's Latin
 * subset either way; they fall back to the system font, as they always have.
 */
const UI_TEXT = ranges(
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x131, 0x131],
  [0x152, 0x153],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x2039, 0x203a],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2190, 0x2193],
  [0x2212, 0x2212],
);

const require = createRequire(import.meta.url);
const notoDir = dirname(require.resolve('@fontsource-variable/noto-sans/package.json'));
const jakartaDir = dirname(require.resolve('@fontsource-variable/plus-jakarta-sans/package.json'));
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles/fonts');
const check = process.argv.includes('--check');

const cedi = await subsetFont(
  readFileSync(resolve(notoDir, 'files/noto-sans-latin-ext-wght-normal.woff2')),
  CEDI,
  { targetFormat: 'woff2' },
);
const ui = await subsetFont(
  readFileSync(resolve(jakartaDir, 'files/plus-jakarta-sans-latin-wght-normal.woff2')),
  UI_TEXT,
  { targetFormat: 'woff2', variationAxes: { wght: { min: 400, max: 700, default: 400 } } },
);
const outputs: Record<string, Buffer> = {
  'hakorem-cedi.woff2': cedi,
  'OFL-noto-sans.txt': readFileSync(resolve(notoDir, 'LICENSE')),
  'hakorem-ui.woff2': ui,
  'OFL-plus-jakarta-sans.txt': readFileSync(resolve(jakartaDir, 'LICENSE')),
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
  console.error(`Font files are stale. Run \`pnpm fonts\` and commit: ${stale.join(', ')}`);
  process.exit(1);
}
if (check) console.log('Font files are up to date.');
