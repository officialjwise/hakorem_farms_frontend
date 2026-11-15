/**
 * Colour tokens: the single source of truth for every colour in the frontend.
 *
 * This is the only TypeScript file allowed to contain hex values (the
 * `hakorem/token-usage` lint rule enforces that). `pnpm tokens` generates the CSS
 * custom properties, the Tailwind utilities and the lint manifest from it.
 *
 * Palette: "Pine & Sand", chosen in F0. See docs/adr/0001-design-tokens.md.
 */

/**
 * What a colour may be used for. Tailwind only generates the utilities a role
 * allows, and the lint rule rejects every other route (arbitrary values, inline
 * styles, raw CSS).
 *
 * - `text`    colour of text, or of an icon drawn in the text colour (`text-*`)
 * - `surface` a fill that text may sit on (`bg-*`)
 * - `line`    borders, dividers, outlines, rings, row edges (`border-*`, `ring-*`, `edge-*`)
 * - `glyph`   SVG fill or stroke of an icon or dot (`fill-*`, `stroke-*`)
 *
 * Status and categorical "mark" tokens such as `good` are `line` + `glyph` only.
 * They reach 3:1 for non-text contrast, not 4.5:1 for text, so they can never be
 * text and can never sit behind text. Use `good-fg` for text, `good-subtle` or
 * `good-strong` for fills.
 */
export type Role = 'text' | 'surface' | 'line' | 'glyph';

/** `marketing` tokens are only usable in storefront hero and promotional code. */
export type Scope = 'app' | 'marketing';

export interface ColorToken {
  readonly light: string;
  readonly dark: string;
  readonly roles: readonly Role[];
  readonly scope?: Scope;
  readonly use: string;
}

const MARK = ['line', 'glyph'] as const;

export const colors = {
  // Neutrals
  bg: { light: '#F7F4EC', dark: '#13120E', roles: ['surface'], use: 'Page background' },
  surface: { light: '#FFFCF6', dark: '#1C1A15', roles: ['surface'], use: 'Cards, tables, inputs' },
  'surface-sunken': {
    light: '#EEE8DB',
    dark: '#0D0C09',
    roles: ['surface'],
    use: 'Table header, recessed wells, skeletons',
  },
  'surface-hover': {
    light: '#F2ECE0',
    dark: '#2A2720',
    roles: ['surface'],
    use: 'Hover on rows and quiet buttons. Darker in light, lighter in dark: hover lifts, it never sinks.',
  },
  scrim: {
    light: '#221E168C',
    dark: '#000000B3',
    roles: ['surface'],
    use: 'Backdrop behind Dialog and Sheet. The alpha is in the value (#RRGGBBAA) because opacity modifiers are banned. Nothing is written on it.',
  },
  border: {
    light: '#D6CDBA',
    dark: '#332F26',
    roles: ['line'],
    use: 'Decorative rules and card edges. Not for identifying a control.',
  },
  'border-strong': {
    light: '#827661',
    dark: '#7A7262',
    roles: ['line'],
    use: 'Input and control boundaries (3:1, WCAG 1.4.11)',
  },
  fg: { light: '#221E16', dark: '#F0ECE2', roles: ['text'], use: 'Body text' },
  'fg-muted': {
    light: '#50483A',
    dark: '#BCB4A3',
    roles: ['text'],
    use: 'Secondary text, headers',
  },
  'fg-disabled': {
    light: '#9C9483',
    dark: '#6E6858',
    roles: ['text'],
    use: 'Disabled control text only. Exempt under WCAG 1.4.3; never for content.',
  },

  // Accent
  accent: {
    light: '#0A7468',
    dark: '#2EC4A6',
    roles: ['surface', ...MARK],
    use: 'Primary action fill, selection bar',
  },
  'accent-hover': {
    light: '#075A51',
    dark: '#5ED3BA',
    roles: ['surface'],
    use: 'Primary action hover',
  },
  'accent-fg': { light: '#FFFFFF', dark: '#03201A', roles: ['text'], use: 'Text on accent' },
  'accent-text': {
    light: '#0A7468',
    dark: '#4CCDB0',
    roles: ['text'],
    use: 'Links, accent text on page',
  },
  'accent-subtle': {
    light: '#DCEDEA',
    dark: '#12302A',
    roles: ['surface'],
    use: 'Selected row, accent tint',
  },
  'accent-subtle-fg': {
    light: '#0A4741',
    dark: '#9BDDC8',
    roles: ['text'],
    use: 'Text on accent tint',
  },
  focus: { light: '#0A7468', dark: '#2EC4A6', roles: ['line'], use: 'Focus ring' },

  // The deep teal panel: a dark island for one highlighted figure group (the dashboard's stock health).
  // It is always rendered with data-theme="dark", so only its dark value is ever shown; the light value
  // is the same colour, and its pairs are checked in the dark theme only (DARK_ISLAND below).
  panel: {
    light: '#0C3A35',
    dark: '#0C3A35',
    roles: ['surface'],
    use: 'Deep teal panel behind a dark-theme island (data-theme="dark")',
  },

  // Chart series. The first series is the accent; the second is the warm sand, so there is still one
  // accent. Series are told apart by line style and marker shape as well as hue (ADR 0033).
  'series-2': {
    light: '#9A6418',
    dark: '#DDAA5E',
    roles: MARK,
    use: 'Second chart series (sand): line, marker, bar. Never text.',
  },
  'series-1-area': {
    light: '#D4ECE8',
    dark: '#123A33',
    roles: ['glyph'],
    use: 'Decorative area under the first series. Nothing is written on it.',
  },
  'series-2-area': {
    light: '#F3E6D0',
    dark: '#3A2C16',
    roles: ['glyph'],
    use: 'Decorative area under the second series, and the second series hatching ground.',
  },

  // Status: good
  good: { light: '#3B8A2F', dark: '#A3CC5C', roles: MARK, use: 'Good: icon, dot, border only' },
  'good-fg': { light: '#25622A', dark: '#BCDC8A', roles: ['text'], use: 'Good: text' },
  'good-subtle': { light: '#E3F1E0', dark: '#232F18', roles: ['surface'], use: 'Good: badge tint' },
  'good-strong': {
    light: '#25622A',
    dark: '#A3CC5C',
    roles: ['surface'],
    use: 'Good: solid fill behind text',
  },
  'good-on': {
    light: '#FFFFFF',
    dark: '#142008',
    roles: ['text'],
    use: 'Good: text on solid fill',
  },

  // Status: warning
  warning: {
    light: '#A35F00',
    dark: '#E3A33B',
    roles: MARK,
    use: 'Warning: icon, dot, border only',
  },
  'warning-fg': { light: '#7A4600', dark: '#F0C27A', roles: ['text'], use: 'Warning: text' },
  'warning-subtle': {
    light: '#FCEFD6',
    dark: '#3A2A12',
    roles: ['surface'],
    use: 'Warning: badge tint',
  },
  'warning-strong': {
    light: '#7A4600',
    dark: '#E3A33B',
    roles: ['surface'],
    use: 'Warning: solid fill behind text',
  },
  'warning-on': {
    light: '#FFFFFF',
    dark: '#1F1400',
    roles: ['text'],
    use: 'Warning: text on solid fill',
  },

  // Status: critical
  critical: {
    light: '#A11B14',
    dark: '#E8655A',
    roles: MARK,
    use: 'Critical: icon, dot, border only',
  },
  'critical-fg': { light: '#8A1A13', dark: '#F6A198', roles: ['text'], use: 'Critical: text' },
  'critical-subtle': {
    light: '#FBE3DF',
    dark: '#3D1A17',
    roles: ['surface'],
    use: 'Critical: badge tint',
  },
  'critical-strong': {
    light: '#8A1A13',
    dark: '#E8655A',
    roles: ['surface'],
    use: 'Critical: solid fill behind text, danger button',
  },
  'critical-strong-hover': {
    light: '#6E140E',
    dark: '#EF8379',
    roles: ['surface'],
    use: 'Danger button hover',
  },
  'critical-on': {
    light: '#FFFFFF',
    dark: '#2A0B08',
    roles: ['text'],
    use: 'Critical: text on solid fill',
  },

  // Status: info
  info: { light: '#2F5F9E', dark: '#6FA3E6', roles: MARK, use: 'Info: icon, dot, border only' },
  'info-fg': { light: '#234B80', dark: '#A2C4F0', roles: ['text'], use: 'Info: text' },
  'info-subtle': { light: '#E3EBF6', dark: '#182A40', roles: ['surface'], use: 'Info: badge tint' },
  'info-strong': {
    light: '#234B80',
    dark: '#6FA3E6',
    roles: ['surface'],
    use: 'Info: solid fill behind text',
  },
  'info-on': {
    light: '#FFFFFF',
    dark: '#0A1628',
    roles: ['text'],
    use: 'Info: text on solid fill',
  },

  // Categorical: stock and payment states that are not good / warning / critical
  violet: { light: '#6B4FA6', dark: '#A98BE3', roles: MARK, use: 'Reserved, refunded: mark' },
  'violet-fg': {
    light: '#55398C',
    dark: '#C9B6F0',
    roles: ['text'],
    use: 'Reserved, refunded: text',
  },
  'violet-subtle': {
    light: '#EEE8F7',
    dark: '#2A2140',
    roles: ['surface'],
    use: 'Reserved, refunded: tint',
  },
  plum: {
    light: '#9A2F6E',
    dark: '#E07BB5',
    roles: MARK,
    use: 'Quarantined, vet hold, unallocated: mark',
  },
  'plum-fg': {
    light: '#7C2257',
    dark: '#EDA8CF',
    roles: ['text'],
    use: 'Quarantined, vet hold, unallocated: text',
  },
  'plum-subtle': {
    light: '#F7E4EE',
    dark: '#3A1A2C',
    roles: ['surface'],
    use: 'Quarantined, vet hold, unallocated: tint',
  },
  clay: { light: '#A0522D', dark: '#DB8E62', roles: MARK, use: 'Expiring soon: mark' },
  'clay-fg': { light: '#7E3F20', dark: '#ECB496', roles: ['text'], use: 'Expiring soon: text' },
  'clay-subtle': {
    light: '#F6E7DD',
    dark: '#3A2316',
    roles: ['surface'],
    use: 'Expiring soon: tint',
  },
  slate: {
    light: '#5E6670',
    dark: '#9AA3AD',
    roles: MARK,
    use: 'Sold, written off, unpaid not due, voided: mark',
  },
  'slate-fg': {
    light: '#454C55',
    dark: '#C0C7CE',
    roles: ['text'],
    use: 'Sold, written off, unpaid not due, voided: text',
  },
  'slate-subtle': {
    light: '#ECEEF0',
    dark: '#262A2F',
    roles: ['surface'],
    use: 'Sold, written off, unpaid not due, voided: tint',
  },

  // Marketing: storefront hero and promotional surfaces only. Provisional values,
  // to be replaced with the print and social brand colours (docs/ASSUMPTIONS.md A-F0-01).
  'brand-marketing': {
    light: '#2DB84B',
    dark: '#2DB84B',
    roles: ['surface', ...MARK],
    scope: 'marketing',
    use: 'Loud brand green: hero and promo fills',
  },
  'brand-marketing-fg': {
    light: '#06200D',
    dark: '#06200D',
    roles: ['text'],
    scope: 'marketing',
    use: 'Text on brand green',
  },
  'brand-marketing-highlight': {
    light: '#FFD23F',
    dark: '#FFD23F',
    roles: ['surface', ...MARK],
    scope: 'marketing',
    use: 'Loud brand yellow: promo highlights',
  },
  'brand-marketing-highlight-fg': {
    light: '#2A2000',
    dark: '#2A2000',
    roles: ['text'],
    scope: 'marketing',
    use: 'Text on brand yellow',
  },
} as const satisfies Record<string, ColorToken>;

export type ColorName = keyof typeof colors;

/** Tokens whose value carries an alpha channel (#RRGGBBAA). Every other token is opaque #RRGGBB. */
export const TRANSLUCENT: readonly ColorName[] = ['scrim'];

/**
 * Shadow colour per theme. Not a utility: it only feeds the shadow tokens. Dark
 * themes lean on borders for elevation because shadows vanish on dark surfaces.
 */
export const shadowColor = { light: '#3A2E12', dark: '#000000' } as const;

export type PairKind = 'text' | 'non-text' | 'exempt';

export interface ContrastPair {
  readonly fg: ColorName;
  readonly bg: ColorName;
  readonly min: number;
  readonly kind: PairKind;
  readonly use: string;
  /** Themes the pair is shown in. Omitted means both. A dark island's pairs are 'dark' only. */
  readonly themes?: readonly ('light' | 'dark')[];
}

/** Surfaces only ever rendered inside data-theme="dark": checked against dark-theme foregrounds only. */
export const DARK_ISLAND: readonly ColorName[] = ['panel'];

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
/** Body text is held to AAA because sun on a counter screen roughly halves perceived contrast. */
const DAYLIGHT_BODY = 7;

const PAGE_SURFACES = [
  'bg',
  'surface',
  'surface-sunken',
  'surface-hover',
] as const satisfies readonly ColorName[];
const STATUSES = ['good', 'warning', 'critical', 'info'] as const;
const CATEGORIES = ['violet', 'plum', 'clay', 'slate'] as const;

/** Every foreground/background pairing the components use. The contrast test checks each in both themes. */
export const contrastPairs: readonly ContrastPair[] = [
  ...PAGE_SURFACES.flatMap((bg): ContrastPair[] => [
    { fg: 'fg', bg, min: DAYLIGHT_BODY, kind: 'text', use: 'Body text' },
    { fg: 'fg-muted', bg, min: AA_TEXT, kind: 'text', use: 'Secondary text' },
    { fg: 'accent-text', bg, min: AA_TEXT, kind: 'text', use: 'Link text' },
    { fg: 'border-strong', bg, min: AA_NON_TEXT, kind: 'non-text', use: 'Control boundary' },
    { fg: 'focus', bg, min: AA_NON_TEXT, kind: 'non-text', use: 'Focus ring' },
    { fg: 'accent', bg, min: AA_NON_TEXT, kind: 'non-text', use: 'Primary button against page' },
    { fg: 'fg-disabled', bg, min: 0, kind: 'exempt', use: 'Disabled text (WCAG 1.4.3 exception)' },
  ]),
  { fg: 'accent-fg', bg: 'accent', min: AA_TEXT, kind: 'text', use: 'Primary button label' },
  {
    fg: 'accent-fg',
    bg: 'accent-hover',
    min: AA_TEXT,
    kind: 'text',
    use: 'Primary button label, hover',
  },
  { fg: 'fg', bg: 'accent-subtle', min: DAYLIGHT_BODY, kind: 'text', use: 'Text in selected row' },
  {
    fg: 'fg-muted',
    bg: 'accent-subtle',
    min: AA_TEXT,
    kind: 'text',
    use: 'Secondary text in selected row',
  },
  {
    fg: 'accent-subtle-fg',
    bg: 'accent-subtle',
    min: AA_TEXT,
    kind: 'text',
    use: 'Accent tint text',
  },
  {
    fg: 'accent',
    bg: 'accent-subtle',
    min: AA_NON_TEXT,
    kind: 'non-text',
    use: 'Selected row edge',
  },
  {
    fg: 'focus',
    bg: 'accent-subtle',
    min: AA_NON_TEXT,
    kind: 'non-text',
    use: 'Focus ring in selected row',
  },
  {
    fg: 'critical-on',
    bg: 'critical-strong-hover',
    min: AA_TEXT,
    kind: 'text',
    use: 'Danger button label, hover',
  },
  ...STATUSES.flatMap((s): ContrastPair[] => [
    { fg: `${s}-fg`, bg: `${s}-subtle`, min: AA_TEXT, kind: 'text', use: `${s}: badge text` },
    { fg: `${s}-fg`, bg: 'surface', min: AA_TEXT, kind: 'text', use: `${s}: inline text` },
    { fg: `${s}-fg`, bg: 'bg', min: AA_TEXT, kind: 'text', use: `${s}: inline text on page` },
    {
      fg: `${s}-fg`,
      bg: 'surface-hover',
      min: AA_TEXT,
      kind: 'text',
      use: `${s}: inline text, hovered row`,
    },
    {
      fg: `${s}-on`,
      bg: `${s}-strong`,
      min: AA_TEXT,
      kind: 'text',
      use: `${s}: text on solid fill`,
    },
    { fg: s, bg: 'surface', min: AA_NON_TEXT, kind: 'non-text', use: `${s}: icon or border` },
    { fg: s, bg: 'bg', min: AA_NON_TEXT, kind: 'non-text', use: `${s}: icon or border on page` },
    {
      fg: s,
      bg: `${s}-subtle`,
      min: AA_NON_TEXT,
      kind: 'non-text',
      use: `${s}: icon inside badge`,
    },
  ]),
  ...CATEGORIES.flatMap((c): ContrastPair[] => [
    { fg: `${c}-fg`, bg: `${c}-subtle`, min: AA_TEXT, kind: 'text', use: `${c}: badge text` },
    { fg: c, bg: 'surface', min: AA_NON_TEXT, kind: 'non-text', use: `${c}: dot or border` },
    {
      fg: c,
      bg: `${c}-subtle`,
      min: AA_NON_TEXT,
      kind: 'non-text',
      use: `${c}: icon inside badge`,
    },
  ]),
  // Chart series against the surfaces a chart sits on.
  ...(['surface', 'bg'] as const).map((bg): ContrastPair => ({
    fg: 'series-2',
    bg,
    min: AA_NON_TEXT,
    kind: 'non-text',
    use: 'Second chart series',
  })),
  // The deep teal panel is a dark island: what it carries, in the dark theme only.
  ...(
    [
      ['fg', DAYLIGHT_BODY, 'text', 'Panel body text'],
      ['fg-muted', AA_TEXT, 'text', 'Panel secondary text'],
      ['accent-text', AA_TEXT, 'text', 'Panel link'],
      ['good-fg', AA_TEXT, 'text', 'Panel good text'],
      ['warning-fg', AA_TEXT, 'text', 'Panel warning text'],
      ['critical-fg', AA_TEXT, 'text', 'Panel critical text'],
      ['focus', AA_NON_TEXT, 'non-text', 'Panel focus ring'],
      ['accent', AA_NON_TEXT, 'non-text', 'Panel bar, available'],
      ['good', AA_NON_TEXT, 'non-text', 'Panel bar, good'],
      ['warning', AA_NON_TEXT, 'non-text', 'Panel bar, low'],
      ['critical', AA_NON_TEXT, 'non-text', 'Panel bar, out'],
      ['series-2', AA_NON_TEXT, 'non-text', 'Panel second series'],
      // No border-strong pair: it reaches only 2.6:1 here, so the panel carries no bordered control.
      // Its one control, refresh, is a quiet button identified by its label and focus ring.
    ] as const
  ).map(([fg, min, kind, use]): ContrastPair => ({
    fg,
    bg: 'panel',
    min,
    kind,
    use,
    themes: ['dark'],
  })),
  {
    fg: 'brand-marketing-fg',
    bg: 'brand-marketing',
    min: AA_TEXT,
    kind: 'text',
    use: 'Text on brand green',
  },
  {
    fg: 'brand-marketing-highlight-fg',
    bg: 'brand-marketing-highlight',
    min: AA_TEXT,
    kind: 'text',
    use: 'Text on brand yellow',
  },
];
