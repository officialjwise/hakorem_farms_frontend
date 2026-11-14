/**
 * Generates the PWA icons and manifest from the colour tokens (ADR 0013).
 * `pnpm icons` writes them, `pnpm icons:check` fails if they are stale.
 * The icon is an "H" on the accent colour, drawn from rectangles so the SVG and the PNGs match
 * exactly and no image library is needed.
 */
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors } from '../../../packages/ui/src/tokens/palette';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const check = process.argv.includes('--check');

const BG = colors.accent.light;
const FG = colors['accent-fg'].light;

type Rect = readonly [x: number, y: number, w: number, h: number];
/** The glyph on a 100 x 100 grid, inside the maskable safe zone (the middle 60 percent). */
const H: readonly Rect[] = [
  [30, 26, 12, 48],
  [58, 26, 12, 48],
  [30, 44, 40, 12],
];

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

function png(size: number, rounded: boolean): Buffer {
  const bg = rgb(BG);
  const fg = rgb(FG);
  const radius = rounded ? size * 0.2 : 0;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const gx = ((x + 0.5) / size) * 100;
      const gy = ((y + 0.5) / size) * 100;
      const inGlyph = H.some(
        ([rx, ry, rw, rh]) => gx >= rx && gx < rx + rw && gy >= ry && gy < ry + rh,
      );
      // Corner mask for the non-maskable icon.
      const cx = Math.min(x + 0.5, size - x - 0.5);
      const cy = Math.min(y + 0.5, size - y - 0.5);
      const outside =
        rounded && cx < radius && cy < radius && Math.hypot(radius - cx, radius - cy) > radius;
      const [r, g, b] = inGlyph ? fg : bg;
      row.set([r, g, b, outside ? 0 : 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" rx="20" fill="${BG}"/>` +
  H.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FG}"/>`).join(
    '',
  ) +
  `</svg>\n`;

const manifest = {
  name: 'HaKorem Farms console',
  short_name: 'HaKorem',
  description: 'HaKorem Farms back office and point of sale.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: BG,
  background_color: colors.bg.light,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
  shortcuts: [{ name: 'Point of sale', short_name: 'POS', url: '/pos' }],
};

const files: [string, string | Buffer][] = [
  ['icons/icon.svg', svg],
  ['icons/icon-192.png', png(192, true)],
  ['icons/icon-512.png', png(512, true)],
  ['icons/icon-maskable-512.png', png(512, false)],
  ['manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n'],
];

let stale = false;
for (const [name, content] of files) {
  const path = join(root, name);
  if (check) {
    const same = existsSync(path) && Buffer.compare(readFileSync(path), Buffer.from(content)) === 0;
    if (!same) {
      console.error(`Stale: public/${name}. Run pnpm --filter @hakorem/console icons.`);
      stale = true;
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}
if (stale) process.exit(1);
