import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { colors, contrastPairs, type ColorName, type Role } from './palette';
import { contrastRatio } from './contrast';
import { GENERATED_FILES } from './render';

const THEMES = ['light', 'dark'] as const;
const names = Object.keys(colors) as ColorName[];
const roles = (n: ColorName) => colors[n].roles as readonly Role[];

/** Decorative-only tokens, deliberately not held to a contrast minimum. */
const DECORATIVE: readonly ColorName[] = ['border'];

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
    const unchecked = names.filter((n) => roles(n).includes('surface') && !covered.has(n));
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

  it('has a #RRGGBB value for every token in both themes', () => {
    for (const n of names) for (const t of THEMES) expect(colors[n][t]).toMatch(/^#[0-9A-F]{6}$/);
  });
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
