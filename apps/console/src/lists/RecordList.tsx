import type { ReactNode } from 'react';
import { useTableView, type FailureLike, type QueryLike, type TableColumn } from '@hakorem/ui';
import { PageHeader } from '../lib/ScreenHeader';
import { useStateLabels, type ScreenStateWords } from '../lib/states';
import { TableCard } from '../lib/TableCard';
import type { CursorPages } from '../lib/useCursorPages';

interface Paged<T> {
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}

/**
 * A read-only list screen: title, the reference's table card (toolbar, sortable columns, pages), a stacked
 * table on a phone, and the four states (F5b's lots, movements, suppliers and cash registers). Every
 * figure is the API's.
 */
export function RecordList<T>({
  id,
  title,
  description,
  words,
  query,
  pages,
  toolbar,
  rowKey,
  columns,
  tableLabel,
  pagesLabel,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  words: ScreenStateWords;
  query: QueryLike<Paged<T>, FailureLike>;
  pages: CursorPages;
  /** Search, date range and filter pills, in that order. */
  toolbar?: ReactNode;
  rowKey: (row: T, index: number) => string;
  /** The first column names the row (`rowHeader`). */
  columns: TableColumn<T>[];
  tableLabel: string;
  pagesLabel: string;
}) {
  const labels = useStateLabels(words);
  const view = useTableView(columns);
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <PageHeader title={title} titleId={id} description={description} />
      <TableCard
        view={view}
        query={query}
        labels={labels}
        rows={(page) => page.data}
        rowKey={rowKey}
        tableLabel={tableLabel}
        exportName={title}
        toolbar={toolbar}
        pages={{ state: pages, info: (page) => page.page, label: pagesLabel }}
      />
    </section>
  );
}
