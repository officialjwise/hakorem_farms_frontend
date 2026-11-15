'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { SortDirection } from '../table/Table';

/** One column of a table card. The cell and the head are already translated by the screen. */
export interface TableColumn<T> {
  /** Stable, unique within the table. */
  id: string;
  /** The column header, already translated. Also names the value when the table stacks on a phone. */
  head: string;
  cell: (row: T) => ReactNode;
  /** Right-aligned with tabular figures, for money, weight and quantity. */
  numeric?: boolean;
  /**
   * Present: the column can be sorted, by this value. Money is compared as the API's integer pesewas and
   * weight as its decimal string's number; nothing is added up. Absent: the column keeps the API's order.
   */
  sortValue?: (row: T) => string | number | null | undefined;
  /** The cell that names the row (the product, the lot). It is a row header and is never hidden. */
  rowHeader?: boolean;
}

export interface TableSort {
  id: string;
  direction: Exclude<SortDirection, 'none'>;
}

export interface TableView<T> {
  /** Every column, in order, for the Columns menu. */
  columns: readonly TableColumn<T>[];
  /** The columns on screen, in order. */
  visible: readonly TableColumn<T>[];
  isHidden: (id: string) => boolean;
  /** Shows or hides a column. A row header column cannot be hidden. */
  toggle: (id: string) => void;
  sort: TableSort | null;
  /** Null returns to the API's order. */
  setSort: (sort: TableSort | null) => void;
  /** The rows in the chosen order. With no sort, the API's order, untouched. */
  sortRows: (rows: readonly T[]) => readonly T[];
  /** Props for a sortable TableHead: its state, and a click that cycles ascending, descending, none. */
  headSort: (id: string) => { sort: SortDirection; onSort: () => void } | undefined;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compare(a: string | number | null | undefined, b: string | number | null | undefined) {
  // Blanks go last whichever way the column sorts.
  const aBlank = a === null || a === undefined || a === '';
  const bBlank = b === null || b === undefined || b === '';
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * The state behind a table card's Columns and Sort menus and its sortable headers (ADR 0036). It orders
 * and hides what the screen already has: the rows of the page on screen, as the API sent them. It never
 * fetches, totals or changes a value.
 */
export function useTableView<T>(
  columns: readonly TableColumn<T>[],
  options: { initialSort?: TableSort; initialHidden?: readonly string[] } = {},
): TableView<T> {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () => new Set(options.initialHidden ?? []),
  );
  const [sort, setSort] = useState<TableSort | null>(options.initialSort ?? null);

  const rowHeaders = useMemo(
    () => new Set(columns.filter((c) => c.rowHeader === true).map((c) => c.id)),
    [columns],
  );
  const toggle = useCallback(
    (id: string) => {
      if (rowHeaders.has(id)) return;
      setHidden((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [rowHeaders],
  );
  const visible = useMemo(
    () => columns.filter((c) => c.rowHeader === true || !hidden.has(c.id)),
    [columns, hidden],
  );
  const sortRows = useCallback(
    (rows: readonly T[]) => {
      const column = sort === null ? undefined : columns.find((c) => c.id === sort.id);
      const value = column?.sortValue;
      if (sort === null || value === undefined) return rows;
      const sign = sort.direction === 'ascending' ? 1 : -1;
      return rows
        .map((row, index) => ({ row, index, key: value(row) }))
        .sort((a, b) => {
          const order = compare(a.key, b.key);
          // Blanks stay last in both directions; ties keep the API's order.
          const blank = a.key === null || a.key === undefined || a.key === '';
          const otherBlank = b.key === null || b.key === undefined || b.key === '';
          if (blank || otherBlank) return order || a.index - b.index;
          return sign * order || a.index - b.index;
        })
        .map((entry) => entry.row);
    },
    [columns, sort],
  );
  const headSort = useCallback(
    (id: string) => {
      const column = columns.find((c) => c.id === id);
      if (column?.sortValue === undefined) return undefined;
      const current: SortDirection = sort?.id === id ? sort.direction : 'none';
      return {
        sort: current,
        onSort: () =>
          setSort(
            current === 'none'
              ? { id, direction: 'ascending' }
              : current === 'ascending'
                ? { id, direction: 'descending' }
                : null,
          ),
      };
    },
    [columns, sort],
  );
  return {
    columns,
    visible,
    isHidden: (id: string) => !rowHeaders.has(id) && hidden.has(id),
    toggle,
    sort,
    setSort,
    sortRows,
    headSort,
  };
}
