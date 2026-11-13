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

## Decided or assumed in this part, for owner review

- **Weight thousands separator:** comma in the interface and on documents (`1,250.500 kg`), none in exports. Your rule fixed three decimals and the kg suffix but not grouping, so this mirrors money. It is easy to change before any screen uses it.
- **Not applicable in exports:** an empty cell rather than an en dash, so a numeric column still sums.
- **Weight input type:** a decimal string, not a number. Logged as **CR-002**, with money as integer pesewas and weight as kilogram decimal strings, so the backend serialises them that way.
- **Theme on `<html>`:** UIProvider themes its own subtree and portal target, but not `<html>`. The apps (F1) should also set `data-theme` on `<html>`, server-rendered on the storefront to avoid a flash, so page scrollbars and overscroll match. No UIProvider change is needed for that.
- **`@radix-ui/react-dialog`** is a devDependency, used only by the proof story. F0c promotes it to a dependency when it builds Dialog.

## Contract

- CR-002 added (money and weight serialisation). CR-001 remains open.
- Screens moved from the mock to the real API: none (F0 has no screens).

## Questions F0c must bring to the owner before building

These need patterns the references and ADRs 0004 to 0008 do not have. Ask first, as the owner's rule requires.

1. **Dialog and Sheet backdrop:** a scrim needs a colour that is not in the palette, and opacity modifiers are banned. Should it be a new `scrim` token with an alpha value, and in which role?
2. **Group fields:** Field wires exactly one control, but RadioGroup and CheckboxGroup need `fieldset` and `legend`. Should that be a `FieldGroup` sibling, or a Field variant?
3. **Toast viewport:** ADR 0006 puts it in UIProvider. Confirm it is added to UIProvider when Toast is built, not as a separate provider.
4. **The barcode-and-Dialog focus story** (ADR 0004) needs the POS barcode focus trap, which F1 builds. Should F0c build a barcode-input fixture for the story, or defer the story to F1 or F9?

## Opening message for F0c

```text
Read CLAUDE.md if present, docs/SHARED_BRIEF.md, and the F0 section of docs/BUILD_PROMPT.md.
Read docs/sessions/F00-design-system-part1.md and docs/sessions/F00-design-system-part2.md,
then docs/adr/0001 and 0003 to 0008, and docs/ASSUMPTIONS.md.
This is F0c on branch f00-design-system. Do not reopen decisions recorded there.

Button, Table and StatusBadge are the reference shape. UIProvider, Field, formatMoney,
formatWeight and @hakorem/i18n are the foundations. Build on them; never around them.
If a component needs a pattern none of them has, stop and ask me before building it.
Start by asking me the four questions in part 2, in one batch.

Confirm in three lines: the phase, the remaining scope, and the gate. Then build, in order:

1. Primitives on Radix. Overlays use open/onOpenChange and usePortalContainer;
   inputs go inside Field:
   Spinner, Skeleton, Input, Textarea, NumberInput, MoneyInput, WeightInput, Select,
   Combobox, Checkbox, Radio, Switch, DatePicker, Dialog, Sheet, Popover, Tooltip,
   Toast (its viewport in UIProvider), Tabs, Pagination, Badge, Avatar, Card,
   EmptyState, ErrorState.
   Then refactor Button's spinner to Spinner, Table's skeleton bars to Skeleton,
   and TableMessageRow to compose EmptyState and ErrorState.
2. Domain components: MoneyDisplay and WeightDisplay (on formatMoney and formatWeight),
   QuantityDisplay, PriceBandDisplay, AnimalTag, LotBadge.
3. The form system: react-hook-form with Zod resolvers, a per-form FormProvider,
   field-level errors through Field, server error mapping, a dirty-state guard on
   navigation, and submit-once through Button's loading state. A failed money or
   stock operation also leaves something persistent on screen, never a toast alone.
4. Budgets: a keyboard-path test per interactive component, and the storefront
   Lighthouse CI budget recorded.
5. Frontend skills in .claude/skills/: hakorem-screen, hakorem-ui-component,
   hakorem-api-call, hakorem-contract-sync, hakorem-pos-offline, hakorem-money-ui,
   hakorem-storefront-perf, hakorem-a11y, hakorem-frontend-adr. Each has a trigger
   description, a correct and an incorrect example, and stays under 400 lines.
6. A short root CLAUDE.md: what the project is, which surface is which, the contract
   rule, the commands, and the three things that go wrong most often.

Stop at the gate, write docs/sessions/F00-design-system.md, push, and open the PR to main.
```
