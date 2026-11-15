'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../button/Button';
import { Select } from '../select/Select';

/** Rejects an empty string literal at compile time. Dynamic blank strings are rejected at render. */
type NonEmpty<T extends string> = T extends '' ? never : T;

/**
 * Jumping between the pages already reached. A cursor API has no total, so the pages offered are the ones
 * whose cursor is known (1 to `reached`); Next goes further. All three words are required together.
 */
type GoToProps =
  | { page?: undefined; reached?: never; onGoTo?: never; goToLabel?: never; pageLabel?: never }
  | {
      /** The page on screen, 1 for the first. */
      page: number;
      /** How many pages have been reached so far. */
      reached: number;
      onGoTo: (page: number) => void;
      /** The picker's label, for example "Go to page". */
      goToLabel: string;
      /** A page button's accessible name, for example (n) => `Page ${n}`. */
      pageLabel: (page: number) => string;
    };

/** Passing `loading` at all requires the text a screen reader hears. */
type LoadingProps =
  { loading?: undefined; loadingLabel?: never } | { loading: boolean; loadingLabel: string };

export type PaginationProps<L extends string = string> = LoadingProps &
  GoToProps & {
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
 * Pagination. The API pages by cursor (nextCursor, hasMore), so there is no
 * total: Previous and Next, and with `page` and `reached` a numbered button and
 * a "Go to page" picker for every page reached so far. While loading, the
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
  page,
  reached,
  onGoTo,
  goToLabel,
  pageLabel,
  className,
}: PaginationProps<L>) {
  const goToId = useId();
  if (label.trim() === '') {
    throw new Error('Pagination needs a non-empty label for its navigation landmark.');
  }
  const busy = loading === true;
  const numbered = page !== undefined && reached !== undefined && reached > 1;
  const pages = numbered ? Array.from({ length: reached }, (_, i) => i + 1) : [];
  // At most seven buttons: the first, the last, and the pages around this one.
  const shown = pages.filter(
    (n) =>
      reached === undefined ||
      reached <= 7 ||
      n === 1 ||
      n === reached ||
      Math.abs(n - (page ?? 1)) <= 1,
  );
  return (
    <nav
      aria-label={label}
      aria-busy={busy || undefined}
      data-slot="pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      {summary ? <p className="text-control-sm text-fg-muted">{summary}</p> : <span />}
      <div className="flex flex-wrap items-center gap-2">
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
        {numbered && pageLabel !== undefined && onGoTo !== undefined ? (
          <ol className="flex items-center gap-1">
            {shown.map((n, index) => (
              <li key={n} className="flex items-center gap-1">
                {index > 0 && n - (shown[index - 1] ?? n) > 1 ? (
                  <span aria-hidden="true" className="px-1 text-fg-muted">
                    …
                  </span>
                ) : null}
                <Button
                  variant={n === page ? 'primary' : 'ghost'}
                  size="sm"
                  iconOnly
                  aria-label={pageLabel(n)}
                  aria-current={n === page ? 'page' : undefined}
                  onClick={() => {
                    if (!busy && n !== page) onGoTo(n);
                  }}
                >
                  <span aria-hidden="true" className="tabular-nums">
                    {n}
                  </span>
                </Button>
              </li>
            ))}
          </ol>
        ) : null}
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
      {numbered && goToLabel !== undefined && onGoTo !== undefined && pageLabel !== undefined ? (
        <div className="flex items-center gap-2">
          <label htmlFor={goToId} className="text-control-sm text-fg-muted">
            {goToLabel}
          </label>
          <Select
            id={goToId}
            size="sm"
            className="w-20"
            value={String(page)}
            onValueChange={(value) => {
              const target = Number(value);
              if (!busy && target !== page) onGoTo(target);
            }}
            options={pages.map((n) => ({ value: String(n), label: String(n) }))}
          />
        </div>
      ) : null}
      {busy ? (
        <span role="status" className="sr-only">
          {loadingLabel}
        </span>
      ) : null}
    </nav>
  );
}
