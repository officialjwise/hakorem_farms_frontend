import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/** Passing `loading` at all requires the text a screen reader hears. */
type LoadingProps =
  { loading?: undefined; loadingLabel?: never } | { loading: boolean; loadingLabel: string };

export type PaginationProps<L extends string = string> = LoadingProps & {
  /** Required. Names the navigation landmark, for example "Stock on hand pages". */
  label: NonEmpty<L>;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  /** Already formatted by the caller. Nothing is counted here: the contract has no total. */
  summary?: string;
  className?: string;
};

/**
 * Pagination. The API pages by cursor (nextCursor, hasMore), so there are no
 * page numbers and no total: only Previous and Next. While loading, both
 * buttons stay focusable (aria-disabled) and ignore clicks, and a status
 * announces the loading label.
 */
export function Pagination<L extends string>({
  label,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  summary,
  loading,
  loadingLabel,
  className,
}: PaginationProps<L>) {
  if (label.trim() === '') {
    throw new Error('Pagination needs a non-empty label for its navigation landmark.');
  }
  const busy = loading === true;
  return (
    <nav
      aria-label={label}
      aria-busy={busy || undefined}
      data-slot="pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      {summary ? <p className="text-control-sm text-fg-muted">{summary}</p> : <span />}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrevious && !busy}
          aria-disabled={busy || !hasPrevious || undefined}
          onClick={() => {
            if (!busy && hasPrevious) onPrevious();
          }}
        >
          <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
          {previousLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext && !busy}
          aria-disabled={busy || !hasNext || undefined}
          onClick={() => {
            if (!busy && hasNext) onNext();
          }}
        >
          {nextLabel}
          <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
        </Button>
      </div>
      {busy ? (
        <span role="status" className="sr-only">
          {loadingLabel}
        </span>
      ) : null}
    </nav>
  );
}
