---
name: hakorem-ui-component
description: Use when adding or changing anything in packages/ui, including a component, a story, a token, a variant or a stylesheet rule. Fires before creating a component folder. Enforces the Button, Table, StatusBadge, Field and Input shape, token-only styling, both densities, four states with a story each, axe, keyboard behaviour and no business logic.
---

# Adding to packages/ui

The owner's rule: **Button, Table, StatusBadge, UIProvider and Field are the approved reference. Match their shape exactly. If a component needs a pattern none of them has, stop and ask the owner before building it.** A new stylesheet, a context, a different way of passing strings, or a new variant mechanism each count as a new pattern. `docs/adr/0010-components-built-in-f0c.md` records the ones already approved.

## The shape

One folder per component under `packages/ui/src/components/<kebab-name>/`:

- `Name.tsx`, with `data-slot="kebab-name"` on the root.
- `Name.test.tsx`: behaviour, including the keyboard path.
- `Name.stories.tsx`: one story per state.
- `Name.typetest.tsx` for any API that must refuse misuse (blank label, missing required prop, forbidden combination), using `@ts-expect-error` as `Field.typetest.tsx` does.
- Export from `src/index.ts`.

## Rules

- **Tokens only** (ADR 0001). No raw hex, no `rgb()`, no Tailwind palette, no opacity modifier (`bg-accent/50`), no arbitrary colour value. Respect the token roles:
  - `text` colours are `text-*` only, `surface` colours are `bg-*`, `line` are `border-*`/`ring-*`, `glyph` are `fill-*`/`stroke-*`.
  - Mark tokens (`good`, `warning`, `critical`, `info`, `violet`, `plum`, `clay`, `slate`) are lines and glyphs only. Text is `critical-fg`, a tint is `critical-subtle`, a solid fill is `critical-strong` with `critical-on`.
  - `hakorem/token-usage` fails the build on any other route. Do not disable it.
- **Both densities through CSS variables** (`h-control-md`, `px-control-md`, `text-control-md`, `size-icon-md`, `h-row`). Never branch on density in JavaScript.
- **No copy in components.** Every visible or announced string is a prop, already translated. A required label is typed `NonEmpty<L>` and a blank one throws at render. `packages/ui` never imports i18next (ADR 0008).
- **Controls go inside `Field`** (one control) or `FieldGroup` (a group of options). A control accepts Field's `id`, `aria-describedby`, `aria-invalid` and `required` as plain props and puts them on the actual focusable element. Single-line controls wear `inputVariants` and call `useRequireLabel`, so an unlabelled control throws.
- **Overlays** use Radix `open` + `onOpenChange` + `defaultOpen`, portal into `usePortalContainer()` and render nothing until it is non-null. z-index from the token scale. No keyframes.
- **No business logic.** No totals, tax, margin, expiry decision, date comparison, `Intl` or `toLocaleString`. Parse and format only.
- **Reuse** `Button`, `Spinner`, `Skeleton`, `Input`, `Field`, `StatusBadge`, `cn`, `buttonVariants`, `inputVariants` rather than rewriting them.

## Four states, one story each (ADR 0010)

| Kind               | Components                                                        | States                                                               |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Text controls      | Input, Textarea, NumberInput, MoneyInput, WeightInput, DatePicker | Default, Focus, Invalid, Disabled                                    |
| Pickers            | Select, Combobox                                                  | Default, Focus, Invalid, Disabled (Combobox adds Loading, NoResults) |
| Choice controls    | Checkbox, Radio, Switch                                           | Off, On, Focus, Disabled                                             |
| Group              | FieldGroup                                                        | Default, Invalid, Required, Disabled                                 |
| Overlays           | Dialog, Sheet                                                     | Closed, Open, Busy, Failed                                           |
| Anchored overlays  | Popover, Tooltip                                                  | Closed, Open, Focus, Disabled trigger                                |
| Toast              | Toast                                                             | One per tone, plus Persistent                                        |
| Display and domain | Badge, Avatar, Card, EmptyState, ErrorState, MoneyDisplay…        | See the table in ADR 0010                                            |

## Story rules

- `title: 'Primitives/Name'` (or `'Domain/Name'`), `parameters: { matrix: true }` so light/dark by comfortable/compact all render and axe checks all four.
- **A story with a `play` function that queries the DOM must not set `matrix: true`.** The matrix renders four frames, so `getByRole` would match four elements.
- Every interactive component has a `KeyboardPath` story whose `play` uses real key presses (Tab, Enter, Space, arrows, Escape), and the same path in a unit test where jsdom allows.
- Force hover and focus with `parameters.pseudo`, as Button's `States` story does.
- Stories wrap controls in `Field`. Never show an unlabelled control.

## Checks

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:a11y`. Run each separately: a pipe hides a failing exit code.

## Correct

```tsx
export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-control-sm',
        tone === 'accent'
          ? 'border-accent bg-accent-subtle text-accent-subtle-fg'
          : 'border-border-strong bg-surface-sunken text-fg',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
```

## Incorrect

```tsx
// Raw hex, an opacity modifier, a mark token used as text, copy inside the component,
// and density decided in JavaScript.
export function Badge({ compact }: { compact: boolean }) {
  return <span className={`bg-[#0D5C55]/20 text-good ${compact ? 'h-7' : 'h-9'}`}>Low stock</span>;
}
```
