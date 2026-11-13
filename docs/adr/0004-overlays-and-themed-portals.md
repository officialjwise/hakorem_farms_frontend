# 0004. Overlays follow Radix's state convention and portal into a themed target

- Status: accepted
- Date: 2026-11-13
- Session: F0 (owner decision), implemented in F0b

## Context

Dialog, Sheet, Popover, Tooltip, Select, Combobox and DatePicker all open, close and render through a portal. None of the reference components (Button, Table, StatusBadge) has open state or a portal.

Theme and density are set by `data-theme` and `data-density` on an ancestor. Portaled content renders under `<body>`, outside any themed wrapper, so without a fix every overlay renders unthemed.

## Decision

- **State:** Radix's own convention exactly. `open` + `onOpenChange`, uncontrolled by default (`defaultOpen`). No third way.
- **Theming portals:** every portal renders into an explicit themed target provided by `UIProvider` (ADR 0006), passed as Radix `Portal`'s `container`. The target carries the same `data-theme` and `data-density` as the tree that opened it.
  - Theme on `<html>` alone is not enough, because Storybook's matrix renders four themes on one page and a themed island must theme its own overlays.
  - F0b confirmed the mechanism with `Foundations/UIProvider › DialogInDarkCompact`, which opens a Dialog in dark compact and asserts the dialog's own computed colours, not the page's.
- **Stacking:** z-index comes from the token scale (`z-dropdown`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`, `z-tooltip`), never a literal.
- **Backdrop** (owner decision 2026-11-13): Dialog and Sheet dim the page with a `scrim` colour token.
  - **Alpha in the value:** the token's value includes its alpha (`#RRGGBBAA`), because opacity modifiers are banned.
  - **Themes:** it has a light and a dark value.
  - **Contrast test:** it composites the scrim over the page background in each theme and checks that text on the dialog above it still passes. Today's contrast module parses only `#RRGGBB`, so F0c adds alpha compositing.
  - **Role:** `surface`, so it emits `bg-scrim` only (assumption A-F0-04).
- **Tooltips:** they do not exist on touch, and the POS is touch. A Tooltip is never the only route to information, the same rule as StatusBadge. A control that needs explaining gets a visible label or hint.
- **Focus:** Radix owns the focus trap and focus return, and we do not override either.
- **Barcode focus story:** a story with the POS barcode focus trap and an open Dialog together proves they do not fight. Focus stays in the Dialog while it is open, and returns to the barcode field when it closes.
  - **Deferred to F1** (owner decision 2026-11-13), where the real POS focus trap is built. It is a required F1 story in `docs/BUILD_PROMPT.md`.
  - **No stand-in in F0:** a stand-in trap would prove only that the stand-in works.

## Consequences

- Each overlay component takes the portal container from context. A component that portals anywhere else is a bug.
- Tooltip content cannot be the only place a fact lives. Screens are reviewed for this.
