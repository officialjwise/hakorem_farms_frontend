import { useCallback, useState } from 'react';

export interface CursorPages {
  /** The cursor for the page on screen: undefined for the first page. Pass it as `query.cursor`. */
  cursor: string | undefined;
  /** 1 for the first page. For "Page 2" in the pagination summary; there is no total (DATA_CONVENTIONS). */
  page: number;
  /** How many pages have been reached so far: the ones "Go to page" can open without a new search. */
  reached: number;
  hasPrevious: boolean;
  /** Moves on, with the page's `nextCursor`. */
  next: (nextCursor: string) => void;
  previous: () => void;
  /** Opens a page already reached (1 to `reached`). */
  goTo: (page: number) => void;
  /** Back to the first page, for example when a filter changes. */
  reset: () => void;
}

const FIRST = { cursors: [undefined] as (string | undefined)[], index: 0 };

/**
 * Cursor pagination's one piece of screen state (DATA_CONVENTIONS, "Pagination"). Every cursor reached is
 * kept, so Previous and "Go to page" return to the exact page, and each page is its own cache entry. Going
 * back and then Next with the same cursor keeps the pages beyond; a different cursor drops them.
 */
export function useCursorPages(): CursorPages {
  const [state, setState] = useState(FIRST);
  const next = useCallback(
    (nextCursor: string) =>
      setState((s) =>
        s.cursors[s.index + 1] === nextCursor
          ? { ...s, index: s.index + 1 }
          : { cursors: [...s.cursors.slice(0, s.index + 1), nextCursor], index: s.index + 1 },
      ),
    [],
  );
  const previous = useCallback(
    () => setState((s) => (s.index > 0 ? { ...s, index: s.index - 1 } : s)),
    [],
  );
  const goTo = useCallback(
    (page: number) =>
      setState((s) => (page >= 1 && page <= s.cursors.length ? { ...s, index: page - 1 } : s)),
    [],
  );
  const reset = useCallback(() => setState(FIRST), []);
  return {
    cursor: state.cursors[state.index],
    page: state.index + 1,
    reached: state.cursors.length,
    hasPrevious: state.index > 0,
    next,
    previous,
    goTo,
    reset,
  };
}
