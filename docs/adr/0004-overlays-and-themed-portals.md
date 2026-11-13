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
  - F0b confirms the mechanism with a story that opens a Dialog in dark compact and asserts the dialog's own computed colours, not the page's.
- **Stacking:** z-index comes from the token scale (`z-dropdown`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`, `z-tooltip`), never a literal.
- **Tooltips:** they do not exist on touch, and the POS is touch. A Tooltip is never the only route to information, the same rule as StatusBadge. A control that needs explaining gets a visible label or hint.
- **Focus:** Radix owns the focus trap and focus return, and we do not override either. F0b adds a story with the POS barcode focus trap and an open Dialog together, proving they do not fight: focus stays in the Dialog while it is open, and returns to the barcode field when it closes.

## Consequences

- Each overlay component takes the portal container from context. A component that portals anywhere else is a bug.
- Tooltip content cannot be the only place a fact lives. Screens are reviewed for this.
