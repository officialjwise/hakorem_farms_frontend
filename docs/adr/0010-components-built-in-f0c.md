# 0010. How the F0c components are built: Combobox, DatePicker, Toast, shared control look, four states

- Status: accepted (owner answered the first three questions on 2026-11-13). The "four states" table is proposed, and the owner reviews it at F0c's gate (assumption A-F0-05).
- Date: 2026-11-13
- Session: F0c

## Context

The reference components (Button, Table, StatusBadge, UIProvider, Field) have no precedent for three things the component list needs, and the owner's rule is to ask before inventing a pattern. F0c asked once and the owner answered. This ADR records those answers and the small shared mechanisms that follow, so each component is built the same way.

## Decision

### Owner answers

- **Combobox:** a hand-written listbox on Radix Popover, following the ARIA APG combobox pattern. No new library. The input has `role="combobox"`, the list is a `listbox` with `option` rows, and arrow keys, Home, End, Enter and Escape are handled in the component. Radix has no Combobox primitive, and the themed portal works unchanged because Popover already takes the container from `usePortalContainer`.
- **DatePicker:** a token-styled native `<input type="date">` inside Field, wearing `inputVariants`. The value is a `YYYY-MM-DD` string, which is the contract's `date` format. It adds no bytes, the browser supplies month names (so the UI package holds no copy), and it is the best control on the cheap Android phones the storefront targets. A calendar grid is a backlog item.
- **Toast:** `UIProvider` holds the toast queue and the viewport (ADR 0006). Screens raise a toast with `useToast().show({ tone, title, description?, action? })`. Strings are passed in, like every other component. There is no separate provider.

### Shared mechanisms

- **`inputVariants`** is exported from `Input.tsx`, the same way `buttonVariants` is exported from Button. Every single-line control (Input, NumberInput, MoneyInput, WeightInput, DatePicker, and the triggers of Select and Combobox) wears it, so the boundary, focus ring and invalid treatment live in one place. Invalid is read from `aria-invalid`, which only Field sets.
- **`useRequireLabel`** (`src/lib`) closes ADR 0005's consequence that an input outside a Field must be hard to do by accident. After mount, a control with no `<label>`, `aria-label` or `aria-labelledby` throws. It reads the DOM only, so it needs no context and no change to Field.
- **Radio groups use `asChild`:** the radio group root renders into FieldGroup's `fieldset` (`<RadioGroup asChild><FieldGroup …>`), so the accessibility tree holds exactly one named group (ADR 0009). A checkbox group has no Radix root, so it is a FieldGroup alone.
- **Money and weight inputs parse, they do not calculate.** `MoneyInput` holds integer pesewas (or null) and `WeightInput` a three-place kilogram string (or null). Both sanitise as the operator types, so unparseable text cannot exist, and neither uses a float. `NumberInput` holds a digit string and never converts it to a number.
- **No new stylesheet and no new variant mechanism.** Components use Tailwind utilities, token classes and `cva`, as Button does. Overlays do not animate, because that would need keyframes, which is a stylesheet.

### Four states per component

The owner's rule is that every component ships with four states and a story per state. A spinner and a text box have different states, so the four are defined per kind. A story is named for its state, and a component may have more than four.

| Kind               | Components                                                                          | The four states, one story each                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Text controls      | Input, Textarea, NumberInput, MoneyInput, WeightInput, DatePicker                   | Default, Focus, Invalid, Disabled                                                                                        |
| Pickers            | Select, Combobox                                                                    | Default, Focus, Invalid, Disabled. Combobox adds Loading and NoResults                                                   |
| Choice controls    | Checkbox, Radio, Switch                                                             | Off, On, Focus, Disabled. Indeterminate for Checkbox                                                                     |
| Group              | FieldGroup                                                                          | Default, Invalid, Required, Disabled                                                                                     |
| Overlays           | Dialog, Sheet                                                                       | Closed, Open, Busy, Failed. A failed action stays inside the overlay                                                     |
| Anchored overlays  | Popover, Tooltip                                                                    | Closed, Open, Focus, Disabled trigger                                                                                    |
| Toast              | Toast                                                                               | One story per tone: good, warning, critical, info. Plus Persistent                                                       |
| Navigation         | Tabs, Pagination                                                                    | Tabs: Default, Selected, Focus, Disabled. Pagination: First, Middle, Last, Loading                                       |
| Display containers | Badge, Avatar, Card                                                                 | Badge: tones. Avatar: Image, Fallback, Loading, Broken. Card: Default, Interactive, Selected, Loading                    |
| Message states     | EmptyState, ErrorState                                                              | EmptyState: WithAction, WithoutAction, Compact, InTable. ErrorState: Default, WithReference, WithRetry, PermissionDenied |
| Loading marks      | Spinner, Skeleton                                                                   | Announced, Sizes or Shapes, Decorative, OnSurfaces or Region                                                             |
| Domain displays    | MoneyDisplay, WeightDisplay, QuantityDisplay, PriceBandDisplay, AnimalTag, LotBadge | A normal value, zero or empty, not applicable (null), and the extreme (negative, large, long, expired)                   |

A story that has a `play` function that queries by role must not set `matrix: true`, because the matrix renders four frames and the query would match four elements.

## Consequences

- The owner can overrule any row of the table at the gate, and the stories are renamed, not rebuilt.
- A calendar DatePicker and a second Combobox mode (multi-select) are backlog items, not hidden gaps.
- Toast needs UIProvider to change. It stays one provider, with the queue and viewport inside it.
