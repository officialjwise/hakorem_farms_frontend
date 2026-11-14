# F0 design system, part 2 of 3 (F0b: foundations)

- Session: F0b, run in the same chat as part 1 at the owner's direction, with reduced scope (the three foundations only)
- Date: 2026-11-13
- Branch: `f00-design-system`, pushed to `origin`
- Gate: **not yet reached.** F0c builds the components on these foundations.

## Built

### 1. UIProvider with a themed portal target (ADR 0004, 0006)

- **`UIProvider({ theme, density })`:** renders the app root (`data-slot="ui-root"`) and a sibling portal target (`data-slot="ui-portal"`) carrying the same `data-theme` and `data-density`. `theme` and `density` are required. `system` omits `data-theme`, so the device preference applies.
- **Exactly one:** mounting a UIProvider inside another throws.
- **`usePortalContainer()`:** every overlay passes this to Radix `Portal`'s `container`. It returns null until the target mounts, and an overlay renders nothing until then, because Radix treats a null container as `<body>`. It throws outside a UIProvider.
- **Storybook:** the decorator mounts one UIProvider per frame, like an app root.
- **Proof story:** `Foundations/UIProvider › DialogInDarkCompact` holds the page light and opens a Radix Dialog in a dark compact app. It asserts the dialog sits outside the app root and inside the portal target, and checks the dialog's own computed background, text colour and a 32px compact button. It fails when the dialog portals to `<body>`; that was tested.

### 2. Field (ADR 0005)

- **One control, wired by Field:** `Field({ label, hint?, error?, required?, requiredLabel?, children })` passes its single child control the generated id, label association, `aria-describedby` (error first, then hint), `aria-invalid` and `required`. It does this through Radix `Slot`, the same mechanism as Button's `asChild`, so no new pattern. Controls wire nothing themselves.
- **Label:** `label` is required. An empty literal is a compile error, and a blank label throws.
- **Errors:** invalid exactly when `error` has text. An empty string means no error, so a red border without words cannot happen.
- **Required:** the `required` attribute plus visible `requiredLabel` text inside the label. The accessible name is "Weight (kg) Required", and the attribute announces the state.
- **Proof:** five compile-time misuse cases are rejected. The `Wiring` story checks the accessible name, description, validity and required state in Chromium.

### 3. Formatting, the cedi glyph and translation (ADR 0007, 0008)

- **Formatters:** `formatMoney(pesewas, { context })` and `formatWeight(kg, { context })` in `packages/ui/src/format`. Integer pesewas (number or bigint) and kilogram decimal strings go in, with no float arithmetic and no Intl.

  | Context   | Money          | Weight         |
  | --------- | -------------- | -------------- |
  | interface | `GH₵1,234.50`  | `1,250.500 kg` |
  | document  | `GHS 1,234.50` | `1,250.500 kg` |
  | export    | `1234.50`      | `1250.500`     |
  - ASCII minus.
  - `null` renders as an en dash, or an empty cell in exports.
  - Floats, unsafe integers and weights with more than three places are refused, not rounded.
  - 63 tests cover boundaries, negatives, zero and negative zero, bigint, and refused inputs.

- **Cedi glyph:** a 1.3 KB glyph-only face, Noto Sans (OFL) variable weight subset to U+20B5. `pnpm fonts` builds it and `pnpm fonts:check` runs in CI; the output is deterministic.
  - It is listed first in the sans and mono stacks with `unicode-range: U+20B5`, so it downloads only when GH₵ appears. The OFL licence ships beside it.
  - The `Foundations/Formatting › CediSignInSubsetFace` story asserts the face loads for U+20B5 and draws the glyph itself. It fails with a face that lacks the glyph; that was tested.
- **Translation:** react-i18next in `packages/i18n` (`createI18n({ namespaces })`), with one JSON file per namespace per language, each loaded by dynamic import so bundlers split them.
  - Keys are typed: a misspelt key or an unknown namespace is a compile error.
  - Tests refuse number, currency and date formatting in any string, and any language missing keys.
  - The catalogue holds only the labels the foundations need: `field.required`, `error.reference`, `error.tryAgain`.

### Checks at the tip

All pass:

- tokens and fonts checks, lint, format and typecheck (including every `.typetest`)
- 268 ui unit tests, 5 i18n tests and 37 lint-rule tests
- 27 Storybook stories with axe in Chromium

## Decided in this part, and the owner's answers (2026-11-13)

- **Weight thousands separator:** comma in the interface and on documents (`1,250.500 kg`), none in exports, mirroring money. **Accepted**, and confirmed in ADR 0007.
- **Not applicable in exports:** an empty cell rather than an en dash, because a dash breaks the column sum. **Accepted**, and confirmed in ADR 0007.
- **CR-002, money and weight shapes:** **withdrawn and closed.** Contract 1.0.0 already sent both shapes, so this was answered before it was raised (see Contract below).
- **Theme on `<html>`, for F1:** UIProvider themes its own subtree and portal target, but not `<html>`. The apps should also set `data-theme` on `<html>`, rendered on the server for the storefront to avoid a flash, so page scrollbars and overscroll match. No UIProvider change is needed.
- **`@radix-ui/react-dialog`** is a devDependency, used only by the proof story. F0c promotes it to a dependency when it builds Dialog.

## Contract

- **Synced:** contract 1.1.0 is now in `contract/openapi.yaml`.
  - It was copied byte for byte from backend `f437489`; the contract last changed at `bb63f93`.
  - `scripts/sync-contract.sh` and the generated client are still F2 scope, so this sync was a plain copy.
  - Prettier ignores `contract/`.
- **Confirmed against 1.1.0:**
  - `Kilograms` is a string with exactly three places, never a JSON number.
  - `Pesewas` is an int64 integer from 0 to 2^53 − 1, never a float.
  - A value that does not apply is `anyOf` the schema or `null`.
- **CR-002:** closed in `docs/CONTRACT_REQUESTS.md`, with a note that it was answered before it was raised. It was written without checking the contract.
- **CR-001:** remains open.
- **Screens moved from the mock to the real API:** none (F0 has no screens).

## The four questions, answered by the owner (binding)

1. **Backdrop:** add a `scrim` token with the alpha in its value, because opacity modifiers are banned.
   - It has a light and a dark value.
   - A contrast test checks that text on the dialog above it still passes in both themes.
   - Recorded in ADR 0004.
   - The role is assumed to be `surface` (A-F0-04), for the owner to review at F0c's gate.
2. **Groups:** a separate FieldGroup on `fieldset` and `legend`.
   - It owns the group label, hint, error and `aria-describedby`.
   - Each option keeps its own label.
   - Field is not stretched to cover groups.
   - It is a new pattern, so it has its own ADR, 0009.
3. **Toast:** confirmed, the viewport goes inside UIProvider (ADR 0006).
4. **Barcode-and-Dialog focus story:** deferred to F1, with no stand-in, because a stand-in proves only that the stand-in works.
   - Added to the F1 section of `docs/BUILD_PROMPT.md` as a required story, and recorded in ADR 0004.

## Opening message for F0c

```text
Read CLAUDE.md if present, docs/SHARED_BRIEF.md, and the F0 section of docs/BUILD_PROMPT.md.
Read docs/sessions/F00-design-system-part1.md and docs/sessions/F00-design-system-part2.md,
then docs/adr/0001 and 0003 to 0009, docs/ASSUMPTIONS.md and docs/CONTRACT_REQUESTS.md.
This is F0c on branch f00-design-system. Do not reopen decisions recorded there.

Button, Table and StatusBadge are the reference shape. UIProvider, Field, formatMoney,
formatWeight and @hakorem/i18n are the foundations. Build on them; never around them.
If a component needs a pattern none of them has, stop and ask me before building it.

Already answered, and binding. Do not ask these again:
- Backdrop: a `scrim` token with its alpha in the value (#RRGGBBAA), light and dark.
  Opacity modifiers stay banned. A contrast test composites it over the page background
  and checks that text on the dialog above it still passes in both themes. parseHex
  reads only #RRGGBB today, so add the compositing. Role: surface (A-F0-04). ADR 0004.
- Groups: FieldGroup on fieldset and legend, separate from Field. It owns the group
  label, hint, error and aria-describedby; each option keeps its own label. ADR 0009.
- Toast: its viewport goes inside UIProvider, never a separate provider. ADR 0006.
- The barcode-and-Dialog focus story is not F0c scope. It is a required F1 story.
- Contract 1.1.0 is in contract/openapi.yaml, and CR-002 is closed. Pesewas is an
  integer and never negative; direction travels in a separate field. Kilograms is a
  string with exactly three places. A null can carry a meaning (a null thresholdPesewas
  means "always"), so read the field's description before showing an en dash.

Confirm in three lines: the phase, the remaining scope, and the gate. Then build, in order:

1. The scrim token and its contrast test, before any overlay.
2. Primitives on Radix. Overlays use open/onOpenChange and usePortalContainer;
   a single control goes inside Field, a radio or checkbox group inside FieldGroup:
   Spinner, Skeleton, Input, Textarea, NumberInput, MoneyInput, WeightInput, Select,
   Combobox, FieldGroup, Checkbox, Radio, Switch, DatePicker, Dialog, Sheet, Popover,
   Tooltip, Toast, Tabs, Pagination, Badge, Avatar, Card, EmptyState, ErrorState.
   Promote @radix-ui/react-dialog to a dependency when you build Dialog.
   Then refactor Button's spinner to Spinner, Table's skeleton bars to Skeleton,
   and TableMessageRow to compose EmptyState and ErrorState.
3. Domain components: MoneyDisplay and WeightDisplay (on formatMoney and formatWeight),
   QuantityDisplay, PriceBandDisplay, AnimalTag, LotBadge.
4. The form system: react-hook-form with Zod resolvers, a per-form FormProvider,
   field-level errors through Field and FieldGroup, server error mapping, a dirty-state
   guard on navigation, and submit-once through Button's loading state. A failed money
   or stock operation also leaves something persistent on screen, never a toast alone.
5. Budgets: a keyboard-path test per interactive component, and the storefront
   Lighthouse CI budget recorded.
6. Frontend skills in .claude/skills/: hakorem-screen, hakorem-ui-component,
   hakorem-api-call, hakorem-contract-sync, hakorem-pos-offline, hakorem-money-ui,
   hakorem-storefront-perf, hakorem-a11y, hakorem-frontend-adr. Each has a trigger
   description, a correct and an incorrect example, and stays under 400 lines.
7. A short root CLAUDE.md: what the project is, which surface is which, the contract
   rule, the commands, and the three things that go wrong most often. Include the rule
   that git add, git commit and git push run as three separate commands: the permission
   classifier refuses them chained in one (&&, ; or a pipe). Follow it yourself too.

Stop at the gate, write docs/sessions/F00-design-system.md, push, and open the PR to main.
```
