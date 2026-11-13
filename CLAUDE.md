# HaKorem Farms frontend

The frontend of a production system a Ghanaian livestock, meat and produce business runs trading, stock, money and investor reporting on. The remote is `hakorem_farms_frontend`. You work inside this repository and nowhere else: never edit `../backend/`, and never read `../backend/src/`.

## Start of every session

Read this file, `docs/SHARED_BRIEF.md`, your session's section of `docs/BUILD_PROMPT.md`, and the most recent report in `docs/sessions/`. Do not reopen a decision recorded in `docs/adr/`. One phase per session. Write the handoff report at the end.

## Which surface is which

| Path                  | What it is                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/ui`         | The design system: tokens, components, formatters, forms, Storybook. Built (F0).                     |
| `packages/i18n`       | react-i18next catalogue, one namespace per feature. Apps call `t()`; `packages/ui` never does.       |
| `apps/storefront`     | Public shop, Next.js, server rendered, built for 3G. Not built yet (F1).                             |
| `apps/console`        | Installable PWA with two shells: back office (dense tables) and POS (offline first). Not built (F1). |
| `contract/`           | A synced copy of the backend's OpenAPI contract. Never hand-edited.                                  |
| `tooling/lint-tokens` | The `hakorem/token-usage` lint rule.                                                                 |

## The contract rule

`contract/openapi.yaml` is the only truth about the API. Never hand-write an API type, guess a field, or call an endpoint it does not list. If you need something missing, append it to `docs/CONTRACT_REQUESTS.md` and carry on against a mock. Read the contract before raising a request. No screen calls `fetch`, and no screen computes money: totals, tax and margins come from the API.

## Commands that exist today

```bash
pnpm setup             # install, then check tokens and fonts
pnpm tokens            # regenerate colour tokens from palette.ts
pnpm tokens:check      # fails if the generated tokens are stale
pnpm fonts:check       # fails if the cedi glyph face is stale
pnpm lint              # ESLint (with hakorem/token-usage) and Stylelint
pnpm typecheck         # tsc, including every .typetest
pnpm test:unit         # Vitest: components, formatters, contrast, lint rules
pnpm test:a11y         # every story in Chromium with axe, WCAG 2.2 AA
pnpm storybook         # port 6006
pnpm build-storybook
pnpm format:check
```

Arrive later, named in `docs/BUILD_PROMPT.md`: `pnpm dev:mock`, `dev:storefront`, `dev:console`, `sync-contract`, `test:integration`, `test:e2e`, `test:e2e:staging` and `lighthouse` (F1, F2 and F13).

## Skills (`.claude/skills/`)

| Skill                     | Fires when                                        |
| ------------------------- | ------------------------------------------------- |
| `hakorem-screen`          | Building or changing any screen                   |
| `hakorem-ui-component`    | Adding anything to `packages/ui`                  |
| `hakorem-api-call`        | Touching data fetching or mutation                |
| `hakorem-contract-sync`   | A session starts, or the contract changed         |
| `hakorem-pos-offline`     | Any POS or driver screen                          |
| `hakorem-money-ui`        | Displaying or capturing money, weight or quantity |
| `hakorem-storefront-perf` | Changing any public page                          |
| `hakorem-a11y`            | Any interactive work                              |
| `hakorem-frontend-adr`    | A structural or dependency decision is made       |

## The three things that go wrong most often

1. **A control or state with no words.** An unlabelled input, a placeholder as a label, or status shown only in colour. This is what `Field`, `StatusBadge` and `useRequireLabel` exist to stop, and it is the first review finding on every component.
2. **The wrong colour route.** A raw hex, an opacity modifier, or a mark token such as `critical` used as text. `hakorem/token-usage` fails the build; use `-fg` for text, `-subtle` or `-strong` for fills, and add a contrast pair for anything new.
3. **Money formatted or computed outside the formatters.** `toLocaleString`, a float, or a total summed on the client. Use `formatMoney`, `formatWeight` and `formatQuantity`, take totals from the API, and keep cost and price as separate fields (CR-001).

## Rules that bite

- **A new pattern needs the owner first.** Button, Table, StatusBadge, UIProvider and Field are the reference shape. A new stylesheet, context, provider or variant mechanism is a question, not a decision.
- **Every screen ships four states** (loading, empty, error, permission denied) and every component ships its four states with a story each (ADR 0010).
- **A failed money or stock operation leaves persistent words on screen.** A toast alone fails review.
- **Check at 360 px**, in both themes and both densities.
- **Git: run `git add`, `git commit` and `git push` as three separate commands.** The permission classifier refuses them chained with `&&`, `;` or a pipe. Likewise run each check on its own: a pipe in a shell chain hides a failing exit code.
- Before pushing, run `git remote -v` and confirm it shows `hakorem_farms_frontend`. Conventional Commits, one concern per commit, tests in the same commit as the code.
