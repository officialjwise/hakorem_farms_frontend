import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from '../field/Field';
import { Select } from '../select/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '../table/Table';
import {
  ColumnsMenu,
  DateRangeMenu,
  ExportMenu,
  FilterMenu,
  SortMenu,
  TableToolbar,
  ToolbarSearch,
} from './TableToolbar';
import { useTableView, type TableColumn, type TableSort } from './useTableView';

interface Row {
  name: string;
  sku: string;
  where: string;
  head: number;
}
const ROWS: Row[] = [
  { name: 'Goat', sku: 'LIV-GOAT', where: 'Goat pen 1', head: 12 },
  { name: 'Sheep', sku: 'LIV-SHEEP', where: 'Sheep pen', head: 8 },
  { name: 'Broiler chicken', sku: 'LIV-BROILER', where: 'Broiler house 1', head: 462 },
];
const COLUMNS: TableColumn<Row>[] = [
  {
    id: 'name',
    head: 'Product',
    rowHeader: true,
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="grid">
        {r.name}
        <code className="text-control-sm font-normal text-fg-muted">{r.sku}</code>
      </span>
    ),
  },
  { id: 'where', head: 'Where', sortValue: (r) => r.where, cell: (r) => r.where },
  { id: 'head', head: 'On hand', numeric: true, sortValue: (r) => r.head, cell: (r) => r.head },
];

/** The reference's table card, built from the toolbar pieces and the Table, as the console's TableCard does. */
function Card({
  filtersSet = 0,
  initialSort,
  initialHidden,
}: {
  filtersSet?: number;
  initialSort?: TableSort;
  initialHidden?: string[];
}) {
  const view = useTableView(COLUMNS, { initialSort, initialHidden });
  const [search, setSearch] = useState('');
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <TableToolbar>
        <ToolbarSearch
          label="Search products by name or SKU"
          placeholder="Search products"
          value={search}
          onValueChange={setSearch}
          onSubmit={() => undefined}
        />
        <DateRangeMenu
          label="Dates"
          summary="2026-11-01 to 2026-11-15"
          from="2026-11-01"
          to="2026-11-15"
          onChange={() => undefined}
          fromLabel="From"
          toLabel="To"
          clearLabel="Any date"
        />
        <FilterMenu
          label="Filter"
          active={filtersSet}
          reset={{ label: 'Clear filters', onReset: () => undefined }}
        >
          <Field label="Status">
            <Select
              value="ALL"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
              ]}
            />
          </Field>
        </FilterMenu>
        <div className="contents lg:ms-auto lg:flex lg:items-center lg:gap-2">
          <ColumnsMenu view={view} label="Columns" legend="Show columns" />
          <SortMenu
            view={view}
            label="Sort by"
            defaultLabel="As listed"
            directionLegend="Direction"
            ascendingLabel="A to Z, low to high"
            descendingLabel="Z to A, high to low"
            scopeNote="Sorts the rows on this page."
          />
          <ExportMenu
            label="Export"
            items={[{ id: 'csv', label: 'This page as CSV', onSelect: () => undefined }]}
          />
        </div>
      </TableToolbar>
      <TableContainer aria-label="Products" className="rounded-none border-0 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              {view.visible.map((c) => {
                const sort = view.headSort(c.id);
                return sort === undefined ? (
                  <TableHead key={c.id} numeric={c.numeric ?? false}>
                    {c.head}
                  </TableHead>
                ) : (
                  <TableHead key={c.id} numeric={c.numeric ?? false} {...sort}>
                    {c.head}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.sortRows(ROWS).map((row) => (
              <TableRow key={row.sku}>
                {view.visible.map((c) =>
                  c.rowHeader === true ? (
                    <TableRowHeader key={c.id}>{c.cell(row)}</TableRowHeader>
                  ) : (
                    <TableCell key={c.id} numeric={c.numeric ?? false} label={c.head}>
                      {c.cell(row)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

const meta = {
  title: 'Data/TableToolbar',
  component: Card,
  parameters: { matrixLayout: 'stack' },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The toolbar has no data of its own: the card's loading, empty, error and denied states are
 * QueryBoundary's, beneath it, and the toolbar stays put through all four.
 */
export const Default: Story = { parameters: { matrix: true } };

/** Two filters set: the pill says so, so a narrowed list never looks complete. */
export const FiltersSet: Story = { parameters: { matrix: true }, args: { filtersSet: 2 } };

/** Sorted by on hand, high to low, with a column hidden: both pills carry a count. */
export const SortedAndNarrowed: Story = {
  parameters: { matrix: true },
  args: { initialSort: { id: 'head', direction: 'descending' }, initialHidden: ['where'] },
};

export const KeyboardSortsFromTheHeader: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: 'On hand' });
    header.focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('columnheader', { name: 'On hand' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  },
};
