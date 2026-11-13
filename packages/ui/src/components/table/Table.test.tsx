import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableMessageRow,
  TableRow,
  TableRowHeader,
} from './Table';

describe('Table', () => {
  it('is a labelled, keyboard-focusable scroll region', async () => {
    render(
      <TableContainer aria-label="Stock on hand">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Goat</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>,
    );
    const region = screen.getByRole('region', { name: 'Stock on hand' });
    await userEvent.tab();
    expect(region).toHaveFocus();
  });

  it('marks only the sorted column with aria-sort, and sorts on click', async () => {
    const onSort = vi.fn();
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sort="ascending" onSort={onSort}>
              Item
            </TableHead>
            <TableHead sort="none" onSort={vi.fn()}>
              Location
            </TableHead>
            <TableHead numeric>On hand</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const [item, location, onHand] = screen.getAllByRole('columnheader');
    expect(item).toHaveAttribute('aria-sort', 'ascending');
    expect(location).not.toHaveAttribute('aria-sort');
    expect(onHand).not.toHaveAttribute('aria-sort');
    expect(
      within(screen.getByRole('columnheader', { name: 'On hand' })).queryByRole('button'),
    ).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Item' }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('exposes selection to assistive technology', () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected>
            <TableRowHeader>Beef, 15 kg pack</TableRowHeader>
            <TableCell numeric>15.000 kg</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('rowheader', { name: 'Beef, 15 kg pack' })).toBeInTheDocument();
  });

  it('announces loading once', () => {
    render(
      <Table>
        <TableBody>
          <TableLoadingRows columns={4} rows={6} label="Loading stock on hand" />
        </TableBody>
      </Table>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading stock on hand');
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('renders the error state as an alert carrying the correlation id', () => {
    render(
      <Table>
        <TableBody>
          <TableMessageRow
            colSpan={5}
            tone="error"
            title="Stock could not be loaded"
            reference="req_01JD2K8M4N"
            referenceLabel="Reference"
          />
        </TableBody>
      </Table>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Stock could not be loaded');
    expect(alert).toHaveTextContent('req_01JD2K8M4N');
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '5');
  });

  it('renders the empty state without an alert', () => {
    render(
      <Table>
        <TableBody>
          <TableMessageRow colSpan={5} tone="empty" title="No stock at this location" />
        </TableBody>
      </Table>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('No stock at this location')).toBeInTheDocument();
  });
});
