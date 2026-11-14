# F0 design system, part 3 of 3 (F0c: components, forms, budgets, skills)

- Session: F0c, on branch `f00-design-system`
- Date: 2026-11-13
- Gate: **reached, pending the owner's review items below.** The component library is built, and every automated check is green.

## Built

### 1. The scrim token (ADR 0004, A-F0-04)

- `scrim` in `palette.ts`, with its alpha in the value: `#221E168C` light and `#000000B3` dark. Role `surface`, so only `bg-scrim` exists.
- `contrast.ts` gains `parseHexAlpha` and `composite`. `parseHex` still reads only `#RRGGBB`.
- The contrast test composites the scrim over every page surface in both themes and checks that the dialog edge stays visible against it, by fill or by strong border. In light the fill separates (3.7 to 4.2:1), and in dark the border does (4.1 to 4.3:1). Text on the dialog is unaffected, because the dialog is opaque.

### 2. Primitives (27, all on the references' shape)

| Group              | Components                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Loading marks      | Spinner, Skeleton                                                                              |
| Text controls      | Input, Textarea, NumberInput, MoneyInput, WeightInput, DatePicker (plus the shared AffixInput) |
| Pickers            | Select, Combobox                                                                               |
| Choice controls    | FieldGroup, Checkbox, Radio (with RadioGroup), Switch                                          |
| Overlays           | Dialog, Sheet, Popover, Tooltip, Toast                                                         |
| Navigation         | Tabs, Pagination                                                                               |
| Display containers | Badge, Avatar, Card, EmptyState, ErrorState                                                    |

- **Refactors, as asked:** Button's spinner is now `Spinner`, Table's skeleton bars are `Skeleton`, and `TableMessageRow` composes `EmptyState` and `ErrorState`. Rendered output and every existing test are unchanged.
- **Overlays:** all use `open`/`onOpenChange`, portal into the themed target and render nothing until it exists. `@radix-ui/react-dialog` is now a dependency.
- **Toast:** `UIProvider` holds the queue and the viewport (ADR 0006). Screens call `useToast().show(...)`. `UIProvider` now **requires** `toastLabels` (`region`, `announcement`, `close`), so no English lives in the package.
- **Money and weight inputs** parse text with strings and BigInt only. `MoneyInput` holds integer pesewas, `WeightInput` a three-place kilogram string, and neither accepts a keystroke that would break the contract's shape.
- **Pagination is cursor based** (Previous and Next only), because the contract's `PageInfo` has no total and no page numbers.

### 3. Domain components

MoneyDisplay, WeightDisplay, QuantityDisplay, PriceBandDisplay, AnimalTag, LotBadge, plus `formatQuantity` in `format/`. They format and never compute. A value that can be null requires a `notApplicableLabel`, so a screen reader hears words, not "dash". PriceBandDisplay shows selling prices only (CR-001). Whether a lot is expiring is decided by the caller.

### 4. The form system (`packages/ui/src/forms`)

- `Form`: a per-form `FormProvider` on `<form noValidate>`. Submit-once is a ref guard plus Button's `loading`. After a successful submit the form resets to the submitted values, so the dirty guard lets go.
- `FormField` and `FormFieldGroup`: react-hook-form `Controller` onto `Field` and `FieldGroup`, so those two alone own `aria-invalid` and `aria-describedby`.
- `mapServerErrors`: the contract's JSON-pointer `details` become field errors (`/items/0/qty` becomes `items.0.qty`, with the RFC 6901 escapes). What cannot be mapped is returned with the correlation id.
- `FormError`: persistent, role alert, composes `ErrorState`. A failed money or stock operation always leaves it on screen, never only a toast.
- `useDirtyGuard`: `beforeunload` while dirty, plus `blocked`, `requestLeave`, `confirmLeave` and `stay` for a router adapter. Wiring a router is F1.

### 5. Budgets

- **Keyboard path:** `src/test/budgets.test.ts` classifies every component folder as interactive or display only, and fails unless each interactive one has a `KeyboardPath` story that presses real keys. It found three gaps (Button, Table and Toast), which are now filled.
- **Lighthouse:** `lighthouse/budget.json`, `lighthouse/lighthouserc.json` and `docs/PERFORMANCE_BUDGET.md` hold LCP under 2.5 s, a 300 KB listing page, a 360 px viewport, and accessibility 100. The test keeps them equal to the brief. **Recorded, not enforced**, because the storefront does not exist (A-F0-06). F13 adds `@lhci/cli` and `pnpm lighthouse`.

### 6. Skills and `CLAUDE.md`

Nine skills in `.claude/skills/` (52 to 113 lines each, each with a trigger description and a correct and an incorrect example) and a 69-line root `CLAUDE.md`, which includes the rule that `git add`, `git commit` and `git push` run as three separate commands. The skills for the API client, contract sync and the POS offline queue state the rules and say which session builds the tools (F2, F9, F13).

## Checks at the tip

All pass, each run on its own so no pipe hid an exit code:

- `tokens:check`, `fonts:check`, `lint` (ESLint with `hakorem/token-usage`, and Stylelint), `format:check`, `typecheck` (every `.typetest`)
- 666 ui unit tests, 5 i18n tests
- 218 story tests in Chromium with axe at WCAG 2.2 AA, in both themes and both densities
- `build-storybook`
- An audit of `packages/ui/src` finds no raw hex, no `fetch(`, no `toLocaleString`, `Intl` or `parseFloat`, and one lint suppression (below).

## Decided in this session

- **ADR 0010:** how the F0c components are built: the owner's three answers, the shared `inputVariants` and `useRequireLabel`, and the "four states" table.
- **Combobox, DatePicker, Toast API:** the owner's answers (2026-11-13). A hand-written APG listbox on Radix Popover. A styled native date input. `useToast()` from UIProvider.
- **`AnimalTag` has no link variant.** The fork first built one with Radix `Slottable` and lint suppressions. That is a mechanism the references lack, so it was removed.
- **A `FormProvider` is the only new context**, as the owner asked for it per form.

## For the owner's review at this gate

1. **A-F0-04:** the scrim has the `surface` role. Confirm or change.
2. **A-F0-05:** "four states" is defined per kind of component, in the table in ADR 0010. The shared brief's four states are screen states, so this is my reading. Overrule any row and the stories are renamed, not rebuilt.
3. **A-F0-06:** the storefront sub-budgets (script 120 KB, fonts 20 KB, stylesheets 30 KB) and the 300 ms, 700 Kbps, 4x CPU profile are mine. The brief gives only 2.5 s and 300 KB.
4. **Quantity display:** answered 2026-11-14, see below.
5. **Combobox option rows carry one lint suppression** (`click-events-have-key-events`, `interactive-supports-focus`), with its reason in a comment. Focus stays in the input and the rows are reached through `aria-activedescendant`, which is the APG pattern. The alternative is a scoped exception in `eslint.config.js`.
6. **ADR 0009's proposed details** (the `Details that follow from Field` section) are built as written. The owner reviews them at this gate, as that ADR said.

## Resolved at the gate (owner, 2026-11-14)

1. **Scrim (A-F0-04): resolved.** The generated utilities give `bg-scrim` and nothing else: `color-utilities.css` holds one `@utility` for it, and the manifest lists role `surface` only.
2. **Four states (A-F0-05): resolved.** ADR 0010 is accepted as written. Both levels stand, and ADR 0010 now says so: component states per its table, and the brief's four screen states (loading, empty, error, permission denied) binding for every screen from F3 onward.
3. **Lighthouse budgets (A-F0-06): still open, provisional.** Re-measure against a real listing page in F7 and adjust there. Noted in `docs/PERFORMANCE_BUDGET.md`.
4. **Quantity: changed.** Display precision follows the unit, not the wire format: zero places for countable units, three for weight and volume, and a non-zero digit beyond the declared precision is always shown. `formatQuantity` and `QuantityDisplay` now take a required `places`. The contract's `Uom` has `code`, `name` and `kind` but no decimal places, so **CR-003** is raised. Recorded in ADR 0007.
5. **Combobox suppression: resolved (owner, 2026-11-14).** `tabIndex={-1}` satisfies `interactive-supports-focus`, and the inline disable is gone. `click-events-have-key-events` still fired, and `role="option"` is on the same element as the `onClick`, so it is off for `Combobox.tsx` only through a scoped `eslint.config.js` exception citing ADR 0002 (the rule checks element type, not ARIA role). No inline suppression remains in the package. Lint passes, and the Combobox unit tests and all eight stories, KeyboardPath included, pass in Chromium with axe.
6. **ADR 0009: confirmed**, all three proposals.

### Combobox: which rule, and why the code cannot satisfy it

The disable on the option rows covers two `jsx-a11y` rules. Neither suppression nor a config exception is in place beyond the existing one-line disable, and nothing was added.

- **`interactive-supports-focus`.** `role="option"` is an interactive role, and the row has a mouse handler but no `tabIndex`. **The code can satisfy this**: `tabIndex={-1}` makes the row focusable by script but out of the tab order, and the existing `onMouseDown` `preventDefault` already stops a click moving focus off the input. The fork did not need to suppress this one. That is a shortcut I accepted without checking.
- **`click-events-have-key-events`.** An `onClick` needs a key handler beside it. Here keys never reach a row, because focus stays in the input and the row is reached through `aria-activedescendant`, which is the APG pattern. A key handler on the row would be dead code that exists only to quiet the rule. The alternatives are all worse or unverified: replace `onClick` with `onPointerUp`, which the rule does not check, but a screen reader's double-tap activation may dispatch only a `click`, and I have not tested VoiceOver or TalkBack; or keep `onClick` and add a handler that does nothing.

So the honest answer is one half fixable now and one half a real tension between the rule and the pattern. I recommend: take `tabIndex={-1}` now, and decide the click question after a VoiceOver and TalkBack check, because that test is what tells us whether `onPointerUp` is safe. If you would rather have no suppression at all in the meantime, say so and I will switch to `onPointerUp` and carry the AT risk in the report.

### Typetests falsified

Run with the real `pnpm typecheck`, restored afterwards (clean tree, typecheck back to exit 0):

- **Broke the typetest:** in `Field.typetest.tsx` the empty-label case was made a valid one. Typecheck exits 2 with `TS2578: Unused '@ts-expect-error' directive`.
- **Loosened the component:** in `Field.tsx`, `label: NonEmpty<L>` became `label: L`. Typecheck exits 2 with the same error at the same line.

## Not verified, and said plainly

- **No visual review.** I did not screenshot the new components. Axe, contrast pairs and computed-colour proof stories cover accessibility and theming, but not how a layout looks. Review in Storybook (`pnpm storybook`) before merging.
- **Typetests:** falsified for `Field` in both directions (above). The other `.typetest` files use the same mechanism and were not each broken by hand.
- **No real device.** Nothing was run on an Android phone or a touch screen.
- **Process slip:** I chained `git add && git commit` once, against the workspace rule. It succeeded and caused no harm. Every other commit used separate commands.

## Contract

- **Synced:** nothing new. Contract 1.1.0 is still in `contract/openapi.yaml`.
- **Read for shapes:** `Pesewas`, `Kilograms`, `Quantity`, `PageInfo`, `PriceBand`, `Error` and `ErrorDetail`. Every component takes the contract's shape as plain props and imports no generated type.
- **Screens moved from the mock to the real API:** none (F0 has no screens).
- **Added to `docs/CONTRACT_REQUESTS.md` this session:** nothing. CR-001 remains open. No endpoint was needed.

## Carried to F1

- `useDirtyGuard` needs a router adapter in each app, and the apps set `data-theme` on `<html>` (F0b note).
- **Required F1 story:** the POS barcode focus trap and an open Dialog together, built against the real trap (ADR 0004, `docs/BUILD_PROMPT.md`).
- Each app mounts exactly one `UIProvider`, now with `toastLabels` from its translation layer.
- A calendar DatePicker, multi-select Combobox, and page-number Pagination are backlog, not hidden gaps.

## Opening message for F1

```text
Read CLAUDE.md, docs/SHARED_BRIEF.md, and the F1 section of docs/BUILD_PROMPT.md.
List docs/sessions/ and read only the most recent report (F00-design-system-part3.md).
Do not reopen decisions in docs/adr/ (0001 to 0010).

Button, Table, StatusBadge, UIProvider and Field are the approved references.
If a screen needs a pattern none of the components has, stop and ask me.

Confirm in three lines: the phase, its scope, and its gate.
Then execute F1 only. Stop at the gate and write the session report.
```
