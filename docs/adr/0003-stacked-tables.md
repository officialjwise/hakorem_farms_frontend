# 0003. Tables stack into label/value blocks below 40rem

- Status: accepted
- Date: 2026-11-13
- Session: F0

## Context

At 360px the stock table pushed its value column off screen and clipped weights mid-digit. The F5 gate is a storekeeper doing a stock take on a phone in the cold room. They must read every value of a row without scrolling sideways.

## Options considered

1. **Horizontal scroll everywhere.** Keeps column comparison, but hides the values a phone user came for.
2. **Hide columns on narrow screens.** Loses data, and which columns to drop differs per screen.
3. **Stack each row into a block below a breakpoint**, with scroll as an explicit opt-out.

## Decision

Option 3.

- **Trigger:** below **40rem of container width** a table stacks by default. This is a container query, not a media query, so a table in a narrow side panel on a desktop stacks too.
- **Block layout:** each row becomes a block. The row header (`TableRowHeader`) is the heading, and every `TableCell` with a `label` becomes a label/value pair: label on the start edge, value on the end edge, numerics still tabular.
- **Header:** sortable columns stay visible as a sort bar. The other column headers become screen-reader only.
- **Selection:** a selected row keeps its tint, and the accent edge spans the whole block.
- **Opt-out:** `TableContainer layout="scroll"` keeps the columns and scrolls inside the focusable region. Use it only for genuinely wide reference tables, where comparing across columns matters more than reading one record.
- **Accessibility:** every table part carries an explicit ARIA table role (`table`, `rowgroup`, `row`, `columnheader`, `rowheader`, `cell`), because changing a table element's CSS `display` can drop its native semantics in some browsers. The visible label is CSS generated content with empty alternative text (`content: attr(data-label) / ''`), so screen readers hear the real column header once, not twice.
- **Where it lives:** the layout rules are in `packages/ui/src/styles/table.css`. 40rem is written there directly, because container queries cannot read custom properties.

## Consequences

- Every screen passes `label` on its cells, using the same translated string as the column header. A cell without a label shows its value alone when stacked.
- The `At360px` story asserts the geometry in real Chromium: each cell inside the visible region, and no horizontal overflow.
- jsx-a11y's `no-redundant-roles` and `no-interactive-element-to-noninteractive-role` are off for `Table.tsx` only, with the reason in `eslint.config.js`.
