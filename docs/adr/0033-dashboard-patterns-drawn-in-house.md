# 0033. Charts, stat tiles and the other dashboard patterns are drawn in house, on tokens

- Status: proposed
- Date: 2026-11-15
- Session: F5b

## Context

F5b asks for a dashboard and shared patterns built once in `packages/ui`: a stat tile with a trend, a chart wrapper on our tokens, a donut, a progress-bar list, an alert list row, a confirmation that shows exactly what changes with its amounts, and an alert and toast pattern with clear severity. Chart series must stay distinguishable without relying on hue alone, in both themes. Labels need barcodes. The owner also ruled (2026-11-15) that a figure the API says has no data source yet shows an explicit unavailable state, never zero or a placeholder number.

## Options considered

1. **A chart library** (Recharts, visx, Chart.js). Saves drawing code. But its colours arrive as props or inline styles, which the token rule forbids (ADR 0001). It adds 40 to 100 kB to a back office already at 270 of 300 kB. And its accessibility is a tooltip, not a table.
2. **Hand-drawn SVG and HTML in `packages/ui`.** Every colour stays a token utility (`stroke-accent`, `fill-series-2`). The weight is a few kilobytes, and the accessible form (a named figure, a summary sentence, a table of every figure) is part of the component.
3. **A barcode library** (JsBarcode, bwip-js). Covers many symbologies we do not need.

## Decision

Option 2 for charts, and an in-house Code 128 (set B) encoder for barcodes, with no new dependency.

- **Charts** (`LineChart`, `BarChart`, `Donut`, `ProgressList`) take the values for geometry and the same values already formatted for people. They compute positions only (axis maximum, column centres, heights, a segment's share of the ring). No figure anyone reads is computed in them.
- **Not by hue alone.**
  - Lines: the first series is a solid accent line with round markers over a tinted area; the second a dashed sand line with square markers.
  - Bars: the second series is hatched.
  - Donut: each legend entry has its own marker shape.
  - Every chart's figures are one disclosure away as a real table.
- **One accent.** Charts take one or two series: `accent`, then `series-2` (sand). A third would need a second accent, so the type refuses it.
- **The deep teal panel** is a dark-theme island (`data-theme="dark"` on a `bg-panel` element), not a second palette (ADR 0001, amendment).
- **Severity** has one table (`lib/severity.ts`) shared by `Alert`, `Toast` and the dashboard's rows: words, an icon shape per severity and colour. Warning and critical are `role="alert"`, the others `role="status"`.
- **`Unavailable`**, and `StatTile`'s `unavailable` prop, are the state for "no data source yet". It is distinct from empty (the source holds nothing) and from error (the source failed): a dashed edge, a crossed circle and words, with no number.
- **`ConfirmChanges`** is the confirmation every stock and money write opens: a before and after table of exactly what changes, the write's lines, what cannot be taken back, and the refusal kept inside. The console's `lib/ConfirmDialog` stays as the translated wrapper F5 screens use, now drawn by `ConfirmChanges`.
- **`PageHeader`**: title, one line, when the figures were generated with a refresh, and the primary actions on the right.
- **Links in tiles and rows** use `asChild` with Radix `Slottable`, the shape `Card` already has, so `packages/ui` never imports the router.

## Consequences

- Charts are simpler than a library's: no zoom, no hover tooltip (the table replaces it), and at most two series. A need beyond that is a new decision.
- The Code 128 encoder carries its own tests: the symbol table's module sums and the modulo-103 check.
- Revisit if a report in F12 needs a chart kind these do not cover (a stacked area, a scatter).
