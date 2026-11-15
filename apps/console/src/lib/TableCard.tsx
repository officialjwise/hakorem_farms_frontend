import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ColumnsMenu,
  ExportMenu,
  Pagination,
  QueryBoundary,
  SortMenu,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  TableToolbar,
  type ExportMenuItem,
  type FailureLike,
  type QueryBoundaryLabels,
  type QueryLike,
  type TableLayout,
  type TableView,
} from '@hakorem/ui';
import { downloadCsv, tableToCsv } from './exportTable';
import type { CursorPages } from './useCursorPages';

interface PageInfo {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface TableCardProps<T, D> {
  view: TableView<T>;
  query: QueryLike<D, FailureLike>;
  labels: QueryBoundaryLabels;
  /** The rows in the answer, for example `(page) => page.data`. */
  rows: (data: D) => readonly T[];
  rowKey: (row: T, index: number) => string;
  /** Names the table region, for example "Products". */
  tableLabel: string;
  /**
   * The screen's own toolbar controls, in the reference's order: search, date range, filter. Columns,
   * Sort and Export follow on the same row.
   */
  toolbar?: ReactNode;
  /**
   * The formats this screen's API can produce (a report's XLSX and PDF). "This page as CSV", from the
   * table on screen, is always offered after them.
   */
  exports?: readonly ExportMenuItem[];
  /** The CSV's file name, for example "Products". */
  exportName: string;
  /** Cursor pages: Previous, Next, the pages reached and "Go to page". */
  pages?: { state: CursorPages; info: (data: D) => PageInfo; label: string };
  emptyAction?: ReactNode;
  /** Extra state for a row, for example `selected`. */
  rowProps?: (row: T) => { selected?: boolean };
  /** Below 40rem: stacked label/value blocks (default), or keep columns and scroll. */
  layout?: TableLayout;
  /** After the table, inside the card: a total row from the API, a note. */
  footer?: (data: D) => ReactNode;
  /** Before the toolbar, inside the card: a heading when the page holds more than one table. */
  heading?: ReactNode;
}

/**
 * The reference's table card (F5c, ADR 0036): one white card holding a single-line toolbar of pills, the
 * table with sortable headers, and the pages at its foot. Columns and Sort act on the page on screen;
 * search, dates and filters go to the API. The four states come from QueryBoundary, and the toolbar
 * stays put through all of them.
 */
export function TableCard<T, D>({
  view,
  query,
  labels,
  rows,
  rowKey,
  tableLabel,
  toolbar,
  exports = [],
  exportName,
  pages,
  emptyAction,
  rowProps,
  layout = 'stack',
  footer,
  heading,
}: TableCardProps<T, D>) {
  const { t } = useTranslation('common');
  const tableRef = useRef<HTMLTableElement>(null);
  const page = pages?.state.page ?? 1;
  const header = (
    <TableHeader>
      <TableRow>
        {view.visible.map((column) => {
          const sort = view.headSort(column.id);
          return sort === undefined ? (
            <TableHead key={column.id} numeric={column.numeric ?? false}>
              {column.head}
            </TableHead>
          ) : (
            <TableHead
              key={column.id}
              numeric={column.numeric ?? false}
              sort={sort.sort}
              onSort={sort.onSort}
            >
              {column.head}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
  return (
    <div
      data-slot="table-card"
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      {heading}
      <TableToolbar>
        {toolbar}
        <div className="contents lg:ms-auto lg:flex lg:flex-nowrap lg:items-center lg:gap-2">
          <ColumnsMenu view={view} label={t('table.columns')} legend={t('table.columnsLegend')} />
          <SortMenu
            view={view}
            label={t('table.sort')}
            defaultLabel={t('table.sortDefault')}
            directionLegend={t('table.direction')}
            ascendingLabel={t('table.ascending')}
            descendingLabel={t('table.descending')}
            scopeNote={t('table.sortScope')}
          />
          <ExportMenu
            label={t('table.export')}
            items={[
              ...exports,
              {
                id: 'csv',
                label: t('table.exportCsv'),
                disabled: query.status !== 'success',
                onSelect: () => {
                  if (tableRef.current === null) return;
                  downloadCsv(
                    t('table.exportCsvName', { name: exportName, page }),
                    tableToCsv(tableRef.current),
                  );
                },
              },
            ]}
          />
        </div>
      </TableToolbar>
      <QueryBoundary
        query={query}
        labels={labels}
        isEmpty={(data) => rows(data).length === 0}
        emptyAction={emptyAction}
        loadingFallback={
          <TableContainer
            aria-label={tableLabel}
            layout={layout}
            className="rounded-none border-0 shadow-none"
          >
            <Table>
              {header}
              <TableBody>
                <TableLoadingRows columns={view.visible.length} label={labels.loading} />
              </TableBody>
            </Table>
          </TableContainer>
        }
      >
        {(data) => {
          const info = pages?.info(data);
          return (
            <div className="grid">
              <TableContainer
                aria-label={tableLabel}
                layout={layout}
                className="rounded-none border-0 shadow-none"
              >
                <Table ref={tableRef}>
                  {header}
                  <TableBody>
                    {view.sortRows(rows(data)).map((row, index) => (
                      <TableRow key={rowKey(row, index)} {...rowProps?.(row)}>
                        {view.visible.map((column) =>
                          column.rowHeader === true ? (
                            <TableRowHeader key={column.id} numeric={column.numeric ?? false}>
                              {column.cell(row)}
                            </TableRowHeader>
                          ) : (
                            <TableCell
                              key={column.id}
                              numeric={column.numeric ?? false}
                              label={column.head}
                            >
                              {column.cell(row)}
                            </TableCell>
                          ),
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {footer?.(data)}
              {pages !== undefined && info !== undefined ? (
                <div className="border-t border-border p-4">
                  <Pagination
                    label={pages.label}
                    hasPrevious={pages.state.hasPrevious}
                    hasNext={info.hasMore && info.nextCursor !== null}
                    onPrevious={pages.state.previous}
                    onNext={() => {
                      if (info.nextCursor !== null) pages.state.next(info.nextCursor);
                    }}
                    previousLabel={t('pagination.previous')}
                    nextLabel={t('pagination.next')}
                    summary={t('pagination.page', { page })}
                    page={page}
                    reached={pages.state.reached}
                    onGoTo={pages.state.goTo}
                    goToLabel={t('pagination.goTo')}
                    pageLabel={(n) => t('pagination.pageButton', { page: n })}
                  />
                </div>
              ) : null}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
