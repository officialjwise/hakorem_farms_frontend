# 0036. Every list is a table card with one row of pill controls

- Status: proposed
- Date: 2026-11-15
- Session: F5c

## Context

The owner asked for the reference's table card on every list (F5c, item 3):

- one row of pill controls inside the card: search, date range, filter, Columns, Sort and Export;
- working Columns and Sort menus;
- dotted status pills;
- an icon chip by category where a row has no image;
- "Go to page" on the pagination.

F5b had put filters in a band above some tables and beside others. Each screen wrote its own table header and cells, so a Columns menu had nothing to read.

The API pages by cursor and gives no total (DATA_CONVENTIONS). Only some lists take a search, a date range or a filter (the operation's query parameters say which), and none takes a sort.

## Options considered

1. **Keep hand-written tables and add the menus per screen.** No new pattern, but about twenty copies of the same state, and nothing keeps them alike.
2. **A data-grid library.** Columns, sorting and virtualisation come with it, at 30 to 60 kB on a back office already at 282 of 300 kB. Its markup and focus model are not the ones ADR 0003 and the Table tests settled.
3. **A column definition and a small view hook in `packages/ui`, and one table card in the console.** Built on the existing Table, Popover, Checkbox and Radio.

## Decision

Option 3.

- **`TableColumn<T>`** (`packages/ui`): `id`, `head`, `cell`, and optionally `numeric`, `rowHeader` and `sortValue`.
  - The row header column names each row and can never be hidden.
  - A column without `sortValue` cannot be sorted.
- **`useTableView(columns)`** holds the hidden columns and the sort.
  - It returns the visible columns, the rows in order, and the props a sortable `TableHead` needs. The header and the Sort menu drive the same state.
  - It orders the rows of the page on screen; it never fetches, totals or changes a value.
  - Money is compared as the API's integer pesewas. Blanks go last, and ties keep the API's order.
- **The toolbar pieces** (`packages/ui`):
  - `TableToolbar` lays out one line from 64rem; on a phone the search takes the first line and the pills wrap.
  - `ToolbarSearch` is a pill with a search icon and a label a screen reader hears, and submits on Enter.
  - `DateRangeMenu` has From and To fields and its range in words on the pill.
  - `FilterMenu` holds the screen's own labelled fields, with the count of active filters on the pill.
  - `ColumnsMenu` is a checkbox per column.
  - `SortMenu` offers a column or "As listed", a direction, and a note that it sorts the page on screen.
  - `ExportMenu` lists the formats.
- **Only what the API honours.** A screen offers search, a date range or a filter only when its operation takes `q`, `from`/`to` or that filter. Nothing is faked.
- **Sorting this page.** Sorting acts on the page on screen and says so. A server sort needs the contract to grow one.
- **Export.**
  - Where the API produces a file (a report's XLSX and PDF), those formats come first.
  - Every card also offers "This page as CSV": the visible columns, values exactly as formatted on screen.
  - The CSV has a byte order mark for GH₵, and a leading `=`, `+`, `-` or `@` is defused.
- **`TableCard`** (`apps/console/src/lib`):
  - The card holds the toolbar, the table through `QueryBoundary`, and the pagination at its foot.
  - The toolbar stays put through loading, empty, error and denied.
  - `RecordList` is a `TableCard` with a page header.
- **Pagination.**
  - `useCursorPages` keeps every cursor reached.
  - `Pagination` numbers those pages (at most seven buttons, the current page marked `aria-current`) and offers a "Go to page" picker over them.
  - Next still goes further.
- **Status pills** are tinted, with a dot and the words. The words carry the state. The solid (`strong`) pill keeps its icon.
- **`IconChip`** (`packages/ui`) is a decorative icon on a tinted square, hidden from assistive technology.
  - It sits beside a row's name where the row has no image: a product's accounting group, a lot's tracking, a supplier, a till.
  - The same chip sits in stat tiles and modal titles.

## Consequences

- **Every list reads and behaves the same:** one card, one toolbar, the same menus and the same pages.
- **Adding a column means one entry** in a screen's column list. The Columns menu, the Sort menu, the stacked phone layout and the CSV follow it.
- **Sort and Columns choices last only while the page is open.** Keeping them per viewer would be browser storage (ADR 0034's preference pattern), and nobody has asked for it.
- **Revisit:**
  - when the contract offers a sort parameter, so Sort can reach the whole list;
  - or a total, so pagination can number pages not yet reached.
