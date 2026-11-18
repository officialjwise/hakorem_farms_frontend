# HaKorem Farms frontend

The frontend of a production system a Ghanaian livestock, meat and produce business runs trading, stock, money and investor reporting on. The remote is `hakorem_farms_frontend`. You work inside this repository and nowhere else: never edit `../backend/`, and never read `../backend/src/`.

## Start of every session

Read this file, `docs/SHARED_BRIEF.md`, your session's section of `docs/BUILD_PROMPT.md`, and the most recent report in `docs/sessions/`. Do not reopen a decision recorded in `docs/adr/`. One phase per session. Write the handoff report at the end.

## Which surface is which

| Path                  | What it is                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`         | The design system: tokens, components, formatters, forms, Storybook. Built (F0).                                                                                 |
| `packages/i18n`       | react-i18next catalogue, one namespace per feature. Apps call `t()`; `packages/ui` never does.                                                                   |
| `packages/api-client` | Generated from the contract: types, operation table, `call(operationId, …)`. Never hand-edited.                                                                  |
| `packages/data`       | TanStack Query layer: `useApiQuery`, `useApiMutation`, keys, stale times, retry. See DATA_CONVENTIONS.                                                           |
| `apps/storefront`     | Public shop, Next.js 15, server rendered, built for 3G. Shell built (F1); catalogue screens are F7.                                                              |
| `apps/console`        | Installable PWA, Vite: two documents, `index.html` (back office) and `pos.html` (till) (ADR 0030); the real auth client; users, roles, sessions, audit log (F3). |
| `e2e/`                | Playwright and axe specs, Chromium, 360 px, against production builds.                                                                                           |
| `contract/`           | A synced copy of the backend's OpenAPI contract. Never hand-edited.                                                                                              |
| `tooling/lint-tokens` | The `hakorem/token-usage` lint rule.                                                                                                                             |

## The contract rule

`contract/openapi.yaml` is the only truth about the API. Never hand-write an API type, guess a field, or call an endpoint it does not list. If you need something missing, append it to `docs/CONTRACT_REQUESTS.md` and carry on against a mock. Read the contract before raising a request. No screen calls `fetch`, and no screen computes money: totals, tax and margins come from the API. Data goes through `useApiQuery` and `useApiMutation` and the four states through `QueryBoundary`; the rules are in `docs/DATA_CONVENTIONS.md`.

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
pnpm dev:storefront    # Next.js on port 3000
pnpm dev:console       # Vite on port 5173
pnpm test:e2e          # builds both apps (console on HK_API_BASE_URL=/mock), then Playwright with axe
pnpm test:e2e:quarantine  # only the quarantined specs (tag @quarantine, each with its issue)
pnpm screenshots       # builds both apps, then writes docs/screenshots/<phase>/<screen>-<width>.png (tag @screenshots)
pnpm budget:console    # after build:console: fails if the till's or back office's initial load is over budget
pnpm icons:check       # fails if the console icons or manifest are stale
pnpm sync-contract     # copy ../backend/contract, regenerate packages/api-client, typecheck everything
pnpm sync-contract:github [ref]  # the same from GitHub at one commit (default main), no clone; use it in cloud sessions (ADR 0018)
pnpm sync-contract:check  # CI: fails if the contract was hand-edited or the committed client is stale
pnpm dev:mock          # Prism on 4010, from contract/openapi.yaml
pnpm test:integration  # screens and the data layer against the real Prism (starts it itself)
```

Set `HK_API_BASE_URL` to choose the API. Nothing else decides it. `HK_REQUESTED_CONTRACT` (`CR-032,CR-033,CR-038,CR-042,CR-045,CR-046,CR-050`) builds the console against contract requests not yet in the contract; only the e2e and CI builds set it, and a build for any API but `/mock` fails with it set (ADR 0046). When a request lands, `requested/landed.ts` fails the type check until its switch is deleted. For the mock in a browser, run `pnpm dev:mock` and `HK_API_BASE_URL=/mock pnpm dev:console`: the console's dev and preview servers forward `/mock` to Prism and add the staff cookie (ADR 0025). Node tests use `http://127.0.0.1:4010` directly.

Arrive later, named in `docs/BUILD_PROMPT.md`: `test:e2e:staging` and `lighthouse` (F13).

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
- **Every phase opens its own pull request and merges it once CI is green** (owner, 2026-11-16). Do not ask first.
- **A red CI run is re-run only after its cause is named in the PR.** Read the failing job's log, find which test failed and why, and write that in a PR comment before any re-run. Fix the cause; never re-run to get green.
