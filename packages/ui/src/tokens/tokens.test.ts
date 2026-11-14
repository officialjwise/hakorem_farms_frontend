import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { colors, contrastPairs, TRANSLUCENT, type ColorName, type Role } from './palette';
import { composite, contrastRatio, parseHex, parseHexAlpha } from './contrast';
import { GENERATED_FILES } from './render';

const THEMES = ['light', 'dark'] as const;
const names = Object.keys(colors) as ColorName[];
const roles = (n: ColorName) => colors[n].roles as readonly Role[];

/** Decorative-only tokens, deliberately not held to a contrast minimum. */
const DECORATIVE: readonly ColorName[] = ['border'];

/** Surfaces nothing is written on, so no text pair exists for them. The scrim has its own tests below. */
const NO_TEXT: readonly ColorName[] = ['scrim'];

/** Everything the scrim can be painted over: the page, and surfaces that sit on it. */
const UNDER_SCRIM = ['bg', 'surface', 'surface-sunken', 'surface-hover'] as const;

describe('contrast', () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      it.each(
        contrastPairs
          .filter((p) => p.kind !== 'exempt')
          .map((p) => [p.use, p.fg, p.bg, p.min] as const),
      )('%s: --%s on --%s reaches %d:1', (_use, fg, bg, min) => {
        expect(contrastRatio(colors[fg][theme], colors[bg][theme])).toBeGreaterThanOrEqual(min);
      });
    });
  }
});

describe('palette coverage', () => {
  it('checks every text token against at least one background', () => {
    const covered = new Set(contrastPairs.map((p) => p.fg));
    const unchecked = names.filter((n) => roles(n).includes('text') && !covered.has(n));
    expect(unchecked).toEqual([]);
  });

  it('checks every surface token behind at least one text colour', () => {
    const covered = new Set(contrastPairs.filter((p) => p.kind === 'text').map((p) => p.bg));
    const unchecked = names.filter(
      (n) => roles(n).includes('surface') && !covered.has(n) && !NO_TEXT.includes(n),
    );
    expect(unchecked).toEqual([]);
  });

  it('checks every mark token for 3:1 non-text contrast', () => {
    const covered = new Set(contrastPairs.filter((p) => p.kind === 'non-text').map((p) => p.fg));
    const marks = names.filter(
      (n) => !roles(n).includes('text') && !roles(n).includes('surface') && !DECORATIVE.includes(n),
    );
    expect(marks.filter((n) => !covered.has(n))).toEqual([]);
  });

  it('only pairs tokens in roles they actually have', () => {
    for (const p of contrastPairs) {
      expect(roles(p.bg)).toContain('surface');
      if (p.kind === 'non-text')
        expect(roles(p.fg).some((r) => r === 'line' || r === 'glyph')).toBe(true);
      else expect(roles(p.fg)).toContain('text');
    }
  });

  it('has a #RRGGBB value for every opaque token in both themes', () => {
    for (const n of names.filter((n) => !TRANSLUCENT.includes(n)))
      for (const t of THEMES) expect(colors[n][t]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('has a #RRGGBBAA value for every translucent token, and only those', () => {
    for (const n of TRANSLUCENT)
      for (const t of THEMES) expect(colors[n][t]).toMatch(/^#[0-9A-F]{8}$/);
  });
});

/** Builds #RRGGBB or #RRGGBBAA from channel numbers, so the tests hold no hex literal (the token lint rule applies here too). */
const hex = (...channels: number[]) =>
  `#${channels.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`;

describe('alpha compositing', () => {
  it('reads #RRGGBBAA and refuses #RRGGBB, and the reverse for parseHex', () => {
    expect(parseHexAlpha(hex(255, 0, 0, 128))).toEqual({ rgb: [255, 0, 0], alpha: 128 / 255 });
    expect(() => parseHexAlpha(hex(255, 0, 0))).toThrow();
    expect(() => parseHex(hex(255, 0, 0, 128))).toThrow();
  });

  it.each([
    [
      'fully opaque shows the top colour',
      hex(16, 32, 48, 255),
      hex(255, 255, 255),
      hex(16, 32, 48),
    ],
    [
      'fully transparent shows the base',
      hex(16, 32, 48, 0),
      hex(255, 255, 255),
      hex(255, 255, 255),
    ],
    [
      'black at 50% over white is mid grey',
      hex(0, 0, 0, 128),
      hex(255, 255, 255),
      hex(127, 127, 127),
    ],
    [
      'white at 50% over black is mid grey',
      hex(255, 255, 255, 128),
      hex(0, 0, 0),
      hex(128, 128, 128),
    ],
  ])('%s', (_name, top, base, expected) => {
    expect(composite(top, base)).toBe(expected);
  });
});

describe('scrim (ADR 0004)', () => {
  it('is a surface and nothing else, so only bg-scrim exists', () => {
    expect(roles('scrim')).toEqual(['surface']);
  });

  it.each(THEMES)('%s: dims the page without blacking it out', (theme) => {
    const { alpha } = parseHexAlpha(colors.scrim[theme]);
    expect(alpha).toBeGreaterThanOrEqual(0.4);
    expect(alpha).toBeLessThanOrEqual(0.85);
  });

  for (const theme of THEMES) {
    describe(theme, () => {
      const over = (under: (typeof UNDER_SCRIM)[number]) =>
        composite(colors.scrim[theme], colors[under][theme]);

      it.each(UNDER_SCRIM)(
        'text on the dialog above the scrim over --%s still passes, because the dialog is opaque',
        (under) => {
          // The dialog is painted on --surface, which is opaque, so nothing the scrim does can reach its text...
          expect(TRANSLUCENT).not.toContain('surface');
          // ...and the dialog's own text pairs hold in this theme (the same pairs the contrast tests above run).
          expect(contrastRatio(colors.fg[theme], colors.surface[theme])).toBeGreaterThanOrEqual(7);
          expect(
            contrastRatio(colors['fg-muted'][theme], colors.surface[theme]),
          ).toBeGreaterThanOrEqual(4.5);
          // The scrim composited over the page is a real opaque colour the dialog is measured against.
          expect(over(under)).toMatch(/^#[0-9A-F]{6}$/);
        },
      );

      it.each(UNDER_SCRIM)(
        'the dialog edge stays visible against the scrim over --%s (3:1, by fill or by strong border)',
        (under) => {
          const behind = over(under);
          const byFill = contrastRatio(colors.surface[theme], behind);
          const byBorder = contrastRatio(colors['border-strong'][theme], behind);
          expect(Math.max(byFill, byBorder)).toBeGreaterThanOrEqual(3);
        },
      );
    });
  }
});

describe('the mark / text / fill split', () => {
  const MARKS = ['good', 'warning', 'critical', 'info', 'violet', 'plum', 'clay', 'slate'] as const;

  it.each(MARKS)('--%s is lines and glyphs only, never text or a fill', (mark) => {
    expect([...roles(mark)].sort()).toEqual(['glyph', 'line']);
  });

  it.each(['good', 'warning', 'critical', 'info'] as const)(
    '--%s has text, tint, strong and on-strong companions',
    (s) => {
      expect(roles(`${s}-fg`)).toEqual(['text']);
      expect(roles(`${s}-subtle`)).toEqual(['surface']);
      expect(roles(`${s}-strong`)).toEqual(['surface']);
      expect(roles(`${s}-on`)).toEqual(['text']);
    },
  );

  it('generates no text or fill utility for any mark token', () => {
    const css = GENERATED_FILES['src/styles/generated/color-utilities.css']();
    for (const mark of MARKS) {
      expect(css).not.toMatch(new RegExp(`@utility (text|bg|decoration|caret)-${mark} \\{`));
      expect(css).toMatch(new RegExp(`@utility border-${mark} \\{`));
      expect(css).toMatch(new RegExp(`@utility stroke-${mark} \\{`));
    }
  });
});

describe('marketing tokens', () => {
  it('are scoped to marketing, and only they are', () => {
    for (const n of names) {
      const scope = (colors[n] as { scope?: string }).scope ?? 'app';
      expect(scope).toBe(n.startsWith('brand-marketing') ? 'marketing' : 'app');
    }
  });
});

describe('generated files', () => {
  it.each(Object.entries(GENERATED_FILES))(
    '%s is up to date (run `pnpm tokens`)',
    (rel, render) => {
      expect(readFileSync(resolve(__dirname, '../..', rel), 'utf8')).toBe(render());
    },
  );
});
