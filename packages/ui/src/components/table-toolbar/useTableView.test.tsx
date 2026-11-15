import { act, renderHook } from '@testing-library/react';
import { useTableView, type TableColumn } from './useTableView';

interface Row {
  name: string;
  valuePesewas: number | null;
  where: string;
}

const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', head: 'Product', rowHeader: true, cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'where', head: 'Where', cell: (r) => r.where },
  {
    id: 'value',
    head: 'Value',
    numeric: true,
    cell: (r) => r.valuePesewas,
    sortValue: (r) => r.valuePesewas,
  },
];

const ROWS: Row[] = [
  { name: 'Goat 10', valuePesewas: 61250, where: 'Pen 1' },
  { name: 'goat 9', valuePesewas: null, where: 'Pen 2' },
  { name: 'Beef', valuePesewas: 220500, where: 'Cold room' },
  { name: 'Eggs', valuePesewas: 61250, where: 'Store' },
];

describe('useTableView', () => {
  it("keeps the API's order until a sort is chosen", () => {
    const { result } = renderHook(() => useTableView(COLUMNS));
    expect(result.current.sortRows(ROWS)).toBe(ROWS);
    expect(result.current.headSort('name')?.sort).toBe('none');
  });

  it('sorts text naturally and case-blind, and numbers as numbers, blanks last both ways', () => {
    const { result } = renderHook(() => useTableView(COLUMNS));
    act(() => result.current.setSort({ id: 'name', direction: 'ascending' }));
    expect(result.current.sortRows(ROWS).map((r) => r.name)).toEqual([
      'Beef',
      'Eggs',
      'goat 9',
      'Goat 10',
    ]);
    act(() => result.current.setSort({ id: 'value', direction: 'descending' }));
    // Ties keep the API's order (Goat 10 before Eggs); the blank stays last.
    expect(result.current.sortRows(ROWS).map((r) => r.name)).toEqual([
      'Beef',
      'Goat 10',
      'Eggs',
      'goat 9',
    ]);
    act(() => result.current.setSort({ id: 'value', direction: 'ascending' }));
    expect(result.current.sortRows(ROWS).at(-1)?.name).toBe('goat 9');
  });

  it('cycles a header through ascending, descending and back to as listed', () => {
    const { result } = renderHook(() => useTableView(COLUMNS));
    act(() => result.current.headSort('value')?.onSort());
    expect(result.current.sort).toEqual({ id: 'value', direction: 'ascending' });
    act(() => result.current.headSort('value')?.onSort());
    expect(result.current.sort).toEqual({ id: 'value', direction: 'descending' });
    act(() => result.current.headSort('value')?.onSort());
    expect(result.current.sort).toBeNull();
    // A column with no sort value offers no sort.
    expect(result.current.headSort('where')).toBeUndefined();
  });

  it('hides and shows columns, but never the column that names the row', () => {
    const { result } = renderHook(() => useTableView(COLUMNS));
    act(() => result.current.toggle('where'));
    expect(result.current.visible.map((c) => c.id)).toEqual(['name', 'value']);
    act(() => result.current.toggle('name'));
    expect(result.current.visible.map((c) => c.id)).toEqual(['name', 'value']);
    act(() => result.current.toggle('where'));
    expect(result.current.visible.map((c) => c.id)).toEqual(['name', 'where', 'value']);
  });
});
