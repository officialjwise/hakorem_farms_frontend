import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toastLabels } from '../../test/toastLabels';
import { UIProvider } from '../ui-provider/UIProvider';
import {
  ColumnsMenu,
  DateRangeMenu,
  ExportMenu,
  FilterMenu,
  SortMenu,
  ToolbarSearch,
} from './TableToolbar';
import { useTableView, type TableColumn } from './useTableView';

interface Row {
  name: string;
  where: string;
}
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', head: 'Product', rowHeader: true, cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'where', head: 'Where', cell: (r) => r.where, sortValue: (r) => r.where },
];

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider theme="light" density="comfortable" toastLabels={toastLabels}>
      {children}
    </UIProvider>
  );
}

function Menus({ onState }: { onState: (state: string) => void }) {
  const view = useTableView(COLUMNS);
  onState(
    `${view.visible.map((c) => c.id).join(',')}|${view.sort === null ? 'none' : `${view.sort.id}:${view.sort.direction}`}`,
  );
  return (
    <>
      <ColumnsMenu view={view} label="Columns" legend="Show columns" />
      <SortMenu
        view={view}
        label="Sort by"
        defaultLabel="As listed"
        directionLegend="Direction"
        ascendingLabel="A to Z"
        descendingLabel="Z to A"
        scopeNote="Sorts the rows on this page."
      />
    </>
  );
}

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe('the table toolbar', () => {
  it('searches on Enter with the trimmed words, and names the field for a screen reader', async () => {
    const onSubmit = vi.fn();
    function Search() {
      const [value, setValue] = React.useState('');
      return (
        <ToolbarSearch
          label="Search products by name or SKU"
          placeholder="Search products"
          value={value}
          onValueChange={setValue}
          onSubmit={onSubmit}
        />
      );
    }
    render(<Search />);
    expect(screen.getByRole('search', { name: 'Search products by name or SKU' })).toBeVisible();
    await userEvent.type(
      screen.getByRole('searchbox', { name: /by name or SKU/ }),
      '  goat {Enter}',
    );
    expect(onSubmit).toHaveBeenCalledWith('goat');
  });

  it('hides a column from the Columns menu and keeps the row header', async () => {
    let state = '';
    render(
      <Provider>
        <Menus onState={(s) => (state = s)} />
      </Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Columns/ }));
    expect(screen.getByRole('checkbox', { name: 'Product' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Where' }));
    expect(state.split('|')[0]).toBe('name');
  });

  it('sorts by a column and direction from the Sort menu, and returns to as listed', async () => {
    let state = '';
    render(
      <Provider>
        <Menus onState={(s) => (state = s)} />
      </Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Sort by/ }));
    expect(screen.getByText('Sorts the rows on this page.')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Where' }));
    expect(state.split('|')[1]).toBe('where:ascending');
    await userEvent.click(screen.getByRole('radio', { name: 'Z to A' }));
    expect(state.split('|')[1]).toBe('where:descending');
    await userEvent.click(screen.getByRole('radio', { name: 'As listed' }));
    expect(state.split('|')[1]).toBe('none');
  });

  it('shows how many filters are set, and clears them', async () => {
    const onReset = vi.fn();
    render(
      <Provider>
        <FilterMenu label="Filter" active={2} reset={{ label: 'Clear filters', onReset }}>
          <p>Fields</p>
        </FilterMenu>
      </Provider>,
    );
    const pill = screen.getByRole('button', { name: /^Filter/ });
    expect(pill).toHaveTextContent('2');
    await userEvent.click(pill);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('says the date range in words on the pill and changes each end', async () => {
    const onChange = vi.fn();
    render(
      <Provider>
        <DateRangeMenu
          label="Dates"
          summary="Any date"
          from={undefined}
          to={undefined}
          onChange={onChange}
          fromLabel="From"
          toLabel="To"
          clearLabel="Any date"
        />
      </Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dates: Any date' }));
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-01', to: undefined });
  });

  it('runs an export and closes the menu', async () => {
    const onSelect = vi.fn();
    render(
      <Provider>
        <ExportMenu label="Export" items={[{ id: 'csv', label: 'This page as CSV', onSelect }]} />
      </Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Export/ }));
    await userEvent.click(screen.getByRole('button', { name: 'This page as CSV' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'This page as CSV' })).toBeNull();
  });
});
