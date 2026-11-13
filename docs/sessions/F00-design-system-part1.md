# F0 design system, part 1 of 2

- Session: F0 (continues in "F0 continued")
- Date: 2026-11-13
- Branch: `f00-design-system`, pushed to `origin`, last commit `d58e952`
- Gate: **not yet reached.** This part stopped at a green commit because the session's context was heavy, as the session protocol requires.

## Built

- **Workspace:** pnpm 11 workspace, TypeScript 5.9, ESLint 10, Stylelint 17, Prettier, Vitest 5, Storybook 10.6 and Playwright, all pinned. A two-week minimum release age and a build-script allowlist are in `pnpm-workspace.yaml`. CI is in `.github/workflows/ci.yml`.
- **Tokens (`packages/ui/src/tokens/palette.ts` → `pnpm tokens`):**
  - the Pine & Sand palette in light and dark
  - type scale with the system font stack
  - spacing
  - comfortable and compact density, through `data-density`
  - radius, elevation, z-index, motion and breakpoints (360px floor)
  - the reserved `--brand-marketing` tokens
  - a `--surface-hover` token, so hover lifts in dark and darkens slightly in light
- **Role-typed colour enforcement:**
  - Every colour declares its roles (`text`, `surface`, `line`, `glyph`), and Tailwind generates only those utilities.
  - `hakorem/token-usage` (ESLint and Stylelint, in `tooling/lint-tokens`) blocks every other route.
  - Mark tokens such as `--good` can never be text or a fill behind text.
  - Marketing tokens are confined to marketing code.
  - Raw colours and the Tailwind palette are banned.
- **Contrast is tested:**
  - Every pair in `contrastPairs`, in both themes: body 7:1, text 4.5:1, controls and marks 3:1.
  - Coverage tests refuse an unchecked token.
  - axe runs on every story in Chromium and fails on any WCAG 2.2 AA violation. This gate was proved live with a planted failure.
- **Components:**
  - **Button:** four variants, three density-aware sizes, loading with submit-once, icon-only that requires `aria-label`, `asChild`.
  - **Table:** sortable headers, row headers, numeric columns, selection, sticky header, striping, footer, and loading, empty and error rows. Below 40rem of container width it stacks into label/value blocks by default, with `layout="scroll"` as the opt-out (ADR 0003).
  - **StatusBadge:** `icon` and `label` required, an empty label rejected at compile time and at render, no `children`, `strong` only for the four statuses.
- **Storybook:** a theme and density toolbar, and a `matrix` parameter that renders light/dark × comfortable/compact in every review story.

## Decided

- ADR 0001: role-typed colour tokens, generated and enforced.
- ADR 0002: toolchain versions, and where they are held back (pnpm 11, TypeScript 5.9, jsx-a11y on ESLint 10).
- ADR 0003: tables stack below 40rem by default.
- Owner decisions:
  - Palette: Pine & Sand.
  - Compact table text stays at 14px.
  - Dark hover lifts.
  - The 360px table must show every value without sideways scrolling.

## Assumed (docs/ASSUMPTIONS.md)

- **A-F0-01:** marketing green and yellow are provisional. The owner is sending the print values.
- **A-F0-02:** the display font is the system stack.
- **A-F0-03:** the POS defaults to the light theme.

## Contract

- **CR-001** added to `docs/CONTRACT_REQUESTS.md`: stock valuation at cost, with cost and price as separately named fields and totals from the API.
- Screens moved from the mock to the real API: **none** (F0 has no screens).

## Deferred to F0 continued (the remaining gate scope)

1. **Primitives on Radix**, built to the Button, Table and StatusBadge pattern: Input, Select, Combobox, Checkbox, Radio, Switch, Textarea, DatePicker, NumberInput, MoneyInput, WeightInput, Dialog, Sheet, Popover, Tooltip, Toast, Tabs, Pagination, Badge, Avatar, Card, Skeleton, EmptyState, ErrorState, Spinner.
   - Once Spinner and Skeleton exist, refactor Button's inline spinner and Table's skeleton bars to use them.
   - Once EmptyState and ErrorState exist, `TableMessageRow` should compose them.
2. **Domain components:** MoneyDisplay (integer pesewas → GHS), WeightDisplay (kg to three places), QuantityDisplay, PriceBandDisplay, AnimalTag, LotBadge.
3. **Form system:** react-hook-form with Zod resolvers, field-level errors, server error mapping, a dirty-state guard on navigation, and submit-once protection. Button's loading state is already the submit-once primitive.
4. **Budgets:** a keyboard-path test per interactive component, and a Lighthouse CI budget for the storefront (recorded now, enforced once the storefront exists).
5. **Frontend skills** in `.claude/skills/`: hakorem-screen, hakorem-ui-component, hakorem-api-call, hakorem-contract-sync, hakorem-pos-offline, hakorem-money-ui, hakorem-storefront-perf, hakorem-a11y, hakorem-frontend-adr.
6. **Root `CLAUDE.md`**, short.
7. **Gate report** at `docs/sessions/F00-design-system.md`, then open the pull request from `f00-design-system` to `main`.

## Notes for the next session

- **Owner rule:** Button, Table and StatusBadge are the approved reference. Match their shape exactly. If a component seems to need a pattern they do not have, stop and ask the owner rather than inventing a second way. Examples that count as a new pattern: a component stylesheet like `table.css`, a different way of passing strings, or a new variant mechanism.
- **New components** follow the pattern:
  - token-only classes (lint enforces it), both densities through CSS variables, no copy in components (strings are props)
  - a story with `parameters: { matrix: true }` covering every state, unit tests for behaviour, and a `.typetest.tsx` for any API that must refuse misuse
- **Stacked tables:** pass `label` on every `TableCell`.
- **Review screenshots:** build Storybook, then screenshot `iframe.html?id=<story>&viewMode=story` with Playwright. The script used is described in this session's chat, and is not committed because it is a review aid, not product code.
- **Gotcha:** a pipe in a shell chain hides a failing exit code. Check each gate's exit status separately.

## Opening message for the next session

```text
Read CLAUDE.md if present, docs/SHARED_BRIEF.md, and the F0 section of docs/BUILD_PROMPT.md.
Read docs/sessions/F00-design-system-part1.md, then docs/adr/0001, 0003 and docs/ASSUMPTIONS.md.
This is "F0 continued" on branch f00-design-system. Do not reopen decisions recorded there.

Confirm in three lines: the phase, the remaining scope, and the gate.
Then build the deferred items in order, matching Button, Table and StatusBadge exactly.
If a component needs a pattern they do not have, stop and ask me before building it.
Stop at the gate, write docs/sessions/F00-design-system.md, push, and open the PR to main.
```
