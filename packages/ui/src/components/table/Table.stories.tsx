import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../button/Button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableMessageRow,
  TableRow,
  TableRowHeader,
  type SortDirection,
} from './Table';

const meta = {
  title: 'Primitives/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Story fixture: an opening stock position at the farm and shop. Not seed data.
 * Values are at cost (specific identification for animals, weighted average for
 * the rest), never at selling price. The footer total is the sum of the rows.
 */
const STOCK = [
  {
    ref: 'GT-0142',
    item: 'Goat, Boer cross',
    location: 'Pen 3',
    qty: '1 head',
    weight: '38.400',
    costValue: '980.00',
  },
  {
    ref: 'SH-0031',
    item: 'Sheep, Djallonké',
    location: 'Pen 1',
    qty: '1 head',
    weight: '51.200',
    costValue: '1,420.00',
  },
  {
    ref: 'B-07',
    item: 'Broiler chicken',
    location: 'Shop floor',
    qty: '24 head',
    weight: '–',
    costValue: '2,040.00',
  },
  {
    ref: 'M-2611',
    item: 'Beef, 15 kg pack',
    location: 'Cold room',
    qty: '4 packs',
    weight: '60.000',
    costValue: '1,560.00',
  },
  {
    ref: 'M-2598',
    item: 'Chicken wings, 15 kg pack',
    location: 'Cold room',
    qty: '6 packs',
    weight: '90.000',
    costValue: '780.00',
  },
  {
    ref: 'E-BIG',
    item: 'Eggs, big',
    location: 'Shop floor',
    qty: '18 crates',
    weight: '–',
    costValue: '756.00',
  },
  {
    ref: 'P-YAM',
    item: 'Yam',
    location: 'Shop floor',
    qty: '140 tubers',
    weight: '–',
    costValue: '840.00',
  },
];
const COLUMNS = 5;

/** Column names: the same string labels the header and each stacked cell. */
const L = {
  location: 'Location',
  onHand: 'On hand',
  weight: 'Weight (kg)',
  cost: 'Value at cost (GHS)',
} as const;

function Head({ sort = 'ascending', onSort }: { sort?: SortDirection; onSort?: () => void }) {
  return (
    <TableHeader sticky>
      <TableRow>
        <TableHead sort={sort} onSort={onSort ?? (() => undefined)}>
          Item
        </TableHead>
        <TableHead>{L.location}</TableHead>
        <TableHead numeric>{L.onHand}</TableHead>
        <TableHead numeric>{L.weight}</TableHead>
        <TableHead numeric>{L.cost}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function Rows({ selected = 'M-2611', rows = STOCK }: { selected?: string; rows?: typeof STOCK }) {
  return (
    <>
      {rows.map((r) => (
        <TableRow key={r.ref} selected={r.ref === selected}>
          <TableRowHeader>
            <span className="block">{r.item}</span>
            <span className="block font-mono text-xs font-normal text-fg-muted">{r.ref}</span>
          </TableRowHeader>
          <TableCell label={L.location} className="text-fg-muted">
            {r.location}
          </TableCell>
          <TableCell label={L.onHand} numeric>
            {r.qty}
          </TableCell>
          <TableCell label={L.weight} numeric className="font-mono">
            {r.weight}
          </TableCell>
          <TableCell label={L.cost} numeric className="font-mono">
            {r.costValue}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function Totals() {
  return (
    <TableFooter>
      <TableRow>
        <TableRowHeader colSpan={4}>Stock value at cost</TableRowHeader>
        <TableCell label={L.cost} numeric className="font-mono">
          8,376.00
        </TableCell>
      </TableRow>
    </TableFooter>
  );
}

/** The reference table: a sortable header, a row header per row, numeric columns, a selected row, a totals footer. */
export const StockOnHand: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand">
      <Table>
        <TableCaption>
          Stock on hand at the farm and shop, as at 13 November 2026, 08:00 Accra time.
        </TableCaption>
        <Head />
        <TableBody>
          <Rows />
        </TableBody>
        <Totals />
      </Table>
    </TableContainer>
  ),
};

/** Hover and keyboard focus on the sort control, forced for review. */
export const InteractionStates: Story = {
  parameters: {
    matrix: true,
    pseudo: { hover: ['.demo-hover-row'], focusVisible: ['.demo-focus-sort button'] },
  },
  render: () => (
    <TableContainer aria-label="Interaction states">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sort="none" onSort={() => undefined} className="demo-focus-sort">
              Item
            </TableHead>
            <TableHead>State shown</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableRowHeader>Goat, Boer cross</TableRowHeader>
            <TableCell>Default</TableCell>
          </TableRow>
          <TableRow className="demo-hover-row">
            <TableRowHeader>Sheep, Djallonké</TableRowHeader>
            <TableCell>Hover</TableCell>
          </TableRow>
          <TableRow selected>
            <TableRowHeader>Beef, 15 kg pack</TableRowHeader>
            <TableCell>Selected</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

/** Alternate rows tinted, for wide back-office tables. */
export const Striped: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand, striped">
      <Table striped>
        <Head />
        <TableBody>
          <Rows />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

/** Click the Item header to cycle the sort. aria-sort moves with it. */
export const Sortable: Story = {
  render: function SortableTable() {
    const [sort, setSort] = useState<SortDirection>('none');
    const next: Record<SortDirection, SortDirection> = {
      none: 'ascending',
      ascending: 'descending',
      descending: 'none',
    };
    const rows =
      sort === 'none'
        ? STOCK
        : [...STOCK].sort((a, b) => (sort === 'ascending' ? 1 : -1) * a.item.localeCompare(b.item));
    return (
      <TableContainer aria-label="Stock on hand, sortable">
        <Table>
          <Head sort={sort} onSort={() => setSort(next[sort])} />
          <TableBody>
            <Rows rows={rows} selected="" />
          </TableBody>
        </Table>
      </TableContainer>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('columnheader', { name: 'Item' });
    await expect(header).not.toHaveAttribute('aria-sort');
    await userEvent.click(within(header).getByRole('button', { name: 'Item' }));
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(header).getByRole('button', { name: 'Item' }));
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  },
};

/** The keyboard path: Tab reaches the region, then the sort button; Enter and Space both change the sort. */
export const KeyboardPath: Story = {
  render: function KeyboardPathTable() {
    const [sort, setSort] = useState<SortDirection>('none');
    const next: Record<SortDirection, SortDirection> = {
      none: 'ascending',
      ascending: 'descending',
      descending: 'none',
    };
    return (
      <TableContainer aria-label="Stock on hand, keyboard">
        <Table>
          <Head sort={sort} onSort={() => setSort(next[sort])} />
          <TableBody>
            <Rows rows={STOCK} selected="" />
          </TableBody>
        </Table>
      </TableContainer>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('columnheader', { name: 'Item' });
    await userEvent.tab();
    await expect(canvas.getByRole('region', { name: 'Stock on hand, keyboard' })).toHaveFocus();
    await userEvent.tab();
    await expect(within(header).getByRole('button', { name: 'Item' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.keyboard(' ');
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  },
};

/** The header stays put while a long list scrolls inside the container. */
export const StickyHeader: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand, scrolling" className="max-h-72">
      <Table>
        <Head />
        <TableBody>
          <Rows rows={[...STOCK, ...STOCK.map((r) => ({ ...r, ref: `${r.ref}-B` }))]} selected="" />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const Loading: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand" aria-busy="true">
      <Table>
        <Head />
        <TableBody>
          <TableLoadingRows columns={COLUMNS} rows={5} label="Loading stock on hand" />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const Empty: Story = {
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand">
      <Table>
        <Head />
        <TableBody>
          <TableMessageRow
            colSpan={COLUMNS}
            tone="empty"
            title="No stock at Cold room"
            description="Nothing has been received or transferred here yet."
            action={
              <Button size="sm">
                <Plus />
                Receive stock
              </Button>
            }
          />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const ErrorState: Story = {
  name: 'Error',
  parameters: { matrix: true },
  render: () => (
    <TableContainer aria-label="Stock on hand">
      <Table>
        <Head />
        <TableBody>
          <TableMessageRow
            colSpan={COLUMNS}
            tone="error"
            title="Stock on hand could not be loaded"
            description="The connection dropped before the server answered. Your data is safe."
            reference="req_01JD2K8M4NQ7"
            referenceLabel="Reference"
            action={
              <Button size="sm" variant="secondary">
                <RotateCw />
                Try again
              </Button>
            }
          />
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

/**
 * The F5 case: a storekeeper reading stock on a phone. Below 40rem of container
 * width each row stacks into a block, the item as heading and every column as a
 * label/value pair, so nothing sits off screen. The sort control stays as a bar.
 */
export const At360px: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-[360px] max-w-full">
      <TableContainer aria-label="Stock on hand, narrow screen">
        <Table>
          <Head />
          <TableBody>
            <Rows />
          </TableBody>
          <Totals />
        </Table>
      </TableContainer>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const region of canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="table-container"]',
    )) {
      const bounds = region.getBoundingClientRect();
      const row = within(region).getByRole('row', { name: /Goat, Boer cross/ });
      await expect(getComputedStyle(row).display).toBe('block');
      // Every value, including the last column, lies fully inside the visible region.
      for (const cell of within(row).getAllByRole('cell')) {
        const r = cell.getBoundingClientRect();
        await expect(r.right).toBeLessThanOrEqual(bounds.right);
        await expect(r.left).toBeGreaterThanOrEqual(bounds.left);
      }
      await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
      const cost = within(row).getByRole('cell', { name: '980.00' });
      await expect(getComputedStyle(cost).fontVariantNumeric).toContain('tabular-nums');
    }
  },
};

/** Loading, stacked: skeleton blocks in the same shape as the rows that will replace them. */
export const At360pxLoading: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-[360px] max-w-full">
      <TableContainer aria-label="Stock on hand, narrow screen" aria-busy="true">
        <Table>
          <Head />
          <TableBody>
            <TableLoadingRows columns={COLUMNS} rows={3} label="Loading stock on hand" />
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  ),
};

/**
 * Opt-out: layout="scroll" keeps the columns and scrolls sideways inside the
 * region. Only for genuinely wide reference tables, where comparing across
 * columns matters more than reading one record.
 */
export const At360pxScrollOptOut: Story = {
  parameters: { matrix: true },
  render: () => (
    <div className="w-[360px] max-w-full">
      <TableContainer layout="scroll" aria-label="Stock on hand, wide reference">
        <Table>
          <Head />
          <TableBody>
            <Rows />
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  ),
};
