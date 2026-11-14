# Frontend build prompt

Lives at `frontend/docs/BUILD_PROMPT.md`. This track runs in its own Claude session, in parallel with the backend, and never edits anything under `backend/`.

## How to run this prompt

You are the lead frontend engineer on the HaKorem Farms Platform. You work inside `frontend/` and nowhere else. The remote is `github.com/officialjwise/hakorem_farms_frontend`, and you never open, read or edit anything under `backend/src/`.

Every session, in this order:

1. Read `docs/SHARED_BRIEF.md`. It carries the business, the domain and the requirements, and it is binding.
2. Read only the section of this file for the session you are running.
3. Run `./scripts/sync-contract.sh`, then read `../backend/docs/CONTRACT_CHANGELOG.md` for anything added since your last session.
4. List `docs/sessions/` and read only the most recent report, plus the backend's most recent report for which modules went live.
5. Confirm the phase, its scope and its gate in three lines, then start.

Five rules particular to this track:

- **The contract is the only truth about the API.** Never hand-write an API type, never guess a field name, never call an endpoint that is not in `contract/openapi.yaml`. Everything comes from the generated client.
- **Build against the mock until the real endpoint exists.** Each session, switch the screens whose backend modules went live from the mock to the real API, and say in your report which ones moved.
- **Missing endpoint, not invented endpoint.** If you need something the contract does not offer, append it to `docs/CONTRACT_REQUESTS.md` with the screen that needs it and the shape you want, then carry on against a local mock override. The backend track reads that file at the start of its next session.
- **Three surfaces, one design system.** The storefront is public, server-rendered and built for slow connections. The console is an installable PWA with two shells, back office and POS, and the POS shell is offline-first from the first line of code rather than retrofitted.
- **Every screen ships with four states**: loading, empty, error and permission denied. A screen with only a happy path is not finished, and this is the most common way frontend work here will fail review.

## F0 — Design system

This runs on day one alongside backend B0. It needs no API and no contract. The gate is a component library someone could assemble screens from without inventing anything.

Build in `packages/ui`:

- **Tokens first**, as CSS custom properties: colour, type scale, spacing, radius, shadow, breakpoints, z-index, in light and dark. Everything downstream references a token, and no raw hex value appears anywhere in the codebase after this session.
- **A brand direction that fits the business**: green and earth tones, warm, farm to table. High contrast is a functional requirement rather than a style preference, because the POS runs on a counter with daylight on the screen and the storefront opens on cheap Android phones.
- **Two density modes.** Comfortable for the storefront, compact for the back office and POS, where an operator wants more rows on screen rather than more whitespace.
- **Primitives on Radix**: Button, Input, Select, Combobox, Checkbox, Radio, Switch, Textarea, DatePicker, NumberInput, MoneyInput, WeightInput, Dialog, Sheet, Popover, Tooltip, Toast, Tabs, Table, Pagination, Badge, Avatar, Card, Skeleton, EmptyState, ErrorState, Spinner.
- **Domain components that will recur everywhere**: MoneyDisplay taking integer pesewas and rendering GHS, WeightDisplay in kilograms to three places, QuantityDisplay with its unit, StatusBadge, PriceBandDisplay, AnimalTag, LotBadge.
- **One form system**, react-hook-form with Zod resolvers, including field-level errors, server error mapping, a dirty-state guard on navigation, and submit-once protection.
- **Storybook**, with a story per component covering every state, and axe checks running against the stories in CI.

Set the budgets in this session so every later one inherits them: WCAG 2.2 level AA, a keyboard path through every interactive component, a 360 px minimum width, and a Lighthouse CI budget for the storefront.

Build no screens here. If you find yourself making a page, stop and go back to the component.

## F1 — The three surfaces

The gate is all three shells running, routing and navigating, with authentication screens working against a stub.

- **`apps/storefront`** on Next.js 15 App Router. Public layout, header, navigation, footer, category routes, product detail route, cart drawer and a checkout route skeleton. Server components by default and client components only where interactivity demands it. Metadata, Open Graph tags and a sitemap route from the start rather than as an SEO pass later.
- **`apps/console`** on React 19 and Vite, installable as a PWA, with two shells behind one build. Back office gets sidebar navigation, dense tables and breadcrumbs. POS gets a full-screen layout, large touch targets, no sidebar, and keyboard-first behaviour with a focus trap that keeps barcode input landing in the right field.
- **Role-aware routing.** Every route declares the permission it needs and renders the permission-denied state when the user lacks it, rather than redirecting silently to a dashboard and leaving them confused.
- **Authentication screens**: login, TOTP challenge, forced password change on first login, forgot and reset password, and session expiry with silent refresh. Build them against a stub auth module that mimics the exact token and cookie behaviour the contract describes, so switching to the real one in F3 is a one-file change.
- **A global error boundary, a toast system, and an offline indicator** in the POS shell, all wired before any screen needs them.
- **Required story, carried over from F0** (owner, 2026-11-13; frontend ADR 0004): the POS barcode focus trap and an open Dialog together. Focus stays in the Dialog while it is open and returns to the barcode field when it closes. Build it against the real POS trap from this session, never a stand-in. F1's gate is not met without it.

No business screens in this session. This one is the skeleton everything else hangs on.

## F2 — Contract, client and the data layer

The gate is the generated client in use, the mock server serving every planned screen, and the data patterns settled. This session is what makes the rest of the track independent of the backend's pace.

- **`scripts/sync-contract.sh`** copies `../backend/contract/openapi.yaml` into `contract/`, regenerates `packages/api-client` with openapi-typescript plus a typed fetch wrapper, and fails loudly if the app no longer compiles against it. CI runs it too, against the committed contract, so a stale client cannot merge.
- **Mock server.** Prism against the contract on port 4010, started by `pnpm dev:mock`. A single environment variable decides whether a build talks to the mock or to a real API base URL. Nothing else, anywhere, makes that decision.
- **Data layer.** TanStack Query with query keys derived from the contract's operation ids. Settle the conventions once and write them into `docs/DATA_CONVENTIONS.md`: stale times per class of data, when optimistic updates are allowed and when they are not, cache invalidation on mutation, retry policy, and error normalisation into the shared error shape.
- **Idempotency.** Every mutation sends a client-generated idempotency key, so a retry on a flaky Ghanaian connection cannot double-charge or double-post.
- **Shared states.** Loading, empty, error and permission-denied components wired directly to query and mutation states, so no screen implements them by hand and they stay consistent.
- **Money and weight.** Integer pesewas in and out, formatted only at the edge of the UI, with a test proving no float arithmetic touches a displayed amount.

Prove the gate with a throwaway screen that lists products from the mock and can be made to show all four states on demand. Delete it before the session closes.

## F3 to F12 — The screen sessions

Ten sessions, one recipe. The table says what each covers and what has to be true before it closes.

| Session | Surface and screens | What proves it |
| --- | --- | --- |
| **F3** | Console: login against the real API, users, roles, permissions, sessions, audit viewer | A wrong-role user sees the permission-denied state, not a broken page |
| **F4** | Console: products, categories, units, grades, weight bands, price lists with effective dates | A price list change can be previewed before it activates |
| **F5** | Console: stock on hand, goods receipt, transfers, adjustments with reason codes, stock take | A storekeeper completes a stock take on a phone, standing in the cold room |
| **F6** | Console: animal register, weights, health, breeding, mortality, feed, processing orders | One animal's full history reads on one screen without scrolling to find it |
| **F7** | Storefront: catalogue, search, filters, product detail, cart, checkout, delivery slots | Checkout completes on a throttled 3G connection and the catch-weight estimate is unmissable |
| **F8** | Console: invoices, receipts, credit notes, statements, document viewer and reprint | A reprint is visibly a reprint, and the tax breakdown matches the API to the pesewa |
| **F9** | POS: sale, barcode and weight capture, split tender, hold and recall, returns, shift open and close | A full sale completes with the network off and syncs exactly once on reconnect |
| **F10** | Console and storefront: quote builder, public request-for-quote form, revisions, acceptance, wholesale accounts, ageing | A customer accepts a quote from a link on their phone |
| **F11** | Console and driver: order list, picking with weight capture, dispatch, route view, proof of delivery | A driver completes a delivery with one bar of signal |
| **F12** | Console: owner dashboard, operational and financial reports, exports, investor portal | The owner reads today's position without asking anyone for help |

### The recipe every screen session follows

1. Read the requirement blocks for these screens, and nothing else from the SRS.
2. Read the backend's latest session report and move any screens whose modules went live from the mock to the real API.
3. Build from existing components. A new component goes into `packages/ui` with a story, never inline in a screen.
4. All four states on every screen: loading, empty, error, permission denied.
5. Keyboard path walked and axe clean before you call anything done.
6. A Playwright spec per primary flow, running against the mock in CI and against staging nightly.
7. Check every screen at 360 px before committing.
8. Commit, push, write the session report naming which screens moved off the mock.

### Two rules that matter more than they look

- **No screen calls `fetch` directly.** Everything goes through the generated client and the query layer, so a contract change surfaces as a type error rather than a runtime surprise in front of a customer.
- **No business calculation in the frontend.** Totals, taxes, margins and distributions come from the API. The frontend formats, it does not compute. The single exception is the POS offline cart, which has to total locally: that calculation is ported from the backend's rules, carries its own test suite asserting exact pesewa values, and is reconciled server-side on sync. If the two ever disagree, the server wins and the difference is flagged, never silently absorbed.

Anything that writes money or stock gets a confirmation step showing the exact amounts first. At a busy counter, an accidental tap is the realistic failure, not a bug.

## F13 — Performance, accessibility, PWA and deploy

The gate is every frontend non-functional target met and evidenced against staging.

- **Performance.** Lighthouse CI against the storefront on a simulated 3G profile: largest contentful paint under 2.5 seconds, a listing page under 300 KB compressed. Fix by cutting payload, never by gaming the metric. Responsive lazy-loaded images, route-level code splitting, font subsetting, and server components wherever interactivity does not demand otherwise.
- **Accessibility.** axe clean on every route, a manual keyboard pass through each primary flow, a screen reader pass on checkout and on the POS sale screen, visible focus everywhere, and contrast verified in both themes.
- **PWA.** A service worker with an explicit caching strategy per route class, the offline queue persisted in IndexedDB following the conflict rules in `../backend/docs/OFFLINE_SYNC.md`, an install prompt, and an update flow that cannot lose a cart or an open sale.
- **The offline test that actually matters.** Disconnect, run fifty POS transactions, reconnect. Exactly fifty land, no duplicates appear, and any stock conflict surfaces for a human rather than resolving itself quietly.
- **End to end against real staging**, covering every acceptance scenario in the shared brief that has a user interface.
- **Deploy.** Storefront and console built in CI and shipped to the VPS as the shared brief's deployment section describes, with a frontend smoke suite: storefront loads, catalogue renders, login works, POS shell boots with the network off.

Run the browser matrix on real devices wherever you can. A cheap Android phone on a weak connection tells you more here than any flagship will.

## Frontend skills to generate

Generate these in `frontend/.claude/skills/` during F0, in the same format as the backend's: YAML frontmatter with a `name` and a `description` written as a trigger rather than a summary, a body under roughly 400 lines, and a correct and an incorrect example in every one.

| Skill | Fires when | What it enforces |
| --- | --- | --- |
| `hakorem-screen` | Building or changing any screen | The four states, permission declaration, component reuse, the 360 px check, a Playwright spec |
| `hakorem-ui-component` | Adding anything to `packages/ui` | Token-only styling, both density modes, a story per state, axe, keyboard behaviour, no business logic |
| `hakorem-api-call` | Touching data fetching or mutation | Generated client only, query key convention, idempotency key, error normalisation, never a direct `fetch` |
| `hakorem-contract-sync` | A session starts, or the contract changed | Running the sync script, reading the changelog, handling a breaking change, writing a contract request |
| `hakorem-pos-offline` | Any POS or driver screen | IndexedDB queue shape, client-generated ids, conflict rules, server-wins reconciliation, the network-off test |
| `hakorem-money-ui` | Displaying or capturing money or weight | Integer pesewas, formatting only at the edge, no float arithmetic, GHS presentation, weight to three places |
| `hakorem-storefront-perf` | Changing any public page | Image handling, bundle budget, server against client components, the Lighthouse gate |
| `hakorem-a11y` | Any interactive work | The WCAG 2.2 AA checklist, keyboard path, focus management, labels, contrast in both themes |
| `hakorem-frontend-adr` | A structural or dependency decision is made | House ADR format, numbering, linking from the architecture notes |

Also write `CLAUDE.md` at the frontend root, and keep it short: what the project is, which surface is which, the contract rule, the commands, and the three things that go wrong most often.

## Commands, testing and the session report

```bash
pnpm setup
pnpm dev:mock           # Prism against the contract on port 4010
pnpm dev:storefront     # Next.js
pnpm dev:console        # Vite PWA, back office and POS shells
pnpm sync-contract      # pull the contract across, regenerate the client
pnpm test:unit          # Vitest and Testing Library
pnpm test:integration   # a screen against the running mock server
pnpm test:e2e           # Playwright against the mock
pnpm test:e2e:staging   # Playwright against the deployed staging API
pnpm test:a11y          # axe across routes and stories
pnpm lighthouse
pnpm storybook
```

The test layers mirror the backend's. Unit covers components and hooks. Integration runs a screen against the real Prism mock, never against a mocked `fetch`, because a mocked fetch only proves the mock agrees with itself. End to end covers whole flows in Playwright. Smoke runs after deploy.

Commits and branches follow the backend prompt's conventions, with session naming such as `f05-stock-screens`. Push before the session closes, after running `git remote -v` and confirming it shows `hakorem_farms_frontend`.

The session report goes at `docs/sessions/<ID>-<slug>.md` in the same shape as the backend's, with two lines this track must never omit: which screens moved from the mock to the real API, and what you added to `docs/CONTRACT_REQUESTS.md` this session. Those two lines are how the other track knows what you need.
