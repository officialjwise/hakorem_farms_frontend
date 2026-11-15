# 0001. Role-typed colour tokens, generated and enforced

- Status: accepted
- Date: 2026-11-13
- Session: F0

## Context

The console runs on a POS counter in daylight and the storefront opens on cheap Android phones, so contrast is a functional requirement. Two failure modes recur in design systems.

- A status colour tuned for an icon (3:1) gets used as text (needs 4.5:1).
- A brand accent leaks into places it should not be.

A comment or a style guide does not stop either one. The owner asked for both to be impossible, not just discouraged.

## Options considered

1. **Tailwind theme colours plus a written guideline.** Every token works in every utility. Misuse is caught in review, if at all.
2. **A TypeScript token object with branded types.** This catches misuse only where colours pass through typed props, and Tailwind class strings bypass it.
3. **Role-typed tokens.** Each colour declares the roles it may play, Tailwind only generates the utilities those roles allow, and a lint rule closes every other route.

## Decision

Option 3.

- **Single source.** `packages/ui/src/tokens/palette.ts` holds every colour, with its light and dark value, its roles (`text`, `surface`, `line`, `glyph`) and its scope (`app` or `marketing`). It is the only TypeScript file allowed to contain a hex value, along with the generator in `render.ts`.
- **Generated artefacts.** `pnpm tokens` writes three files:
  - `generated/tokens.css`: the CSS custom properties, in light, dark and system-preference blocks.
  - `generated/color-utilities.css`: one `@utility` per token per allowed role.
  - `generated/token-manifest.json`: what the lint rules read.

  CI runs `pnpm tokens:check`, and a unit test asserts the committed files match the source.

- **The good / good-strong split.** Status and categorical marks (`good`, `warning`, `critical`, `info`, `violet`, `plum`, `clay`, `slate`) are `line` + `glyph` only. `border-good`, `stroke-good` and `fill-good` exist, but `text-good` and `bg-good` are never generated. Text uses `good-fg`. A fill behind text uses `good-subtle` (tint) or `good-strong` (solid, with `good-on` text).
- **Enforcement beyond the utilities.** `@hakorem/lint-tokens` provides `hakorem/token-usage` for both ESLint and Stylelint. It fails the build on:
  - a token used outside its roles, in a class, inline style, CSS declaration or `@apply`
  - a colour token passed as an arbitrary value (`text-[var(--good)]`, `bg-(--good)`)
  - a colour token aliased into another custom property
  - an opacity modifier on a token
  - any raw hex or colour function
  - the default Tailwind palette, which is also cleared from the theme
  - a marketing token outside `apps/storefront/src/marketing/` or `packages/ui/src/marketing/`
- **Contrast is tested, not asserted.** Every foreground/background pair the components use is listed in `contrastPairs` and checked in both themes. Body text must reach 7:1, because daylight roughly halves perceived contrast. Other text must reach 4.5:1, and control boundaries, focus rings and marks must reach 3:1. Coverage tests fail if a text or surface token is added without a pair. Separately, axe runs against every Storybook story in Chromium in both themes.
- **Marketing accent.** `brand-marketing` (loud green) and `brand-marketing-highlight` (yellow) are reserved for storefront hero and promotional surfaces, so they can match print and social material. The console and POS stay on the muted pine accent.
- **Density.** `data-density="comfortable" | "compact"` on any ancestor swaps control heights, cell padding and type size through CSS variables. Components never branch on density in JavaScript.
- **Type.** The UI uses the platform system font stack: zero bytes on 3G, each device's own hinted face, and tabular figures for money and weight. `--font-display` maps to the same stack until brand typography is supplied (ASSUMPTIONS A-F0-02).

## Consequences

- Adding a colour means adding it to `palette.ts` with roles and contrast pairs, then running `pnpm tokens`. The tests refuse a token nobody has checked.
- Any colour need not covered by the existing roles has to be designed, not improvised inline.
- Utilities for custom tokens are static, so Tailwind opacity modifiers are unavailable. That is intended.
- Revisit if Tailwind gains per-utility colour namespaces natively. The generator could then emit theme keys instead of `@utility` blocks.

## Amendment, 2026-11-15 (F5b): a brighter accent, a deep teal panel and a second chart series

**Why.** The owner saw a reference dashboard (teal accent on a cream field, a deep teal panel for contrast) and asked for the accent to lean brighter and more saturated toward it, on condition that every pair in the contrast matrix still passes AA in both themes, with one accent kept and the sand used for the second data series.

**Values changed.**

| Token          | Light, was → now      | Dark, was → now       |
| -------------- | --------------------- | --------------------- |
| `accent`       | `#0D5C55` → `#0A7468` | `#3DBE98` → `#2EC4A6` |
| `accent-hover` | `#09463F` → `#075A51` | `#62CDAD` → `#5ED3BA` |
| `accent-text`  | `#0D5C55` → `#0A7468` | `#52C6A3` → `#4CCDB0` |
| `focus`        | `#0D5C55` → `#0A7468` | `#3DBE98` → `#2EC4A6` |

Light `accent` goes from HSL 175° 75% 21% to 173° 84% 25%. That is brighter and more saturated, and as far as AA allows: white on it is 5.66:1 and as link text it holds 4.64:1 on the sunken surface (the binding pair). A brighter light value fails link text on `surface-sunken`.

**Tokens added.**

- **`panel`** (surface, `#0C3A35` in both themes): the deep teal panel. A panel is always rendered with `data-theme="dark"` (any element's `data-theme` wins for its subtree), so inside it every token takes its dark value. Its pairs carry `themes: ['dark']`, and the contrast test checks them in the dark theme only (`DARK_ISLAND`).
  - The panel carries no bordered control: `border-strong` reaches only 2.6:1 on it. Its one control, refresh, is a quiet button.
- **`series-2`** (mark: line and glyph; light `#9A6418`, dark `#DDAA5E`): the second chart series, a darker sand. The first series is `accent`, so there is still one accent.
- **`series-1-area`, `series-2-area`** (glyph, decorative): the tint under a line and the hatching on a second-series bar. Nothing is written on them, so like `border` they hold no contrast minimum.

**Re-run, 2026-11-15:** `pnpm --filter @hakorem/ui test:unit src/tokens`, 219 tests, all passed. The 54 pairs that involve the changed or new tokens, tightest first:

| Pair                                      | Theme | Ratio | Minimum |
| ----------------------------------------- | ----- | ----- | ------- |
| `critical` on `panel` (panel bar, out)    | dark  | 3.85  | 3       |
| `series-2` on `bg`                        | light | 4.54  | 3       |
| `accent-text` on `surface-sunken`         | light | 4.64  | 4.5     |
| `accent` / `focus` on `surface-sunken`    | light | 4.64  | 3       |
| `accent` / `focus` on `accent-subtle`     | light | 4.67  | 3       |
| `accent-text` on `surface-hover`          | light | 4.81  | 4.5     |
| `series-2` on `surface`                   | light | 4.87  | 3       |
| `accent-text` on `bg`                     | light | 5.15  | 4.5     |
| `accent-text` on `surface`                | light | 5.53  | 4.5     |
| `accent-fg` on `accent` (primary label)   | light | 5.66  | 4.5     |
| `accent` / `warning` / `focus` on `panel` | dark  | 5.72  | 3       |
| `fg-muted` on `panel`                     | dark  | 6.10  | 4.5     |
| `accent-text` on `panel`                  | dark  | 6.38  | 4.5     |
| `accent-fg` on `accent` (primary label)   | dark  | 7.80  | 4.5     |
| `fg` on `panel`                           | dark  | 10.5  | 7       |

Every other pair in the matrix is unchanged and still passes.

### Amendment, later the same day (F5b): the accent goes back to `#0D5C55` and `#3DBE98`

The owner then set the accent explicitly: `#0D5C55` in light mode and `#3DBE98` in dark mode. These are the F0 values. So `accent`, `accent-hover`, `accent-text` and `focus` are back to their F0 values (`#0D5C55`/`#3DBE98`, `#09463F`/`#62CDAD`, `#0D5C55`/`#52C6A3`, `#0D5C55`/`#3DBE98`). The brighter values in the table above are withdrawn.

The panel and the second series stay. Re-run: 219 contrast tests pass. On the panel, `accent-text` is 5.96:1 (minimum 4.5) and `accent` 5.0:1 or better (minimum 3).

### Amendment, 2026-11-15 (F5c): the console's UI face is Plus Jakarta Sans, self-hosted

**Why.** The owner approved a geometric typeface for the closer pass against the reference template, from three free faces: Figtree, Plus Jakarta Sans and Outfit. Each was set beside the reference's own type (a body face, plus a geometric face for headings and figures) on the same card: the title, a subtitle, a section heading, a figure with its label, a body line and a menu line, at the reference's sizes.

- **Plus Jakarta Sans** matched the reference's set width: every line broke at the same word, and its open geometric capitals and figures read closest to the reference's headings.
- **Figtree and Outfit** set narrower, so the same lines broke later, and Outfit's round forms read further from the body face.

**What ships.**

- **Plus Jakarta Sans** (OFL, `@fontsource-variable/plus-jakarta-sans` 5.3.0, a dev dependency). `scripts/build-cedi-font.ts` subsets it into `src/styles/fonts/hakorem-ui.woff2`, beside the cedi face, and `pnpm fonts:check` keeps it honest in CI.
- **One variable file.** The weight axis is cut to 400 to 700, the only weights the UI uses (`font-normal`, `font-medium`, `font-semibold`, `font-bold`).
- **Latin only.** Basic Latin, Latin-1, dashes, quotes, the bullet, the ellipsis, the euro, arrows and the minus sign.
- **Measured: 17,860 bytes (17.9 KB)**, the only font a back office page needs besides the 1.3 KB cedi face. Four static Latin weights would be 48.6 KB.
- **`font-display: swap`,** with the system stack behind it. Text paints at once in the device's own face and swaps when the file lands, so a 3G connection never shows a blank page, and a failed download changes nothing but the face.
- **The cedi sign.** The face has no U+20B5, so `'HaKorem Cedi'` stays first in every stack and draws that one glyph.
- **Tabular figures.** These survive the subset: `font-variant-numeric: tabular-nums` sets 1111 and 0000 to the same width, so money and weight columns still align.

**Where.**

- **The console only, both documents** (`apps/console/src/styles.css`), and Storybook, so stories look like the console.
- **Not the storefront.** It keeps the system stack, as the storefront performance rules require ("No web fonts for UI", fonts under 20 KB). The face is declared in the design system but downloaded only where a stack names it. Using it on public pages is a separate owner decision (A-F0-02).
- **Not a JavaScript cost.** The bundle budget does not count it.

**The light grey page.** The same pass moved the page off cream so that white cards stand out; see "Amendment (F5c): a light grey page and white cards" below.

### Amendment, 2026-11-15 (F5c): a light grey page and white cards

**Why.** The owner asked for a light grey page with white cards, in both themes, so that every card stands out as it does in the reference. On the cream page (`bg` `#F7F4EC`, `surface` `#FFFCF6`) a card was only one step lighter than the page.

**Values changed.** Text, accent, status and categorical tokens are unchanged.

| Token            | Light, was → now      | Dark, was → now       |
| ---------------- | --------------------- | --------------------- |
| `bg`             | `#F7F4EC` → `#F2F4F3` | `#13120E` → `#0F1110` |
| `surface`        | `#FFFCF6` → `#FFFFFF` | `#1C1A15` → `#1C1F1D` |
| `surface-sunken` | `#EEE8DB` → `#EBEFED` | `#0D0C09` → `#0B0D0C` |
| `surface-hover`  | `#F2ECE0` → `#F1F4F3` | `#2A2720` → `#272B29` |
| `border`         | `#D6CDBA` → `#DCE2DF` | `#332F26` → `#313633` |
| `border-strong`  | unchanged             | `#7A7262` → `#878070` |

- **The light page** is a grey with a trace of the pine accent, so it sits with the accent rather than against it.
- **The dark theme** follows the same rule: the page is darker than the cards, and a card is one clear step lighter.
- **Dark `border-strong`** was lifted because the new dark hover surface left a control boundary on a hovered row at 3.01:1. It is now 3.66:1.

**Re-run, 2026-11-15:** `pnpm --filter @hakorem/ui exec vitest run --project unit src/tokens`, 219 tests, all passed. The tightest pairs on the changed neutrals:

| Pair                                | Theme | Ratio | Minimum |
| ----------------------------------- | ----- | ----- | ------- |
| `border-strong` on `surface-hover`  | dark  | 3.66  | 3       |
| `border-strong` on `surface-sunken` | light | 3.84  | 3       |
| `good` on `bg`                      | light | 3.91  | 3       |
| `border-strong` on `bg`             | light | 4.03  | 3       |
| `accent-text` on `surface-sunken`   | light | 6.76  | 4.5     |
| `accent-text` on `surface-hover`    | dark  | 6.81  | 4.5     |
| `fg-muted` on `surface-hover`       | dark  | 6.97  | 4.5     |
| `fg` on every page surface          | both  | ≥ 7   | 7       |

**Scope.** The neutrals are shared, so the storefront's page also turns grey with white cards. Its F1 shell has no marketing surfaces yet, and the marketing tokens are untouched.
