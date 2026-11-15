import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pagination,
  QueryBoundary,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableLoadingRows,
  TableRow,
  TableRowHeader,
  type FailureLike,
  type QueryLike,
} from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels, type ScreenStateWords } from '../lib/states';
import type { useCursorPages } from '../lib/useCursorPages';

interface Paged<T> {
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}

export interface ListColumn<T> {
  head: string;
  numeric?: boolean;
  cell: (row: T) => ReactNode;
}

/**
 * A read-only list screen: title, filters, a stacked table on a phone, pages, and the four states
 * (F5b's reference lists: lots, movements, suppliers, cash registers). Every figure is the API's.
 */
export function RecordList<T>({
  id,
  title,
  description,
  words,
  query,
  pages,
  filters,
  rowKey,
  name,
  nameHead,
  columns,
  tableLabel,
  pagesLabel,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  words: ScreenStateWords;
  query: QueryLike<Paged<T>, FailureLike>;
  pages: ReturnType<typeof useCursorPages>;
  filters?: ReactNode;
  rowKey: (row: T, index: number) => string;
  name: (row: T) => ReactNode;
  nameHead: string;
  columns: ListColumn<T>[];
  tableLabel: string;
  pagesLabel: string;
}) {
  const { t } = useTranslation('common');
  const labels = useStateLabels(words);
  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>{nameHead}</TableHead>
        {columns.map((column) => (
          <TableHead key={column.head} numeric={column.numeric ?? false}>
            {column.head}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <PageHeader title={title} titleId={id} description={description} />
      {/* The reference's table card: filters as a toolbar, then the table, in one card. */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {filters === undefined ? null : (
          <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">{filters}</div>
        )}
        <QueryBoundary
          query={query}
          labels={labels}
          isEmpty={(page) => page.data.length === 0}
          loadingFallback={
            <TableContainer aria-label={tableLabel} className="rounded-none border-0 shadow-none">
              <Table>
                {header}
                <TableBody>
                  <TableLoadingRows columns={columns.length + 1} label={labels.loading} />
                </TableBody>
              </Table>
            </TableContainer>
          }
        >
          {(page) => (
            <div className="grid">
              <TableContainer aria-label={tableLabel} className="rounded-none border-0 shadow-none">
                <Table>
                  {header}
                  <TableBody>
                    {page.data.map((row, index) => (
                      <TableRow key={rowKey(row, index)}>
                        <TableRowHeader>{name(row)}</TableRowHeader>
                        {columns.map((column) => (
                          <TableCell
                            key={column.head}
                            numeric={column.numeric ?? false}
                            label={column.head}
                          >
                            {column.cell(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {pages.hasPrevious || page.page.hasMore ? (
                <div className="border-t border-border p-3">
                  <Pagination
                    label={pagesLabel}
                    hasPrevious={pages.hasPrevious}
                    hasNext={page.page.hasMore && page.page.nextCursor !== null}
                    onPrevious={pages.previous}
                    onNext={() => {
                      if (page.page.nextCursor !== null) pages.next(page.page.nextCursor);
                    }}
                    previousLabel={t('pagination.previous')}
                    nextLabel={t('pagination.next')}
                  />
                </div>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      </div>
    </section>
  );
}
