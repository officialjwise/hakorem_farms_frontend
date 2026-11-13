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
