# 0035. The console follows the reference template's layout, density and shapes, in Pine & Sand

- Status: proposed
- Date: 2026-11-15
- Session: F5b

## Context

The owner shared screenshots of a commercial pharmacy POS template, then asked for a close copy of its layout and density with our content and palette. The screens were captured with Playwright from the template's public demo, for study only; the captures are not in the repository. The owner listed what to match exactly: cards and tiles, the stat row, table density, forms, modals, the sidebar, the page header, alerts and toasts, and the chart card.

## Decision

Match the structure and shapes. Do not copy the template's code, icons, fonts or images.

- **Controls.** Buttons and single-line inputs are pills (`rounded-full`); a textarea keeps `rounded-lg`. This is a design-system change: every control in both apps, the till included, takes the pill shape.
- **Cards, tables and stat tiles.** A 1 px border, `shadow-sm` and a `rounded-lg` radius. A stat tile has a small label with an icon, a bold figure and a tinted trend pill.
  - A table header is sentence case, `font-semibold`, on the sunken surface.
  - A list's filters sit as a toolbar inside the same card as its table, with pagination at the card's foot.
- **Modals.** A bold title with a round close button on the sunken surface. The body follows; then a divider and a footer with Cancel on the left and the primary action on the right (`ConfirmChanges`).
- **The sidebar.** It is the deep teal panel, full height, with the brand at the top and sentence-case group headings. Items are 44 px tall with outline icons. The current item is an outlined pill on `accent-subtle` with its icon on an `accent` square. The sidebar is a dark-theme island, so it reads the same in both page themes.
- **The page header.** The title on the left, the breadcrumbs beneath it (a home icon in a circle), and the primary actions on the right (`PageHeader`'s `breadcrumbs`, filled by the console's `lib/ScreenHeader`). The top bar holds search, branch, the till, theme, notifications and the account.
- **Colours** stay Pine & Sand tokens throughout (ADR 0001). The template's blue and purple map to `accent` and `series-2`.

## Consequences

- Every existing component test still passes; their class strings changed, not their behaviour.
- The template's sparkline in each stat tile is not drawn: the API gives no series for it (CR-013).
- Revisit if the owner supplies brand typography (A-F0-02): the template's geometric face was deliberately not copied.
